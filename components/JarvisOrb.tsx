import React, { useEffect, useRef } from 'react';

interface JarvisOrbProps {
  isActive: boolean;
  audioLevel: number; // 0 to 255
}

const JarvisOrb: React.FC<JarvisOrbProps> = ({ isActive, audioLevel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      // Base Pulse
      const baseRadius = 60;
      const dynamicRadius = baseRadius + (audioLevel / 4); // React to sound
      
      // Core
      const gradient = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, dynamicRadius);
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(0.3, '#00d8ff');
      gradient.addColorStop(0.7, 'rgba(0, 216, 255, 0.3)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.beginPath();
      ctx.arc(centerX, centerY, dynamicRadius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Outer Rings (Iron Man HUD style)
      ctx.strokeStyle = '#00d8ff';
      ctx.lineWidth = 2;

      // Rotating Ring 1
      const time = Date.now() / 1000;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius + 30, time, time + Math.PI * 1.5);
      ctx.stroke();

      // Rotating Ring 2 (Counter)
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius + 45, -time * 0.8, -time * 0.8 + Math.PI);
      ctx.strokeStyle = 'rgba(0, 216, 255, 0.5)';
      ctx.stroke();
      
      // Decorative ticks
      for(let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2 + (time * 0.1);
        const rStart = baseRadius + 60;
        const rEnd = baseRadius + 70;
        ctx.beginPath();
        ctx.moveTo(centerX + Math.cos(angle) * rStart, centerY + Math.sin(angle) * rStart);
        ctx.lineTo(centerX + Math.cos(angle) * rEnd, centerY + Math.sin(angle) * rEnd);
        ctx.strokeStyle = 'rgba(0, 216, 255, 0.8)';
        ctx.stroke();
      }

      if (isActive) {
         animationId = requestAnimationFrame(draw);
      } else {
         // Idle state drawing
         ctx.beginPath();
         ctx.arc(centerX, centerY, 40, 0, Math.PI * 2);
         ctx.fillStyle = 'rgba(0, 216, 255, 0.1)';
         ctx.fill();
         ctx.strokeStyle = 'rgba(0, 216, 255, 0.3)';
         ctx.stroke();
      }
    };

    draw();

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [isActive, audioLevel]);

  return (
    <div className="relative flex items-center justify-center w-full max-w-[350px] aspect-square">
       <canvas 
         ref={canvasRef} 
         width={400} 
         height={400} 
         className="z-10 w-full h-full"
       />
       {/* Background glow effects */}
       <div className={`absolute inset-0 rounded-full bg-jarvis-blue blur-[80px] opacity-20 transition-opacity duration-300 ${isActive ? 'opacity-30' : 'opacity-10'}`}></div>
    </div>
  );
};

export default JarvisOrb;