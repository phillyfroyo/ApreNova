# Cuentana - Product Ideas & Roadmap

*Living document for tracking ideas, features, and improvements*

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

### Story Backgrounds
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

*Last updated: 2025-12-04*
