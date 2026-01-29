
import React, { useRef, useState, useEffect } from 'react';
import { Obstacle } from '../types';

interface EditorProps {
  imageUrl: string;
  obstacles: Obstacle[];
  addObstacle: (o: Obstacle) => void;
  removeObstacle: (id: string) => void;
}

const Editor: React.FC<EditorProps> = ({ imageUrl, obstacles, addObstacle, removeObstacle }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImgSize({ w: img.width, h: img.height });
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    
    let clientX: number;
    let clientY: number;

    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height
    };
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    // Voorkom scrollen op mobiel tijdens het tekenen
    if (e.cancelable) e.preventDefault();
    setIsDrawing(true);
    const pos = getPos(e);
    setStartPos(pos);
    setCurrentPos(pos);
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    // Ook hier scrollen voorkomen
    if (e.cancelable) e.preventDefault();
    setCurrentPos(getPos(e));
  };

  const handleEnd = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const x = Math.min(startPos.x, currentPos.x);
    const y = Math.min(startPos.y, currentPos.y);
    const width = Math.abs(currentPos.x - startPos.x);
    const height = Math.abs(currentPos.y - startPos.y);

    // Alleen toevoegen als het vlak een minimale grootte heeft
    if (width > 0.005 && height > 0.005) {
      addObstacle({
        id: Math.random().toString(36).substr(2, 9),
        x, y, width, height
      });
    }
  };

  return (
    <div 
      ref={containerRef}
      className="relative max-w-full max-h-full shadow-2xl overflow-hidden cursor-crosshair border-4 border-zinc-800 rounded-lg select-none"
      style={{ aspectRatio: `${imgSize.w}/${imgSize.h}`, touchAction: 'none' }}
    >
      <img 
        src={imageUrl} 
        alt="Target Wall" 
        className="block w-full h-full pointer-events-none" 
      />
      
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full z-10"
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
        style={{ touchAction: 'none' }}
      />

      <div className="absolute inset-0 pointer-events-none z-20">
        {/* Bestaande Obstakels */}
        {obstacles.map(obs => (
          <div
            key={obs.id}
            className="absolute border-2 border-red-500 bg-red-500/20"
            style={{
              left: `${obs.x * 100}%`,
              top: `${obs.y * 100}%`,
              width: `${obs.width * 100}%`,
              height: `${obs.height * 100}%`
            }}
          />
        ))}

        {/* Huidige Selectie */}
        {isDrawing && (
          <div
            className="absolute border-2 border-yellow-400 bg-yellow-400/20"
            style={{
              left: `${Math.min(startPos.x, currentPos.x) * 100}%`,
              top: `${Math.min(startPos.y, currentPos.y) * 100}%`,
              width: `${Math.abs(currentPos.x - startPos.x) * 100}%`,
              height: `${Math.abs(currentPos.y - startPos.y) * 100}%`
            }}
          />
        )}
      </div>

      <div className="absolute top-2 left-2 bg-black/80 px-2 py-1 rounded text-[10px] text-zinc-400 font-bold uppercase tracking-widest pointer-events-none">
        Setup Mode: Teken collision boxen
      </div>
    </div>
  );
};

export default Editor;
