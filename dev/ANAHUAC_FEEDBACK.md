# Anahuac Feedback

Field notes from watching professors and students use the app live in class at
Universidad Anáhuac. Each section captures observed pain points and proposed
improvements. Consolidates the former `SAVE_WORD.md` and `TRANSLATIONS.md`.

---

## Word Translations

(Note: word translations run on Claude Sonnet 4.6, not GPT. GPT-4o is only used
for phrase translations.)

One feedback I've received from my students at Anahuac using Cuentana is that
they want to translate several words per page, but the word translations are
quite slow. I've been thinking about various ways to accomplish this without
losing the richness of the translations.

### Speeding up translations

I suppose that one question I have is, how long would a word translation take if
we continued using the LLM, but changed the prompt to just ask for the
translation in context? One word for one word? Currently our translation prompts
ask for a very dense amount of info, increasing translation time. So for example
if just asking for the word is fast, we could do 2 AI calls, 1 for just word to
word, then the 2nd being the existing. As soon as the word to word returns, it
shows the translation, then under it is still loading, so if user wants to see
the rich info, they can wait a few seconds longer. The 2nd call is the one that
we start saving to the DB, building our own dictionary, so that 2nd requests are
instant.

Just timed word translations, average is 5 second return time.

### Having our own dictionary

Building our own dictionary over time? We aren't even saving results for word
translations anywhere persistent (just an in-memory Map on the API that dies on
restart + React state that dies on reload — not actually localStorage). Note:
the storage shape already exists — `SavedWord.enrichedData` (Prisma) holds the
exact translation payload, but only when a user explicitly saves a word. A
write-through cache could reuse that shape. We have dialed this in for audio, one
audio request benefits the app and all users forever. I suppose we just haven't
done it yet for translations as I know this is far from the final version of how
we will translate. What if we just started saving all word translations to the
DB, then in one or two years maybe we have enough data to build our own DB based
dictionary, calling translations instantly.

I suppose there's just a firm tradeoff between richness of information and time.
Maybe user just wants an instant translation, and if it seems off, they can
research it further if they want. Or maybe, they want a reliable, context
appropriate, rich with information translation that takes a few seconds longer.

### Deferred: translation cache (and the key design that would make it worth it)

**Decision: deferred for now.** A DB cache for word translations is real value but
not urgent at ~180 users, and we may still change the translation-card payload —
which would partly invalidate any stored data. Revisit once the card format is
stable and/or user count is higher.

**The key design is the whole ballgame.** The value of the LLM call is that it's
*context-dependent* — the same word can mean wildly different things in different
sentences. So the cache key must NOT be the bare word. A bare-word key would
return wrong translations.

- **Naive context key** = `(word + exact sentence + level + direction)`. Correct,
  but fragile (whitespace/punctuation/re-clean changes miss) and low hit-rate at
  our scale: with 8 stories, several up to 10 versions each (5 levels × 2 langs),
  and Gatsby alone being tens of thousands of words ×10, the odds two users
  translate the exact same word-in-sentence are low today.

- **Better: location key + cross-level mapping.** Key on the word's *structural
  position* — `(storySlug, chapter, page, line, word, direction)` — which is far
  more stable than sentence text. The prize: the same word often sits on the
  corresponding line across levels (e.g. "deberia" on Gatsby ch1/p18/line1 appears
  identically at A1/A2/B1/B2; C1 uses a different construction). If we can map one
  cached translation to the equivalent location across all levels that share it,
  that's a 4–5× hit-rate multiplier — the first reader through *any* level seeds
  the word for everyone reading that line at *any* level. This converts caching
  from "wait for a random collision" to "structurally high hit rate."

  **Open question / hinge:** does this require that lines are index-aligned across
  levels? If A1 line N ⟷ B2 line N by index, the cross-level mapping is easy. If
  the rewrite pipeline merges/splits/reorders lines between levels, "the same
  word's location" is not a clean index map and we'd need word-level alignment
  (much harder). Verify line alignment across levels BEFORE committing to this
  design.

### Bug in our current smart translations

