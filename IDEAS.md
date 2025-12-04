# Cuentana - Product Ideas & Roadmap

*Living document for tracking ideas, features, and improvements*

---

## 🚀 PRIORITY: Admin Story Upload System

### Overview

A complete pipeline that takes raw story text and produces fully-formatted, multi-level, bilingual story content files ready for the app. This eliminates the current painful process of manual translation and line-by-line entry.

### The Problem

Currently, uploading a new story requires:
1. Manually translating the entire story line by line
2. Manually formatting into the TypeScript content structure
3. Creating files for each CEFR level (L1-L5) separately
4. Manually rewriting stories for different difficulty levels
5. Updating metadata files in multiple locations

### The Solution

An admin tool that:
1. Accepts raw story text (paste or file upload)
2. Auto-detects the CEFR level of the source text
3. Uses AI to rewrite the story at all 5 CEFR levels
4. Uses AI to translate each level to the other language
5. Auto-paginates (10 lines per page)
6. Generates title, description, and thumbnail options via AI
7. Writes all necessary files to a feature branch for testing

---

### Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│  ADMIN UPLOADS RAW TEXT                                         │
│  - Paste or upload file                                         │
│  - Select source language (EN/ES)                               │
│  - Enter story slug                                             │
│  - Optionally enter title/description or let AI generate        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: PARSE & DETECT                                         │
│  - Split into chapters (by "CHAPTER" or "---" markers)          │
│  - Detect CEFR level of original text                           │
│  - Show admin: "Detected as B2 (Level 4)"                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: GENERATE METADATA                                      │
│  - Title: manual input OR AI generates 3 options to choose from │
│  - Description: manual input OR AI generates options            │
│  - Thumbnail: upload OR AI generates image options              │
│  - All fields editable by admin                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: SELECT LEVELS TO GENERATE                              │
│  - Checkboxes: [ ] L1  [ ] L2  [ ] L3  [ ] L4  [ ] L5           │
│  - Or "Generate All Levels" button                              │
│  - Source level auto-selected based on detection                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 4: GENERATE LEVELS (AI)                                   │
│  For each selected level:                                       │
│  - If level matches source: use original text                   │
│  - If level differs: AI rewrites to target CEFR level           │
│  - Progress indicator: "Generating L1... L2... L3..."           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 5: TRANSLATE (AI)                                         │
│  - Translate each level to the other language                   │
│  - Batch process for efficiency                                 │
│  - Context-aware (character names, tone consistency)            │
│  - Progress indicator: "Translating L1... L2..."                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 6: PAGINATE                                               │
│  - Split each chapter into pages (~10 lines each)               │
│  - Maintain sentence boundaries (don't split mid-sentence)      │
│  - Respect chapter markers                                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 7: PREVIEW                                                │
│  - Show generated content structure                             │
│  - Display sample pages from each level                         │
│  - Confirm before saving                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 8: SAVE TO BRANCH                                         │
│  - Create feature branch: story-upload/{slug}-{timestamp}       │
│  - Write .ts files to src/content/{slug}/{level}/content.ts     │
│  - Update src/lib/stories.ts with STORY_METADATA entry          │
│  - Update src/content/ui/en.ts and es.ts with title/description │
│  - Save thumbnail to public/images/                             │
│  - Commit all changes                                           │
│  - Admin tests locally, then merges to main                     │
└─────────────────────────────────────────────────────────────────┘
```

---

### CEFR Level Transposition AIs

Five specialized AI prompts, each trained to rewrite text at a specific CEFR level while preserving story meaning:

| Level | CEFR | Characteristics |
|-------|------|-----------------|
| L1 | A1 | Simple present tense, basic vocabulary (~500 words), very short sentences, concrete concepts only |
| L2 | A2 | Simple past tense, common expressions (~1000 words), short sentences, familiar topics |
| L3 | B1 | Mixed tenses, idiomatic language (~2000 words), compound sentences, some abstract concepts |
| L4 | B2 | Complex grammar, nuanced vocabulary (~4000 words), varied sentence structure, opinions/arguments |
| L5 | C1/C2 | Literary language, advanced constructions, full complexity, native-like expression |

Each AI must preserve:
- Plot and core meaning
- Character names
- Key story beats and emotional moments
- Approximate line count per page (±20%)

---

### Formatting Keys for Input Text

When pasting/uploading raw story text, admin can use these markers:

- `CHAPTER` or `---` on its own line = Start new chapter
- Regular line breaks = Sentence separation
- No markers needed = Single chapter story (poems, short stories)

Example input:
```
Diego has a phone. He takes his phone everywhere.
He watches videos when he eats.
---
One evening, Diego sits at his window.
His phone falls from his hands.
```

---

### Technical Implementation

**New Files to Create:**
```
src/app/admin/upload-story/page.tsx           # Admin UI
src/app/api/admin/detect-level/route.ts       # CEFR detection endpoint
src/app/api/admin/rewrite-level/route.ts      # Level transposition endpoint
src/app/api/admin/translate/route.ts          # Translation endpoint
src/app/api/admin/generate-metadata/route.ts  # Title/description/image generation
src/app/api/admin/save-story/route.ts         # File writing endpoint
src/lib/admin/story-generator.ts              # Core generation logic
src/lib/admin/cefr-prompts.ts                 # AI prompts for each level
src/lib/admin/file-writer.ts                  # Writes .ts files and updates metadata
```

**Admin Authentication:**
- Simple approach: Environment variable `ADMIN_SECRET`
- Admin page requires entering this secret (stored in session)
- Maintains barrier between normal user and admin access
- Can upgrade to proper `isAdmin` user flag post-launch if needed

**Files Modified by Tool:**
- `src/content/{slug}/{level}/content.ts` (created for each level)
- `src/lib/stories.ts` (append to STORY_METADATA array)
- `src/content/ui/en.ts` (add storiesMetadata entry)
- `src/content/ui/es.ts` (add storiesMetadata entry)
- `public/images/{slug}-thumbnail.png` (save uploaded/generated image)

---

### Cost Estimate (OpenAI API)

Per story upload with all 5 levels:

| Operation | Est. Tokens | Est. Cost (GPT-4) |
|-----------|-------------|-------------------|
| CEFR Detection | ~500 | ~$0.02 |
| Level Rewrite × 4 levels | ~8,000 | ~$0.32 |
| Translation × 5 levels | ~10,000 | ~$0.40 |
| Metadata Generation | ~1,000 | ~$0.04 |
| Image Generation (DALL-E) | — | ~$0.04 |
| **Total per story** | ~19,500 | **~$0.82** |

**Optimization Options:**
- Use GPT-3.5-turbo for simpler levels (L1, L2) - ~10x cheaper
- Batch API calls where possible
- Cache CEFR detection prompts

---

### Implementation Order

1. **Phase 1 - Core Infrastructure**
   - Admin auth (secret-based)
   - Basic admin UI skeleton
   - File writing utilities

2. **Phase 2 - Single Level Upload**
   - Text parsing (chapters, sentences)
   - Translation API integration
   - Auto-pagination
   - File generation for ONE level

3. **Phase 3 - CEFR Detection**
   - Level detection AI prompt
   - UI to display detected level

4. **Phase 4 - Level Transposition**
   - CEFR rewriting prompts for all 5 levels
   - Generate all levels from source text

5. **Phase 5 - Metadata Generation**
   - AI-generated title options
   - AI-generated description options
   - AI-generated thumbnail options (DALL-E)
   - Manual upload alternative

6. **Phase 6 - Branch & Commit**
   - Git integration for branch creation
   - Auto-commit generated files
   - Instructions for testing and merging

---

### Future Enhancement: User-Generated Stories

After admin tool is stable, extend to allow users to upload stories that only they can access:
- Same pipeline but saves to user-specific storage (database, not files)
- No branch/commit workflow needed
- Stories only visible to the uploading user
- Optional: submit for admin review to make public

---

*Plan created: 2025-12-03*

---

### Refinements & Improvements (Post-MVP)

**Pagination Controls:**
- ~~Allow manual override of lines per page (currently defaults to ~10)~~ DONE
- ~~Allow admin to set total pages manually for short content (poems, etc.)~~ DONE
- Add preview of pagination before finalizing
- ~~Add PAGE marker support for manual page breaks~~ DONE

**Story Metadata Enhancements:**
- Add "Story Type" field (poem, short story, novella, article, etc.) for UI categorization
- Add "Cuentana Original" flag (yes/no) to distinguish original vs. licensed content
- These fields will be used to organize/filter stories on the stories page

**Stories Page UI Updates (Future):**
- Add filtering by story type (poems, short stories, etc.)
- Add section for "Cuentana Originals"
- Sort/group stories by category

**CEFR Level Definitions:**
- Dial in and refine the CEFR level characteristics in `cefr-prompts.ts`
- Create more detailed guidance for AI rewriting at each level
- Consider adding example sentences for each level as few-shot prompts
- Test and iterate on prompt quality for accurate level transposition

**Story Editor (for Existing Stories):**
- Create admin page to browse, edit, and delete existing stories
- View all uploaded stories in a list with metadata
- Edit story content (both EN and ES versions)
- Edit metadata (title, description, levels)
- Delete stories (with confirmation)
- Re-generate specific levels or translations

**AI-Assisted Metadata Generation:**
- AI-generate title options (provide 3 choices to pick from)
- AI-generate description options
- AI-generate thumbnail images using DALL-E (requires image generation API)
- All fields remain editable by admin after generation

**Upload UX Improvements:**
- Add drag-and-drop for thumbnail upload
- Add story page background image upload option
- Better visual preview of pagination before saving
- Side-by-side EN/ES preview in Step 8

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

*Last updated: 2025-12-03*
