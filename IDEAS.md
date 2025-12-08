# Cuentana - Product Ideas & Roadmap

*Living document for tracking ideas, features, and improvements*

---

## ✅ IMPLEMENTED: Story Upload Pipeline Speed Optimization

**Problem:** Translations/rewrites took 30+ minutes per level due to sequential processing.

**Optimizations implemented:**
1. ✅ **Parallel chapter batches** - Process 4 chapters simultaneously (REWRITE_BATCH_SIZE, TRANSLATION_BATCH_SIZE)
2. ✅ **Switch to Haiku for translation** - Faster model for translations (GPT-4o kept for rewriting)
3. ✅ **Parallel level translation** - All levels translate simultaneously via Promise.allSettled

*Note: 300ms delays between sub-chunks preserved to prevent rate limit errors*

**Expected result:** Translation drops from ~15 min to ~1-2 min per story.

**Files modified:**
- `src/app/admin/upload-story/StoryUploadForm.tsx` (parallel batching for chapters + levels)
- `src/app/api/admin/translate/route.ts` (switched to claude-haiku-4-20250514)

---

## Refinements & Improvements (Post-MVP)

**Pagination Controls:**
- Add preview of pagination before finalizing

**Upload UX Improvements:**
- Add drag-and-drop for thumbnail upload
- Better visual preview of pagination before saving
- Side-by-side EN/ES preview before saving

**Future Enhancement: User-Generated Stories**
- After admin tool is stable, extend to allow users to upload stories that only they can access
- Same pipeline but saves to user-specific storage (database, not files)
- No branch/commit workflow needed
- Stories only visible to the uploading user
- Optional: submit for admin review to make public

### Streaming Progressive Story Loading (User Upload Portal)

**Core Concept:** When a user uploads/rewrites a story, don't make them wait for the full pipeline. Stream content to the reader as it becomes available.

