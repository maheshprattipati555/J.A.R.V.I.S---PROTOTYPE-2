
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createPcmBlob, decodeAudioData, base64ToUint8Array } from '../utils/audioUtils';
import { TOOLS, JARVIS_SYSTEM_INSTRUCTION, AUDIO_SAMPLE_RATE, INPUT_SAMPLE_RATE } from '../constants';
import { ToolCallData, UserProfile } from '../types';

type AudioCallback = (level: number) => void;
// Updated LogCallback to include 'turnComplete'
type LogCallback = (message: string, source: 'user' | 'jarvis' | 'system', type?: 'text' | 'tool' | 'error' | 'turnComplete', isStreaming?: boolean) => void;
type ToolCallback = (toolCall: ToolCallData) => Promise<any>;

export class JarvisService {
  private ai: GoogleGenAI;
  private session: any = null;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private outputNode: GainNode | null = null;
  private nextStartTime: number = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private currentVolume: number = 1.0;
  private isAudioOutputEnabled: boolean = true;
  
  // Stored Callback
  private onLog: LogCallback = () => {};

  // Transcription State
  private currentModelTranscription: string = '';

  // Visualizer Hooks
  public inputAnalyser: AnalyserNode | null = null;
  public outputAnalyser: AnalyserNode | null = null;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async connect(
    onLog: LogCallback, 
    onToolCall: ToolCallback,
    onAudioLevel: AudioCallback,
    userProfile?: UserProfile
  ) {
    this.onLog = onLog; // Store for global use in class

    try {
      this.onLog("Initializing audio systems...", "system");
      
      // 1. Setup Audio Contexts
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ 
        sampleRate: INPUT_SAMPLE_RATE 
      });
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ 
        sampleRate: AUDIO_SAMPLE_RATE 
      });

      // 2. Setup Analysers for Visualizer
      this.inputAnalyser = this.inputAudioContext.createAnalyser();
      this.inputAnalyser.fftSize = 256;
      this.outputAnalyser = this.outputAudioContext.createAnalyser();
      this.outputAnalyser.fftSize = 256;

      this.outputNode = this.outputAudioContext.createGain();
      this.outputNode.gain.value = this.currentVolume; // Set initial volume
      this.outputNode.connect(this.outputAnalyser);
      this.outputAnalyser.connect(this.outputAudioContext.destination);

      // 3. Get Microphone
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });

      // 4. Connect to Gemini Live
      this.onLog("Connecting to Gemini Live API...", "system");
      
      const instruction = userProfile 
        ? `${JARVIS_SYSTEM_INSTRUCTION}\n\nUSER PROFILE:\nName: ${userProfile.name}\nEmail: ${userProfile.email}\nAddress the user by their name.` 
        : JARVIS_SYSTEM_INSTRUCTION;

      const config = {
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } },
          },
          outputAudioTranscription: {}, // Enable output transcription
          inputAudioTranscription: {},  // Enable input transcription for better context
          systemInstruction: instruction,
          tools: [{ functionDeclarations: TOOLS }],
        },
      };

      const callbacks = {
        onopen: () => {
          this.onLog("Connection established. J.A.R.V.I.S. is online.", "system");
          this.startAudioInputStream(stream);
        },
        onmessage: async (message: LiveServerMessage) => {
            // Handle Audio
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && this.isAudioOutputEnabled) {
                this.handleAudioOutput(base64Audio);
            }

            // Handle Text Response (Streaming)
            let newText = '';
            
            // 1. Check Output Transcription (Primary Source for Live API)
            const transcription = message.serverContent?.outputTranscription?.text;
            if (transcription) {
                newText = transcription;
            }
            // 2. Check Model Turn Text (Fallback or specific text responses)
            else {
                const directText = message.serverContent?.modelTurn?.parts?.[0]?.text;
                if (directText) {
                    newText = directText;
                }
            }

            if (newText) {
                this.currentModelTranscription += newText;
                // Stream partial text to UI immediately
                this.onLog(newText, "jarvis", "text", true); 
            }

            // Handle Turn Complete
            if (message.serverContent?.turnComplete) {
                if (this.currentModelTranscription.trim()) {
                    this.currentModelTranscription = '';
                }
                // Signal that the turn is complete (stops loading animation)
                this.onLog("", "jarvis", "turnComplete");
            }

            // Handle Tool Calls
            if (message.toolCall) {
                for (const fc of message.toolCall.functionCalls) {
                    this.onLog(`Executing protocol: ${fc.name}`, "jarvis", "tool");
                    try {
                        const result = await onToolCall({
                            id: fc.id,
                            name: fc.name,
                            args: fc.args
                        });
                        
                        this.session.sendToolResponse({
                            functionResponses: {
                                id: fc.id,
                                name: fc.name,
                                response: { result }
                            }
                        });
                    } catch (e) {
                        this.onLog(`Error executing ${fc.name}`, "system", "error");
                        this.session.sendToolResponse({
                            functionResponses: {
                                id: fc.id,
                                name: fc.name,
                                response: { error: String(e) }
                            }
                        });
                    }
                }
            }
            
            // Handle Interruption
            if (message.serverContent?.interrupted) {
                this.onLog("Interrupted.", "system");
                this.stopAudioOutput();
                this.currentModelTranscription = '';
                this.onLog("", "jarvis", "turnComplete"); // Clear loading state on interrupt
            }
        },
        onerror: (e: ErrorEvent) => {
            console.error(e);
            this.onLog("Connection error occurred.", "system", "error");
        },
        onclose: (e: CloseEvent) => {
            this.onLog("Connection closed.", "system");
        }
      };

      const sessionPromise = this.ai.live.connect({ ...config, callbacks });
      this.session = await sessionPromise;
      this.startVisualizerLoop(onAudioLevel);

    } catch (error) {
      this.onLog(`Initialization failed: ${error instanceof Error ? error.message : String(error)}`, "system", "error");
      throw error;
    }
  }

  public setVolume(level: number) {
      this.currentVolume = Math.max(0, Math.min(1, level));
      if (this.outputNode) {
          this.outputNode.gain.value = this.currentVolume;
      }
  }

  public setAudioOutputEnabled(enabled: boolean) {
      this.isAudioOutputEnabled = enabled;
      if (!enabled) {
          this.stopAudioOutput();
      }
  }

  public async sendText(text: string) {
      if (this.session) {
          try {
            console.debug("Sending text to model:", text);
            await this.session.sendRealtimeInput({
                clientContent: {
                    turns: [{
                        role: 'user',
                        parts: [{ text }]
                    }],
                    turnComplete: true
                }
            });
            // Don't log "sent" here, let UI show thinking state
          } catch (e) {
              this.onLog(`Failed to send text: ${e}`, "system", "error");
              // Emit error so UI knows to stop thinking
              this.onLog("", "jarvis", "turnComplete");
          }
      } else {
          this.onLog("Session not active. Cannot send text.", "system", "error");
          this.onLog("", "jarvis", "turnComplete");
      }
  }

  public async sendContextUpdate(context: string) {
    if (this.session) {
        // Send as a system event message that shouldn't necessarily be spoken aloud,
        // but informs the model's context.
        await this.sendText(`[SYSTEM EVENT: ${context}]`);
    }
  }

  private startAudioInputStream(stream: MediaStream) {
    if (!this.inputAudioContext || !this.inputAnalyser) return;

    this.inputSource = this.inputAudioContext.createMediaStreamSource(stream);
    this.inputSource.connect(this.inputAnalyser);
    
    this.processor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);
    
    this.processor.onaudioprocess = (e) => {
        // Only send audio if NOT in text mode (i.e. audio output enabled)
        // This prevents mic feedback loop and unnecessary token usage in Type Mode
        if (!this.isAudioOutputEnabled) return;

        const inputData = e.inputBuffer.getChannelData(0);
        const pcmBlob = createPcmBlob(inputData, INPUT_SAMPLE_RATE);
        
        if (this.session) {
            this.session.sendRealtimeInput({ media: pcmBlob });
        }
    };

    this.inputAnalyser.connect(this.processor);
    this.processor.connect(this.inputAudioContext.destination);
  }

  private async handleAudioOutput(base64Audio: string) {
    if (!this.outputAudioContext || !this.outputNode || !this.isAudioOutputEnabled) return;

    try {
        this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
        
        const audioBytes = base64ToUint8Array(base64Audio);
        const audioBuffer = await decodeAudioData(audioBytes, this.outputAudioContext, AUDIO_SAMPLE_RATE);
        
        const source = this.outputAudioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.outputNode);
        
        source.addEventListener('ended', () => {
            this.sources.delete(source);
        });

        source.start(this.nextStartTime);
        this.nextStartTime += audioBuffer.duration;
        this.sources.add(source);
    } catch (err) {
        console.error("Error decoding audio", err);
    }
  }

  private stopAudioOutput() {
    this.sources.forEach(source => {
        try { source.stop(); } catch (e) {}
    });
    this.sources.clear();
    this.nextStartTime = this.outputAudioContext?.currentTime || 0;
  }

  private startVisualizerLoop(cb: AudioCallback) {
    const update = () => {
        if (!this.outputAnalyser || !this.inputAnalyser) return;
        
        const dataArrayOut = new Uint8Array(this.outputAnalyser.frequencyBinCount);
        this.outputAnalyser.getByteFrequencyData(dataArrayOut);
        
        const dataArrayIn = new Uint8Array(this.inputAnalyser.frequencyBinCount);
        this.inputAnalyser.getByteFrequencyData(dataArrayIn);

        let sum = 0;
        for(let i = 0; i < dataArrayOut.length; i++) {
            sum += (dataArrayOut[i] * 1.2) + (dataArrayIn[i] * 0.8);
        }
        
        const average = sum / (dataArrayOut.length * 2);
        cb(average);
        
        if (this.session) {
            requestAnimationFrame(update);
        }
    };
    update();
  }

  async disconnect() {
    this.inputSource?.disconnect();
    this.processor?.disconnect();
    
    if (this.inputAudioContext?.state !== 'closed') await this.inputAudioContext?.close();
    if (this.outputAudioContext?.state !== 'closed') await this.outputAudioContext?.close();
    
    this.session = null;
    this.inputAudioContext = null;
    this.outputAudioContext = null;
    this.inputSource = null;
    this.processor = null;
  }

  async sendVideoFrame(base64Image: string) {
    if (this.session) {
        this.session.sendRealtimeInput({
            media: {
                mimeType: 'image/jpeg',
                data: base64Image
            }
        });
    }
  }
}
