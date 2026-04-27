# Landing Page Plan — `/` (pre-auth home)

**Goal:** convert curious arrivals into engaged signups by demonstrating the app's core promise, not by listing its features. Filter out users who are looking for "Duolingo" or "private classes" so the people who do sign up are the right ones.

**Audience:** an English speaker learning Spanish, or a Spanish speaker learning English, who likes books / podcasts / stories and wants reading-and-listening practice at their level. Bus-pitch demographic, plus the eventual paid-ad audience. Mostly mobile.

**Constraint we're designing around:** screenshots, screen recordings, and text. No fancy animations, no illustrations, no custom video productions.

---

## The Core Promise (the thing the page is built around)

> **Read anything you want — at your level — in the language you're learning.**

Everything else (audiobooks, vocab saving, AI tutor, spaced repetition) is a mechanism that supports this promise. Don't bury the promise under the mechanisms.

### Why this framing wins

- **It's a unique claim.** No other language app offers CEFR-adaptive rewriting for arbitrary text. Duolingo doesn't. Babbel doesn't. ChatGPT can't sustain a 200-page novel at A2.
- **It collapses 5 features into 1 mental model.** Users don't have to remember a checklist; they remember "the app that lets me read what I want."
- **It pre-empts the "I don't like books" objection.** The promise isn't "read books" — it's "read anything." That includes news articles, recipes, fan fiction, song lyrics, the Wikipedia page about their favorite band.

---

## Page Structure

The page is a single scrolling column on mobile, max-width-constrained on desktop. Each section serves one purpose. CTAs repeat at predictable intervals.

### Section 1 — Hero (above the fold)

**Purpose:** state the promise, prove it visually within 2 seconds, primary CTA.

**Headline (EN):** Read anything in Spanish — at your level.
**Headline (ES):** Lee lo que quieras en inglés — a tu nivel.

**Subheadline (EN):** Stories, articles, your own uploads — rewritten to match your CEFR level. With audio, tap-to-translate, and vocab review built in.
**Subheadline (ES):** Historias, artículos, tus propios textos — reescritos para tu nivel CEFR. Con audio, traducción al toque y repaso de vocabulario.

**Primary CTA button:** `Start free` / `Empieza gratis`
**CTA helper text:** No card required. Pick your level in 60 seconds. / Sin tarjeta. Elige tu nivel en 60 segundos.

**Visual placement under headline + above CTA:** the demo video you already recorded (`tap-translate-save.mp4`), framed in the phone-bezel container we built. Autoplay, muted, loop.

**Screenshot/recording instruction:** ALREADY DONE. The 20-second `tap-translate-save.mp4` is the hero visual.

**Notes on hero copy:**
- The em-dash treatment ("at your level") is the load-bearing phrase. It's the differentiator. If a user reads only those four words, they understand the promise.
- "Stories, articles, your own uploads" in the subheadline is the only place we mention the upload feature in section 1 — keeps the hero clean while planting the seed.
- The CTA helper line is a friction-reducer. "Free" alone isn't enough; "no card required" is.

---

### Section 2 — The Level Problem (the core differentiator)

**Purpose:** make the user feel the pain point this app solves, then show how it solves it.

**Headline (EN):** Tired of reading at the wrong level?
**Headline (ES):** ¿Cansado de leer al nivel equivocado?

**Body (EN):** Children's books are too easy. The novel you actually want to read is too hard. So you stop reading. We rewrite any story to match your CEFR level — A1 through C1 — without losing the plot.

**Body (ES):** Los libros para niños son demasiado fáciles. La novela que en verdad quieres leer es demasiado difícil. Así que dejas de leer. Nosotros reescribimos cualquier historia para tu nivel CEFR — de A1 a C1 — sin perder la trama.

**Visual:** SIDE-BY-SIDE COMPARISON of the same passage at two levels.

**Screenshot/recording instruction:**
- Pick one short paragraph from a story we have.
- Take **two screenshots** of that same paragraph displayed at two different CEFR levels — for example A2 and B2.
- The screenshots should be of the actual story page. The CEFR badge should be visible in both.
- Resolution: phone-frame portrait, ~344×500 each.
- These will be displayed side-by-side on desktop, stacked on mobile.
- Caption labels: "A2 — beginner" and "B2 — intermediate" (or whatever two levels you choose).

**Why two levels and not five:** showing all 5 levels is information overload. Two is enough to prove the concept. The user's brain extrapolates "if it works for these two, it works for the rest."

