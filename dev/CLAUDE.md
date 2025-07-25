# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start development server on http://localhost:3000
- `npm run build` - Build production application (includes `prisma generate`)
- `npm run start` - Start production server
- `npm run lint` - Run ESLint checks

## Database Commands

- `npx prisma generate` - Generate Prisma client after schema changes
- `npx prisma db push` - Push schema changes to database
- `npx prisma studio` - Open Prisma Studio database browser

## High-Level Architecture

This is a **Next.js 15** language learning application called "my-aprenova" with the following core architecture:

### Tech Stack
- **Framework**: Next.js 15 with App Router
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js with Google, Facebook, and credentials providers
- **Styling**: Tailwind CSS with custom themes
- **Language**: TypeScript
- **Audio**: HTML5 Audio API with custom progress controls
- **Payment**: Stripe integration for premium subscriptions

### Core Architecture Patterns

**Story-Based Learning System**:
- Stories organized by slug → level → chapter → page hierarchy
- Content files stored as TypeScript exports in `src/content/[storySlug]/[level]/ch[chapter]/page-[page].[lang].ts`
- Audio files organized in `public/audio/[storySlug]/[level]/ch[chapter]/page-[page]/line[N].mp3`
- Dynamic routing: `/[lng]/stories/[storySlug]/[level]/[chapter]/[page]`

**Internationalization (i18n)**:
- Bilingual support (English/Spanish) with URL-based locale detection
- Translation system via `src/lib/t.ts` with content files in `src/content/ui/[lang].ts`
- Story content includes both English and Spanish text per line

**Premium/Freemium Model**:
- User authentication with premium status tracking
- Story access control based on `isPremiumOnly` flags
- Translation features: "free" (show/hide) vs "premium" (AI-powered via OpenAI)

**Audio System**:
- Sentence-level audio playback with normal and slow speed variants
- Custom audio progress bars with drag-to-seek functionality
- Fallback to speech synthesis if audio files missing

### Key Directories

- `src/app/` - Next.js App Router pages and API routes
- `src/components/` - Reusable React components including UI system
- `src/content/` - Story content files and UI translations
- `src/lib/` - Utility functions, auth configuration, database client
- `src/hooks/` - Custom React hooks for session logging, user level, etc.
- `src/types/` - TypeScript type definitions
- `prisma/` - Database schema and migrations

### Database Schema
- `User` - Authentication, premium status, native language, quiz level
- `SessionLog` - User activity tracking by type and duration
- `CompletedStory` - Progress tracking by story/level/chapter/page
- Standard NextAuth tables for sessions and accounts

### Important Implementation Details

**Story Content Format**:
```typescript
export const story = {
  storySlug: "aventura",
  level: 1,
  chapter: 1,
  page: 1,
  hasChapters: true,
  lines: [
    { es: "Spanish text", en: "English text" }
  ]
};
```

**Route Structure**:
- Internationalized routes with `[lng]` parameter
- Dynamic story routes: `/[lng]/stories/[storySlug]/[level]/[chapter]/[page]`
- API routes for user management, translation, audio, and Stripe

**Authentication Flow**:
- Social login (Google/Facebook) and email/password
- Custom user fields stored in database and JWT token
- Premium status affects story access and translation features

**Translation System**:
- Free mode: simple show/hide Spanish translations
- Premium mode: AI-powered contextual translations via OpenAI API
- Phrase and word-level translation endpoints

## Common Patterns

When adding new stories:
1. Create content files in `src/content/[storySlug]/` following the level/chapter/page structure
2. Add story metadata to `STORY_METADATA` in `src/lib/stories.ts`
3. Create corresponding audio files in `public/audio/[storySlug]/`
4. Update story themes in `src/components/storyThemes.ts` if needed

When working with audio:
- Audio files follow naming: `line[N].mp3` for normal speed, `line[N].mp3` in `-slow` directories for slow speed
- Always provide fallback to speech synthesis
- Use the custom audio progress bar component for consistency

When adding translations:
- Add new keys to both `src/content/ui/en.ts` and `src/content/ui/es.ts`
- Use the `t()` function from `src/lib/t.ts` for translations in components
- Follow the nested object structure for organization