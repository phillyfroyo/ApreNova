# Azure TTS Audio Player System

A comprehensive frontend audio player system that integrates with Azure Text-to-Speech to provide word-level highlighting synchronized with audio playbook for enhanced language learning.

## 🎯 Features

### Core Functionality
- **Word-Level Highlighting**: Real-time synchronization between audio playbook and text highlighting
- **Dual Speed Support**: Normal and slow playbook modes using Azure TTS variants  
- **Interactive Progress Bar**: Scrubbing with word-level precision and visual word markers
- **Intelligent Caching**: Pre-loading and caching for optimal performance
- **Fallback Support**: Graceful degradation to static MP3 files when Azure TTS fails

### Advanced Features
- **Performance Optimization**: Intelligent preloading, memory management, and retry logic
- **Comprehensive Error Handling**: Detailed error categorization with user-friendly messages
- **Mobile Support**: Touch-friendly controls and responsive design
- **Accessibility**: Screen reader support and keyboard navigation
- **Analytics**: Performance monitoring and error tracking

## 📁 File Structure

```
src/
├── components/
│   ├── StoryLayoutAzure.tsx          # Main integration component
│   ├── WordHighlighter.tsx           # Word highlighting with smooth transitions
│   └── AzureAudioControls.tsx        # Enhanced audio controls UI
├── hooks/
│   ├── useAzureAudioPlayer.ts        # Core audio player logic
│   ├── useAzureTTS.ts                # Existing Azure TTS integration
│   └── useAudioErrorState.ts         # Error state management
├── types/
│   └── azure-tts.ts                  # Extended TypeScript definitions
└── utils/
    ├── audioPerformance.ts           # Performance optimization utilities
    └── audioErrorHandler.ts          # Error handling and recovery
```

## 🚀 Quick Start

### 1. Basic Integration

Replace your existing StoryLayout component with StoryLayoutAzure:

```tsx
import StoryLayoutAzure from '@/components/StoryLayoutAzure';

// In your page component
export default function StoryPage({ sentences, storySlug, title, storyMap }) {
  return (
    <StoryLayoutAzure
      sentences={sentences}
      initialLevel="l3"
      storySlug={storySlug}
      title={title}
      storyMap={storyMap}
    />
  );
}
```

### 2. Custom Audio Player Hook

For custom implementations, use the useAzureAudioPlayer hook:

```tsx
import { useAzureAudioPlayer } from '@/hooks/useAzureAudioPlayer';

function CustomAudioComponent({ sentences }) {
  const audioPlayer = useAzureAudioPlayer({
    autoPreload: true,
    fallbackToStaticAudio: true,
    onWordHighlight: (word, sentenceIndex) => {
      console.log(`Highlighting: ${word.word}`);
    },
    onError: (error, sentenceIndex) => {
      console.error('Audio error:', error);
    }
  });

  const handlePlay = async (index, isSlow = false) => {
    const sentence = sentences[index];
    await audioPlayer.playAzureAudio(
      index,
      sentence.text,
      'es-ES',
      isSlow,
      { storySlug: 'example', currentLevel: 'l3', chapterNumber: 1, pageNumber: 1 }
    );
  };

  return (
    <div>
      {audioPlayer.playerState.highlightedWords.map((word, index) => (
        <span 
          key={index}
          className={word.isActive ? 'highlighted' : ''}
        >
          {word.word}
        </span>
      ))}
      <button onClick={() => handlePlay(0)}>Play Normal</button>
      <button onClick={() => handlePlay(0, true)}>Play Slow</button>
    </div>
  );
}
```

### 3. Word Highlighting Component

Use the WordHighlighter component independently:

```tsx
import WordHighlighter from '@/components/WordHighlighter';

function HighlightExample({ sentence, wordTimings, currentWordIndex }) {
  return (
    <WordHighlighter
      sentence={sentence}
      highlightedWords={wordTimings}
      currentWordIndex={currentWordIndex}
      highlightStyle="prominent"
      isClickable={true}
      onWordClick={(wordIndex, word) => {
        console.log(`Clicked word: ${word} at index ${wordIndex}`);
      }}
    />
  );
}
```

