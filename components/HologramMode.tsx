
import React, { useEffect, useRef, useState } from 'react';
import { X, Box, Hand, Move, Maximize, Search, Activity, Circle, Triangle, Database, ChevronRight, Zap, Square, Disc, Hexagon, Beaker, Atom, Snowflake, LayoutGrid, Sparkles, ChevronDown, ChevronUp, Lock, Unlock, MousePointer2, Globe, Camera, Trash2 } from 'lucide-react';

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
    // Standard Geometry
    { id: 'reactor', name: 'Arc Reactor', icon: Activity, category: 'Tech' },
    { id: 'cube', name: 'Tesseract Cube', icon: Box, category: 'Geo' },
    { id: 'sphere', name: 'Energy Sphere', icon: Circle, category: 'Geo' },
    { id: 'pyramid', name: 'Pyramid', icon: Triangle, category: 'Geo' },
    { id: 'torus', name: 'Torus Ring', icon: Circle, category: 'Geo' },
    { id: 'knot', name: 'Quantum Knot', icon: Activity, category: 'Tech' },
    { id: 'cylinder', name: 'Data Cylinder', icon: Database, category: 'Tech' },
    { id: 'cone', name: 'Focus Cone', icon: Triangle, category: 'Geo' },
    { id: 'ring', name: 'Orbital Ring', icon: Disc, category: 'Geo' },
    { id: 'plane', name: 'Grid Plane', icon: Square, category: 'Geo' },
    { id: 'capsule', name: 'Stasis Capsule', icon: Box, category: 'Geo' },
    { id: 'circle', name: '2D Disc', icon: Circle, category: 'Geo' },
    
    // Advanced Polyhedra
    { id: 'dodecahedron', name: 'Dodecahedron', icon: Hexagon, category: 'Adv Geo' },
    { id: 'icosahedron', name: 'Icosahedron', icon: Hexagon, category: 'Adv Geo' },
    { id: 'octahedron', name: 'Octahedron', icon: Triangle, category: 'Adv Geo' },
    { id: 'tetrahedron', name: 'Tetrahedron', icon: Triangle, category: 'Adv Geo' },
    { id: 'stellated', name: 'Stellated Core', icon: Sparkles, category: 'Adv Geo' },
    { id: 'hypercube', name: 'Hypercube Projection', icon: Box, category: 'Adv Geo' },
    { id: 'fractal', name: 'Sierpinski Fractal', icon: LayoutGrid, category: 'Adv Geo' },

    // Science & Molecules
    { id: 'atom', name: 'Atomic Model', icon: Atom, category: 'Science' },
    { id: 'methane', name: 'Methane (CH4)', icon: Beaker, category: 'Science' },
    { id: 'water', name: 'Water (H2O)', icon: Beaker, category: 'Science' },
    { id: 'benzene', name: 'Benzene (C6H6)', icon: Hexagon, category: 'Science' },
    { id: 'buckyball', name: 'Buckyball (C60)', icon: Circle, category: 'Science' },
    { id: 'diamond', name: 'Diamond Lattice', icon: LayoutGrid, category: 'Science' },
    { id: 'crystal', name: 'Crystal Matrix', icon: Snowflake, category: 'Science' },
    
    // Biology
    { id: 'helix', name: 'DNA Double Helix', icon: Activity, category: 'Bio' },
    { id: 'virus', name: 'Viral Capsid', icon: Activity, category: 'Bio' },
    { id: 'protein', name: 'Protein Fold', icon: Activity, category: 'Bio' },
    
    // Planetary
    { id: 'earth', name: 'Planetary Model', icon: Globe, category: 'Space' },
];

const CATEGORY_LABELS: Record<string, string> = {
    'Tech': 'Technological Schematics',
    'Geo': 'Basic Geometry',
    'Adv Geo': 'Advanced Geometry',
    'Science': 'Chemical & Atomic',
    'Bio': 'Biological Structures',
    'Space': 'Cosmic Models'
};

