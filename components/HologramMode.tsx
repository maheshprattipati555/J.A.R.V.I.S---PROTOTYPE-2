
import React, { useEffect, useRef, useState } from 'react';
import { X, Box, Hand, Move, Maximize, Grid, Search, Globe, Activity, Circle, Triangle, Database, Layers, ChevronRight } from 'lucide-react';

declare global {
  interface Window {
    Hands: any;
    THREE: any;
  }
}

interface HologramModeProps {
  onClose: () => void;
  shape: string;
  showLibrary: boolean;
  onSelectShape: () => void;
}

// Available Shapes Definition
const SHAPE_LIBRARY = [
    { id: 'reactor', name: 'Arc Reactor', icon: Activity },
    { id: 'cube', name: 'Tesseract Cube', icon: Box },
    { id: 'sphere', name: 'Energy Sphere', icon: Circle },
    { id: 'pyramid', name: 'Pyramid', icon: Triangle },
    { id: 'torus', name: 'Torus Ring', icon: Circle },
    { id: 'knot', name: 'Quantum Knot', icon: Activity },
    { id: 'helix', name: 'DNA Helix', icon: Activity },
    { id: 'earth', name: 'Planetary Model', icon: Globe },
    { id: 'cylinder', name: 'Data Cylinder', icon: Database },
    { id: 'cone', name: 'Focus Cone', icon: Triangle },
];

