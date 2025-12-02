import SetupWizard from './components/SetupWizard';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Preferences } from '@capacitor/preferences';
import { JarvisService } from './services/jarvisService';
import JarvisOrb from './components/JarvisOrb';
import VisionOverlay from './components/VisionOverlay';
import HologramMode from './components/HologramMode';
import { WeatherWidget, TimerWidget, TodoWidget, AppStatusWidget, ContextWidget } from './components/Widgets';
import { LogEntry, WeatherData, Timer, TodoItem, ToolCallData, ChatMessage, UserProfile } from './types';
import { Mic, Power, Video, VideoOff, Keyboard, Radio, Terminal, Send, MessageSquare, Zap, Lock, Mail, User, ArrowRight, ShieldCheck, RefreshCw, Bell, Globe, Smartphone, CheckCircle, Chrome, Box, MessageCircle, Copy, Check } from 'lucide-react';

interface AppConfig {
  native: (cmd: string) => string;
  web: (cmd: string) => string;
}

// Configuration for deep linking and web fallbacks
const APP_LIBRARY: Record<string, AppConfig> = {
  'spotify': { native: (cmd) => cmd ? `spotify:search:${encodeURIComponent(cmd)}` : 'spotify:', web: (cmd) => `https://open.spotify.com/search/$` },
  'youtube': { native: (cmd) => cmd ? `vnd.youtube://results?search_query=${encodeURIComponent(cmd)}` : 'vnd.youtube://', web: (cmd) => `https://www.youtube.com/results?search_query=${encodeURIComponent(cmd)}` },
  'google maps': { native: (cmd) => cmd ? `geo:0,0?q=${encodeURIComponent(cmd)}` : 'geo:0,0', web: (cmd) => `https://www.google.com/maps/search/?api=1&query=$` },
  'gmail': { native: (cmd) => 'googlegmail://', web: (cmd) => 'https://mail.google.com' },
  'calculator': { native: () => 'calculator:', web: (cmd) => `https://www.google.com` },
  'phone': { native: (cmd) => `tel:${cmd}`, web: (cmd) => `https://www.google.com` },
  'messages': { native: (cmd) => `sms:${cmd}`, web: () => 'https://messages.google.com/web' },
  'whatsapp': { native: (cmd) => 'whatsapp://', web: () => 'https://web.whatsapp.com' },
  'calendar': { native: () => 'content://com.android.calendar/time/', web: () => 'https://calendar.google.com' },
  'google': { native: (cmd) => `googlechrome://www.google.com/search?q=${encodeURIComponent(cmd)}`, web: (cmd) => `https://www.google.com/search?q=${encodeURIComponent(cmd)}` },
  'instagram': { native: (cmd) => 'instagram://', web: () => 'https://www.instagram.com' },
  'twitter': { native: (cmd) => 'twitter://', web: () => 'https://twitter.com' },
  'tiktok': { native: (cmd) => 'tiktok://', web: () => 'https://www.tiktok.com' },
  'netflix': { native: (cmd) => 'nflx://', web: () => 'https://www.netflix.com' },
  'camera': { native: () => 'camera:', web: () => '' },
  'photos': { native: () => 'photos-redirect://', web: () => 'https://photos.google.com' },
  'settings': { native: () => 'App-Prefs:root', web: () => '' }
};

interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
  gapi: any;
  google: any;
}

const FormattedMessage: React.FC<{ text: string }> = ({ text }) => {
  const blocks = text.split(/(```[\s\S]*?```)/g);
  return (
    <div className="text-sm leading-relaxed">
      {blocks.map((block, index) => {
        if (block.startsWith('```') && block.endsWith('```')) {
          const content = block.slice(3, -3);
          return (
            <div key={index} className="my-3 rounded-md overflow-hidden border border-gray-700 bg-[#0d1117] shadow-sm">
               <div className="p-3 overflow-x-auto custom-scrollbar">
                  <pre className="font-mono text-xs text-gray-300 whitespace-pre">{content.trim()}</pre>
               </div>
            </div>
          );
        }
        return <span key={index}>{block}</span>;
      })}
    </div>
  );
};

