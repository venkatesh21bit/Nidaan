'use client';

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

interface AIVoiceOrbProps {
  state: VoiceState;
  audioLevel?: number; // 0-100
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  statusText?: string;
}

export function AIVoiceOrb({
  state,
  audioLevel = 0,
  onClick,
  size = 'lg',
  className,
  statusText
}: AIVoiceOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [pulse, setPulse] = useState(0);

  // Size configurations
  const sizeConfig = {
    sm: { orb: 80, canvas: 140 },
    md: { orb: 120, canvas: 200 },
    lg: { orb: 160, canvas: 280 },
    xl: { orb: 220, canvas: 380 }
  };

  const config = sizeConfig[size];

  // State-based colors - matching the blue glow from the reference image
  const stateColors = {
    idle: { inner: '#0c4a6e', outer: '#0ea5e9', glow: '#38bdf8' },
    listening: { inner: '#0284c7', outer: '#38bdf8', glow: '#7dd3fc' },
    processing: { inner: '#4f46e5', outer: '#818cf8', glow: '#a5b4fc' },
    speaking: { inner: '#059669', outer: '#34d399', glow: '#6ee7b7' },
    error: { inner: '#b91c1c', outer: '#f87171', glow: '#fca5a5' }
  };

  const colors = stateColors[state];

  // Animate pulse effect
  useEffect(() => {
    let start: number;
    const animate = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = (timestamp - start) / 1000;
      
      // Different animation speeds based on state
      const speed = state === 'listening' ? 2.5 : state === 'processing' ? 4 : 1.2;
      setPulse(Math.sin(progress * speed) * 0.5 + 0.5);
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [state]);

  // Canvas glow effect - creates the blue radial glow like the reference image
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameId: number;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      
      ctx.clearRect(0, 0, width, height);
      
      // Dynamic glow intensity based on audio level and state
      const baseIntensity = state === 'listening' ? 0.7 + (audioLevel / 100) * 0.3 : 
                           state === 'processing' ? 0.6 + pulse * 0.4 :
                           state === 'speaking' ? 0.8 : 0.4;
      
      // Create the main radial glow effect (like the reference blue orb image)
      const maxRadius = config.canvas / 2;
      
      // Outer soft glow
      const outerGradient = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, maxRadius
      );
      outerGradient.addColorStop(0, `${colors.glow}${Math.floor(baseIntensity * 200).toString(16).padStart(2, '0')}`);
      outerGradient.addColorStop(0.3, `${colors.outer}${Math.floor(baseIntensity * 150).toString(16).padStart(2, '0')}`);
      outerGradient.addColorStop(0.6, `${colors.outer}${Math.floor(baseIntensity * 80).toString(16).padStart(2, '0')}`);
      outerGradient.addColorStop(1, 'transparent');
      
      ctx.fillStyle = outerGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, maxRadius, 0, Math.PI * 2);
      ctx.fill();

      // Pulsing rings when listening
      if (state === 'listening') {
        const ringCount = 3;
        for (let i = 0; i < ringCount; i++) {
          const ringProgress = ((Date.now() / 1000) + i * 0.3) % 1;
          const ringRadius = (config.orb / 2) + ringProgress * 60;
          const ringAlpha = (1 - ringProgress) * 0.4 * baseIntensity;
          
          ctx.strokeStyle = `${colors.glow}${Math.floor(ringAlpha * 255).toString(16).padStart(2, '0')}`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Audio reactive outer ring
      if (state === 'listening' && audioLevel > 5) {
        const audioRadius = (config.orb / 2) + 10 + (audioLevel / 100) * 40;
        ctx.strokeStyle = `${colors.glow}${Math.floor(0.6 * 255).toString(16).padStart(2, '0')}`;
        ctx.lineWidth = 3 + (audioLevel / 100) * 4;
        ctx.beginPath();
        ctx.arc(centerX, centerY, audioRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      frameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [state, audioLevel, pulse, colors, config]);

  // Status text
  const getStatusText = () => {
    if (statusText) return statusText;
    switch (state) {
      case 'idle': return 'Tap to speak';
      case 'listening': return 'Listening...';
      case 'processing': return 'Processing...';
      case 'speaking': return 'AI Speaking';
      case 'error': return 'Error occurred';
      default: return '';
    }
  };

  const getIcon = () => {
    switch (state) {
      case 'idle':
        return (
          <svg className="w-12 h-12 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
          </svg>
        );
      case 'listening':
        return (
          <div className="flex items-center justify-center space-x-1 h-12">
            <div className="w-1.5 bg-white rounded-full animate-voice-wave-1" style={{ height: '60%' }} />
            <div className="w-1.5 bg-white rounded-full animate-voice-wave-2" style={{ height: '80%' }} />
            <div className="w-1.5 bg-white rounded-full animate-voice-wave-3" style={{ height: '100%' }} />
            <div className="w-1.5 bg-white rounded-full animate-voice-wave-2" style={{ height: '80%' }} />
            <div className="w-1.5 bg-white rounded-full animate-voice-wave-1" style={{ height: '60%' }} />
          </div>
        );
      case 'processing':
        return (
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 border-4 border-white/30 rounded-full" />
            <div className="absolute inset-0 border-4 border-transparent border-t-white rounded-full animate-spin" />
          </div>
        );
      case 'speaking':
        return (
          <svg className="w-12 h-12 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
          </svg>
        );
      case 'error':
        return (
          <svg className="w-12 h-12 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
        );
    }
  };

  return (
    <div className={cn("flex flex-col items-center", className)}>
      {/* Orb Container */}
      <div 
        className="relative cursor-pointer select-none"
        style={{ width: config.canvas, height: config.canvas }}
        onClick={onClick}
      >
        {/* Canvas for glow effects */}
        <canvas
          ref={canvasRef}
          width={config.canvas}
          height={config.canvas}
          className="absolute inset-0 pointer-events-none"
        />
        
        {/* Main Orb */}
        <div
          className={cn(
            "absolute rounded-full flex items-center justify-center transition-all duration-300",
            "border border-white/30 backdrop-blur-sm",
            state === 'idle' && "hover:scale-105"
          )}
          style={{
            width: config.orb,
            height: config.orb,
            left: (config.canvas - config.orb) / 2,
            top: (config.canvas - config.orb) / 2,
            background: `radial-gradient(circle at 35% 35%, ${colors.glow}90, ${colors.outer}80, ${colors.inner})`,
            boxShadow: `
              0 0 ${30 + pulse * 20}px ${colors.glow}90,
              0 0 ${60 + pulse * 30}px ${colors.outer}60,
              0 0 ${90 + pulse * 40}px ${colors.outer}30,
              inset 0 0 40px ${colors.glow}30
            `,
            transform: `scale(${1 + (state === 'listening' ? (audioLevel / 100) * 0.15 : 0) + (state !== 'idle' ? pulse * 0.05 : 0)})`
          }}
        >
          {getIcon()}
        </div>
      </div>

      {/* Status Text */}
      <div className="mt-2 text-center">
        <p className={cn(
          "text-xl font-semibold tracking-wide transition-colors duration-300",
          state === 'idle' && "text-slate-300",
          state === 'listening' && "text-cyan-400",
          state === 'processing' && "text-indigo-400",
          state === 'speaking' && "text-emerald-400",
          state === 'error' && "text-red-400"
        )}>
          {getStatusText()}
        </p>
      </div>
    </div>
  );
}
