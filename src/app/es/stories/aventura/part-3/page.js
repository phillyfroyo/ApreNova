// src/app/es/stories/aventura/part-3/page.js
'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Part3() {
  const searchParams = useSearchParams();
  const [level, setLevel] = useState('');

  useEffect(() => {
    const userLevel = searchParams.get('level') || 'beginner';
    setLevel(userLevel);
  }, [searchParams]);

  const lines = [
    "The next day, Juan and I find Ana at the town square. She is there with her mom. They are selling food.",
    '“Ana, we must talk,” I say.',
    'She looks at us. “What is it?”',
    '“We went to the cave again. We had the map, and we met an old man.”',
    'Her eyes go wide. “That is good. My grandpa said something about a cave, but no one would believe him.”',
    '“Come with us,” Juan says. “Let’s go back today.”',
    'She looks at her mom. Her mom says, “Be careful.”',
    'We walk back into the forest. This time the way is not the same. Some trees are broken. The ground has marks. We see no people.',
    '“Something is not right,” Ana says.',
    'We reach the cave. It looks the same, but the drawings are not.',
    'One shows three people. They look like us!',
    '“This was not here before!” Juan says.',
    'Then we hear a loud sound. We run out.',
    'The old man is there. Two men stand with him. They look angry.',
    '“You must leave,” the old man says.',
    'Ana takes my hand. Her touch gives me courage.',
    'We all feel it. This is the start of something dangerous.'
  ];

  return (
    <div style={{ padding: '2rem', maxWidth: '700px', margin: '0 auto' }}>
      <h1>Adventure in Guatemala – Part 3</h1>
      <p><strong>Level:</strong> {level}</p>
      {lines.map((line, idx) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '1rem 0' }}>
          <span role="img" aria-label="speaker">🔊</span>
          <span role="img" aria-label="writing hand">✍️</span>
          <span>{line}</span>
        </div>
      ))}
    </div>
  );
}