const SimulatedNotification: React.FC<{ title: string; message: string; time: string; type?: 'mail' | 'whatsapp'; onClose: () => void; action?: () => void }> = ({ title, message, time, type = 'mail', onClose, action }) => {
    return (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[100] w-[90%] max-w-sm animate-slide-down cursor-pointer" onClick={() => { action?.(); onClose(); }}>
            <div className="bg-white/90 backdrop-blur-xl text-black rounded-2xl shadow-2xl p-4 border border-gray-200 relative overflow-hidden">
                <div className={`absolute bottom-0 left-0 h-1 ${type === 'whatsapp' ? 'bg-green-500' : 'bg-blue-500'} animate-[width_6s_linear_forwards] w-full`} />
                <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{title}</span>
                    </div>
                    <span className="text-[10px] text-gray-400">{time}</span>
                </div>
                <div className="pl-7">
                     <div className="font-bold text-sm">New Message</div>
                     <div className="text-sm text-gray-700 truncate">{message}</div>
                </div>
            </div>
        </div>
    );
};

const Dashboard: React.FC<{ apiKey: string; onLogout: () => void }> = ({ apiKey, onLogout }) => {
  const user = { name: "Sir", email: "admin@stark.industries", id: "001", authProvider: "system" };
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [timers, setTimers] = useState<Timer[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [activeApp, setActiveApp] = useState<string | null>(null);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [hologramMode, setHologramMode] = useState(false);
  const [hologramLibraryVisible, setHologramLibraryVisible] = useState(true);
  const [currentHologramShape, setCurrentHologramShape] = useState<string>('reactor');
  const [currentMood, setCurrentMood] = useState('NEUTRAL');
  const [contextData, setContextData] = useState({ timeOfDay: 'Day', activity: 'Idle' });
  const [isStandby, setIsStandby] = useState(true);
  const [isTypeMode, setIsTypeMode] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [notification, setNotification] = useState<any>(null);
  
  // --- MEMORY SYSTEM ---
  const [memories, setMemories] = useState<string[]>([]);
  const memoriesRef = useRef<string[]>([]); 
  // ---------------------

  const jarvisRef = useRef<JarvisService | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const thinkingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastContextUpdate = useRef<number>(0);
  const isTypeModeRef = useRef(isTypeMode);
  const wakeLockRef = useRef<any>(null);

  // 1. ROBUST LOAD MEMORIES
  useEffect(() => {
      const loadMemories = async () => {
          try {
              const { value } = await Preferences.get({ key: 'jarvis_memories' });
              if (value) {
                  try {
                      const parsed = JSON.parse(value);
                      if (Array.isArray(parsed)) {
                          setMemories(parsed);
                          memoriesRef.current = parsed;
                          addLog(`Memory Core: ${parsed.length} facts loaded.`, 'system');
                      } else {
                          // CORRUPTION DETECTED: Reset
                          console.warn("Memory corrupted (not array). Resetting.");
                          setMemories([]);
                          memoriesRef.current = [];
                          await Preferences.remove({ key: 'jarvis_memories' });
                      }
                  } catch (parseError) {
                      console.error("JSON Parse Error", parseError);
                      setMemories([]);
                      memoriesRef.current = [];
                  }
              }
          } catch (e) {
              console.error("Failed to load memories", e);
          }
      };
      loadMemories();
  }, []);

  // 2. KEEP REF SYNCED ALWAYS
  useEffect(() => {
      memoriesRef.current = memories;
  }, [memories]);

  useEffect(() => {
    isTypeModeRef.current = isTypeMode;
  }, [isTypeMode]);

  useEffect(() => {
      const checkContext = () => {
          const hour = new Date().getHours();
          let timeOfDay = 'Night';
          if (hour >= 5 && hour < 12) timeOfDay = 'Morning';
          else if (hour >= 12 && hour < 17) timeOfDay = 'Afternoon';
          else if (hour >= 17 && hour < 22) timeOfDay = 'Evening';
          setContextData(prev => ({ ...prev, timeOfDay }));
      };
      checkContext();
      const interval = setInterval(checkContext, 60000); 
      return () => clearInterval(interval);
  }, []);

  useEffect(() => {
      const requestWakeLock = async () => {
          if ('wakeLock' in navigator) {
              try {
                  wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
              } catch (err: any) {
                  console.error(`${err.name}, ${err.message}`);
              }
          }
      };
      requestWakeLock();
  }, []);

  useEffect(() => {
    if (isThinking) {
        if (thinkingTimeoutRef.current) clearTimeout(thinkingTimeoutRef.current);
        thinkingTimeoutRef.current = setTimeout(() => {
            setIsThinking(false);
            addLog("Response timed out.", "system", "error");
        }, 8000); 
    }
  }, [isThinking]);

  const addLog = useCallback((message: string, source: LogEntry['source'], type: LogEntry['type'] = 'text') => {
    setLogs(prev => [...prev, { timestamp: new Date(), source, message, type }].slice(-50));
  }, []);

  const addChatMessage = useCallback((text: string, role: 'user' | 'model' | 'system', isStreaming: boolean = false, isSystemEvent: boolean = false) => {
    setChatHistory(prev => {
        if (role === 'model' || role === 'system') setIsThinking(false);
        const lastMsg = prev[prev.length - 1];
        if (isStreaming && role === 'model' && lastMsg && lastMsg.role === 'model') {
            return [...prev.slice(0, -1), { ...lastMsg, text: lastMsg.text + text, timestamp: new Date() }];
        }
        return [...prev, { id: Math.random().toString(36).substring(7), role, text, timestamp: new Date(), isSystemEvent }];
    });
  }, []);

  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);
  useEffect(() => { if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' }); }, [chatHistory, isTypeMode, isThinking]);
  useEffect(() => { if (jarvisRef.current) jarvisRef.current.setAudioOutputEnabled(!isTypeMode); }, [isTypeMode, isConnected]);

  useEffect(() => { return; }, []);

  const handleToolCall = async (toolCall: ToolCallData): Promise<any> => {
    const { name, args } = toolCall;
    switch (name) {
      // --- FIXED & SAFE MEMORY SAVE ---
      case 'saveMemory':
          try {
              const newFact = args.fact;
              // Safe access with fallback to empty array
              const currentMemories = Array.isArray(memoriesRef.current) ? memoriesRef.current : [];
              const updatedMemories = [...currentMemories, newFact];
              
              setMemories(updatedMemories);
              memoriesRef.current = updatedMemories;
              
              await Preferences.set({ key: 'jarvis_memories', value: JSON.stringify(updatedMemories) });
              addLog(`Memory Bank Updated: "${newFact}"`, 'system', 'tool');
              return { success: true, stored: newFact };
          } catch (err) {
              console.error("Save Memory Failed", err);
              addLog("Memory Write Error. Resetting...", "system", "error");
              // Emergency Reset
              setMemories([]);
              memoriesRef.current = [];
              return { success: false, error: "Memory storage reset" };
          }
      // -------------------------
      case 'setTimer':
        setTimers(prev => [...prev, { id: Math.random().toString(), label: args.label || 'Timer', duration: args.seconds, remaining: args.seconds, status: 'running' }]);
        return { success: true };
      case 'cancelTimer':
        setTimers(prev => prev.filter(t => !args.label || !t.label.includes(args.label)));
        return { success: true };
      case 'setAlarm':
         return { success: true, time: args.time };
      case 'getWeather':
        const temp = 22; 
        setWeather({ location: args.location, temperature: temp, condition: 'Clear' });
        return { temperature: temp, condition: 'Clear', location: args.location };
      case 'changeVolume':
         jarvisRef.current?.setVolume(args.level / 100);
         return { volume: args.level };
      case 'toggleLights':
        addLog(`Smart Home: Lights ${args.state}`, 'system', 'tool');
        return { status: 'success' };
      case 'launchApp':
        const appKey = args.appName.toLowerCase();
        let matchKey = Object.keys(APP_LIBRARY).find(k => appKey.includes(k)) || 'google';
        const config = APP_LIBRARY[matchKey];
        window.location.href = config.native(args.command || '');
        setTimeout(() => window.open(config.web(args.command || ''), '_blank'), 1000);
        return { status: 'launched' };
      case 'googleSearch':
        addLog(`Searching: "${args.query}"`, 'system', 'tool');
        return { results: [{ title: `Results for ${args.query}`, snippet: `Found data.` }] };
      case 'changeHologramShape':
          setCurrentHologramShape(args.shape.toLowerCase());
          setHologramMode(true);
          return { success: true };
      case 'controlHologram':
          if (args.action === 'open_menu') setHologramLibraryVisible(true);
          return { success: true };
      case 'sendEmail':
          addLog(`Emailing ${args.recipient}`, 'system', 'tool');
          return { status: 'sent' };
      case 'sendWhatsApp':
          addLog(`Messaging ${args.phoneNumber}`, 'system', 'tool');
          return { status: 'sent' };
      case 'disengage':
         setTimeout(() => toggleConnection(false), 1000);
         return { status: "disengaging" };
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  };

  const handleMoodChange = useCallback((newMood: string) => {
      if (newMood !== currentMood) {
          setCurrentMood(newMood);
          if (isConnected && jarvisRef.current) {
              const now = Date.now();
              if (now - lastContextUpdate.current > 10000) {
                  lastContextUpdate.current = now;
                  jarvisRef.current.sendContextUpdate(`User appears ${newMood}.`);
              }
          }
      }
  }, [currentMood, isConnected, addLog]);

  const toggleConnection = async (forceState?: boolean) => {
    const targetState = forceState !== undefined ? forceState : !isConnected;
    if (!targetState) {
      await jarvisRef.current?.disconnect();
      setIsConnected(false); setIsStandby(true);
      addLog("Systems powered down.", "system");
    } else {
      setIsConnecting(true); setIsStandby(false);
      try {
          const service = new JarvisService(apiKey);
          jarvisRef.current = service;
          
          // INJECT MEMORIES INTO CONNECTION
          // Use a safe fallback if memoriesRef is weird
          const currentMemories = Array.isArray(memoriesRef.current) ? memoriesRef.current : [];
          const memoryString = currentMemories.join('\n- ');
          
          await service.connect(
              (msg, src, type, isStreaming) => {
                  if (type === 'turnComplete') { setIsThinking(false); return; }
                  if (type === 'text' && src === 'jarvis') { 
                      if (isTypeModeRef.current) addChatMessage(msg, 'model', isStreaming); 
                      if (!isStreaming) addLog(msg, src, type as any); 
                  }
                  else if (type === 'tool') { 
                      if (isTypeModeRef.current) addChatMessage(msg, 'system', false, true); 
                      addLog(msg, src, type); 
                  }
                  else { addLog(msg, src, type as any); }
              },
              handleToolCall,
              (level) => setAudioLevel(level),
              user,
              memoryString 
          );
          setIsConnected(true);
          addLog(`Voice interface engaged.`, "system");
      } catch (error) { console.error(error); addLog("Connection failed.", "system", "error"); setIsStandby(true); } finally { setIsConnecting(false); }
    }
  };

  const toggleTypeMode = () => { if (!isConnected) toggleConnection(true).then(() => setIsTypeMode(true)); else setIsTypeMode(prev => !prev); };
  const toggleVisionMode = () => { if (!isConnected) toggleConnection(true).then(() => { setVideoEnabled(true); setHologramMode(false); }); else { setVideoEnabled(prev => !prev); setHologramMode(false); } };
  const toggleHologramMode = () => { if (!isConnected) toggleConnection(true).then(() => { setHologramMode(true); setVideoEnabled(false); }); else { setHologramMode(prev => !prev); } };

  const handleTextSubmit = async (e: React.FormEvent) => {
      e.preventDefault(); if (!inputText.trim()) return;
      if (!isConnected || !jarvisRef.current) { addLog("System offline.", "system"); return; }
      addChatMessage(inputText, 'user'); 
      setIsThinking(true);
      try { await jarvisRef.current.sendText(inputText); } catch (e) { setIsThinking(false); }
      setInputText('');
  };

  return (
    <div className="min-h-screen bg-jarvis-bg text-jarvis-blue font-mono relative overflow-hidden selection:bg-jarvis-blue selection:text-jarvis-bg">
      {videoEnabled && isConnected && ( <VisionOverlay isActive={videoEnabled} onLog={(msg) => addLog(msg, 'system')} audioLevel={audioLevel} onVideoFrame={(base64) => jarvisRef.current?.sendVideoFrame(base64)} onMoodChange={handleMoodChange} /> )}
      {hologramMode && isConnected && ( <HologramMode onClose={() => setHologramMode(false)} shape={currentHologramShape} showLibrary={hologramLibraryVisible} onSelectShape={() => setHologramLibraryVisible(false)} /> )}
      {!videoEnabled && !hologramMode && ( <div className="absolute inset-0 pointer-events-none"><div className="absolute inset-0 bg-[linear-gradient(rgba(0,216,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,216,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px]" /><div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(5,5,16,0.8)_100%)]" /></div> )}

      <div className={`relative z-10 flex flex-col h-screen p-4 md:p-6 max-w-7xl mx-auto transition-opacity duration-500 ${videoEnabled || hologramMode ? 'bg-black/10' : ''}`}>
        <header className="flex justify-between items-center mb-4 border-b border-jarvis-border/30 pb-4 bg-black/20 backdrop-blur-sm rounded-lg p-2">
          <div className="flex flex-col">
            <h1 className="text-2xl md:text-3xl font-bold tracking-widest text-white shadow-black drop-shadow-md" style={{ fontFamily: 'Rajdhani' }}>J.A.R.V.I.S.</h1>
            <div className="flex items-center gap-2 text-xs text-jarvis-blue/60"><span className="w-2 h-2 bg-jarvis-blue rounded-full animate-pulse" /><span className="shadow-black drop-shadow-sm">STARK INDUSTRIES // MARK VII</span></div>
          </div>
          <div className="flex items-center gap-4">
             <div className="text-right hidden md:block"><div className="text-xs text-gray-400">AUTHORIZED PERSONNEL</div><div className="text-sm font-mono text-white">{user.name.toUpperCase()}</div></div>
             <button onClick={onLogout} className="text-xs text-red-500 hover:text-red-400 border border-red-900/30 px-2 py-1 rounded hover:bg-red-500/10 transition-colors backdrop-blur-md bg-black/40">LOGOUT</button>
             <div className={`px-3 py-1 rounded border backdrop-blur-md bg-black/40 ${isConnected ? 'border-jarvis-blue text-jarvis-blue' : 'border-red-500/50 text-red-500'}`}>{isConnected ? 'ONLINE' : 'OFFLINE'}</div>
          </div>
        </header>

        <main className="flex-1 flex flex-col md:flex-row gap-6 relative overflow-hidden min-h-0">
          <div className={`w-full md:w-1/4 flex flex-col gap-4 z-20 overflow-y-auto custom-scrollbar transition-opacity duration-300 ${videoEnabled || hologramMode ? 'opacity-60 hover:opacity-100' : 'opacity-100'}`}>
            <ContextWidget mood={currentMood} timeOfDay={contextData.timeOfDay} activity={contextData.activity} />
            <WeatherWidget data={weather} />
            <AppStatusWidget activeApp={activeApp} />
            <div className="bg-jarvis-panel border border-jarvis-border p-3 rounded-lg hidden md:block backdrop-blur-md"><div className="flex justify-between text-xs mb-1 text-gray-400"><span>CPU</span><span>{isConnected ? Math.floor(Math.random() * 30 + 10) : 0}%</span></div><div className="w-full bg-gray-800 h-1 rounded mb-3"><div className="bg-jarvis-blue h-1 rounded" style={{ width: isConnected ? '35%' : '0%' }} /></div><div className="flex justify-between text-xs mb-1 text-gray-400"><span>MEMORY</span><span>{isConnected ? '12.4 TB' : '0 TB'}</span></div><div className="w-full bg-gray-800 h-1 rounded"><div className="bg-purple-500 h-1 rounded" style={{ width: isConnected ? '62%' : '0%' }} /></div></div>
          </div>

          <div className="w-full md:w-1/2 flex flex-col relative min-h-[300px] h-full pointer-events-none">
             {isTypeMode ? (
                 <div className="flex flex-col h-full bg-black/40 rounded-lg border border-jarvis-border/30 backdrop-blur-md overflow-hidden animate-fade-in pointer-events-auto">
                     <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                        {chatHistory.map((msg) => (
                           <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} ${msg.isSystemEvent ? 'justify-center' : ''}`}>
                              {msg.isSystemEvent ? (
                                  <div className="flex items-center gap-1.5 bg-jarvis-blue/10 border border-jarvis-blue/20 rounded-full px-3 py-1">
                                      <Zap className="w-3 h-3 text-yellow-400" />
                                      <span className="text-[10px] uppercase tracking-wider text-cyan-200">{msg.text.replace('Executing protocol:', '').trim()}</span>
                                  </div>
                              ) : (
                                  <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm shadow-md ${msg.role === 'user' ? 'bg-jarvis-blue/20 text-cyan-50 border border-jarvis-blue/30 rounded-tr-none' : 'bg-gray-800/90 text-gray-100 border border-gray-700 rounded-tl-none'}`}>
                                      <FormattedMessage text={msg.text} />
                                  </div>
                              )}
                           </div>
                        ))}
                        <div ref={chatEndRef} />
                     </div>
                     <div className="p-3 bg-black/60 border-t border-jarvis-border/30"><form onSubmit={handleTextSubmit} className="flex gap-2"><input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Type command..." className="flex-1 bg-black/40 border border-jarvis-blue/30 text-white font-mono text-sm p-3 rounded" /><button type="submit" disabled={!inputText.trim()} className="bg-jarvis-blue/10 text-jarvis-blue border border-jarvis-blue/30 p-3 rounded"><Send className="w-4 h-4" /></button></form></div>
                 </div>
             ) : (
                 !videoEnabled && !hologramMode && (<div className="flex flex-col items-center justify-center h-full pointer-events-auto"><JarvisOrb isActive={isConnected} audioLevel={audioLevel} /><div className="absolute bottom-4 text-center transition-opacity duration-500">{isConnecting ? (<span className="text-jarvis-blue animate-pulse">INITIALIZING CONNECTION...</span>) : isStandby ? (<span className="text-gray-600">LISTENING FOR 'JARVIS'</span>) : (<span className="text-jarvis-blue tracking-widest text-sm animate-pulse-slow">LISTENING ON CHANNEL SECURE</span>)}</div></div>)
             )}
          </div>

          <div className={`w-full md:w-1/4 flex flex-col gap-4 z-20 overflow-y-auto custom-scrollbar transition-opacity duration-300 ${videoEnabled || hologramMode ? 'opacity-60 hover:opacity-100' : 'opacity-100'}`}>
            <TimerWidget timers={timers} onCancel={handleCancelTimer} />
            <TodoWidget todos={todos} />
          </div>
        </main>

        <footer className="mt-4 flex flex-col md:flex-row gap-4 items-stretch h-48 md:h-40 flex-shrink-0 z-20">
           <div className="flex-1 bg-black/60 border border-jarvis-border/30 rounded-lg p-3 font-mono text-xs overflow-y-auto custom-scrollbar relative backdrop-blur-md">
              <div className="sticky top-0 bg-black/80 backdrop-blur w-full pb-2 mb-2 border-b border-white/10 flex items-center gap-2"><Terminal className="w-3 h-3 text-jarvis-blue" /><span className="text-gray-400">SYSTEM OPERATIONS LOG</span></div>
              <div className="space-y-1">{logs.map((log, i) => (<div key={i} className={`flex gap-2 ${log.type === 'error' ? 'text-red-400' : log.source === 'user' ? 'text-white' : 'text-cyan-300'}`}><span className="text-gray-600">[{log.timestamp.toLocaleTimeString()}]</span><span className="uppercase opacity-70 w-16 text-[10px] tracking-wider">{log.source}</span><span>{log.message}</span></div>))}<div ref={logsEndRef} /></div>
           </div>

           <div className="w-full md:w-auto flex md:flex-col gap-2 justify-center min-w-[120px]">
              <button onClick={() => toggleConnection()} disabled={isConnecting || apiKeyMissing} className={`flex-1 md:flex-auto flex items-center justify-center gap-2 p-4 rounded-lg border transition-all duration-300 hover:scale-[1.02] active:scale-95 backdrop-blur-md ${isConnected ? 'bg-red-500/10 border-red-500 text-red-500 hover:bg-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-jarvis-blue/10 border-jarvis-blue text-jarvis-blue hover:bg-jarvis-blue/20 shadow-[0_0_15px_rgba(0,216,255,0.3)]'} disabled:opacity-50 disabled:cursor-not-allowed`}>{isConnecting ? (<div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />) : (isConnected ? <Power className="w-6 h-6" /> : <Mic className="w-6 h-6" />)}<span className="font-bold">{isConnected ? 'DISENGAGE' : 'INITIALIZE'}</span></button>
              <div className="flex gap-2 h-12">
                  <button onClick={toggleVisionMode} disabled={!isConnected} className={`flex-1 flex items-center justify-center rounded border transition-colors backdrop-blur-md ${videoEnabled ? 'bg-jarvis-blue text-black border-jarvis-blue shadow-[0_0_10px_rgba(0,216,255,0.4)]' : 'bg-black/40 border-gray-700 text-gray-500 hover:border-jarvis-blue hover:text-jarvis-blue'}`} title="Toggle Visual Sensors (AR)">{videoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}</button>
                  <button onClick={toggleHologramMode} disabled={!isConnected} className={`flex-1 flex items-center justify-center rounded border transition-colors backdrop-blur-md ${hologramMode ? 'bg-jarvis-blue text-black border-jarvis-blue shadow-[0_0_10px_rgba(0,216,255,0.4)]' : 'bg-black/40 border-gray-700 text-gray-500 hover:border-jarvis-blue hover:text-jarvis-blue'}`} title="Holographic Interface"><Box className="w-4 h-4" /></button>
                  <button onClick={toggleTypeMode} className={`flex-1 flex items-center justify-center rounded border transition-colors backdrop-blur-md ${isTypeMode ? 'bg-jarvis-blue text-black border-jarvis-blue shadow-[0_0_10px_rgba(0,216,255,0.4)]' : 'bg-black/40 border-gray-700 text-gray-500 hover:border-white hover:text-white'}`} title={isTypeMode ? "Switch to Voice Mode" : "Switch to Type Mode"}><Keyboard className="w-4 h-4" /></button>
              </div>
           </div>
        </footer>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    const loadKey = async () => {
      try {
        const { value } = await Preferences.get({ key: 'jarvis_api_key' });
        if (value) {
          setApiKey(value);
          setShowWelcome(true);
        }
      } catch (error) {
        console.error("Storage failed:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadKey();
  }, []);

  const handleSetupComplete = (key: string) => {
    setApiKey(key);
    setShowWelcome(true);
  };

  const handleLogout = async () => {
    await Preferences.remove({ key: 'jarvis_api_key' });
    setApiKey(null);
  };

  if (isLoading) {
    return <div className="min-h-screen bg-[#050510] flex items-center justify-center text-jarvis-blue animate-pulse">INITIALIZING SYSTEMS...</div>;
  }

  if (!apiKey) {
    return <SetupWizard onComplete={handleSetupComplete} />;
  }

  if (showWelcome) {
    return (
      <WelcomeAnimation
        userName="Commander"
        onComplete={() => setShowWelcome(false)}
      />
    );
  }

  return <Dashboard apiKey={apiKey} onLogout={handleLogout} />;
};

export default App;