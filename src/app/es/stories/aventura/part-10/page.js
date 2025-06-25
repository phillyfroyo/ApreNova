// src/app/es/stories/aventura/part-10/page.js
'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Part10() {
  const searchParams = useSearchParams();
  const [level, setLevel] = useState('');

  useEffect(() => {
    const userLevel = searchParams.get('level') || 'beginner';
    setLevel(userLevel);
  }, [searchParams]);

  const lines = [
    'We run out of the tunnel. The air of the forest hits our faces. The moon is up. It gives us light.',
    'Behind us, we hear shouts and fast steps.',
    '“Quick!” the old man says. “We must get to the statue before they do!”',
    'Ana looks at me. My heart is fast. We run through the trees.',
    'Then we see it — a big stone in the shape of a jaguar.',
    'Juan puts his hand on it. “There must be something here…”',
    'A gunshot breaks the air. We fall to the ground. In the dark, we see people moving.',
    '“They found us,” Ana says.',
    'The old man pulls out a small thing. “This is the key!”',
    'He puts it into the stone. A deep sound starts. The jaguar opens its mouth.',
    'Inside, we see a red gem. It shines.',
    '“It’s… so bright,” Ana says.',
    'Juan takes the gem and puts it in his bag. “Run!”',
    'We go down a path. The air is full of sound. We hear helicopters. A light moves over the forest.',
    'Then we hear a voice from above: “Give us the gem, and we will let you go.”',
    'We stop.',
    'We are surrounded.',
    'To be continued…'
  ];

  return (
    <div style={{ padding: '2rem', maxWidth: '700px', margin: '0 auto' }}>
      <h1>Adventure in Guatemala – Part 10</h1>
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
