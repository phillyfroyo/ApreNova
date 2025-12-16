# Ideas & Future Improvements

## Priority Items

### AI Image Generation System Improvements
The current DALL-E image generation for thumbnails and backgrounds needs refinement. Issues include inconsistent style adherence and sometimes undesirable outputs. Areas to explore:
- Better prompt engineering for more consistent results
- Consider alternative models (Stable Diffusion, Midjourney API, Leonardo.ai)
- More granular control over style parameters
- Option to completely override story-based content with admin prompt

### Story Classification & Tagging System
Need to implement a comprehensive tagging system for stories to improve organization and UI presentation:

**Required Tags:**
- **Story Type**: poem, short story, or novel (for UI organization/filtering)
- **Cuentana Original**: boolean flag to distinguish original content from adapted works

**For Non-Original Works (adapted/classic stories):**
- Author name
- Year published
- Original language
- Source/attribution

**Additional Tag Ideas to Consider:**
- Genre tags (adventure, mystery, romance, comedy, drama, etc.)
- Theme tags (family, friendship, nature, travel, food, culture, etc.)
- Age appropriateness / target audience
- Estimated reading time
- Geographic/cultural setting (Guatemala, Mexico, Spain, etc.)
- Seasonal/holiday relevance (Christmas, Day of the Dead, etc.)
- Vocabulary focus areas (food vocab, travel vocab, emotions, etc.)
- Grammar concepts practiced in the story
- Series/collection grouping (for multi-part stories)

---

## Other Ideas

### Stories Pages Revamp
Our stories pages need a revamp. Really think through the user experience, layout, navigation, and overall design to make reading more engaging and intuitive.

### Story View Analytics
Track number of views of stories throughout the app, counting all users. This could help identify popular content, inform content strategy, and provide insights into user engagement patterns.

### Aggressive Prefetching Optimization
Implement intelligent prefetching throughout the app to minimize perceived load times:

**Story Content:**
- When user enters a chapter, prefetch the next chapter in the background
- For split-by-chapter content, this gives 5+ minutes of buffer time to load ~50-100KB
- Prefetch previous chapter too for users who navigate backwards

**Story List/Library:**
- When hovering over a story card, prefetch that story's first chapter
- Prefetch story metadata for visible cards in the viewport

**Navigation:**
- Prefetch likely next pages based on user flow (e.g., after story completion, prefetch dashboard)
- Use `<link rel="prefetch">` for common navigation paths

**Audio Files:**
- Prefetch audio for upcoming lines/pages while user reads current content
- Cache recently played audio for quick replay

**Implementation Notes:**
- Use Intersection Observer for viewport-based prefetching
- Respect user's data-saver preferences
- Implement request prioritization (current content > prefetch)
- Consider using Service Workers for advanced caching strategies

### Dialogue/Script UI Support
Currently, when uploading TV show transcripts or movie scripts, character names appear inline with their dialogue but there's no visual distinction between the speaker and their lines. This makes dialogue-heavy content hard to read.

**Potential Solutions:**
- Detect dialogue patterns (CHARACTER NAME: dialogue or CHARACTER NAME\n dialogue)
- Style character names differently (bold, different color, smaller font)
- Consider a "script mode" layout with character names in a left column
- Add a story type detection that triggers appropriate formatting
- May need to store dialogue metadata in content structure (speaker, line)

### Admin Portal Refactoring Ideas

#### Extract Wizard Orchestration Hook
The main `StoryUploadForm.tsx` is quite large (~2000+ lines). Consider extracting the wizard orchestration logic into a `useStoryWizard` hook that manages:
- Step navigation and validation gates
- Master `storyData` state
- Step transition logic
This would make the form component a thin UI shell.

#### Complete Step Component Extraction
Step components exist in `/components/steps/` but the main form still contains substantial inline step logic. Complete the migration so `StoryUploadForm.tsx` only renders `<StepN />` components and handles step transitions.

#### API Request Deduplication
`api-service.ts` could benefit from request deduplication/caching for operations like `detectLevel` or `generateMetadata` that might get called multiple times with the same input.

#### Optimistic UI for Draft Saves
`useDraftManager` shows `isSaving` but doesn't provide optimistic UI feedback. Add a brief "Saved!" toast or checkmark animation on successful save.

#### Auth Service Persistent Storage
`auth-service.ts` uses in-memory storage for sessions (notes "In production, use Redis"). If ever running multi-instance, sessions won't sync. Consider implementing Redis/persistent storage or document this as a known limitation for single-instance deployment.
