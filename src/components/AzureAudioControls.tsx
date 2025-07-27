// src/components/AzureAudioControls.tsx
"use client";

import React, { useRef, useCallback, useState, useEffect } from 'react';
import type { WordHighlightData } from '@/hooks/useAzureAudioPlayer';

interface AudioControlsProps {
  // Audio state
  isPlaying: boolean;
  progress: number;
  duration: number;
  isLoading: boolean;
  hasError: boolean;
  errorMessage?: string;
  isSupported: boolean; // Whether Azure TTS is working or fallback mode
  
  // Word highlighting
  highlightedWords?: WordHighlightData[];
  currentWordIndex?: number;
  
  // Callbacks
  onPlay?: () => void;
  onPlaySlow?: () => void;
  onTogglePlayback?: () => void;
  onStop?: () => void;
  onSeek?: (time: number) => void;
  onSeekToWord?: (wordIndex: number) => void;
  onRetry?: () => void;
  
  // UI state
  visible?: boolean;
  showRetryButton?: boolean;
  showWordMarkers?: boolean;
  
  // Styling
  className?: string;
  
  // Drag state control
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export default function AzureAudioControls({
  isPlaying,
  progress,
  duration,
  isLoading,
  hasError,
  errorMessage,
  isSupported = true,
  highlightedWords = [],
  currentWordIndex = -1,
  onPlay,
  onPlaySlow,
  onTogglePlayback,
  onStop,
  onSeek,
  onSeekToWord,
  onRetry,
  visible = true,
  showRetryButton = true,
  showWordMarkers = true,
  className = "",
  onDragStart,
  onDragEnd
}: AudioControlsProps) {
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragProgress, setDragProgress] = useState(0);

  // Calculate progress percentage
  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;
  const displayPercent = isDragging ? dragProgress : progressPercent;