Current error in the word translation card, i've seen it conjugate an infinitive
verb. I can't remember the exact circumstances, maybe i can trigger it again, or
maybe it was just a one off. if i can trigger again, let's look into fixing, if
not, we'll just call it a quirk of the LLM. It had to do with, for verbs, we ask
it to include the subject in the translation so that the conjugations make sense,
but i translated not the main verb in a clause but a trailing verb, it was an
infinitive, and the translation just looked awkward as it removed the main verb
and just showed the subject + infinitive. A basic example would be like "Quiere
ir" > translate 'ir' > and it says 'he go'.

Okay yes I just tested it with 'podria ser', just translating 'ser', and the
translation says 'el/ella/useted ser = it be'. I think we just need to tell the
model to only include the subjects if it's the leading / conjugated verb, or to
omit the subject if it's an infinitive.

---

## Save Word / Vocabulary

Ideas for the future of the save word / vocabulary routes.

The bet is that this will be a very powerful learning tool when implemented
optimally.

Firstly, I believe we should have the 'vocabulary' routed to the story pages.
Imagine the app quizzing you on words after every page you read. The current
route is a bit clunky and easy to skip / not do. Whether to display the quiz if
user has no saved words is something to decide. Or if we only show saved words
for that page / story. Probably we'd be looking at implementing all user saved
words quiz available at the end of each page. Prob max ~5 questions, all the
highest priority. Perhaps down the road, we can do a generate quiz option for
users, where AI takes key vocab words from the page they just read and quizzes
them on the user.

Some additional ideas for improvement.

1. allow quizzing to go en <> es at random. Currently, for me at en/, i save
   spanish words, and the quiz works unidirectionally: translate this english
   word into spanish.

2. This also introduces some issues, where only one answer is acceptable. Here's
   a proposal: on word save, save just the word immediately, when the word is
   saved successfully, mark word as saved to user. Current setup does this, but
   there is a GPT AI call inbetween if the word hasn't been translated by GPT yet,
   slowing the process down. Let's save the word, show the success, then do the
   GPT translation in the background after save, but with a slightly different
   call that adds 'include all acceptable answers to this translation' which are
   all listed as potentially correct answers. It will need to do this based on
   the spanish word and the english word if we introduce the #1 idea of en <> es
   randomized quizzing. if showing first the saved word language, then we'd only
   show the saved word, not any of the possible saved word language equivilants,
   however we'd accept a correct answer for any of the non-saved word language.
   This idea will need further dialing in, but those are the bones.

3. Often times i can't remember the answer when i'm using our vocab quiz. When
   this happens, our only option is to show the user the answer, which is like
   forfeiting the answer. Would be ideal if when the user can't remember the
   answer to type in, the 'i don't know' or equivilant option provides a multiple
   choice question for the user to answer.

4. After saving a word and visiting the vocab page, saved words are immediately
   overdue. This is not a great UX, it's kind of stressful. Maybe set freshly
   saved words to be due by the end of the day, instead of an impossible
   immediate deadline.

5. Remove the time descriptions at vocabulary quiz route after you answer a
   question as they are not accurate. Either let them be accurate or remove.

6. Add more context for user to see when quizzing. Let's go look at the current
   setup, but I believe it will just show you a section of the native language
   text from the paragraph where the word was saved. I'm not even sure if it will
   just show the first few words of a paragraph, or if it actually shows text
   surrounding the saved word. Proposed: Main context is to add the surrounding 5
   or 6 words of either side of the saved word, in the users target language,
   with a blank where the saved word is. I think this would be very easy and high
   value.

---

## Professor Feedback (Lori)

Lori loves the app, and her students are really into it. Lori learned English largely through books, and has proposed two pieces of feedback after her 3rd day of classroom Cuentana usage. Both mirror how she or other students would use a physical book while reading in a second language. 

1. She wants to be able to underline words in a Cuentana story, just like she would with a pen in a real book. First UI thought would be to add an icon to the emoji row, and when word(s) are highlighted and this new underline icon is clicked, words get underlined. I'm open to other ideas. The next part of the equation (perhapse for later on) would be for users to have access to underlined words, as remembering/finding underlined sections in this web app form would be difficult otherwise. We'll have to think about that after more deeply understanding what the user is really getting at when they underline a word. 