---

### Section 3 — Bring Your Own Content (the scope claim)

**Purpose:** answer "but what if you don't have the book I want to read?" before they ask.

**Headline (EN):** Don't see what you want to read? Upload it.
**Headline (ES):** ¿No ves lo que quieres leer? Súbelo.

**Body (EN):** Paste an article. Drop in a PDF. Upload a chapter from your favorite novel. We'll rewrite it to your level, translate every line, and turn it into a reader with audio in under a minute.

**Body (ES):** Pega un artículo. Sube un PDF. Sube un capítulo de tu novela favorita. Lo reescribiremos a tu nivel, lo traduciremos línea por línea, y lo convertiremos en un lector con audio en menos de un minuto.

**Visual:** SCREEN RECORDING of the upload flow.

**Screenshot/recording instruction:**
- Open the upload story modal (the one accessible via the upload button on `/stories` for logged-in users).
- Record paste-to-published flow:
  1. Paste 2-3 paragraphs of source text into the upload modal (Spanish content if recording for `en` site, English content if recording for `es` site)
  2. Show the level selection
  3. Show the "processing" state briefly
  4. Cut to the resulting story page being readable
- Total length: 15-25 seconds
- Speed up the processing wait (cut it down) — viewers won't sit through 30 seconds of a loading spinner
- Output: portrait MP4, same dimensions as the hero video for consistency
- Filename: `/public/landing/upload-flow.mp4` (English) and eventually `/public/landing/upload-flow-es.mp4`

**Caption above video:** "From paste to reading in under a minute" / "De pegar a leer en menos de un minuto"

**Why this section is here, not first:** uploading your own content is a powerful feature, but it's not the *first* thing a user wants to know. They want to know they can read interesting stuff at their level — *then* "and you can also bring your own" is the kicker.

---

### Section 4 — Listen, Don't Just Read (the audio differentiator)

**Purpose:** convert listeners and audiobook fans (high-LTV users) by showing the audio is real, not afterthought.

**Headline (EN):** Train your ear with full audiobooks at your level.
**Headline (ES):** Entrena tu oído con audiolibros completos a tu nivel.

**Body (EN):** Every story plays as a real audiobook — narrated, sentence-synced, with words highlighted as they're spoken. Listen on your commute. Read along. Pause to look up a word.

**Body (ES):** Cada historia se reproduce como un audiolibro real — narrado, sincronizado por oración, con palabras resaltadas mientras se hablan. Escucha en el camino. Lee al mismo tiempo. Pausa para buscar una palabra.

**Visual:** SCREEN RECORDING of the audio playback feature.

**Screenshot/recording instruction:**
- Open any story page with audio.
- Press play on the listen button.
- Show the highlighted-word-as-spoken sync (the per-sentence audio highlight on the text).
- Show the page auto-advancing to the next page mid-playback.
- Optionally: tap a word mid-playback to show that the audio continues while the translation popup appears.
- Total length: 12-20 seconds.
- Output: `/public/landing/audio-playback.mp4`

**Important note on audio for the recording:** since the demo videos are autoplay/muted, the user can't hear the audiobook narration. The visual proof here is **the synchronized highlighting**, not the audio itself. Make sure the screen recording clearly shows words lighting up in time with playback.

---

### Section 5 — Build Your Own Vocabulary (the retention mechanism)

**Purpose:** show the loop that keeps users coming back. Saved words → quiz review → habit.

**Headline (EN):** Save the words that stump you. Review them on autopilot.
**Headline (ES):** Guarda las palabras que te detienen. Repásalas en automático.

**Body (EN):** Tap any word to translate. Tap save. The app uses spaced repetition to bring them back at the right moment — the science-backed way to make vocabulary stick.

**Body (ES):** Toca cualquier palabra para traducir. Toca guardar. La app usa repetición espaciada para devolverlas en el momento correcto — la forma comprobada para fijar el vocabulario.

**Visual:** TWO STILL SCREENSHOTS in a side-by-side or stacked layout.

**Screenshot/recording instruction:**
- **Screenshot A:** the in-story save action — a word is selected, the emoji action row is open, save button visible. Show the green "saved" state if possible.
- **Screenshot B:** the vocabulary review page mid-quiz, showing a flashcard with the word and a difficulty-rating row.
- Both portrait phone-frame style.
- Caption A: "Tap to save" / "Toca para guardar"
- Caption B: "Review at the right time" / "Repasa en el momento correcto"