### 4. Audio Controls

Standalone audio controls:

```tsx
import AzureAudioControls from '@/components/AzureAudioControls';

function AudioControlsExample() {
  return (
    <AzureAudioControls
      isPlaying={isPlaying}
      progress={progress}
      duration={duration}
      isLoading={isLoading}
      hasError={hasError}
      highlightedWords={wordTimings}
      currentWordIndex={currentWordIndex}
      onPlay={() => handlePlay(false)}
      onPlaySlow={() => handlePlay(true)}
      onSeek={(time) => audioPlayer.seekTo(time)}
      onSeekToWord={(index) => audioPlayer.seekToWord(index)}
      showWordMarkers={true}
    />
  );
}
```

## 🔧 Configuration

### Audio Player Options

```tsx
const options = {
  // Performance
  autoPreload: true,              // Pre-cache next sentences
  
  // Fallback behavior
  fallbackToStaticAudio: true,    // Use MP3 files when Azure TTS fails
  staticAudioBasePath: '/audio',  // Base path for static audio files
  
  // Callbacks
  onWordHighlight: (word, sentenceIndex) => {},
  onSentenceComplete: (sentenceIndex) => {},
  onError: (error, sentenceIndex) => {}
};
```

### Word Highlighting Styles

```tsx
// Available highlight styles
type HighlightStyle = 'subtle' | 'prominent' | 'pulse';

// Custom styling
<WordHighlighter
  highlightStyle="prominent"
  wordClassName="custom-word-class"
  activeWordClassName="custom-active-class"
/>
```

### Error Handling

```tsx
import { handleAudioError, audioErrorHandler } from '@/utils/audioErrorHandler';

try {
  await audioPlayer.playAzureAudio(/* params */);
} catch (error) {
  const errorDetails = handleAudioError(error, {
    sentenceIndex: 0,
    text: 'Sample sentence',
    operation: 'playback'
  });
  
  // Get fallback strategy
  const strategy = audioErrorHandler.getFallbackStrategy(errorDetails);
  
  if (strategy.strategy === 'fallback_audio') {
    // Use static audio fallback
    audioPlayer.playStaticAudio(/* params */);
  }
}
```

## 📊 Performance Monitoring

### Using Performance Optimizer

```tsx
import { audioPerformanceOptimizer } from '@/utils/audioPerformance';

// Initialize session
audioPerformanceOptimizer.initSession(
  'storySlug',
  'l3',
  1,
  1,
  sentences.map(s => s.text)
);

// Check performance
if (!audioPerformanceOptimizer.isPerformingWell()) {
  const recommendations = audioPerformanceOptimizer.getRecommendations();
  console.log('Performance recommendations:', recommendations);
}

// Get metrics
const metrics = audioPerformanceOptimizer.getMetrics();
console.log('Performance metrics:', metrics);

// Clean up
audioPerformanceOptimizer.endSession();
```

### Performance Timing

```tsx
import { withPerformanceTracking } from '@/utils/audioPerformance';

// Wrap operations for automatic timing
const result = await withPerformanceTracking(
  () => generateTTS(request),
  'tts-generation'
);
```

## 🛠️ API Integration

### Azure TTS API Structure

The system expects your Azure TTS API to return:

```typescript
interface TTSResponse {
  audioUrl: string;           // URL to generated audio file
  wordTimings: WordTiming[];  // Array of word timing data
  duration: number;           // Total audio duration
  cached: boolean;           // Whether response was cached
}

interface WordTiming {
  word: string;              // The word text
  startTime: number;         // Start time in seconds
  endTime: number;           // End time in seconds
  confidence: number;        // Confidence score (0-1)
}
```

### API Endpoints

```typescript
// Generate TTS
POST /api/azure-tts/generate
Body: {
  text: string;
  language: 'es-ES' | 'en-US';
  speed: 'normal' | 'slow';
  storySlug?: string;
  chapterPage?: string;
}

// Batch generate (optional)
POST /api/azure-tts/batch
Body: BatchAudioRequest
```

## 🎨 Styling & Customization

### CSS Classes

The components use Tailwind CSS classes. Key customization points:

