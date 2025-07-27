// src/components/WordHighlighter.tsx
"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { WordHighlightData } from '@/hooks/useAzureAudioPlayer';

export type HighlightStyle = 'subtle' | 'prominent' | 'pulse';

interface WordHighlighterProps {
  sentence: string;
  highlightedWords?: WordHighlightData[];
  currentWordIndex?: number;
  highlightStyle?: HighlightStyle;
  onWordClick?: (wordIndex: number, word: string) => void;
  isClickable?: boolean;
  className?: string;
  wordClassName?: string;
  activeWordClassName?: string;
  disabled?: boolean;
}

interface WordData {
  text: string;
  isWord: boolean;
  originalIndex: number;
}

export default function WordHighlighter({
  sentence,
  highlightedWords = [],
  currentWordIndex = -1,
  highlightStyle = 'subtle',
  onWordClick,
  isClickable = false,
  className = "",
  wordClassName = "",
  activeWordClassName = "",
  disabled = false
}: WordHighlighterProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const wordRefs = useRef<Array<HTMLSpanElement | null>>([]);

  // Parse sentence into words and spaces
  const parseWords = useCallback((text: string): WordData[] => {
    const parts = text.split(/(\s+)/);
    const result: WordData[] = [];
    let wordIndex = 0;

    parts.forEach(part => {
      if (part.trim().length > 0) {
        // It's a word
        result.push({
          text: part,
          isWord: true,
          originalIndex: wordIndex
        });
        wordIndex++;
      } else {
        // It's whitespace
        result.push({
          text: part,
          isWord: false,
          originalIndex: -1
        });
      }
    });

    return result;
  }, []);

  const words = parseWords(sentence);

  // Get highlight data for a word
  const getWordHighlight = useCallback((wordIndex: number): WordHighlightData | null => {
    return highlightedWords.find(hw => hw.index === wordIndex) || null;
  }, [highlightedWords]);

  // Check if word is currently active
  const isWordActive = useCallback((wordIndex: number): boolean => {
    const highlight = getWordHighlight(wordIndex);
    return highlight?.isActive || wordIndex === currentWordIndex;
  }, [getWordHighlight, currentWordIndex]);

  // Handle word click
  const handleWordClick = useCallback((wordIndex: number, word: string) => {
    if (disabled || !isClickable) return;
    onWordClick?.(wordIndex, word);
  }, [disabled, isClickable, onWordClick]);

  // Get CSS classes for a word
  const getWordClasses = useCallback((wordIndex: number, isHovered: boolean): string => {
    const isActive = isWordActive(wordIndex);
    const baseClasses = [
      'inline-block',
      'transition-all',
      'duration-200',
      'ease-in-out',
      'cursor-pointer',
      'relative'
    ];

    // Base word styling
    if (wordClassName) {
      baseClasses.push(wordClassName);
    } else {
      baseClasses.push('px-0.5', '-mx-[1px]');
    }

    // Highlight style classes
    if (isActive) {
      if (activeWordClassName) {
        baseClasses.push(activeWordClassName);
      } else {
        switch (highlightStyle) {
          case 'subtle':
            baseClasses.push(
              'bg-yellow-200/60',
              'text-black',
              'rounded-sm',
              'shadow-sm'
            );
            break;
          case 'prominent':
            baseClasses.push(
              'bg-yellow-300/80',
              'text-black',
              'rounded-md',
              'shadow-md',
              'scale-105',
              'font-semibold'
            );
            break;
          case 'pulse':
            baseClasses.push(
              'bg-yellow-200/70',
              'text-black',
              'rounded-md',
              'animate-pulse',
              'shadow-lg',
              'border-2',
              'border-yellow-400'
            );
            break;
        }
      }
    }

    // Hover effects (only if clickable and not disabled)
    if (isClickable && !disabled) {
      if (isHovered && !isActive) {
        baseClasses.push(
          'bg-blue-100/50',
          'rounded-sm',
          'scale-102'
        );
      }
      baseClasses.push('hover:bg-blue-100/30');
    }

    // Disabled state
    if (disabled) {
      baseClasses.push('opacity-50', 'cursor-not-allowed');
    } else if (isClickable) {
      baseClasses.push('cursor-pointer');
    } else {
      baseClasses.push('cursor-default');
    }

    return baseClasses.join(' ');
  }, [isWordActive, wordClassName, activeWordClassName, highlightStyle, isClickable, disabled]);

  // Scroll active word into view
  useEffect(() => {
    if (currentWordIndex >= 0 && wordRefs.current[currentWordIndex]) {
      const wordElement = wordRefs.current[currentWordIndex];
      const container = containerRef.current;
      
      if (wordElement && container) {
        const wordRect = wordElement.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        // Check if word is outside the visible area
        if (
          wordRect.left < containerRect.left || 
          wordRect.right > containerRect.right ||
          wordRect.top < containerRect.top ||
          wordRect.bottom > containerRect.bottom
        ) {
          wordElement.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'center'
          });
        }
      }
    }
  }, [currentWordIndex]);

  // Render confidence indicator for debugging (if needed)
  const renderConfidenceIndicator = (wordIndex: number) => {
    const highlight = getWordHighlight(wordIndex);
    if (!highlight || highlight.confidence >= 0.8) return null;
    
    return (
      <div className="absolute -top-1 -right-1 w-2 h-2 bg-orange-400 rounded-full text-xs" 
           title={`Confidence: ${(highlight.confidence * 100).toFixed(0)}%`} />
    );
  };

  return (
    <div
      ref={containerRef}
      className={`flex flex-wrap items-baseline leading-relaxed ${className}`}
      role="text"
      aria-label={sentence}
    >
      {words.map((wordData, index) => {
        if (!wordData.isWord) {
          // Render whitespace
          return (
            <span key={index} className="whitespace-pre">
              {wordData.text}
            </span>
          );
        }

        const wordIndex = wordData.originalIndex;
        const isHovered = hoveredIndex === wordIndex;
        const isActive = isWordActive(wordIndex);
        const highlight = getWordHighlight(wordIndex);
        
        return (
          <span
            key={index}
            ref={el => { wordRefs.current[wordIndex] = el; }}
            className={getWordClasses(wordIndex, isHovered)}
            onClick={() => handleWordClick(wordIndex, wordData.text)}
            onMouseEnter={() => !disabled && setHoveredIndex(wordIndex)}
            onMouseLeave={() => setHoveredIndex(-1)}
            role={isClickable && !disabled ? "button" : undefined}
            tabIndex={isClickable && !disabled ? 0 : -1}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && isClickable && !disabled) {
                e.preventDefault();
                handleWordClick(wordIndex, wordData.text);
              }
            }}
            aria-label={isClickable ? `Word: ${wordData.text}${isActive ? ' (currently highlighted)' : ''}` : undefined}
            data-word-index={wordIndex}
            data-word={wordData.text}
            data-active={isActive}
            data-timing={highlight ? `${highlight.startTime}-${highlight.endTime}` : undefined}
          >
            {wordData.text}
            {process.env.NODE_ENV === 'development' && renderConfidenceIndicator(wordIndex)}
          </span>
        );
      })}
    </div>
  );
}