**Why two screenshots, not a video:** vocab review doesn't change frame-to-frame in interesting ways — a video would just be the user clicking through cards, which is less compelling than two clear "before/after" frames. Stills are better here.

---

### Section 6 — Secondary CTA + Social Proof

**Purpose:** catch users who scrolled this far without clicking the hero CTA.

**Headline (EN):** Ready to read what you actually want?
**Headline (ES):** ¿Listo para leer lo que en verdad quieres?

**Body (EN):** Free to start. Pick your level. Tap a word. That's the whole onboarding.
**Body (ES):** Gratis para empezar. Elige tu nivel. Toca una palabra. Eso es todo.

**CTA button:** `Start free` / `Empieza gratis` (same CTA as hero — same wording for consistency)

**Below the button — "Already have an account? Log in" link** (this is your friction-relief for returning users who somehow landed here).

**Optional: testimonial slot.**
- If you have a quote from any of your existing 94 users (or the 2 who replied to your email outreach, or the 1:1 tutoring students), put it here.
- Format: 1-2 sentences in italic, "— Name, [optional context]"
- Don't fake this. If you don't have a real one yet, leave the slot out for v1.
- Real quote example: "I finally finished a novel in Spanish — at the level where I could actually understand it." — María, B1 learner

---

### Section 7 — Footer (minimal)

- Logo + tagline
- Links: Privacy, Terms, About (existing routes)
- "Made in Mexico City" or similar — anchors the brand
- No social media icons unless they're real and active
- No phone number, no email — those invite spam and you don't want support requests on this page

---

## Critical Design Decisions

### Why I'm NOT including these:

- **AI tutor in headline content.** Mentioned only in passing in Section 6 if at all. AI tutors are commodity; CEFR-adaptive content is the moat.
- **A "minimalist reader" feature section.** The minimalism shows itself in every screenshot. Telling users "we made it minimalist" is the opposite of minimalist. Saying nothing is louder.
- **A long "How it works" section with numbered steps.** Replaced by section 6's compressed version: "Pick your level. Tap a word. That's the onboarding." Three steps in one sentence.
- **Pricing.** No mention of price on the landing page. Free to start is enough; pricing belongs after sign-in or on a dedicated `/premium` route.
- **Comparison tables vs. Duolingo / Babbel.** Tempting but draws attention to competitors and reads as defensive. The differentiator is in section 2, framed positively.

### CTA placement summary

- Section 1 (hero): primary CTA
- Section 6 (final): secondary CTA
- That's it. Two CTAs. Resist the urge to add more.

### Mobile-first

Every section needs to be designed mobile-first. This means:
- Text wraps cleanly at narrow widths
- Phone-frame video at ~260px wide (matches what we built)
- Side-by-side comparisons (Section 2) become stacked on mobile
- No horizontal scrolling anywhere
- Tap targets ≥ 44×44 px

### Language toggle

- The existing dropdown placement under the welcome card stays.
- All sections below also swap language when the toggle is hit.
- Headlines and body copy are bilingual constants in the page component, keyed by `preferredLang`.

---

## Recording Priority Order

If you can only record a few things, do them in this order:

1. ✅ **Tap-to-translate + save** (already done) — Section 1 hero
2. **Upload flow** — Section 3 (this is your strongest unique-feature visual)
3. **Audio playback with synced highlighting** — Section 4
4. **Two CEFR-level screenshots of the same passage** — Section 2 (this is the heart of the differentiator and surprisingly easy to capture)
5. **Save + vocab review screenshots** — Section 5

Sections 6 and 7 don't need any new visuals.

---

## What this page deliberately doesn't do

It doesn't try to teach the user the entire app. It tries to make them want to find out the rest. The goal of the landing page is **a signup, not an education.**

Once they sign up, the in-app discovery tour we just built takes over.

---

## Open questions for you

1. **Testimonial copy:** Do you have any real quotes from users or tutoring students you could use in Section 6? Even rough ones — we can edit for length.
2. **Spanish-side videos:** the `es` view will eventually need Spanish-narration recordings of the same flows. Until then, the English videos play OR we show "Próximamente" placeholders. Your call which feels less broken.
3. **Brand identity beats:** any color, texture, or imagery direction beyond what's already in the app? The current landing page uses `background3.png` — do we keep that, or do you want a cleaner background for the demo sections so the videos pop more?