const HologramMode: React.FC<HologramModeProps> = ({ onClose, shape, showLibrary, onSelectShape }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); 
  const threeCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const [status, setStatus] = useState('INITIALIZING ENGINE...');
  const [interactionMode, setInteractionMode] = useState<'NONE' | 'MOVE' | 'EDIT' | 'DUAL_SCALE'>('NONE');
  const [activeShape, setActiveShape] = useState(shape);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [gesturesEnabled, setGesturesEnabled] = useState(true);
  const [gestureFeedback, setGestureFeedback] = useState<string | null>(null);
  const [isCaptured, setIsCaptured] = useState(false);
  const [isBinActive, setIsBinActive] = useState(false);

  // Refs for loop management
  const requestRef = useRef<number>(0);
  const handsRef = useRef<any>(null);
  const sceneRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const objectRef = useRef<any>(null);
  const capturedObjectRef = useRef<any>(null);
  const materialsRef = useRef<{wire: any, solid: any, core: any, bond: any, atom: any} | null>(null);
  const isMounted = useRef(true);
  const isProcessingRef = useRef(false);
  
  // Refs to access latest state/props inside loop
  const isCapturedRef = useRef(false);
  const isBinActiveRef = useRef(false);
  const onCloseRef = useRef(onClose);
  
  // --- INTERACTION STATE ---
  interface HandData {
      id: number;
      p: {x: number, y: number}; // Screen position (-1 to 1)
      pinchPoint: {x: number, y: number} | null;
      isFist: boolean;
      isPinch: boolean;
      orientation: { x: number, y: number, z: number }; // Euler angles (Pitch, Yaw, Roll)
  }

  const currentHandsRef = useRef<HandData[]>([]);

  // Robust Gesture Logic State
  const gestureLogicRef = useRef<{
      pendingMode: 'NONE' | 'MOVE' | 'EDIT' | 'DUAL_SCALE';
      confirmationStartTime: number;
      lastHandPos: {x: number, y: number};
      lastMoveTime: number;
      isStable: boolean;
  }>({
      pendingMode: 'NONE',
      confirmationStartTime: 0,
      lastHandPos: {x:0, y:0},
      lastMoveTime: 0,
      isStable: true
  });

  const gestureStateRef = useRef<{
      active: boolean;
      mode: 'NONE' | 'MOVE' | 'EDIT' | 'DUAL_SCALE';
      // Single Hand Refs
      startP: {x: number, y: number} | null;
      startOrientation: {x: number, y: number, z: number};
      // Dual Hand Refs
      startPinchDist: number;
      // Object Refs
      startObjPos: {x: number, y: number, z: number};
      startObjScale: {x: number, y: number, z: number};
      startObjRot: {x: number, y: number, z: number}; // Euler
      startObjQuat: any; // Quaternion for smooth 3D rotation
  }>({
      active: false,
      mode: 'NONE',
      startP: null,
      startOrientation: {x:0,y:0,z:0},
      startPinchDist: 0,
      startObjPos: {x:0,y:0,z:0},
      startObjScale: {x:1,y:1,z:1},
      startObjRot: {x:0,y:0,z:0},
      startObjQuat: null
  });

  // Update refs
  useEffect(() => { isCapturedRef.current = isCaptured; }, [isCaptured]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // Sync with prop changes from voice commands
  useEffect(() => {
      setActiveShape(shape);
  }, [shape]);

  // Sync menu visibility with prop
  useEffect(() => {
      setIsMenuOpen(showLibrary);
  }, [showLibrary]);

  // Update 3D model when active shape changes
  useEffect(() => {
      updateGeometry(activeShape);
  }, [activeShape]);

  // --- CAPTURE LOGIC (SCAN REAL WORLD) ---
  const handleCapture = () => {
      if (!videoRef.current || !sceneRef.current) return;
      
      setStatus("INITIATING LIDAR SCAN...");
      
      // Clean previous capture
      if (capturedObjectRef.current) {
          sceneRef.current.remove(capturedObjectRef.current);
          capturedObjectRef.current.traverse((c: any) => {
              if(c.geometry) c.geometry.dispose();
              if(c.material) c.material.dispose();
              if(c.material?.map) c.material.map.dispose();
              if(c.material?.displacementMap) c.material.displacementMap.dispose();
          });
      }

      // 1. Capture Video Frame
      const video = videoRef.current;
      const w = 512; // Lower res for performance
      const h = 512;
      const snapCanvas = document.createElement('canvas');
      snapCanvas.width = w;
      snapCanvas.height = h;
      const ctx = snapCanvas.getContext('2d');
      if (!ctx) return;
      
      // Crop to center square for texture
      const vidH = video.videoHeight;
      const vidW = video.videoWidth;
      const sSize = Math.min(vidW, vidH);
      const sx = (vidW - sSize) / 2;
      const sy = (vidH - sSize) / 2;
      
      // Draw frame
      ctx.translate(w, 0); // Mirror flip to match HUD
      ctx.scale(-1, 1);
      ctx.drawImage(video, sx, sy, sSize, sSize, 0, 0, w, h);
      
      // Create Texture
      const texture = new window.THREE.CanvasTexture(snapCanvas);
      
      // Create Displacement Map (Grayscale approximation of depth)
      // In a real app, you'd use a depth estimation model. Here we approximate brightness = depth.
      const dispCanvas = document.createElement('canvas');
      dispCanvas.width = w;
      dispCanvas.height = h;
      const dCtx = dispCanvas.getContext('2d');
      if(dCtx) {
          dCtx.drawImage(snapCanvas, 0, 0);
          const imgData = dCtx.getImageData(0,0,w,h);
          const data = imgData.data;
          for(let i=0; i<data.length; i+=4) {
              const b = (data[i] + data[i+1] + data[i+2]) / 3; // Brightness
              // Enhance contrast
              const val = b < 50 ? 0 : b; 
              data[i] = val; data[i+1] = val; data[i+2] = val;
          }
          dCtx.putImageData(imgData, 0, 0);
      }
      const dispTexture = new window.THREE.CanvasTexture(dispCanvas);

      // 2. Create 2.5D Mesh
      // Plane with many segments for displacement
      const geometry = new window.THREE.PlaneGeometry(1.5, 1.5, 128, 128);
      
      const material = new window.THREE.MeshStandardMaterial({
          map: texture,
          displacementMap: dispTexture,
          displacementScale: 0.3, // Depth strength
          wireframe: false,
          color: 0x00d8ff, // Tint it blue for hologram feel
          emissive: 0x004488,
          emissiveIntensity: 0.5,
          transparent: true,
          opacity: 0.9,
          side: window.THREE.DoubleSide
      });
      
      const mesh = new window.THREE.Mesh(geometry, material);
      
      // Add a wireframe overlay for tech effect
      const wireGeo = new window.THREE.WireframeGeometry(geometry);
      const wireMat = new window.THREE.LineBasicMaterial({ color: 0x00ffff, opacity: 0.1, transparent: true });
      const wireMesh = new window.THREE.LineSegments(wireGeo, wireMat);
      mesh.add(wireMesh);

      // Group
      const group = new window.THREE.Group();
      group.add(mesh);
      
      capturedObjectRef.current = group;
      sceneRef.current.add(group);
      
      // Hide the 'live' object while we look at the capture
      if (objectRef.current) objectRef.current.visible = false;

      setIsCaptured(true);
      setStatus("OBJECT SCANNED - MODEL GENERATED");
  };

  // We need this function to be available for the loop via Ref, or just call it directly since it uses refs
  const handleRelease = () => {
      if (capturedObjectRef.current && sceneRef.current) {
          sceneRef.current.remove(capturedObjectRef.current);
          
          // Cleanup memory
          capturedObjectRef.current.traverse((c: any) => {
              if(c.geometry) c.geometry.dispose();
              if(c.material) {
                  if(c.material.map) c.material.map.dispose();
                  if(c.material.displacementMap) c.material.displacementMap.dispose();
                  c.material.dispose();
              }
          });
          
          capturedObjectRef.current = null;
      }
      
      // Show the live object again
      if (objectRef.current) objectRef.current.visible = true;

      setIsCaptured(false);
      setStatus("SCAN CLEARED - RESUMING PROJECTION");
  };
  
  // Store stable reference to handleRelease for the loop
  const handleReleaseRef = useRef(handleRelease);
  useEffect(() => { handleReleaseRef.current = handleRelease; }, [handleRelease]);

  // --- MOLECULE BUILDER HELPERS ---
  const createAtom = (pos: any, size: number, color: number) => {
     const geo = new window.THREE.SphereGeometry(size, 16, 16);
     const mat = new window.THREE.MeshPhongMaterial({ color: color, shininess: 100 });
     const mesh = new window.THREE.Mesh(geo, mat);
     mesh.position.set(pos.x, pos.y, pos.z);
     return mesh;
  };

  const createBond = (start: any, end: any, width: number = 0.05) => {
     const path = new window.THREE.LineCurve3(new window.THREE.Vector3(start.x, start.y, start.z), new window.THREE.Vector3(end.x, end.y, end.z));
     const geo = new window.THREE.TubeGeometry(path, 1, width, 8, false);
     const mat = new window.THREE.MeshPhongMaterial({ color: 0xcccccc });
     return new window.THREE.Mesh(geo, mat);
  };

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
      let isMolecule = false;
      
      // Material Settings
      const wireMat = new window.THREE.LineBasicMaterial({ 
          color: 0x00d8ff, linewidth: 2, transparent: true, opacity: 0.8 
      });
      const solidMat = new window.THREE.MeshPhongMaterial({
          color: 0x00d8ff, wireframe: false, transparent: true, opacity: 0.15, side: window.THREE.DoubleSide
      });
      const coreMat = new window.THREE.MeshBasicMaterial({ 
          color: 0xffffff, transparent: true, opacity: 0.9 
      });
      
      materialsRef.current = { wire: wireMat, solid: solidMat, core: coreMat, bond: null, atom: null };

      switch(type.toLowerCase()) {
          // --- BASIC GEOMETRY ---
          case 'cube': geometry = new window.THREE.BoxGeometry(1, 1, 1); break;
          case 'sphere': geometry = new window.THREE.SphereGeometry(0.7, 24, 24); break;
          case 'earth': geometry = new window.THREE.IcosahedronGeometry(0.8, 3); break;
          case 'pyramid': geometry = new window.THREE.ConeGeometry(0.7, 1.2, 4); break;
          case 'cone': geometry = new window.THREE.ConeGeometry(0.6, 1.2, 24); break;
          case 'cylinder': geometry = new window.THREE.CylinderGeometry(0.5, 0.5, 1.2, 24); break;
          case 'torus': geometry = new window.THREE.TorusGeometry(0.5, 0.2, 24, 50); break;
          case 'knot': geometry = new window.THREE.TorusKnotGeometry(0.4, 0.15, 100, 16); break;
          case 'ring': geometry = new window.THREE.RingGeometry(0.4, 0.8, 32); break;
          case 'circle': geometry = new window.THREE.CircleGeometry(0.8, 32); break;
          case 'plane': geometry = new window.THREE.PlaneGeometry(1.5, 1.5, 4, 4); break;
          case 'capsule': 
              if (window.THREE.CapsuleGeometry) geometry = new window.THREE.CapsuleGeometry(0.4, 1, 4, 16); 
              else geometry = new window.THREE.CylinderGeometry(0.4, 0.4, 1.2, 16);
              break;

          // --- ADVANCED GEOMETRY ---
          case 'dodecahedron': geometry = new window.THREE.DodecahedronGeometry(0.7, 0); break;
          case 'octahedron': geometry = new window.THREE.OctahedronGeometry(0.7, 0); break;
          case 'tetrahedron': geometry = new window.THREE.TetrahedronGeometry(0.8, 0); break;
          case 'icosahedron': geometry = new window.THREE.IcosahedronGeometry(0.8, 0); break;
          
          case 'stellated': // Simulated stellated dodecahedron via Icosahedron detail 0 + cones
              geometry = new window.THREE.IcosahedronGeometry(0.5, 0);
              // Better visual: Low res Icosahedron with large wireframe
              geometry = new window.THREE.IcosahedronGeometry(0.6, 0); 
              break;
          
          case 'hypercube': // Tesseract projection visual
              geometry = new window.THREE.BoxGeometry(0.6, 0.6, 0.6);
              const outerBox = new window.THREE.Mesh(new window.THREE.BoxGeometry(1, 1, 1), wireMat);
              group.add(outerBox);
              break;

          case 'fractal': // Sierpinski Pyramid (4 Tetrahedrons)
              geometry = new window.THREE.TetrahedronGeometry(0.35, 0);
              const offsets = [
                  {x:0, y:0.35, z:0}, {x:0.3, y:-0.15, z:0.2}, {x:-0.3, y:-0.15, z:0.2}, {x:0, y:-0.15, z:-0.35}
              ];
              offsets.forEach(off => {
                  const subTetra = new window.THREE.Mesh(geometry, solidMat);
                  const subWire = new window.THREE.LineSegments(new window.THREE.WireframeGeometry(geometry), wireMat);
                  subTetra.position.set(off.x, off.y, off.z);
                  subWire.position.set(off.x, off.y, off.z);
                  group.add(subTetra);
                  group.add(subWire);
              });
              geometry = null; // Already handled
              break;

          // --- SCIENCE / MOLECULES ---
          case 'atom':
              isMolecule = true;
              // Nucleus
              group.add(createAtom({x:0,y:0,z:0}, 0.15, 0xff0000));
              group.add(createAtom({x:0.05,y:0.05,z:0}, 0.15, 0x0000ff));
              // Electrons (Rings)
              const r1 = new window.THREE.Mesh(new window.THREE.TorusGeometry(0.6, 0.02, 16, 50), wireMat);
              const r2 = r1.clone(); r2.rotation.x = Math.PI / 1.5;
              const r3 = r1.clone(); r3.rotation.x = -Math.PI / 1.5;
              group.add(r1); group.add(r2); group.add(r3);
              // Electron Particles
              const e1 = createAtom({x:0.6,y:0,z:0}, 0.05, 0xffff00); group.add(e1);
              break;

          case 'methane': // CH4
              isMolecule = true;
              group.add(createAtom({x:0,y:0,z:0}, 0.2, 0x333333)); // Carbon
              const hPos = [
                  {x:0.4, y:0.4, z:0.4}, {x:-0.4, y:-0.4, z:0.4},
                  {x:-0.4, y:0.4, z:-0.4}, {x:0.4, y:-0.4, z:-0.4}
              ];
              hPos.forEach(p => {
                  group.add(createAtom(p, 0.1, 0xffffff)); // Hydrogen
                  group.add(createBond({x:0,y:0,z:0}, p));
              });
              break;

          case 'water': // H2O
              isMolecule = true;
              group.add(createAtom({x:0,y:0,z:0}, 0.2, 0xff0000)); // Oxygen
              const hWater = [{x:0.4, y:-0.2, z:0}, {x:-0.4, y:-0.2, z:0}]; // Bent shape
              hWater.forEach(p => {
                  group.add(createAtom(p, 0.12, 0xffffff));
                  group.add(createBond({x:0,y:0,z:0}, p));
              });
              break;

          case 'benzene': // C6H6
              isMolecule = true;
              for(let i=0; i<6; i++) {
                  const angle = (i / 6) * Math.PI * 2;
                  const x = Math.cos(angle) * 0.5;
                  const y = Math.sin(angle) * 0.5;
                  // Carbon Ring
                  group.add(createAtom({x,y,z:0}, 0.15, 0x333333));
                  // Hydrogen Outer Ring
                  const hx = Math.cos(angle) * 0.8;
                  const hy = Math.sin(angle) * 0.8;
                  group.add(createAtom({x:hx,y:hy,z:0}, 0.08, 0xffffff));
                  group.add(createBond({x,y,z:0}, {x:hx,y:hy,z:0}));
                  // Ring Bonds
                  const nextAngle = ((i+1) / 6) * Math.PI * 2;
                  const nx = Math.cos(nextAngle) * 0.5;
                  const ny = Math.sin(nextAngle) * 0.5;
                  group.add(createBond({x,y,z:0}, {x:nx,y:ny,z:0}, 0.08));
              }
              break;
          
          case 'buckyball': // C60 - Truncated Icosahedron visual approx
             geometry = new window.THREE.IcosahedronGeometry(0.7, 1);
             break;
             
          case 'diamond': // Lattice
             isMolecule = true;
             // Simple Tetrahedron Lattice segment
             const dNodes = [
                 {x:0,y:0,z:0}, {x:0.3,y:0.3,z:0.3}, {x:0.3,y:-0.3,z:-0.3}, {x:-0.3,y:0.3,z:-0.3}, {x:-0.3,y:-0.3,z:0.3}
             ];
             dNodes.forEach(p => group.add(createAtom(p, 0.1, 0x00ffff)));
             for(let i=1; i<dNodes.length; i++) group.add(createBond(dNodes[0], dNodes[i]));
             break;
          
          case 'crystal':
             geometry = new window.THREE.OctahedronGeometry(0.7, 0);
             break;

          case 'virus': // Icosahedron + Spikes
             isMolecule = true;
             const capsid = new window.THREE.Mesh(new window.THREE.IcosahedronGeometry(0.5, 1), new window.THREE.MeshPhongMaterial({color:0x8800ff, opacity:0.6, transparent:true}));
             group.add(capsid);
             const capsidWire = new window.THREE.LineSegments(new window.THREE.WireframeGeometry(new window.THREE.IcosahedronGeometry(0.5, 1)), wireMat);
             group.add(capsidWire);
             // Spikes
             const posArray = capsid.geometry.attributes.position.array;
             for(let i=0; i<posArray.length; i+=9) { // Approximate distribution
                 const x = posArray[i], y = posArray[i+1], z = posArray[i+2];
                 const spike = new window.THREE.Mesh(new window.THREE.CylinderGeometry(0.02, 0.05, 0.2), new window.THREE.MeshBasicMaterial({color:0xff0000}));
                 spike.position.set(x,y,z);
                 spike.lookAt(0,0,0);
                 spike.rotateX(-Math.PI/2); // Point outward
                 group.add(spike);
             }
             break;
             
          case 'protein': // Random coil
              const pPoints = [];
              for(let i=0; i<50; i++) {
                  pPoints.push(new window.THREE.Vector3((Math.random()-0.5)*1.5, (Math.random()-0.5)*1.5, (Math.random()-0.5)*1.5));
              }
              const pCurve = new window.THREE.CatmullRomCurve3(pPoints);
              geometry = new window.THREE.TubeGeometry(pCurve, 64, 0.08, 8, false);
              break;

          case 'dna': 
          case 'helix': 
              const points = [];
              for ( let i = 0; i < 100; i ++ ) {
                  const t = i * 0.2;
                  points.push( new window.THREE.Vector3( Math.cos( t ) * 0.4, ( i * 0.05 ) - 1, Math.sin( t ) * 0.4 ) );
              }
              const spline = new window.THREE.CatmullRomCurve3( points );
              geometry = new window.THREE.TubeGeometry( spline, 64, 0.08, 8, false );
              // Second strand
              const points2 = [];
              for ( let i = 0; i < 100; i ++ ) {
                  const t = i * 0.2 + Math.PI;
                  points2.push( new window.THREE.Vector3( Math.cos( t ) * 0.4, ( i * 0.05 ) - 1, Math.sin( t ) * 0.4 ) );
              }
              const spline2 = new window.THREE.CatmullRomCurve3( points2 );
              const strand2 = new window.THREE.Mesh(new window.THREE.TubeGeometry( spline2, 64, 0.08, 8, false ), solidMat);
              const wire2 = new window.THREE.LineSegments(new window.THREE.WireframeGeometry(strand2.geometry), wireMat);
              group.add(strand2);
              group.add(wire2);
              break;

          case 'reactor': 
          default: geometry = new window.THREE.IcosahedronGeometry(0.8, 1); break;
      }

      // If we created a custom molecule group, skip standard mesh generation
      if (geometry) {
          // 1. Create Wireframe Mesh
          const wireframe = new window.THREE.WireframeGeometry(geometry);
          const mesh = new window.THREE.LineSegments(wireframe, wireMat);
          group.add(mesh);

          // 2. Create Inner Solid Ghost
          if (type !== 'helix' && type !== 'virus' && !isMolecule) {
              const solid = new window.THREE.Mesh(geometry, solidMat);
              solid.scale.setScalar(0.96);
              group.add(solid);
          }
      }

      // 3. Core Effect (Glowing Center) - Only for Tech/Geo
      if (!isMolecule && type !== 'helix' && type !== 'protein') {
          const coreGeo = new window.THREE.IcosahedronGeometry(0.1, 0);
          const core = new window.THREE.Mesh(coreGeo, coreMat);
          group.add(core);
      }
      
      // Copy previous transform if exists
      if (gestureStateRef.current.active || objectRef.current) {
          group.position.copy(oldMesh.position);
          group.rotation.copy(oldMesh.rotation);
          group.scale.copy(oldMesh.scale);
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
        // Enable 2 Hands
        hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
        hands.onResults(onHandResults);
        handsRef.current = hands;

        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } });
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = () => {
                // Ensure the video is actually ready before playing to avoid "The play() request was interrupted"
                if (videoRef.current) {
                    videoRef.current.play().then(() => {
                        setStatus("SYSTEM ONLINE");
                        startLoop();
                    }).catch(e => {
                        console.error("Video play failed", e);
                        setStatus("CAMERA ERROR");
                    });
                }
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

  // --- GEOMETRY & GESTURE MATH ---

  const isFingerCurled = (landmarks: any, tipIdx: number, mcpIdx: number) => {
      const wrist = landmarks[0];
      const tip = landmarks[tipIdx];
      const mcp = landmarks[mcpIdx];
      const handSize = Math.hypot(landmarks[9].x - wrist.x, landmarks[9].y - wrist.y);
      const distTip = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
      const distMcp = Math.hypot(mcp.x - wrist.x, mcp.y - wrist.y);
      return distTip < distMcp || distTip < (handSize * 0.6); 
  };

  const isFist = (landmarks: any) => {
      const curledCount = [
          isFingerCurled(landmarks, 8, 5),
          isFingerCurled(landmarks, 12, 9),
          isFingerCurled(landmarks, 16, 13),
          isFingerCurled(landmarks, 20, 17)
      ].filter(Boolean).length;
      const thumbTip = landmarks[4];
      const indexMCP = landmarks[5];
      const thumbDist = Math.hypot(thumbTip.x - indexMCP.x, thumbTip.y - indexMCP.y);
      return curledCount >= 3 && thumbDist < 0.15;
  };

  const isPinch = (landmarks: any) => {
      const thumbTip = landmarks[4];
      const indexTip = landmarks[8];
      const distance = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
      return distance < 0.08; 
  };

  // CALCULATE HAND ORIENTATION IN 3D (Euler Angles)
  // Uses cross product of palm vectors to determine true normal
  const getHandOrientation3D = (landmarks: any) => {
      const wrist = landmarks[0];
      const indexMCP = landmarks[5];
      const pinkyMCP = landmarks[17];

      // Vector 1: Wrist -> Index
      const v1 = { x: indexMCP.x - wrist.x, y: indexMCP.y - wrist.y, z: indexMCP.z - wrist.z };
      // Vector 2: Wrist -> Pinky
      const v2 = { x: pinkyMCP.x - wrist.x, y: pinkyMCP.y - wrist.y, z: pinkyMCP.z - wrist.z };

      // Cross Product (Normal Vector of Palm)
      const normal = {
          x: v1.y * v2.z - v1.z * v2.y,
          y: v1.z * v2.x - v1.x * v2.z,
          z: v1.x * v2.y - v1.y * v2.x
      };

      // Normalize
      const len = Math.sqrt(normal.x*normal.x + normal.y*normal.y + normal.z*normal.z);
      const n = { x: normal.x/len, y: normal.y/len, z: normal.z/len };

      // Calculate Euler Angles from Normal Vector
      // Pitch (X-axis rot): Angle of normal projection on YZ plane
      // Yaw (Y-axis rot): Angle of normal projection on XZ plane
      // Roll (Z-axis rot): Angle of vector (Index-Pinky) on XY plane
      
      // Roll (2D Tilt)
      const roll = Math.atan2(pinkyMCP.y - indexMCP.y, pinkyMCP.x - indexMCP.x);
      
      // Pitch & Yaw from Normal
      // Note: MediaPipe coordinate system: X right, Y down, Z target (monitor)
      // We map these to standard 3D rotations
      const pitch = Math.asin(-n.y); 
      const yaw = Math.atan2(n.x, n.z);

      return { x: pitch, y: yaw, z: roll };
  };

  const onHandResults = (results: any) => {
      if (!isMounted.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      
      const detectedHands: HandData[] = [];

      if (canvas && ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.save();
          ctx.scale(-1, 1);
          ctx.translate(-canvas.width, 0);
          
          if (results.multiHandLandmarks) {
              results.multiHandLandmarks.forEach((landmarks: any, index: number) => {
                  const wrist = landmarks[0];
                  const indexTip = landmarks[8];
                  const thumbTip = landmarks[4];
                  
                  // Canvas Coords
                  const wPt = { x: wrist.x * canvas.width, y: wrist.y * canvas.height };
                  const iPt = { x: indexTip.x * canvas.width, y: indexTip.y * canvas.height };
                  const tPt = { x: thumbTip.x * canvas.width, y: thumbTip.y * canvas.height };

                  const _isFist = isFist(landmarks);
                  const _isPinch = isPinch(landmarks) && !_isFist;
                  const _orientation = getHandOrientation3D(landmarks);
                  
                  // Pinch Point (Midpoint between Thumb and Index)
                  const pinchPt = _isPinch ? {
                      x: (1 - ((iPt.x + tPt.x) / 2 / canvas.width)) * 2 - 1,
                      y: -((iPt.y + tPt.y) / 2 / canvas.height) * 2 + 1
                  } : null;
                  
                  // Wrist Point (Normalized for screen)
                  const normWrist = {
                      x: (1 - (wPt.x / canvas.width)) * 2 - 1,
                      y: -(wPt.y / canvas.height) * 2 + 1
                  };

                  detectedHands.push({
                      id: index,
                      p: normWrist,
                      pinchPoint: pinchPt,
                      isFist: _isFist,
                      isPinch: _isPinch,
                      orientation: _orientation
                  });

                  // --- VISUALIZATION ---
                  if (_isFist) {
                      // Fist Visual (Orange)
                      ctx.fillStyle = 'rgba(255, 140, 0, 0.4)';
                      ctx.beginPath(); ctx.arc(wPt.x, wPt.y, 50, 0, Math.PI*2); ctx.fill();
                      ctx.strokeStyle = '#FFAA00'; ctx.lineWidth = 4; ctx.stroke();
                      
                      // 3D Rotation Ring Visual
                      ctx.beginPath();
                      ctx.ellipse(wPt.x, wPt.y, 70, 30, -_orientation.z, 0, Math.PI*2);
                      ctx.strokeStyle = 'rgba(255, 140, 0, 0.5)'; ctx.lineWidth = 2; ctx.stroke();

                  } else if (_isPinch) {
                      // Pinch Visual (Green)
                      const px = (iPt.x + tPt.x) / 2;
                      const py = (iPt.y + tPt.y) / 2;
                      ctx.fillStyle = 'rgba(0, 255, 100, 0.4)';
                      ctx.beginPath(); ctx.arc(px, py, 30, 0, Math.PI*2); ctx.fill();
                      ctx.strokeStyle = '#00FF66'; ctx.lineWidth = 3; ctx.stroke();
                      ctx.beginPath(); ctx.moveTo(iPt.x, iPt.y); ctx.lineTo(tPt.x, tPt.y); ctx.stroke();
                  } else {
                      // Idle (Cyan)
                      ctx.fillStyle = 'rgba(0, 216, 255, 0.5)';
                      [0, 4, 8, 12, 16, 20].forEach(i => {
                          const p = landmarks[i];
                          ctx.beginPath(); ctx.arc(p.x * canvas.width, p.y * canvas.height, 4, 0, Math.PI*2); ctx.fill();
                      });
                  }
              });
          }
          ctx.restore();
      }
      
      currentHandsRef.current = detectedHands;
      isProcessingRef.current = false;
  };

  // --- PHYSICS LOOP ---
  const startLoop = () => {
      const loop = () => {
          if (!isMounted.current) return;
          
          if (objectRef.current && rendererRef.current && cameraRef.current) {
              // ** PHYSICS TARGET LOGIC **
              // If Captured: gestures target capturedObjectRef
              // If NOT Captured: gestures target objectRef (live spawner)
              const obj = isCapturedRef.current ? capturedObjectRef.current : objectRef.current;
              
              const hands = currentHandsRef.current;
              const state = gestureStateRef.current;
              const logic = gestureLogicRef.current;

              // --- 1. DETERMINE RAW MODE ---
              let rawMode: 'NONE' | 'MOVE' | 'EDIT' | 'DUAL_SCALE' = 'NONE';
              let activeHand = hands[0]; // Default to first hand

              if (gesturesEnabled && obj) {
                  if (hands.length >= 2) {
                      const h1 = hands[0];
                      const h2 = hands[1];
                      if (h1.isPinch && h2.isPinch) rawMode = 'DUAL_SCALE';
                      else if (h1.isFist || h2.isFist) { rawMode = 'MOVE'; activeHand = h1.isFist ? h1 : h2; }
                      else if (h1.isPinch || h2.isPinch) { rawMode = 'EDIT'; activeHand = h1.isPinch ? h1 : h2; }
                  } else if (hands.length === 1) {
                      if (activeHand.isFist) rawMode = 'MOVE';
                      else if (activeHand.isPinch) rawMode = 'EDIT';
                  }
              }

              // --- 2. ROBUST GESTURE FILTERING (Debounce & Idle Check) ---
              const now = Date.now();
              let confirmedMode = 'NONE';
              
              // Hysteresis: Confirm gesture only if held for 400ms
              if (rawMode !== logic.pendingMode) {
                  logic.pendingMode = rawMode;
                  logic.confirmationStartTime = now;
                  setGestureFeedback('VERIFYING...');
              }
              
              const isHeld = (now - logic.confirmationStartTime) > 400; // 400ms confirm threshold
              if (isHeld) confirmedMode = logic.pendingMode;

              // Motion check for Idle Timeout
              if (activeHand) {
                  const currentPos = activeHand.p;
                  const dist = Math.hypot(currentPos.x - logic.lastHandPos.x, currentPos.y - logic.lastHandPos.y);
                  
                  // Update last move time if movement is significant (Jitter filter: > 0.005)
                  if (dist > 0.005) {
                      logic.lastMoveTime = now;
                      logic.lastHandPos = { ...currentPos };
                  }
              }

              // Reset to NONE if idle for 2 seconds
              const isIdle = (now - logic.lastMoveTime) > 2000;
              if (isIdle && confirmedMode !== 'NONE') {
                  confirmedMode = 'NONE';
                  setGestureFeedback('IDLE LOCK');
              }

              // --- 3. BIN CHECK & DROP DETECTION ---
              if (obj) {
                  // Project object center to screen coordinates
                  const vector = new window.THREE.Vector3();
                  obj.getWorldPosition(vector);
                  vector.project(cameraRef.current);
                  
                  const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
                  const y = (-(vector.y * 0.5) + 0.5) * window.innerHeight;
                  
                  // Bin Position (Bottom Right: right-8 bottom-8 = 32px from edges, approx center at w-60, h-60)
                  const binX = window.innerWidth - 60;
                  const binY = window.innerHeight - 60;
                  const dist = Math.hypot(x - binX, y - binY);
                  
                  const isHoveringBin = dist < 80;
                  
                  if (isHoveringBin !== isBinActiveRef.current) {
                      isBinActiveRef.current = isHoveringBin;
                      setIsBinActive(isHoveringBin);
                  }
              }

              // --- 4. STATE TRANSITION & DELETE TRIGGER ---
              if (confirmedMode !== state.mode && obj) {
                  // Detect Drop into Bin: Transitioning FROM a gesture TO 'NONE' while over bin
                  if (state.mode !== 'NONE' && confirmedMode === 'NONE' && isBinActiveRef.current) {
                      // Trigger Delete
                      if (isCapturedRef.current) {
                          handleReleaseRef.current(); 
                      } else {
                          onCloseRef.current(); // Close modal/delete active shape
                      }
                  }

                  state.mode = confirmedMode as any;
                  setInteractionMode(confirmedMode as any);
                  state.active = (confirmedMode !== 'NONE');
                  setGestureFeedback(confirmedMode !== 'NONE' ? 'LOCKED' : null);

                  // Initialize new state based on mode
                  if (confirmedMode === 'DUAL_SCALE' && hands.length >= 2) {
                      const h1 = hands[0];
                      const h2 = hands[1];
                      if (h1.pinchPoint && h2.pinchPoint) {
                          const dx = h1.pinchPoint.x - h2.pinchPoint.x;
                          const dy = h1.pinchPoint.y - h2.pinchPoint.y;
                          state.startPinchDist = Math.hypot(dx, dy);
                          state.startObjScale = { ...obj.scale };
                      }
                  } 
                  else if (confirmedMode === 'MOVE') {
                      state.startP = { ...activeHand.p };
                      state.startOrientation = { ...activeHand.orientation };
                      state.startObjPos = { ...obj.position };
                      state.startObjRot = { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z };
                      state.startObjQuat = obj.quaternion.clone();
                  }
                  else if (confirmedMode === 'EDIT') {
                      state.startP = activeHand.pinchPoint ? { ...activeHand.pinchPoint } : { ...activeHand.p };
                      state.startObjScale = { ...obj.scale };
                  }
              }

              // --- 5. PHYSICS EXECUTION ---
              if (state.mode !== 'NONE' && obj) {
                  if (state.mode === 'DUAL_SCALE' && hands.length >= 2) {
                      // UNIFORM SCALING (Zoom)
                      const h1 = hands[0];
                      const h2 = hands[1];
                      if (h1.pinchPoint && h2.pinchPoint) {
                          const dx = h1.pinchPoint.x - h2.pinchPoint.x;
                          const dy = h1.pinchPoint.y - h2.pinchPoint.y;
                          const currentDist = Math.hypot(dx, dy);
                          
                          if (state.startPinchDist > 0) {
                              const scaleFactor = currentDist / state.startPinchDist;
                              const newScale = Math.max(0.2, state.startObjScale.x * scaleFactor);
                              obj.scale.setScalar(newScale);
                              
                              // Visuals
                              if (materialsRef.current) {
                                  materialsRef.current.wire.color.setHex(0x00ff00); // Pure Green
                                  materialsRef.current.solid.color.setHex(0x00ff00);
                              }
                          }
                      }
                  }
                  else if (state.mode === 'MOVE' && state.startP && activeHand) {
                      // MOVE & ROTATE (6DoF)
                      const currentP = activeHand.p;
                      const currentOr = activeHand.orientation;
                      
                      // Check delta to prevent jitter (0.005 threshold)
                      const moveDelta = Math.hypot(currentP.x - state.startP.x, currentP.y - state.startP.y);
                      
                      if (moveDelta > 0.005) {
                          // 1. Translation
                          const dx = currentP.x - state.startP.x;
                          const dy = currentP.y - state.startP.y;
                          const moveSens = 2.5;
                          obj.position.lerp(new window.THREE.Vector3(
                              state.startObjPos.x + (dx * moveSens),
                              state.startObjPos.y + (dy * moveSens),
                              state.startObjPos.z
                          ), 0.2);

                          // 2. Rotation (3D Mapping)
                          const deltaRoll = currentOr.z - state.startOrientation.z;
                          const deltaPitch = currentOr.x - state.startOrientation.x;
                          const deltaYaw = currentOr.y - state.startOrientation.y;

                          const qRoll = new window.THREE.Quaternion().setFromAxisAngle(new window.THREE.Vector3(0,0,1), -deltaRoll * 1.5);
                          const qPitch = new window.THREE.Quaternion().setFromAxisAngle(new window.THREE.Vector3(1,0,0), deltaPitch * 2.0);
                          const qYaw = new window.THREE.Quaternion().setFromAxisAngle(new window.THREE.Vector3(0,1,0), -deltaYaw * 2.0);

                          const targetQuat = state.startObjQuat.clone()
                              .multiply(qRoll)
                              .multiply(qYaw)
                              .multiply(qPitch);
                          
                          obj.quaternion.slerp(targetQuat, 0.15);

                          // Visuals: Red if hovering bin, else Orange
                          if (materialsRef.current) {
                              const color = isBinActiveRef.current ? 0xff0000 : 0xffaa00;
                              materialsRef.current.wire.color.setHex(color);
                              materialsRef.current.solid.color.setHex(color);
                          }
                      }
                  }
                  else if (state.mode === 'EDIT' && state.startP && activeHand) {
                      // SINGLE HAND EDIT (Stretch)
                      const currentP = activeHand.pinchPoint || activeHand.p;
                      const moveDelta = Math.hypot(currentP.x - state.startP.x, currentP.y - state.startP.y);

                      if (moveDelta > 0.005) {
                          const dx = currentP.x - state.startP.x;
                          const dy = currentP.y - state.startP.y;
                          const scaleSens = 3.0;

                          const newScaleX = Math.max(0.2, state.startObjScale.x + (dx * scaleSens));
                          const newScaleY = Math.max(0.2, state.startObjScale.y + (dy * scaleSens));
                          const newScaleZ = (newScaleX + newScaleY) / 2;

                          obj.scale.set(newScaleX, newScaleY, newScaleZ);

                          if (materialsRef.current) {
                              materialsRef.current.wire.color.setHex(0x00ffaa); // Teal/Green
                              materialsRef.current.solid.color.setHex(0x00ffaa);
                          }
                      }
                  }
              } else {
                  // IDLE - Rotate Active Object (Only if NOT captured, or rotate captured if it is)
                  if (materialsRef.current) {
                      materialsRef.current.wire.color.setHex(0x00d8ff);
                      materialsRef.current.solid.color.setHex(0x00d8ff);
                  }
                  if (obj) obj.rotation.y += 0.002;
              }

              rendererRef.current.render(sceneRef.current, cameraRef.current);
          }

          if (videoRef.current && videoRef.current.readyState >= 2 && handsRef.current && !isProcessingRef.current) {
             isProcessingRef.current = true;
             handsRef.current.send({image: videoRef.current}).catch(() => { isProcessingRef.current = false; });
          }

          requestRef.current = requestAnimationFrame(loop);
      };
      loop();
  };

  const filteredShapes = SHAPE_LIBRARY.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const activeShapeName = SHAPE_LIBRARY.find(s => s.id === activeShape)?.name || 'Unknown Object';
  
  const groupedShapes = filteredShapes.reduce((acc, shape) => {
      const cat = shape.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(shape);
      return acc;
  }, {} as Record<string, typeof SHAPE_LIBRARY>);

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 bg-black flex flex-col animate-fade-in font-['Rajdhani']">
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-40 pointer-events-none" playsInline muted />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
        <canvas ref={threeCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,216,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,216,255,0.05)_1px,transparent_1px)] bg-[size:80px_80px] pointer-events-none opacity-30" />

        {/* TOP BAR */}
        <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start pointer-events-auto z-20">
            {/* Left: Status */}
            <div className="flex flex-col">
                 <h1 className="text-xl font-bold text-white tracking-[0.2em] shadow-black drop-shadow-md">HOLODECK</h1>
                 <div className="flex flex-col gap-1">
                     <span className={`text-xs tracking-widest font-bold flex items-center gap-2 ${
                        interactionMode === 'MOVE' ? 'text-orange-400' : 
                        interactionMode === 'EDIT' ? 'text-green-400' : 
                        interactionMode === 'DUAL_SCALE' ? 'text-purple-400' : 
                        'text-jarvis-blue/80'}`}>
                        {interactionMode === 'NONE' && status}
                        {interactionMode === 'MOVE' && <><Move className="w-3 h-3"/> 6DOF MANIPULATION ACTIVE</>}
                        {interactionMode === 'EDIT' && <><Maximize className="w-3 h-3"/> GEOMETRY STRETCH ACTIVE</>}
                        {interactionMode === 'DUAL_SCALE' && <><Zap className="w-3 h-3"/> UNIFIED SCALING ACTIVE</>}
                    </span>
                    {gestureFeedback && (
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded w-fit ${
                            gestureFeedback === 'LOCKED' ? 'bg-green-500/20 text-green-400' : 
                            gestureFeedback === 'IDLE LOCK' ? 'bg-red-500/20 text-red-400' : 
                            'bg-yellow-500/20 text-yellow-400'
                        }`}>
                            STATUS: {gestureFeedback}
                        </span>
                    )}
                 </div>
            </div>

            {/* CENTER: DROPDOWN MENU & CONTROLS */}
            <div className="absolute left-1/2 -translate-x-1/2 top-4 flex flex-col items-center gap-2">
                 <button 
                     onClick={() => setIsMenuOpen(!isMenuOpen)}
                     className={`flex items-center gap-3 px-6 py-2 rounded-full border transition-all duration-300 backdrop-blur-md shadow-[0_0_15px_rgba(0,216,255,0.2)] ${isMenuOpen ? 'bg-jarvis-blue/20 border-jarvis-blue text-white' : 'bg-black/60 border-jarvis-blue/30 text-cyan-100 hover:bg-jarvis-blue/10 hover:border-jarvis-blue/60'}`}
                 >
                     <Box className="w-4 h-4 text-jarvis-blue" />
                     <span className="font-bold tracking-widest text-sm uppercase">{activeShapeName}</span>
                     {isMenuOpen ? <ChevronUp className="w-4 h-4 opacity-70" /> : <ChevronDown className="w-4 h-4 opacity-70" />}
                 </button>

                 <div className="flex gap-2">
                     <button
                        onClick={() => setGesturesEnabled(prev => !prev)}
                        className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest border transition-all ${
                            gesturesEnabled ? 'bg-green-500/10 border-green-500/50 text-green-400' : 'bg-red-500/10 border-red-500/50 text-red-400'
                        }`}
                     >
                         {gesturesEnabled ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                         {gesturesEnabled ? 'HAND TRACKING ON' : 'GESTURES DISABLED'}
                     </button>

                     <button
                        onClick={isCaptured ? handleRelease : handleCapture}
                        className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest border transition-all ${
                            isCaptured ? 'bg-cyan-500/20 border-cyan-400 text-cyan-400 animate-pulse' : 'bg-blue-500/10 border-blue-500/50 text-blue-400 hover:bg-blue-500/20'
                        }`}
                     >
                         {isCaptured ? <Trash2 className="w-3 h-3" /> : <Camera className="w-3 h-3" />}
                         {isCaptured ? 'RELEASE HOLOGRAM' : 'CAPTURE HOLOGRAM'}
                     </button>
                 </div>

                 {isMenuOpen && (
                     <div className="mt-2 w-[340px] max-h-[60vh] bg-black/90 border border-jarvis-blue/50 backdrop-blur-xl rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col animate-slide-down">
                         {/* Search Header */}
                         <div className="p-3 border-b border-jarvis-blue/20 bg-white/5">
                             <div className="relative">
                                 <Search className="absolute left-3 top-2.5 w-4 h-4 text-jarvis-blue" />
                                 <input 
                                     type="text" 
                                     placeholder="Search schematic database..." 
                                     className="w-full bg-black/60 border border-jarvis-blue/30 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:border-jarvis-blue focus:ring-1 focus:ring-jarvis-blue outline-none transition-all placeholder-gray-600"
                                     value={searchQuery}
                                     onChange={(e) => setSearchQuery(e.target.value)}
                                     autoFocus
                                 />
                             </div>
                         </div>
                         
                         {/* Scrollable List */}
                         <div className="overflow-y-auto custom-scrollbar flex-1 p-2">
                             {Object.keys(groupedShapes).length === 0 && (
                                 <div className="text-center py-8 text-gray-500 text-xs tracking-wider">NO MATCHING SCHEMATICS FOUND</div>
                             )}
                             
                             {Object.entries(groupedShapes).map(([catCode, items]) => (
                                 <div key={catCode} className="mb-3 last:mb-0">
                                     <div className="flex items-center justify-between px-2 mb-1">
                                         <span className="text-[10px] font-bold text-jarvis-blue/70 uppercase tracking-widest">{CATEGORY_LABELS[catCode] || catCode}</span>
                                         <span className="text-[9px] bg-jarvis-blue/10 text-jarvis-blue px-1.5 rounded-full">{items.length}</span>
                                     </div>
                                     <div className="grid grid-cols-1 gap-1">
                                         {items.map(s => (
                                             <button 
                                                 key={s.id}
                                                 onClick={() => {
                                                     setActiveShape(s.id);
                                                     onSelectShape();
                                                     setIsMenuOpen(false);
                                                 }}
                                                 className={`flex items-center gap-3 p-2.5 rounded-lg text-left transition-all border ${activeShape === s.id ? 'bg-jarvis-blue/20 border-jarvis-blue text-white shadow-[inset_0_0_10px_rgba(0,216,255,0.1)]' : 'bg-transparent border-transparent text-gray-300 hover:bg-white/5 hover:text-white'}`}
                                             >
                                                 <div className={`p-1.5 rounded bg-black/40 ${activeShape === s.id ? 'text-jarvis-blue' : 'text-gray-500'}`}>
                                                     <s.icon className="w-4 h-4" />
                                                 </div>
                                                 <span className="text-sm font-medium tracking-wide flex-1">{s.name}</span>
                                                 {activeShape === s.id && <div className="w-1.5 h-1.5 bg-jarvis-blue rounded-full animate-pulse shadow-[0_0_5px_#00d8ff]" />}
                                             </button>
                                         ))}
                                     </div>
                                 </div>
                             ))}
                         </div>
                         
                         {/* Footer */}
                         <div className="p-2 border-t border-jarvis-blue/20 bg-black/80 text-[9px] text-center text-gray-500 font-mono">
                             STARK INDUSTRIES CLASSIFIED DATABASE
                         </div>
                     </div>
                 )}
            </div>

            {/* Right: Close Button */}
            <button onClick={onClose} className="bg-black/60 border border-red-500/50 text-red-500 p-2 rounded-full hover:bg-red-500/20 transition-all hover:rotate-90 backdrop-blur-sm z-30">
                <X className="w-6 h-6" />
            </button>
        </div>

        {/* DELETE BIN - BOTTOM RIGHT */}
        <div className={`absolute bottom-8 right-8 w-20 h-20 rounded-full border-2 flex items-center justify-center transition-all duration-300 z-10 ${isBinActive ? 'border-red-500 bg-red-500/20 scale-125 shadow-[0_0_30px_rgba(239,68,68,0.5)]' : 'border-gray-700 bg-black/40 opacity-50'}`}>
            <Trash2 className={`w-8 h-8 ${isBinActive ? 'text-red-500 animate-bounce' : 'text-gray-500'}`} />
        </div>

        {/* BOTTOM HUD: INSTRUCTIONS */}
        <div className="absolute bottom-8 w-full flex justify-center pointer-events-none z-10">
             <div className="flex gap-4 bg-black/80 backdrop-blur border border-jarvis-blue/30 px-6 py-3 rounded-full items-center shadow-[0_0_20px_rgba(0,216,255,0.2)]">
                 <div className={`flex items-center gap-2 transition-all duration-300 ${interactionMode === 'MOVE' ? 'opacity-100 text-orange-400 scale-110 font-bold' : 'opacity-50 text-gray-400'}`}>
                     <Hand className="w-4 h-4" />
                     <div className="flex flex-col">
                         <span className="text-[10px] tracking-widest">FIST</span>
                         <span className="text-[8px] tracking-widest">MOVE & ROTATE 360°</span>
                     </div>
                 </div>
                 <div className="h-4 w-px bg-gray-700" />
                 <div className={`flex items-center gap-2 transition-all duration-300 ${interactionMode === 'EDIT' ? 'opacity-100 text-green-400 scale-110 font-bold' : 'opacity-50 text-gray-400'}`}>
                     <Maximize className="w-4 h-4" />
                     <div className="flex flex-col">
                        <span className="text-[10px] tracking-widest">1-HAND PINCH</span>
                        <span className="text-[8px] tracking-widest">STRETCH DIMENSIONS</span>
                     </div>
                 </div>
                 <div className="h-4 w-px bg-gray-700" />
                 <div className={`flex items-center gap-2 transition-all duration-300 ${interactionMode === 'DUAL_SCALE' ? 'opacity-100 text-purple-400 scale-110 font-bold' : 'opacity-50 text-gray-400'}`}>
                     <Zap className="w-4 h-4" />
                     <div className="flex flex-col">
                        <span className="text-[10px] tracking-widest">2-HAND PINCH</span>
                        <span className="text-[8px] tracking-widest">UNIFIED SCALING</span>
                     </div>
                 </div>
             </div>
        </div>

    </div>
  );
};

export default HologramMode;