**Pipeline Flow:**
1. User uploads text → immediately begin CEFR rewrite for their level
2. As each **chapter** finishes rewriting → send to translation immediately (don't wait for all chapters)
3. As each chapter's **translation returns** → push to the story reader in real-time
4. User can **start reading chapter 1** while chapters 2-27 are still processing

**Technical Implementation Ideas:**
- **Server-Sent Events (SSE)** or **WebSockets** to push completed chunks to client
- **Optimistic UI:** Show story page with loading placeholders for unfinished chapters
- **Progressive chapter list:** Chapters appear in the navigation as they become available
- **Background processing:** Use Vercel Functions or a job queue (BullMQ, Inngest) to continue processing even if user navigates away
- **Resume capability:** If user closes browser, processing continues; they return to find story ready

**UX Enhancements:**
- **"Reading while loading" indicator:** Show subtle progress bar or pulsing animation on chapters still processing
- **Estimated time remaining:** "3 more chapters translating... ~2 min"
- **Notification when complete:** Browser notification or in-app toast when story is fully ready
- **Chapter-level retry:** If a chapter fails, user can retry just that chapter without losing others
- **Preview quality option:** Offer "draft" mode (faster, lower quality) vs "polished" mode (full rewrite)

**Extended Ideas:**
- **Parallel level generation:** If user wants multiple levels, generate them simultaneously with staggered streaming
- **Prefetch next level:** While user reads L2, background-generate L3 so it's ready when they level up
- **Collaborative reading:** Share partially-loaded story with friends who can read as it streams
- **Audio generation pipeline:** After text streams in, auto-queue TTS generation so audio is ready by the time user reaches that page
- **Smart caching:** If another user uploads the same source text, skip rewrite/translation and serve cached version instantly
- **Cost transparency:** Show user estimated cost/tokens as they upload (especially for long novels)

---

## Core Product Ideas

### 1. Make the App Commercial-Grade, Sturdy, and Secure
- Comprehensive error handling and logging
- Security audit and hardening
- Performance optimization
- Load testing and scalability planning
- Data backup and recovery systems
- GDPR/privacy compliance review
- Input validation and sanitization across all endpoints
- Rate limiting and DDoS protection

**Performance Optimization Focus:**
- Implement aggressive caching strategies (Redis/Vercel KV for API responses, TTS audio)
- Optimize database queries (add indexes, use query batching, implement connection pooling)
- Lazy load components and implement code splitting for faster initial page loads
- Optimize images with Next.js Image component and WebP format
- Implement edge caching for static content and frequently accessed data
- Consider streaming responses for AI tutor to reduce perceived latency
- Minimize bundle size (tree shaking, dynamic imports, analyze bundle)
- Implement service worker for offline caching of stories and audio
- Profile and optimize client-side JavaScript execution
- Consider implementing ISR (Incremental Static Regeneration) for story pages

### 2. Build Out Complete Speech-to-Speech Tutor
- Real-time voice conversation with AI
- Pronunciation feedback and correction
- Natural conversation flow
- Voice activity detection
- Multi-turn dialogue management
- Accent adaptation options
- Speaking practice exercises

### 3. Story Upload & Management System - Phase 2
**User-Generated Content:**
- User story submission portal
- Community review/rating system
- Quality control workflow
- Copyright/plagiarism checking
- Story approval pipeline
- Creator attribution and credits

---

## Claude's Ideas

### 1. Progressive Story Difficulty System
- **Adaptive Reading:** Stories that gradually increase in difficulty within a single narrative
- **Vocabulary Scaffolding:** Introduce new vocabulary in context, then reinforce it throughout the story
- **Grammar Progression:** Design stories to naturally showcase specific grammar patterns at each level
- **Intelligent Level Detection:** Analyze user's Story Tutor questions to recommend level adjustments

### 2. Enhanced Learning Analytics
- **Word Bank:** Track all words a user has looked up or asked about
- **Retention Testing:** Periodic pop-quizzes on previously learned vocabulary
- **Comprehension Metrics:** Track how often users ask about story comprehension vs. vocabulary
- **Reading Speed Analytics:** Measure time per page and identify where users slow down
- **Personalized Recommendations:** Suggest stories based on vocabulary gaps and interests

### 2b. Vocabulary Saving & Flashcard System
- **Save Words/Phrases:** User can explicitly save any word or phrase while reading for later study
- **Anki-Style Flashcards:** Integrate spaced repetition system for saved vocabulary
  - Show word → user recalls meaning → rate difficulty (Again/Hard/Good/Easy)
  - Algorithm schedules reviews based on performance
  - Track mastery level per word
- **Page-Based Quizzes:** After each story page, offer optional quiz if user saved words from that page
  - Multiple choice, fill-in-blank, or translation exercises
  - Immediate reinforcement while context is fresh
  - Track which words were learned in which story/page for context recall
- **Study Dashboard:** Central place to review all saved words, flashcard stats, upcoming reviews

### 3. Social & Gamification Features
- **Reading Streaks:** Daily reading goals and streak tracking
- **Achievements:** Badges for milestones (stories completed, vocabulary mastered, etc.)
- **Leaderboards:** Optional competitive elements for motivated learners
- **Study Groups:** Share stories and discuss with other learners
- **Collaborative Translation:** Users can suggest better translations for community review

### 4. Audio & Multimodal Enhancements
- **Human-Narrated Stories:** Professional voice actors for premium content
- **Read-Along Mode:** Highlighted text synced with audio
- **Listening Comprehension Quizzes:** Test understanding without reading
- **Audio Speed Control:** Adjustable playback speed for listening practice
- **Sentence-by-Sentence Audio:** Click any sentence to hear it spoken

### 5. Content Diversification
- **News Articles:** Current events at different reading levels
- **Podcasts Transcripts:** With synchronized audio
- **Song Lyrics:** With translations and cultural context
- **Movie Scripts:** Scene-by-scene with dialogue practice
- **User Interests:** Tag stories by genre (mystery, romance, sci-fi, history, etc.)

### 6. Advanced Tutor Features
- **Grammar Explanations Library:** Comprehensive reference guide
- **Cultural Notes:** Explain idioms, customs, and cultural references in stories
- **Etymology Insights:** Word origins and related words in both languages
- **False Friends Warnings:** Highlight words that look similar but mean different things
- **Conversation Starters:** Story-based discussion prompts for speaking practice

### 7. Offline & Accessibility
- **Offline Mode:** Download stories for reading without internet
- **Dark Mode:** Eye-strain reduction for night reading
- **Adjustable Font Size:** Accessibility for vision-impaired users
- **Dyslexia-Friendly Font Option:** OpenDyslexic or similar
- **Screen Reader Support:** Full ARIA labels and semantic HTML

### 8. Story Creation AI Assistant
- **AI Story Generator:** Create original stories at specified CEFR levels
- **Translation Quality Checker:** Analyze translations for accuracy and naturalness
- **Vocabulary Complexity Analyzer:** Ensure stories match their assigned level
- **Grammar Pattern Identifier:** Tag which grammar concepts each story teaches
- **Cultural Sensitivity Checker:** Flag potentially problematic content

---

## Near-Term Priorities

### UI/UX Revamp
- **Overall UI Layout:** Revamp the general layout - current design looks amateur
- **User Menu UI:** Redesign the user menu for a more polished look
- **Stories Page Layout:** Split stories by category by default (Cuentana Originals, Poems, Short Stories, Novels) without requiring filter interaction
- **Story Completion Flow:** "Mark this story as complete" is janky - needs revamping

### Story Themes & Backgrounds
- **Theme Editor in Admin Portal:** Add theme configuration to story upload:
  - Gradient picker with presets (gothic, warm, cool, nature, etc.)
  - Text color selection (dark/light)
  - Accent color picker
  - Font family selector (serif, sans-serif, etc.)
- **More Default Gradients:** Add a selection of gradient presets for story backgrounds
- **User Customization:** Allow users to customize their story background colors/gradients

### Translation & Audio Improvements
- **Free Tier Access:** Make smart GPT translations available at free tier - no paywall restrictions for now
- **Translation Caching:** Cache all translations so any user benefits from instant translate if it's been done before
- **Audio Caching:** Store all TTS audio generations for instant playback across users
- **Smarter Translation UX:** Current GPT translation adds little value over hardcoded translations for multi-word selections. Ideas:
  - Auto-open the ? tutor window when GPT translation is used (provides context/examples)
  - Show a different "enhanced translation" window with grammar notes, usage examples, related words
  - Only trigger GPT for phrases/sentences, use cached dictionary for single words
  - Add "Why this translation?" expandable section

### Image Generation
- **Alternative Generators:** Try Gemini, Midjourney API, or other image generators for thumbnails/backgrounds
- **Quality Issues:** Current DALL-E output is often poor quality - need better options especially before user access

### User Profiles & Personalization
- **Extended Customization:** Let users customize their profile further:
  - Profile colors/themes
  - Custom photos on UI
  - Profile image upload
  - Preferred story background

### Quiz System Revamp
- **Comprehensive Testing:** Revamp quiz into a full knowledge assessment mechanism
- **Level Progression:** Use quiz results to advance users to next CEFR levels
- **Mastery Tracking:** Track vocabulary/grammar mastery over time

---

### Story Level Routing & Availability
- **Non-logged-in users:** Show all stories (not level-dependent). When they click a story, auto-route to Level 2. If L2 doesn't exist, find an available level to route to (TBD logic).
- **Logged-in users:** Know their level. Consider:
  - Only showing stories available at user's level
  - OR: Show unavailable-level stories in a separate UI section ("Available at other levels")
- **Core fix:** Never route to a level that doesn't exist. If only L4 content exists, don't try to route to L1.

### Translation/Rewrite Error Handling Improvements
- **Auto-retry with smaller chunks:** If a chunk fails (translation or rewrite), automatically split it into smaller sub-chunks and retry. This isolates problems to smaller sections or may resolve the issue entirely.
- **Better UI error visibility:** When a chunk fails, highlight it clearly in the admin UI so the user can easily identify and fix the problem. Consider:
  - Red highlighting on failed chunks
  - Expandable error details
  - "Retry this chunk" button
  - Side-by-side view of source vs failed translation
- **Error persistence:** Track which chunks failed and allow selective retry without re-processing successful chunks.

### Token Tracking & Cost Analysis for Story Upload Pipeline
- **Token usage tracking:** Add comprehensive tracking of tokens consumed at each step of the upload pipeline (text preprocessing, metadata extraction, CEFR rewriting, translation)
- **Cost estimation:** Calculate actual $ cost per story upload based on token usage
- **Pipeline analysis:** Identify which steps consume the most tokens and where efficiencies could be gained
- **Algorithm vs AI trade-offs:** Analyze where algorithmic approaches could replace or reduce AI token usage:
  - Text preprocessing (already algorithmic)
  - Chapter detection (already algorithmic)
  - Could simpler models work for some tasks?
  - Could caching reduce repeat API calls?
- **User pricing model:** Use cost data to inform pricing when tool is exposed to users
- **Budget estimates:** Calculate cost to upload an entire story library

---

## In Progress
- Fix GPT formatting in Story Tutor (proactive endpoint approach)
- Remove text bubbles from GPT responses
- Add swipe gestures for mobile Story Tutor access
- Fix level display bug on stories page

---

## Completed
- Story-specific AI Tutor with conversation history
- Text selection → instant AI help with emoji
- "You selected" auto-message system
- Persistent chat history per story
- AI Tutor general conversation page
- Quiz system with CEFR level mapping
- OAuth integration (Google)
- Premium/Free tier structure
- **Admin Story Upload System (Full Pipeline)**
  - Admin auth (secret-based)
  - Story upload with raw text parsing
  - CEFR level detection
  - AI rewriting for all 5 CEFR levels
  - AI translation (EN ↔ ES)
  - Auto-pagination
  - AI-generated title/description/thumbnail options
  - Story tagging (type, origin, tags, audience)
  - Story manager (edit/delete existing stories)
  - CSS gradient backgrounds
  - Image management (upload, generate, delete)
  - Slimmed CEFR prompts

---

*Last updated: 2025-12-07*