const HologramMode: React.FC<HologramModeProps> = ({ onClose, shape, showLibrary, onSelectShape }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); 
  const threeCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const [status, setStatus] = useState('INITIALIZING ENGINE...');
  const [interactionMode, setInteractionMode] = useState<'NONE' | 'MOVE' | 'EDIT'>('NONE');
  const [activeShape, setActiveShape] = useState(shape);
  const [searchQuery, setSearchQuery] = useState('');

  // Refs for loop management
  const requestRef = useRef<number>(0);
  const handsRef = useRef<any>(null);
  const sceneRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const objectRef = useRef<any>(null);
  const materialsRef = useRef<{wire: any, solid: any, core: any} | null>(null);
  const isMounted = useRef(true);
  const isProcessingRef = useRef(false);
  
  // --- INTERACTION STATE ---
  const currentHandDataRef = useRef<{
      p1: {x: number, y: number} | null;
      roll: number;
      isFist: boolean;
      isPinch: boolean;
  }>({ p1: null, roll: 0, isFist: false, isPinch: false });

  const gestureStateRef = useRef<{
      active: boolean;
      mode: 'NONE' | 'MOVE' | 'EDIT';
      startP1: {x: number, y: number} | null;
      startRoll: number;
      startObjPos: {x: number, y: number, z: number};
      startObjScale: {x: number, y: number, z: number};
      startObjRot: {x: number, y: number, z: number};
  }>({
      active: false,
      mode: 'NONE',
      startP1: null,
      startRoll: 0,
      startObjPos: {x:0,y:0,z:0},
      startObjScale: {x:1,y:1,z:1},
      startObjRot: {x:0,y:0,z:0}
  });

  // Sync with prop changes from voice commands
  useEffect(() => {
      setActiveShape(shape);
  }, [shape]);

  // Update 3D model when active shape changes
  useEffect(() => {
      updateGeometry(activeShape);
  }, [activeShape]);

  const updateGeometry = (type: string) => {
      if (!window.THREE || !objectRef.current || !sceneRef.current) return;

      const oldMesh = objectRef.current;
      sceneRef.current.remove(oldMesh);
      
      // Clean up
      oldMesh.children.forEach((c: any) => {
          if(c.geometry) c.geometry.dispose();
          if(c.material) c.material.dispose();
      });
      if (oldMesh.geometry) oldMesh.geometry.dispose();

      const group = new window.THREE.Group();
      let geometry;
      
      // Material Settings - stored in ref for updates
      const wireMat = new window.THREE.LineBasicMaterial({ 
          color: 0x00d8ff, linewidth: 2, transparent: true, opacity: 0.8 
      });
      const solidMat = new window.THREE.MeshPhongMaterial({
          color: 0x00d8ff, wireframe: false, transparent: true, opacity: 0.15, side: window.THREE.DoubleSide
      });
      const coreMat = new window.THREE.MeshBasicMaterial({ 
          color: 0xffffff, transparent: true, opacity: 0.9 
      });
      
      materialsRef.current = { wire: wireMat, solid: solidMat, core: coreMat };

      switch(type.toLowerCase()) {
          case 'cube': geometry = new window.THREE.BoxGeometry(1, 1, 1); break;
          case 'sphere': geometry = new window.THREE.SphereGeometry(0.7, 24, 24); break;
          case 'earth': geometry = new window.THREE.IcosahedronGeometry(0.8, 3); break;
          case 'pyramid': geometry = new window.THREE.ConeGeometry(0.7, 1.2, 4); break;
          case 'cone': geometry = new window.THREE.ConeGeometry(0.6, 1.2, 24); break;
          case 'cylinder': geometry = new window.THREE.CylinderGeometry(0.5, 0.5, 1.2, 24); break;
          case 'torus': geometry = new window.THREE.TorusGeometry(0.5, 0.2, 24, 50); break;
          case 'knot': geometry = new window.THREE.TorusKnotGeometry(0.4, 0.15, 100, 16); break;
          case 'helix': 
              const points = [];
              for ( let i = 0; i < 100; i ++ ) {
                  const t = i * 0.2;
                  points.push( new window.THREE.Vector3( Math.cos( t ) * 0.4, ( i * 0.02 ) - 1, Math.sin( t ) * 0.4 ) );
              }
              const spline = new window.THREE.CatmullRomCurve3( points );
              geometry = new window.THREE.TubeGeometry( spline, 64, 0.05, 8, false );
              break;
          case 'reactor': 
          default: geometry = new window.THREE.IcosahedronGeometry(0.8, 1); break;
      }

      // 1. Create Wireframe Mesh
      const wireframe = new window.THREE.WireframeGeometry(geometry);
      const mesh = new window.THREE.LineSegments(wireframe, wireMat);
      group.add(mesh);

      // 2. Create Inner Solid Ghost
      if (type !== 'helix') {
          const solid = new window.THREE.Mesh(geometry, solidMat);
          solid.scale.setScalar(0.96);
          group.add(solid);
      }

      // 3. Core Effect (Glowing Center)
      const coreGeo = new window.THREE.IcosahedronGeometry(0.1, 0);
      const core = new window.THREE.Mesh(coreGeo, coreMat);
      group.add(core);
      
      // Copy previous transform if exists
      if (gestureStateRef.current.active) {
          // Keep current position if swapping while active
          group.position.copy(oldMesh.position);
          group.rotation.copy(oldMesh.rotation);
          group.scale.copy(oldMesh.scale);
      } else {
          // If idle, just keep position to avoid jumping
          group.position.copy(oldMesh.position);
      }

      objectRef.current = group;
      sceneRef.current.add(group);
  };

  useEffect(() => {
    isMounted.current = true;

    const init = async () => {
      try {
        if (!window.THREE || !window.Hands) throw new Error("Libraries missing");

        const width = window.innerWidth;
        const height = window.innerHeight;
        const scene = new window.THREE.Scene();
        
        const camera = new window.THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        camera.position.z = 5;
        cameraRef.current = camera;

        const renderer = new window.THREE.WebGLRenderer({ 
            canvas: threeCanvasRef.current, alpha: true, antialias: true 
        });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio);
        rendererRef.current = renderer;

        const ambientLight = new window.THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);
        const pointLight = new window.THREE.PointLight(0x00d8ff, 1.5);
        pointLight.position.set(5, 5, 5);
        scene.add(pointLight);
        
        sceneRef.current = scene;
        objectRef.current = new window.THREE.Group(); // Placeholder
        updateGeometry(activeShape);

        const hands = new window.Hands({locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${file}`});
        hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
        hands.onResults(onHandResults);
        handsRef.current = hands;

        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } });
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = () => {
                videoRef.current?.play();
                setStatus("SYSTEM ONLINE");
                startLoop();
            };
        }
      } catch (e) {
          console.error(e);
          setStatus("INIT FAILED");
      }
    };

    init();

    const handleResize = () => {
        if (cameraRef.current && rendererRef.current) {
            const w = window.innerWidth;
            const h = window.innerHeight;
            cameraRef.current.aspect = w / h;
            cameraRef.current.updateProjectionMatrix();
            rendererRef.current.setSize(w, h);
        }
    };
    window.addEventListener('resize', handleResize);

    return () => {
        isMounted.current = false;
        window.removeEventListener('resize', handleResize);
        cancelAnimationFrame(requestRef.current);
        if (videoRef.current?.srcObject) (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
        if (handsRef.current) handsRef.current.close();
        if (rendererRef.current) rendererRef.current.dispose();
    };
  }, []);

  // --- GESTURE RECOGNITION LOGIC ---

  const isFingerCurled = (landmarks: any, tipIdx: number, mcpIdx: number) => {
      const wrist = landmarks[0];
      const tip = landmarks[tipIdx];
      const mcp = landmarks[mcpIdx];
      // Normalize relative to hand size (Wrist to Middle MCP)
      const handSize = Math.hypot(landmarks[9].x - wrist.x, landmarks[9].y - wrist.y);
      
      const distTip = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
      const distMcp = Math.hypot(mcp.x - wrist.x, mcp.y - wrist.y);
      
      // Strict check: Tip closer to wrist than MCP (Fully curled)
      // OR Tip very close to MCP (Half curled)
      return distTip < distMcp || distTip < (handSize * 0.6); 
  };

  const isFist = (landmarks: any) => {
      // Check Index (8), Middle (12), Ring (16), Pinky (20)
      const curledCount = [
          isFingerCurled(landmarks, 8, 5),
          isFingerCurled(landmarks, 12, 9),
          isFingerCurled(landmarks, 16, 13),
          isFingerCurled(landmarks, 20, 17)
      ].filter(Boolean).length;
      
      // Thumb Check (Tip close to Index MCP)
      const thumbTip = landmarks[4];
      const indexMCP = landmarks[5];
      const thumbDist = Math.hypot(thumbTip.x - indexMCP.x, thumbTip.y - indexMCP.y);
      
      // Robust Fist: At least 3 fingers curled AND thumb is tucked in or hand is compact
      return curledCount >= 3 && thumbDist < 0.15;
  };

  const isPinch = (landmarks: any) => {
      const thumbTip = landmarks[4];
      const indexTip = landmarks[8];
      const distance = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
      return distance < 0.08; // Tight pinch threshold
  };

  const getHandRoll = (landmarks: any) => {
      const wrist = landmarks[0];
      const middleMCP = landmarks[9];
      // Calculate angle of the "Wrist -> Middle Finger" vector
      // In screen space, this gives us the z-rotation (roll) of the hand
      return Math.atan2(middleMCP.y - wrist.y, middleMCP.x - wrist.x);
  };

  const onHandResults = (results: any) => {
      if (!isMounted.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      
      let newHandData = { p1: null as any, roll: 0, isFist: false, isPinch: false };

      if (canvas && ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.save();
          ctx.scale(-1, 1);
          ctx.translate(-canvas.width, 0);
          
          if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
              // Single hand control prioritization
              const landmarks = results.multiHandLandmarks[0];
              
              const wrist = landmarks[0];
              const indexTip = landmarks[8];
              const thumbTip = landmarks[4];
              
              // Convert to canvas coords
              const wPt = { x: wrist.x * canvas.width, y: wrist.y * canvas.height };
              const iPt = { x: indexTip.x * canvas.width, y: indexTip.y * canvas.height };
              const tPt = { x: thumbTip.x * canvas.width, y: thumbTip.y * canvas.height };

              const _isFist = isFist(landmarks);
              const _isPinch = isPinch(landmarks) && !_isFist; // Fist takes priority

              const _roll = getHandRoll(landmarks);

              // Visualization & Data Extraction
              if (_isFist) {
                    // FIST VISUAL
                    ctx.fillStyle = 'rgba(255, 140, 0, 0.4)'; // Deep Orange
                    ctx.beginPath(); ctx.arc(wPt.x, wPt.y, 60, 0, Math.PI*2); ctx.fill();
                    ctx.strokeStyle = '#FFAA00'; ctx.lineWidth = 4; ctx.stroke();
                    
                    // Direction Indicator (Roll)
                    const dx = Math.cos(_roll) * 80;
                    const dy = Math.sin(_roll) * 80;
                    ctx.beginPath(); ctx.moveTo(wPt.x, wPt.y); ctx.lineTo(wPt.x + dx, wPt.y + dy); ctx.stroke();

                    newHandData = {
                        p1: {
                             x: (1 - (wPt.x / canvas.width)) * 2 - 1,
                             y: -(wPt.y / canvas.height) * 2 + 1
                        },
                        roll: _roll,
                        isFist: true,
                        isPinch: false
                    };
              } else if (_isPinch) {
                    // PINCH VISUAL
                    const pinchX = (iPt.x + tPt.x) / 2;
                    const pinchY = (iPt.y + tPt.y) / 2;
                    
                    ctx.fillStyle = 'rgba(0, 255, 100, 0.4)';
                    ctx.beginPath(); ctx.arc(pinchX, pinchY, 40, 0, Math.PI*2); ctx.fill();
                    ctx.strokeStyle = '#00FF66'; ctx.lineWidth = 3; ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(iPt.x, iPt.y); ctx.lineTo(tPt.x, tPt.y); ctx.stroke();

                    newHandData = {
                        p1: {
                             x: (1 - (pinchX / canvas.width)) * 2 - 1,
                             y: -(pinchY / canvas.height) * 2 + 1
                        },
                        roll: _roll,
                        isFist: false,
                        isPinch: true
                    };
              } else {
                    // IDLE VISUAL
                    ctx.fillStyle = 'rgba(0, 216, 255, 0.5)';
                    [0, 4, 8, 12, 16, 20].forEach(i => {
                         const p = landmarks[i];
                         ctx.beginPath(); ctx.arc(p.x * canvas.width, p.y * canvas.height, 4, 0, Math.PI*2); ctx.fill();
                    });
              }
          }
          ctx.restore();
      }
      
      currentHandDataRef.current = newHandData;
      isProcessingRef.current = false;
  };

  // --- MAIN PHYSICS LOOP ---
  const startLoop = () => {
      const loop = () => {
          if (!isMounted.current) return;
          
          if (objectRef.current && rendererRef.current) {
              const obj = objectRef.current;
              const { p1, isFist, isPinch, roll } = currentHandDataRef.current;
              const state = gestureStateRef.current;

              // 1. STATE TRANSITIONS
              let targetMode: 'NONE' | 'MOVE' | 'EDIT' = 'NONE';
              if (isFist && p1) targetMode = 'MOVE';
              else if (isPinch && p1) targetMode = 'EDIT';

              if (targetMode !== state.mode) {
                  // Start new gesture
                  state.mode = targetMode;
                  setInteractionMode(targetMode);
                  state.active = (targetMode !== 'NONE');

                  if (targetMode !== 'NONE' && p1) {
                      state.startP1 = { ...p1 };
                      state.startRoll = roll;
                      state.startObjPos = { ...obj.position };
                      state.startObjRot = { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z };
                      state.startObjScale = { ...obj.scale };
                  }
              }

              // 2. PHYSICS UPDATE
              if (state.mode === 'MOVE' && p1 && state.startP1) {
                  // --- MOVE (Translation) ---
                  const dx = p1.x - state.startP1.x;
                  const dy = p1.y - state.startP1.y;

                  // Reduced sensitivity for precision (was 6)
                  const moveSens = 2.5;
                  const targetX = state.startObjPos.x + (dx * moveSens);
                  const targetY = state.startObjPos.y + (dy * moveSens);

                  obj.position.lerp(new window.THREE.Vector3(targetX, targetY, 0), 0.15);

                  // --- ROTATE (Wrist Roll) ---
                  // Handle angle wrapping (-PI to PI)
                  let deltaRoll = roll - state.startRoll;
                  if (deltaRoll > Math.PI) deltaRoll -= 2 * Math.PI;
                  if (deltaRoll < -Math.PI) deltaRoll += 2 * Math.PI;
                  
                  // Map wrist roll to object rotation
                  const rotSens = 1.5;
                  obj.rotation.z = state.startObjRot.z - (deltaRoll * rotSens);

                  // Visual Feedback
                  if (materialsRef.current) {
                      materialsRef.current.wire.color.setHex(0xffaa00); // Orange
                      materialsRef.current.solid.color.setHex(0xffaa00);
                  }
              } 
              else if (state.mode === 'EDIT' && p1 && state.startP1) {
                  // --- SCALE (1-Handed Drag) ---
                  const dx = p1.x - state.startP1.x;
                  const dy = p1.y - state.startP1.y;
                  
                  // Sensitivity
                  const scaleSens = 3.0;

                  // Logic: 
                  // Drag Right (+dx) -> Increase Width (X)
                  // Drag Up (-dy in screen coords, but we want visual up) -> Increase Height (Y)
                  // Note: p1.y is inverted in our normalized coords (Up is +1, Down is -1 in our conversion above? 
                  // Wait, let's check: y: -(wPt.y / height) * 2 + 1. 
                  // If pixel y is 0 (top), val is +1. If pixel y is max (bottom), val is -1.
                  // So Moving Up increases y value. Correct.
                  
                  const newScaleX = Math.max(0.2, state.startObjScale.x + (dx * scaleSens));
                  const newScaleY = Math.max(0.2, state.startObjScale.y + (dy * scaleSens));
                  const newScaleZ = (newScaleX + newScaleY) / 2;

                  obj.scale.set(newScaleX, newScaleY, newScaleZ);
                  
                  // Visual Feedback
                  if (materialsRef.current) {
                      materialsRef.current.wire.color.setHex(0x00ff66); // Green
                      materialsRef.current.solid.color.setHex(0x00ff66);
                  }
              }
              else {
                  // IDLE
                  if (materialsRef.current) {
                      materialsRef.current.wire.color.setHex(0x00d8ff); // Cyan
                      materialsRef.current.solid.color.setHex(0x00d8ff);
                  }
                  // Slow idle rotation
                  // obj.rotation.y += 0.002;
              }

              rendererRef.current.render(sceneRef.current, cameraRef.current);
          }

          if (videoRef.current && handsRef.current && !isProcessingRef.current) {
             isProcessingRef.current = true;
             handsRef.current.send({image: videoRef.current}).catch(() => { isProcessingRef.current = false; });
          }

          requestRef.current = requestAnimationFrame(loop);
      };
      loop();
  };

  const filteredShapes = SHAPE_LIBRARY.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 bg-black flex flex-col animate-fade-in font-['Rajdhani']">
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-40 pointer-events-none" playsInline muted />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
        <canvas ref={threeCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,216,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,216,255,0.05)_1px,transparent_1px)] bg-[size:80px_80px] pointer-events-none opacity-30" />

        {/* TOP BAR */}
        <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center pointer-events-auto bg-gradient-to-b from-black/80 to-transparent z-20">
            <div className="flex items-center gap-4">
                 <div>
                    <h1 className="text-xl font-bold text-white tracking-[0.2em]">HOLODECK</h1>
                    <span className={`text-xs tracking-widest font-bold ${interactionMode === 'MOVE' ? 'text-orange-400' : interactionMode === 'EDIT' ? 'text-green-400' : 'text-jarvis-blue/80'}`}>
                        {interactionMode === 'NONE' ? status : interactionMode === 'MOVE' ? 'TRANSLATION MATRIX ACTIVE' : 'GEOMETRY EDITING ACTIVE'}
                    </span>
                 </div>
            </div>
            <button onClick={onClose} className="bg-black/60 border border-red-500/50 text-red-500 p-2 rounded-full hover:bg-red-500/20 transition-all hover:rotate-90">
                <X className="w-6 h-6" />
            </button>
        </div>

        {/* LEFT SIDEBAR: SCHEMATIC LIBRARY */}
        <div className={`absolute top-20 left-4 bottom-20 w-64 bg-black/80 border border-jarvis-blue/30 backdrop-blur-lg rounded-lg flex flex-col transition-transform duration-300 z-20 ${showLibrary ? 'translate-x-0' : '-translate-x-[120%]'}`}>
            <div className="p-3 border-b border-jarvis-blue/20">
                <div className="text-xs text-jarvis-blue mb-2 uppercase tracking-widest font-bold flex items-center gap-2">
                    <Grid className="w-3 h-3" /> Schematic Library
                </div>
                <div className="relative">
                    <Search className="absolute left-2 top-2 w-4 h-4 text-gray-500" />
                    <input 
                        type="text" 
                        placeholder="Search objects..." 
                        className="w-full bg-black/50 border border-gray-700 rounded px-8 py-1.5 text-sm text-white focus:border-jarvis-blue focus:outline-none"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                {filteredShapes.map(s => (
                    <button 
                        key={s.id} 
                        onClick={() => {
                            setActiveShape(s.id);
                            onSelectShape(); // Auto-close logic
                        }}
                        className={`w-full flex items-center justify-between p-3 rounded hover:bg-white/5 group transition-all border ${activeShape === s.id ? 'border-jarvis-blue bg-jarvis-blue/10' : 'border-transparent'}`}
                    >
                        <div className="flex items-center gap-3">
                            <s.icon className={`w-5 h-5 ${activeShape === s.id ? 'text-jarvis-blue' : 'text-gray-500 group-hover:text-white'}`} />
                            <span className={`text-sm ${activeShape === s.id ? 'text-white font-bold' : 'text-gray-300'}`}>{s.name}</span>
                        </div>
                        {activeShape === s.id && <ChevronRight className="w-3 h-3 text-jarvis-blue" />}
                    </button>
                ))}
            </div>
            <div className="p-2 text-[10px] text-center text-gray-500 border-t border-jarvis-blue/20">
                SAY "OPEN MENU" TO RESTORE LIST
            </div>
        </div>

        {/* BOTTOM HUD: INSTRUCTIONS */}
        <div className="absolute bottom-8 w-full flex justify-center pointer-events-none">
             <div className="flex gap-4 bg-black/80 backdrop-blur border border-jarvis-blue/30 px-6 py-3 rounded-full items-center shadow-[0_0_20px_rgba(0,216,255,0.2)]">
                 <div className={`flex items-center gap-2 transition-all duration-300 ${interactionMode === 'MOVE' ? 'opacity-100 text-orange-400 scale-110 font-bold' : 'opacity-50 text-gray-400'}`}>
                     <Hand className="w-4 h-4" />
                     <div className="flex flex-col">
                         <span className="text-[10px] tracking-widest">MOVE: CLOSED FIST</span>
                         <span className="text-[8px] tracking-widest text-orange-400/70">TWIST TO ROTATE</span>
                     </div>
                 </div>
                 <div className="h-4 w-px bg-gray-700" />
                 <div className={`flex items-center gap-2 transition-all duration-300 ${interactionMode === 'EDIT' ? 'opacity-100 text-green-400 scale-110 font-bold' : 'opacity-50 text-gray-400'}`}>
                     <Maximize className="w-4 h-4" />
                     <div className="flex flex-col">
                        <span className="text-[10px] tracking-widest">EDIT: INDEX PINCH</span>
                        <span className="text-[8px] tracking-widest text-green-400/70">DRAG TO RESIZE</span>
                     </div>
                 </div>
             </div>
        </div>

    </div>
  );
};

export default HologramMode;