2. The next idea was to be able to write notes in the margins, just like you might in a physical book. So maybe you click and hold the margin area and a text box pops up. Open to other ideas of how to introduce this, as it will be a tricky one to add while keeping the UI clean. Each note could be attached / go with a paragraph. Same second part of the equation as last time, i'd propose we think through and design an area for users to view all of their underlines and notes. 

---

## Translation Speed: Loading Tidbit (GF's idea) + measurement notes

### The idea — make the wait a moment of learning

Word/phrase translations take a few seconds (rich, context-aware output). Rather
than only chasing raw speed, *lean into* the wait the way Claude's playful loading
messages ("philosophizing…", "juggling…") do — but make it educational. While a
translation loads, show a random **MX/US colloquial saying or idiom** (with its
translation) on the translation card. A 5-second tidbit of real learning, on-theme
for a language app.

**Bonus mechanic:** a quick **save** option — if the user is fast, they can save the
displayed tidbit to their vocabulary route before the translation arrives. Connects
the loading state to the existing save-word/vocab system.

**Design cautions (don't skip these):**
- **Don't let it excuse slowness.** The tidbit is a delighter *on top of* a
  reasonably fast translation, not a justification for 9s. Keep pushing the headline
  to land as soon as it's ready.
- **Handle the variable wait.** Warm/light translations can return in ~2s — the
  tidbit (and its save option) must not flash by and vanish before the user reacts.
  Consider letting the tidbit/save persist briefly even after the translation lands,
  or park the save affordance in a corner.
- **Curate, don't randomize.** "Random words" goes stale fast — Anahuac students hit
  this dozens of times per class and will see repeats within one session. Lean toward
  a rich, finite set of **sayings/idioms** over arbitrary vocabulary; they're more
  memorable and more "worth the wait."

### Streaming vs. double-call — measured, then parked

Decision: **parked.** We measured the word route (warm, cache hitting):

- firstToken ~1.2s, headlineDone ~5.4s, fullDone ~9.5s (~640 output tokens).
- Streaming would reveal the headline ~4s earlier than the full payload — a *real
  but modest* win, not the "1.5s vs 6s" transformation that would make it a slam dunk.
- (The probe's headlineDone proxy fired late — true headline is somewhat earlier —
  so streaming's benefit is at least this good.)
- Streaming structured output means partial-JSON parsing of tool-use input deltas:
  meaningful frontend complexity. Not worth it until we know the wait actually hurts.

The original "two separate calls" idea is fully superseded: the requirement is
**one user request, rich info delivered automatically (no extra button)** — under
that constraint the double-call generates the same tokens as one call but adds a
round-trip, so it has no advantage. If we ever shorten the wait, streaming is the
tool; revisit only if the tidbit doesn't make the wait pleasant enough.

### Trimming output density — discussed, deferred

~9.5s is dominated by ~640 output tokens. Generating less = faster for everyone,
no streaming complexity. But trim *carefully*:

- **Do NOT cut the "xxx can also mean" alternate example sentences.** They're
  high-value (we were considering showing them open-by-default, not hiding them).
  Making them click-to-fetch would convert one wait into a 6s wait *plus* a fresh
  ~4s AI round-trip every time the user wants an example — likely a *worse*
  experience for engaged students, plus a new lazy-fetch code path. The content is
  the product; don't degrade the part we value most.
- **If trimming, cut the peripheral instead:** the verb conjugation chart (6
  conjugations generated on every verb — and *deterministic*, so it could be
  generated from the infinitive WITHOUT an AI call, eliminating those tokens
  entirely), and/or the per-derivative example sentences (the "word family" section
  is more peripheral than the primary translation's alternates).
- **But don't trim yet.** We haven't established 9.5s is actually a problem. Build
  the loading tidbit first; if it makes the wait pleasant, the pressure to degrade
  content evaporates and we keep all the rich output. Decide on trimming *after*,
  from felt experience, not theory.
