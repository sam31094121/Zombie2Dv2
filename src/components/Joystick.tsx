import React, { useState, useEffect, useRef, useCallback } from 'react';

interface JoystickProps {
  onMove: (input: { x: number, y: number } | null) => void;
  color?: string;
}

export const Joystick: React.FC<JoystickProps> = ({ onMove, color = 'white' }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const touchIdRef = useRef<number | null>(null);
  const radius = 50;

  const handleMove = useCallback((e: React.TouchEvent | React.MouseEvent | TouchEvent | MouseEvent) => {
    if (!isDraggingRef.current) return;

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      let clientX, clientY;
      if ('touches' in e) {
        // Find the specific touch that started on this joystick
        const touch = Array.from((e as TouchEvent).touches).find(t => t.identifier === touchIdRef.current);
        if (!touch) return; // Ignore if the tracked touch is not present
        clientX = touch.clientX;
        clientY = touch.clientY;
      } else {
        clientX = (e as MouseEvent).clientX;
        clientY = (e as MouseEvent).clientY;
      }

      const dx = clientX - centerX;
      const dy = clientY - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      const limitedDistance = Math.min(distance, radius);
      const angle = Math.atan2(dy, dx);
      
      const newX = Math.cos(angle) * limitedDistance;
      const newY = Math.sin(angle) * limitedDistance;

      setPosition({ x: newX, y: newY });
      
      // Normalize input
      onMove({
        x: newX / radius,
        y: newY / radius
      });
    }
  }, [onMove, radius]);

  const handleStart = (e: React.TouchEvent | React.MouseEvent) => {
    isDraggingRef.current = true;
    setIsDragging(true);
    
    if ('changedTouches' in e) {
      touchIdRef.current = e.changedTouches[0].identifier;
    }
    
    handleMove(e);
  };

  const handleEnd = useCallback((e: TouchEvent | MouseEvent) => {
    if ('changedTouches' in e) {
      // Check if the touch that ended is the one we are tracking
      const touch = Array.from((e as TouchEvent).changedTouches).find(t => t.identifier === touchIdRef.current);
      if (!touch) return; // Ignore if a different touch ended
    }

    isDraggingRef.current = false;
    touchIdRef.current = null;
    setIsDragging(false);
    setPosition({ x: 0, y: 0 });
    onMove(null);
  }, [onMove]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleMove, { passive: false });
      window.addEventListener('touchend', handleEnd);
      window.addEventListener('touchcancel', handleEnd);
    } else {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
      window.removeEventListener('touchcancel', handleEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
      window.removeEventListener('touchcancel', handleEnd);
    };
  }, [isDragging, handleMove, handleEnd]);

  return (
    <div 
      ref={containerRef}
      className="relative w-32 h-32 flex items-center justify-center rounded-full bg-white/10 border-2 border-white/20 backdrop-blur-sm touch-none select-none"
      onMouseDown={handleStart}
      onTouchStart={handleStart}
    >
      {/* Base */}
      <div className="absolute w-16 h-16 rounded-full bg-white/5 border border-white/10" />
      
      {/* Stick */}
      <div 
        className="absolute w-12 h-12 rounded-full shadow-lg transition-transform duration-75 ease-out flex items-center justify-center"
        style={{ 
          transform: `translate(${position.x}px, ${position.y}px)`,
          backgroundColor: color,
          boxShadow: `0 0 20px ${color}44`
        }}
      >
        <div className="w-6 h-6 rounded-full bg-black/10 border border-black/5" />
      </div>
    </div>
  );
};
