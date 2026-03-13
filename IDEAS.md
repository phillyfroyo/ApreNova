# Cuentana - Product Ideas & Roadmap

*Living document for tracking ideas, features, and improvements*

*Last updated: March 13, 2026*

---

Near term visions, in no particular order.
- Steadily grow content library
- Make sure user upload portal works for a range of story types. 
- Need comprehensive error handing for all error types in the user upload portal. One user reported a silent fail where the pipeline was stuck at 50%, and again a failed upload where we showed an error, but the error was not described. 
- need facebook / whatsapp login options
- need a mobile app. look into the commplexity, difficulty, cost, and time to implement of making this a reality. 
- for vocab page of saved words, offer 'hint' button where it turns into a 4 answer choice MC question
- Add cuentana vocab lists to the vocab page for each level, which will be our adaptation of the oxford 5000
- Add grammar sections where we can begin to teach and test conjugations and other grammar
- The AI tutor is a blank sandbox for users right now. Add some structure, including claude/gpt type interfaces of stored chats and projects. Also add some guidance for users, like prompt ideas for learning and testing language, etc. 
- Add writing section taking inspiration from both my university classes of daily writing prompts, and LMGM for structured feedback for users. 
- More build out admin portal. I want to be able to view this as a dashboard/widget/saved safari app on my phone. I want to know how users are using the app, how much time on app, how they are using the app, which stories they're using, etc. 
- Consider separating user and admin pipelines, consult claude. We've been battling to keep the pipelines shared, but maybe they're just too fundamentally different to have a shared backend and we'd be better off building them separate.
- Add slow voice for the 'listening' story mode TTS 
- Build out full speech to speech AI tutor
- Build out revenue plan & manage free vs paid feautures. The idea is for all AI features to be used by free users, with a daily budget of token usage. They can use their tokens throughout the app however they wish until the limmit is reached, where they will need to upgrade their plan to continue using the features. 

Long term visions: 
- Build out imports from different sources: podcasts, youtube, etc. 
- Add videos for learning to the app
- Build out a full social media app for language learning (far in future, after scaling)



## Refinements & Improvements (Post-MVP)

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

---

## Claude's Ideas

### 1. Progressive Story Difficulty System
- **Intelligent Level Detection:** Analyze user's Story Tutor questions to recommend level adjustments

### 2. Enhanced Learning Analytics
- **Word Bank:** Track all words a user has looked up or asked about
- **Retention Testing:** Periodic pop-quizzes on previously learned vocabulary
- **Comprehension Metrics:** Track how often users ask about story comprehension vs. vocabulary
- **Reading Speed Analytics:** Measure time per page and identify where users slow down
- **Personalized Recommendations:** Suggest stories based on vocabulary gaps and interests

### 2b. Vocabulary Saving & Flashcard System
- **Page-Based Quizzes:** After each story page, offer optional quiz if user saved words from that page
  - Multiple choice, fill-in-blank, or translation exercises
  - Immediate reinforcement while context is fresh
  - Track which words were learned in which story/page for context recall

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

---

## Near-Term Priorities

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
  - Add punctuation boundary detection, so if user is using GPT translations for a complete sentence end to end, we can just use the hardcoded translation rather than calling GPT

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

## Pre-Deployment Tasks

### Facebook Login Setup (auth-improvements-v1 branch)
**Status:** Code ready, needs Facebook Developer configuration

**When deploying, complete these steps:**

1. **Facebook Developer App Configuration:**
   - Go to [developers.facebook.com](https://developers.facebook.com/) → My Apps → Cuentana app
   - Settings → Basic:
     - Add production **App Domains**: `cuentana.com` (or your domain)
     - Add **Privacy Policy URL**: `https://cuentana.com/privacy`
     - Add **Terms of Service URL**: `https://cuentana.com/terms` (if created)
     - Upload **App Icon** (1024x1024 PNG)
   - Facebook Login → Settings:
     - Add **Valid OAuth Redirect URI**: `https://cuentana.com/api/auth/callback/facebook`

2. **Environment Variables (Production):**
   ```
   FACEBOOK_CLIENT_ID=your_app_id
   FACEBOOK_CLIENT_SECRET=your_app_secret
   ```

3. **Facebook App Review:**
   - Go to App Review → Permissions and Features
   - Request `email` and `public_profile` permissions
   - Provide brief description: "Cuentana uses Facebook Login to let users create accounts and sign in to our language learning app. We only request email and basic profile info for authentication."
   - Submit for review (may take 1-5 business days)

4. **Add Facebook Button to UI:**
   - Button code exists in authOptions.ts (auto-enabled when env vars present)
   - Need to add Facebook button to AuthForm.tsx (similar to Google button)

5. **Switch App to Live Mode:**
   - After App Review approval, go to app dashboard
   - Toggle from "Development" to "Live" mode

### Privacy Policy Updates Needed
- [ ] Update contact email from `privacy@cuentana.com` to real email
- [ ] Verify analytics services mentioned match what's actually used
- [ ] Consider adding Terms of Service page

