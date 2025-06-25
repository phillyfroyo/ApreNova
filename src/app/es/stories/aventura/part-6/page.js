// src/app/es/stories/aventura/part-6/page.js
'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Part6() {
  const searchParams = useSearchParams();
  const [level, setLevel] = useState('');

  useEffect(() => {
    const userLevel = searchParams.get('level') || 'beginner';
    setLevel(userLevel);
  }, [searchParams]);

  const lines = [
    'The old man leads us through the way under the house. It is dark. The air is cold. We hear only our steps.',
    'Ana walks next to me. She looks at me.',
    '“Is the red stone in the cave?” I ask.',
    '“Yes,” the old man says. “But dangerous things are there. It will not be easy.”',
    'Then we hear a sound behind us. The old man stops.',
    '“Be careful!” he says. “Go this way, now!”',
    'We move fast. At the end of the tunnel, we climb up. We are back in the forest.',
    'The sun is down, but there is still some light.',
    '“They are coming!” the old man says in a loud voice. “Run!”',
    'Ana takes my hand. We run through the trees. I do not know if we will get away.',
    'But I do not stop.'
  ];

  return (
    <div style={{ padding: '2rem', maxWidth: '700px', margin: '0 auto' }}>
      <h1>Adventure in Guatemala – Part 6</h1>
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
