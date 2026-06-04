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