// Additional utility component for advanced highlighting patterns
export function WordHighlighterWithTooltip({
  sentence,
  highlightedWords = [],
  currentWordIndex = -1,
  onWordClick,
  showTimingInfo = false,
  ...props
}: WordHighlighterProps & { showTimingInfo?: boolean }) {
  const [tooltipData, setTooltipData] = useState<{
    word: string;
    timing?: { start: number; end: number };
    position: { x: number; y: number };
  } | null>(null);

  const handleWordHover = useCallback((event: React.MouseEvent, wordIndex: number, word: string) => {
    if (!showTimingInfo) return;
    
    const highlight = highlightedWords.find(hw => hw.index === wordIndex);
    if (highlight) {
      setTooltipData({
        word,
        timing: { start: highlight.startTime, end: highlight.endTime },
        position: { x: event.clientX, y: event.clientY }
      });
    }
  }, [highlightedWords, showTimingInfo]);

  const handleMouseLeave = useCallback(() => {
    setTooltipData(null);
  }, []);

  return (
    <div className="relative">
      <WordHighlighter
        sentence={sentence}
        highlightedWords={highlightedWords}
        currentWordIndex={currentWordIndex}
        onWordClick={onWordClick}
        {...props}
      />
      
      {tooltipData && (
        <div
          className="fixed z-50 bg-black text-white px-2 py-1 rounded text-xs pointer-events-none"
          style={{
            left: tooltipData.position.x + 10,
            top: tooltipData.position.y - 30
          }}
        >
          <div>{tooltipData.word}</div>
          {tooltipData.timing && (
            <div className="text-gray-300">
              {tooltipData.timing.start.toFixed(2)}s - {tooltipData.timing.end.toFixed(2)}s
            </div>
          )}
        </div>
      )}
    </div>
  );
}