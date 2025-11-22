
import React, { useEffect, useRef, useState } from 'react';
import { Scan, Eye, AlertTriangle, HeartPulse } from 'lucide-react';
import JarvisOrb from './JarvisOrb';

declare global {
  interface Window {
    FaceMesh: any;
  }
}

interface VisionOverlayProps {
  isActive: boolean;
  onLog: (msg: string) => void;
  audioLevel: number;
  onVideoFrame?: (base64Image: string) => void;
  onMoodChange?: (mood: string) => void;
}

// MediaPipe FaceMesh Indices
const LEFT_EYE = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const RIGHT_EYE = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];

const VisionOverlay: React.FC<VisionOverlayProps> = ({ isActive, onLog, audioLevel, onVideoFrame, onMoodChange }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trackingData, setTrackingData] = useState<{
    found: boolean;
    label: string;
    mood: string;
  }>({ found: false, label: 'SCANNING...', mood: 'NEUTRAL' });

  // Refs for Loop Management & Data (Avoids React State in high-freq loop)
  const requestRef = useRef<number>(0);
  const isMounted = useRef<boolean>(false);
  const landmarksRef = useRef<any>(null);
  const faceMeshRef = useRef<any>(null);
  const isProcessingRef = useRef<boolean>(false); // Mutex for WASM calls
  const trackingDataRef = useRef({ found: false, mood: 'NEUTRAL' }); 
  const lastFrameTime = useRef<number>(0);
  const moodDebounceRef = useRef<number>(0);

  useEffect(() => {
    isMounted.current = true;
    let stream: MediaStream | null = null;

    // --- HELPERS ---
    const calculateMood = (landmarks: any[]) => {
        // Simple geometric heuristics for emotion
        // Top Lip: 13, Bottom Lip: 14
        // Mouth Left: 61, Mouth Right: 291
        // Eyebrow Left: 105, Eyebrow Right: 334
        
        const upperLip = landmarks[13];
        const lowerLip = landmarks[14];
        const leftCorner = landmarks[61];
        const rightCorner = landmarks[291];

        // Normalized coordinates (y is down)
        const mouthCenterY = (upperLip.y + lowerLip.y) / 2;
        const mouthCornersY = (leftCorner.y + rightCorner.y) / 2;
        const mouthHeight = Math.abs(upperLip.y - lowerLip.y);
        
        // Smile: Corners are HIGHER (smaller Y) than center
        // Frown: Corners are LOWER (larger Y) than center
        
        const smileFactor = mouthCenterY - mouthCornersY; // Positive = Smile
        
        if (mouthHeight > 0.05) return 'SURPRISED'; // Open mouth (approx)
        if (smileFactor > 0.01) return 'HAPPY';
        if (smileFactor < -0.01) return 'SAD';
        
        return 'NEUTRAL';
    };

    const getBox = (landmarks: any[], indices: number[], width: number, height: number) => {
        let minX = 1, minY = 1, maxX = 0, maxY = 0;
        indices.forEach(idx => {
            const p = landmarks[idx];
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        });
        
        return {
            x: (1 - maxX) * width, 
            y: minY * height,
            w: (maxX - minX) * width,
            h: (maxY - minY) * height
        };
    };

    const drawEyeTarget = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, label: string) => {
        const padding = 10;
        const rx = x - padding;
        const ry = y - padding;
        const rw = w + padding * 2;
        const rh = h + padding * 2;
        const cx = rx + rw/2;
        const cy = ry + rh/2;

        ctx.strokeStyle = '#00d8ff';
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 5;
        ctx.shadowColor = 'rgba(0, 216, 255, 0.5)';

        // 1. Brackets (Iron Man Style)
        const len = Math.min(rw, rh) * 0.3;
        
        ctx.beginPath(); ctx.moveTo(rx, ry + len); ctx.lineTo(rx, ry); ctx.lineTo(rx + len, ry); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(rx + rw - len, ry); ctx.lineTo(rx + rw, ry); ctx.lineTo(rx + rw, ry + len); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(rx + rw, ry + rh - len); ctx.lineTo(rx + rw, ry + rh); ctx.lineTo(rx + rw - len, ry + rh); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(rx + len, ry + rh); ctx.lineTo(rx, ry + rh); ctx.lineTo(rx, ry + rh - len); ctx.stroke();

        // 2. Rotating Ring
        const time = Date.now() / 800;
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(rw, rh) * 0.6, time, time + Math.PI * 1.5);
        ctx.strokeStyle = 'rgba(0, 216, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.font = '10px "Rajdhani", sans-serif';
        ctx.fillStyle = '#00d8ff';
        ctx.textAlign = 'left';
        ctx.fillText(label, rx, ry - 6);
    };

    const drawScanning = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
        const time = Date.now() / 1000;
        const scanY = (Math.sin(time) * 0.5 + 0.5) * h;
        
        ctx.beginPath();
        ctx.moveTo(0, scanY);
        ctx.lineTo(w, scanY);
        ctx.strokeStyle = 'rgba(0, 216, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = 'rgba(0, 216, 255, 0.05)';
        ctx.fillRect(0, 0, w, scanY);
    };

    // --- MAIN LOOP ---
    const loop = () => {
        if (!isMounted.current) return;
        
        const video = videoRef.current;
        const canvas = canvasRef.current;
        
        if (video && video.readyState >= 2 && canvas) {
             const ctx = canvas.getContext('2d');
             if (ctx) {
                // 1. Draw Video Feed (Mirrored)
                ctx.save();
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                ctx.restore();

                // 2. Draw HUD Overlays
                if (landmarksRef.current) {
                    const landmarks = landmarksRef.current;
                    
                    // Mood Detection
                    const mood = calculateMood(landmarks);
                    if (mood !== trackingDataRef.current.mood) {
                        // Debounce mood changes (1s)
                        if (Date.now() - moodDebounceRef.current > 1000) {
                            trackingDataRef.current.mood = mood;
                            moodDebounceRef.current = Date.now();
                            // Update UI
                            setTrackingData(prev => ({ ...prev, mood }));
                            // Notify Parent
                            if (onMoodChange) onMoodChange(mood);
                        }
                    }

                    const lBox = getBox(landmarks, LEFT_EYE, canvas.width, canvas.height);
                    const rBox = getBox(landmarks, RIGHT_EYE, canvas.width, canvas.height);

                    // Draw Boxes
                    drawEyeTarget(ctx, lBox.x, lBox.y, lBox.w, lBox.h, "L_OCULAR");
                    drawEyeTarget(ctx, rBox.x, rBox.y, rBox.w, rBox.h, "R_OCULAR");

                    // Connect Eyes
                    const lcx = lBox.x + lBox.w/2;
                    const lcy = lBox.y + lBox.h/2;
                    const rcx = rBox.x + rBox.w/2;
                    const rcy = rBox.y + rBox.h/2;

                    ctx.beginPath();
                    ctx.moveTo(lcx, lcy);
                    ctx.lineTo(rcx, rcy);
                    ctx.strokeStyle = 'rgba(0, 216, 255, 0.2)';
                    ctx.setLineDash([2, 2]);
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    ctx.setLineDash([]);

                    // Draw Central Connection to Orb (Bottom)
                    const orbX = canvas.width / 2;
                    const orbY = canvas.height - 80;
                    const midX = (lcx + rcx) / 2;
                    const midY = (lcy + rcy) / 2;

                    ctx.beginPath();
                    ctx.moveTo(midX, midY + 20); // Start a bit below eyes
                    ctx.lineTo(orbX, orbY - 50);
                    ctx.strokeStyle = 'rgba(0, 216, 255, 0.1)';
                    ctx.setLineDash([10, 20]);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    
                    // Draw Emotion Label near Face
                    ctx.font = 'bold 12px "Rajdhani"';
                    ctx.fillStyle = mood === 'SAD' ? '#ff9900' : mood === 'HAPPY' ? '#00ff99' : '#00d8ff';
                    ctx.fillText(`EMOTION: ${mood}`, midX + 40, midY - 20);

                } else {
                    // Scanning Mode
                    drawScanning(ctx, canvas.width, canvas.height);
                }
             }

             // 3. Send to Gemini (Throttled)
             const now = Date.now();
             if (onVideoFrame && (now - lastFrameTime.current > 500)) {
                 lastFrameTime.current = now;
                 const aiCanvas = document.createElement('canvas');
                 aiCanvas.width = 640;
                 aiCanvas.height = 360;
                 const aiCtx = aiCanvas.getContext('2d');
                 if (aiCtx) {
                     aiCtx.drawImage(video, 0, 0, aiCanvas.width, aiCanvas.height);
                     const base64 = aiCanvas.toDataURL('image/jpeg', 0.6).split(',')[1];
                     onVideoFrame(base64);
                 }
             }

             // 4. Send to FaceMesh (Serialized)
             if (faceMeshRef.current && !isProcessingRef.current) {
                 isProcessingRef.current = true;
                 faceMeshRef.current.send({image: video})
                    .then(() => {
                        if (isMounted.current) isProcessingRef.current = false;
                    })
                    .catch((e: any) => {
                        console.warn("FaceMesh dropped frame:", e);
                        if (isMounted.current) isProcessingRef.current = false;
                    });
             }
        }
        
        requestRef.current = requestAnimationFrame(loop);
    };

    const onResults = (results: any) => {
        if (!isMounted.current) return;
        
        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            landmarksRef.current = results.multiFaceLandmarks[0];
            
            if (!trackingDataRef.current.found) {
                trackingDataRef.current.found = true;
                setTrackingData(prev => ({ ...prev, found: true, label: 'TARGET ACQUIRED' }));
            }
        } else {
            landmarksRef.current = null;
            if (trackingDataRef.current.found) {
                trackingDataRef.current.found = false;
                setTrackingData(prev => ({ ...prev, found: false, label: 'SCANNING...', mood: 'NEUTRAL' }));
            }
        }
    };

    const initVision = async () => {
      try {
        setIsLoading(true);
        
        if (!window.FaceMesh) {
             throw new Error("Vision libraries not loaded.");
        }

        const faceMesh = new window.FaceMesh({locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/${file}`;
        }});

        faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });
        faceMesh.onResults(onResults);
        faceMeshRef.current = faceMesh;

        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 1280 }, 
                height: { ideal: 720 },
                facingMode: 'user' 
            } 
        });
        
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = () => {
                setIsLoading(false);
                if (videoRef.current) {
                    videoRef.current.play().catch(e => console.error("Play error", e));
                    requestRef.current = requestAnimationFrame(loop);
                }
            };
        }

      } catch (e) {
        console.error(e);
        setError("Vision sensors offline.");
        setIsLoading(false);
      }
    };

    if (isActive) {
        initVision();
    }

    return () => {
        isMounted.current = false;
        cancelAnimationFrame(requestRef.current);
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        if (faceMeshRef.current) {
            faceMeshRef.current.close();
        }
    };
  }, [isActive, onMoodChange]);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden bg-black">
      <video ref={videoRef} className="absolute opacity-0 pointer-events-none" playsInline muted width="1280" height="720" />
      <canvas ref={canvasRef} width={1280} height={720} className="absolute inset-0 w-full h-full object-cover opacity-90" />

      {/* Status Overlay */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 flex flex-col items-center z-10 gap-2">
          {isLoading ? (
              <div className="flex items-center gap-2 text-jarvis-blue animate-pulse">
                  <Scan className="w-5 h-5 animate-spin-slow" />
                  <span className="font-mono text-xs tracking-widest">INITIALIZING VISION PROTOCOLS...</span>
              </div>
          ) : error ? (
               <div className="flex items-center gap-2 text-red-500 bg-black/50 px-4 py-2 rounded border border-red-500/30">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="font-mono text-xs">{error}</span>
              </div>
          ) : (
              <>
                {/* Tracking Status */}
                <div className={`flex items-center gap-2 px-4 py-1 rounded border backdrop-blur-sm transition-colors duration-500 ${trackingData.found ? 'border-jarvis-blue bg-jarvis-blue/10' : 'border-gray-700 bg-black/40'}`}>
                    <Eye className={`w-4 h-4 ${trackingData.found ? 'text-jarvis-blue' : 'text-gray-500'}`} />
                    <span className={`font-mono text-xs tracking-widest ${trackingData.found ? 'text-jarvis-blue' : 'text-gray-500'}`}>{trackingData.label}</span>
                </div>

                {/* Biometric Analysis (Mood) */}
                {trackingData.found && (
                     <div className="flex items-center gap-2 px-4 py-1 rounded border border-jarvis-blue/50 bg-jarvis-panel backdrop-blur-sm animate-fade-in">
                        <HeartPulse className="w-4 h-4 text-red-400 animate-pulse" />
                        <span className="font-mono text-xs tracking-widest text-cyan-100">
                            ANALYSIS: {trackingData.mood}
                        </span>
                    </div>
                )}
              </>
          )}
      </div>
      
      {/* Jarvis Core Overlay */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 pointer-events-none opacity-80">
           <div className="transform scale-75 md:scale-100">
               <JarvisOrb isActive={isActive} audioLevel={audioLevel} />
           </div>
      </div>
      
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,black_100%)] pointer-events-none" />
    </div>
  );
};

export default VisionOverlay;