```css
/* Word highlighting */
.word-highlighted {
  @apply bg-yellow-200 rounded-sm transition-all duration-200;
}

.word-active {
  @apply bg-yellow-300 font-semibold scale-105;
}

/* Audio controls */
.audio-progress-bar {
  @apply w-full h-2 bg-gray-200 rounded-full;
}

.audio-scrubber {
  @apply w-4 h-4 bg-blue-500 rounded-full cursor-pointer;
}
```

### Theme Integration

The system integrates with your existing STORY_THEMES:

```tsx
const theme = STORY_THEMES[storySlug] || STORY_THEMES.default;
// Uses theme.fontFamily, theme.textColor, theme.backgroundImage, etc.
```

## 🔄 Migration Guide

### From Original StoryLayout

1. **Replace the component import:**
   ```tsx
   // Before
   import StoryLayout from '@/components/StoryLayout';
   
   // After
   import StoryLayoutAzure from '@/components/StoryLayoutAzure';
   ```

2. **Update props (same interface):**
   ```tsx
   // No changes needed - same props interface
   <StoryLayoutAzure
     sentences={sentences}
     initialLevel={initialLevel}
     storySlug={storySlug}
     title={title}
     storyMap={storyMap}
   />
   ```

3. **Environment setup:**
   - Ensure Azure TTS API endpoints are configured
   - Static audio files remain as fallback
   - No database changes required

### Backward Compatibility

- All existing URL patterns work unchanged
- Static audio files are used as fallback
- Global click handlers maintain same behavior
- UnifiedTranslator integration unchanged
- All existing UI patterns preserved

## 🧪 Testing

### Development Mode Features

```tsx
// Word confidence indicators (dev only)
<WordHighlighter showTimingInfo={true} />

// Performance logging
if (process.env.NODE_ENV === 'development') {
  console.log(audioPerformanceOptimizer.generateReport());
}

// Error details
const errorDetails = handleAudioError(error, context);
console.log('Error details:', errorDetails);
```

### Testing Audio System

```tsx
// Test Azure TTS availability
const audioPlayer = useAzureAudioPlayer();
if (!audioPlayer.playerState.isSupported) {
  console.log('Using fallback audio mode');
}

// Test performance
const timer = createPerformanceTimer();
await someAudioOperation();
const duration = timer.stop('test-operation');
```

## 📱 Mobile Considerations

- Touch events are supported for audio scrubbing
- Word highlighting works with touch interactions
- Responsive design adapts to different screen sizes
- Audio permissions are handled gracefully
- Fallback to static audio for unsupported features

## 🚨 Error Scenarios & Fallbacks

1. **Azure TTS Unavailable**: Falls back to static MP3 files
2. **Network Issues**: Retry logic with exponential backoff
3. **Quota Exceeded**: Automatic fallback to static audio
4. **Browser Compatibility**: Graceful degradation
5. **Audio Format Issues**: Alternative format attempts

## 🔍 Troubleshooting

### Common Issues

1. **No word highlighting**:
   - Check Azure TTS API response includes wordTimings
   - Verify audio is playing through Azure TTS (not fallback)
   - Check browser console for errors

2. **Audio not playing**:
   - Check browser audio permissions
   - Verify network connectivity
   - Check Azure TTS service status

3. **Performance issues**:
   - Monitor performance metrics
   - Check cache hit rates
   - Verify preloading is working

### Debug Information

```tsx
// Get current state
console.log('Player state:', audioPlayer.playerState);

// Check error statistics
console.log('Error stats:', audioErrorHandler.getErrorStats());

// Performance report
console.log(audioPerformanceOptimizer.generateReport());
```

## 🤝 Contributing

When adding new features:

1. Extend TypeScript interfaces in `azure-tts.ts`
2. Add error handling for new failure modes
3. Include performance tracking for new operations
4. Maintain backward compatibility
5. Add appropriate tests and documentation

This Azure TTS Audio Player System provides a complete solution for word-level synchronized audio playbook with comprehensive error handling, performance optimization, and fallback mechanisms, while maintaining full backward compatibility with your existing StoryLayout system.