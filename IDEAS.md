# Cuentana - Product Ideas & Roadmap

*Living document for tracking ideas, features, and improvements*

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

### 3. Story Upload & Management System
**Phase 1 - Developer Tools:**
- Automated story formatting pipeline
- AI-assisted translation (English ↔ Spanish)
- Consistent styling and structure enforcement
- Batch processing for multiple stories
- Story metadata extraction
- Level detection/suggestion based on content
- Preview and validation before publishing

**Phase 2 - User-Generated Content:**
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

## In Progress
- Fix GPT formatting in Story Tutor (proactive endpoint approach)
- Remove text bubbles from GPT responses
- Add swipe gestures for mobile Story Tutor access
- Fix level display bug on stories page

## Completed
✅ Story-specific AI Tutor with conversation history
✅ Text selection → instant AI help with ❓ emoji
✅ "You selected" auto-message system
✅ Persistent chat history per story
✅ AI Tutor general conversation page
✅ Quiz system with CEFR level mapping
✅ OAuth integration (Google)
✅ Premium/Free tier structure

---

*Last updated: 2025-10-15*
