// src/app/es/stories/aventura/part-2/page.js
'use client';

import { useEffect } from 'react';

export default function Part2Page() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const sentences = [
    "In the morning, Juan and I talk about the cave. We want to go back, but we know it may be dangerous.",
    "\"Pedro, someone must know more about this,\" Juan says.",
    "We walk to the school. There we find Ana. She reads a lot. She likes old stories.",
    "\"Ana, we found a cave with old drawings,\" I tell her.",
    "Her eyes go wide. \"Where is it?\"",
    "We show her the map. She looks at it for a long time.",
    "\"This map is really old,\" she says. \"It could be important.\"",
    "She wants to go with us. I say it might be dangerous, but she does not stop.",
    "\"If we want to know the truth, we must go together,\" she says.",
    "Juan gives a smile. \"Okay. Tomorrow, the three of us will go.\"",
    "That night, I cannot sleep. I think about the cave, the drawings, and Ana."
  ];

  const speak = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  };

  return (
    <div className="story-container">
      <h1>Adventure in Guatemala – Part 2</h1>
      {sentences.map((sentence, index) => (
        <div className="sentence-block" key={index}>
          <div className="emoji-buttons">
            <span onClick={() => speak(sentence)}>🔊</span>
          </div>
          <div className="sentence-text">{sentence}</div>
        </div>
      ))}
    </div>
  );
}