  // Handle drag operations
  const handleDrag = useCallback((e: MouseEvent | TouchEvent) => {
    if (!progressBarRef.current || duration <= 0) return;

    const rect = progressBarRef.current.getBoundingClientRect();
    let clientX: number;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
    } else {
      clientX = e.clientX;
    }

    const offsetX = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    const newProgress = (offsetX / rect.width) * 100;
    const newTime = (newProgress / 100) * duration;

    setDragProgress(newProgress);

    // If this is the final position, seek to it
    if (!isDragging) {
      onSeek?.(newTime);
    }
  }, [duration, isDragging, onSeek]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    onDragStart?.();
    handleDrag(e.nativeEvent);
  }, [handleDrag, onDragStart]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setIsDragging(true);
    onDragStart?.();
    handleDrag(e.nativeEvent);
  }, [handleDrag, onDragStart]);

  // Global mouse/touch handlers
  useEffect(() => {
    const handleGlobalMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      e.preventDefault();
      handleDrag(e);
    };

    const handleGlobalUp = (e: MouseEvent | TouchEvent) => {
      if (isDragging) {
        handleDrag(e); // Final position
        onSeek?.((dragProgress / 100) * duration);
        setIsDragging(false);
        onDragEnd?.();
      }
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleGlobalMove);
      document.addEventListener('mouseup', handleGlobalUp);
      document.addEventListener('touchmove', handleGlobalMove, { passive: false });
      document.addEventListener('touchend', handleGlobalUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMove);
      document.removeEventListener('mouseup', handleGlobalUp);
      document.removeEventListener('touchmove', handleGlobalMove);
      document.removeEventListener('touchend', handleGlobalUp);
    };
  }, [isDragging, handleDrag, dragProgress, duration, onSeek, onDragEnd]);

  // Render word position markers on progress bar
  const renderWordMarkers = () => {
    if (!showWordMarkers || !highlightedWords.length || duration <= 0) return null;

    return highlightedWords.map((word, index) => {
      if (word.startTime <= 0) return null;
      
      const position = (word.startTime / duration) * 100;
      const isActive = index === currentWordIndex;
      
      return (
        <button
          key={index}
          className={`absolute w-2 h-2 rounded-full transform -translate-x-1/2 -translate-y-1/2 
            transition-all duration-200 hover:scale-125 z-10 ${
            isActive 
              ? 'bg-yellow-400 border-2 border-yellow-600 shadow-lg' 
              : 'bg-white/60 border border-gray-400 hover:bg-white/80'
          }`}
          style={{ 
            left: `${Math.min(Math.max(position, 1), 99)}%`,
            top: '50%'
          }}
          onClick={() => onSeekToWord?.(index)}
          title={`${word.word} (${word.startTime.toFixed(1)}s)`}
          data-word-marker
        />
      );
    });
  };

  // Loading indicator
  const renderLoadingIndicator = () => (
    <div className="flex items-center gap-2 text-sm">
      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <span>Generating audio...</span>
    </div>
  );

  // Error state
  const renderError = () => (
    <div className="flex items-center gap-2 text-sm text-red-600">
      <span>⚠️</span>
      <span>{errorMessage || 'Audio error'}</span>
      {showRetryButton && onRetry && (
        <button
          onClick={onRetry}
          className="ml-2 px-2 py-1 bg-red-100 hover:bg-red-200 rounded text-xs transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );

  // Format time display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!visible) return null;

  return (
    <div className={`flex items-center gap-3 w-full ${className}`} data-audio-controls>
      {/* Play Controls */}
      <div className="flex items-center gap-2">
        {/* Speaker Button (Normal Speed) */}
        <button
          onClick={onPlay}
          disabled={isLoading}
          className={`text-xl hover:scale-110 transition-transform ${
            isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:text-blue-600'
          }`}
          title="Play at normal speed"
          data-audio-control="speaker"
        >
          {isLoading ? '⏳' : '🔊'}
        </button>

        {/* Turtle Button (Slow Speed) */}
        <button
          onClick={onPlaySlow}
          disabled={isLoading}
          className={`text-xl hover:scale-110 transition-transform ${
            isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:text-green-600'
          }`}
          title="Play at slow speed"
          data-audio-control="turtle"
        >
          🐢
        </button>

        {/* Play/Pause Toggle (when audio is active) */}
        {(isPlaying || progress > 0) && (
          <button
            onClick={onTogglePlayback}
            className="text-lg hover:scale-110 transition-transform hover:text-blue-600"
            title={isPlaying ? 'Pause' : 'Resume'}
            data-audio-control="toggle"
          >
            {isPlaying ? '⏸️' : '▶️'}
          </button>
        )}
      </div>

      {/* Progress Area */}
      <div className="flex-1 flex items-center gap-2">
        {/* Status Display */}
        {isLoading && renderLoadingIndicator()}
        {hasError && renderError()}
        
        {/* Progress Bar */}
        {!isLoading && !hasError && duration > 0 && (
          <>
            {/* Time Display */}
            <span className="text-xs text-gray-600 min-w-fit">
              {formatTime(progress)}
            </span>
            
            {/* Progress Bar Container */}
            <div className="relative flex-1 h-[30px] flex items-center">
              <div
                ref={progressBarRef}
                className="relative w-full h-[6px] bg-white/30 backdrop-blur-2xl border border-black/10 
                         rounded-full shadow-inner cursor-pointer"
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                data-audio-scrubber
              >
                {/* Progress Fill */}
                <div
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-400 to-blue-600 
                           rounded-full transition-all duration-100"
                  style={{ width: `${displayPercent}%` }}
                />
                
                {/* Word Markers */}
                {renderWordMarkers()}
                
                {/* Scrubber Handle */}
                <div
                  className="absolute top-1/2 w-5 h-5 bg-white/90 backdrop-blur-md border border-black/20 
                           rounded-full shadow-lg transform -translate-y-1/2 -translate-x-1/2
                           cursor-grab active:cursor-grabbing transition-all duration-100"
                  style={{ left: `${displayPercent}%` }}
                >
                  <div className="absolute inset-1 bg-blue-500 rounded-full" />
                </div>
              </div>
            </div>
            
            {/* Duration Display */}
            <span className="text-xs text-gray-600 min-w-fit">
              {formatTime(duration)}
            </span>
          </>
        )}

        {/* Technology Indicator */}
        {!isLoading && !hasError && (
          <div className="text-xs text-gray-500" title={isSupported ? 'Azure TTS with word highlighting' : 'Static audio fallback'}>
            {isSupported ? '🤖' : '📁'}
          </div>
        )}
      </div>

      {/* Close Button */}
      {(isPlaying || progress > 0) && onStop && (
        <button
          onClick={onStop}
          className="text-lg hover:scale-110 transition-transform hover:text-red-600 ml-2"
          title="Stop and close"
          data-audio-control="close"
        >
          ✖️
        </button>
      )}
    </div>
  );
}

// Simplified version for basic use cases
export function SimpleAudioControls({
  isPlaying,
  progress,
  duration,
  onPlay,
  onPlaySlow,
  onTogglePlayback,
  onStop,
  onSeek,
  className = ""
}: Pick<AudioControlsProps, 'isPlaying' | 'progress' | 'duration' | 'onPlay' | 'onPlaySlow' | 'onTogglePlayback' | 'onStop' | 'onSeek' | 'className'>) {
  return (
    <AzureAudioControls
      isPlaying={isPlaying}
      progress={progress}
      duration={duration}
      isLoading={false}
      hasError={false}
      isSupported={true}
      onPlay={onPlay}
      onPlaySlow={onPlaySlow}
      onTogglePlayback={onTogglePlayback}
      onStop={onStop}
      onSeek={onSeek}
      showWordMarkers={false}
      className={className}
    />
  );
}