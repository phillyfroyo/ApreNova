// src/app/es/stories/aventura/part-5/page.js
'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Part5() {
  const searchParams = useSearchParams();
  const [level, setLevel] = useState('');

  useEffect(() => {
    const userLevel = searchParams.get('level') || 'beginner';
    setLevel(userLevel);
  }, [searchParams]);

  const lines = [
    "Inside the small house, the old man lights a small light. It shows some books, a map, and a box.",
    '“If you are here, then you must know the truth,” he says.',
    'We stand close.',
    '“This cave is not just a place. There is something here that people have tried to find for a long time. Some would do anything to get it.”',
    'Ana looks at him. “What is it?”',
    'He opens the box. Inside is paper. He opens it and shows us a drawing: a red stone in something like a face.',
    '“They say this thing has power. It is not just a story. My father and his friend tried to find it. Only one came back.”',
    'We look at each other. I feel worry.',
    '“Someone is still looking for it,” Juan says.',
    'Then we hear sounds outside. People. Steps.',
    '“They have found us,” the old man says. “We must go. Now.”',
    'He puts out the light. Then he opens a door in the floor.',
    '“This way. There is a road under us. It will take us to the other side of the forest.”',
    'Ana takes my hand again.',
    'I do not let go.'
  ];

  return (
    <div style={{ padding: '2rem', maxWidth: '700px', margin: '0 auto' }}>
      <h1>Adventure in Guatemala – Part 5</h1>
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
