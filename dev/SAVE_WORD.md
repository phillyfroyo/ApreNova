Ideas for the future of the save word / vocabulary routes. 

The bet is that this will be a very powerful learning tool when implemented optimally. 

Firstly, I believe we should have the 'vocabulary' routed to the story pages. Imagine the app quizzing you on words after every page you read. The current route is a bit clunky and easy to skip / not do. Whether to display the quiz if user has no saved words is something to decide. Or if we only show saved words for that page / story. Probably we'd be looking at implementing all user saved words quiz available at the end of each page. Prob max ~5 questions, all the highest priority. Perhapse down the road, we can do a generate quiz option for users, where AI takes key vocab words from the page they just read and quizzes them on the user.

Some additional ideas for improvement. 

1. allow quizzing to go en <> es at random. Currently, for me at en/, i save spanish words, and the quiz works unidirectionally: translate this english word into spanish. 

2. This also introduces some issues, where only one answer is acceptable. Here's a proposal: on word save, save just the word immediately, when the word is saved successfully, mark word as saved to user. Current setup does this, but there is a GPT AI call inbetween if the word hasn't been translated by GPT yet, slowing the process down. Let's save the word, show the success, then do the GPT translation in the background after save, but with a slightly different call that adds 'include all acceptable answers to this translation' which are all listed as potentially correct answers. It will need to do this based on the spanish word and the english word if we introduce the #1 idea of en <> es randomized quizzing. if showing first the saved word language, then we'd only show the saved word, not any of the possible saved word language equivilants, however we'd accept a correct answer for any of the non-saved word language. This idea will need further dialing in, but those are the bones. 

3. Often times i can't remember the answer when i'm using our vocab quiz. When this happens, our only option is to show the user the answer, which is like forfeiting the answer. Would be ideal if when the user can't remember the answer to type in, the 'i don't know' or equivilant option provides a multiple choice question for the user to answer.

4. After saving a word and visiting the vocab page, saved words are immediately overdue. This is not a great UX, it's kind of stressful. Maybe set freshly saved words to be due by the end of the day, instead of an impossible immediate deadline. 

5. Remove the time descriptions at vocabulary quiz route after you answer a question as they are not accurate. Either let them be accurate or remove. 