## GPT Translations

One feedback I've received from my students at Anahuac using Cuentana is that they want to translate several words per page, but the word translations are quite slow. I've been thinking about various ways to accomplish this without losing the richness of the translations. 

## Speeding up translations
I suppose that one question I have is, how long would a word translation take if we continued using GPT, but changed the prompt to just ask for the translation in context? One word for one word? Currently our translation prompts ask for a very dense amount of info, increasing translation time. So for example if just asking for the word is fast, we could do 2 AI calls, 1 for just word to word, then the 2nd being the existing. As soon as the word to word returns, it shows the translation, then under it is still loading, so if user wants to see the rich info, they can wait a few seconds longer. The 2nd call is the one that we start saving to the DB, building our own dictionary, so that 2nd requests are instant. 

## Having our own dictionary
Building our own dictionary over time? We aren't even saving results for word translations anywhere other than localstorage. We have dialed this in for audio, one audio request benefits the app and all users forever. I suppose we just haven't done it yet for translations as I know this is far from the final version of how we will translate. What if we just started saving all word translations to the DB, then in one or two years maybe we have enough data to build our own DB based dictionary, calling translations instantly. 

I suppose there's just a firm tradeoff between richness of information and time. Maybe user just wants an instant translation, and if it seems off, they can research it further if they want. Or maybe, they want a reliable, context appropriate, rich with information translation that takes a few seconds longer.  

## Bug in our current smart translations
Current error in the word translation card, i've seen it conjucate an infinitive verb. I can't remember the exact circumstances, maybe i can trigger it again, or maybe it was just a one off. if i can trigger again, let's look into fixing, if not, we'll just call it a quirk of the LLM. It had to do with, for verbs, we ask it to include the subject in the translation so that the conjugations make sense, but i translated not the main verb in a clause but a trailing verb, it was an infinitive, and the translation just looked awkward as it removed the main verb and just showed the subject + infinitive. A basic example would be like "Quiere ir" > translate 'ir' > and it says 'he go'. 

Okay yes I just tested it with 'podria ser', just translating 'ser', and the translation says 'el/ella/useted ser = it be'. I think we just need to tell the model to only include the subjects if it's the leading / conjugated verb, or to omit the subject if it's an infinitive. 