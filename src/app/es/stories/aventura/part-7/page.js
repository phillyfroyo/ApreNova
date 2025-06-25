// src/app/es/stories/aventura/part-7/page.js
'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Part7() {
  const searchParams = useSearchParams();
  const [level, setLevel] = useState('');

  useEffect(() => {
    const userLevel = searchParams.get('level') || 'beginner';
    setLevel(userLevel);
  }, [searchParams]);

  const lines = [
    'We run fast through the trees. The sound behind us gets loud. The old man runs in front. Ana stays close to me.',
    '“Where are we going?” I ask.',
    '“To a safe place,” he says. “We cannot stop.”',
    'I see a small house. The old man runs to it and opens the door.',
    '“Come in. Be quiet.”',
    'We go inside. It is small, but we can see the forest through a big window.',
    '“Who is behind us?” Juan asks.',
    '“Bad men,” says the old man. “They want the red stone. They have looked for it for a long time.”',
    'Ana looks out the window.',
    '“Where is it?” I ask.',
    '“It is in the cave,” the old man says. “But it is not just gold. It is important. It has something no one should use.”'
  ];

  return (
    <div style={{ padding: '2rem', maxWidth: '700px', margin: '0 auto' }}>
      <h1>Adventure in Guatemala – Part 7</h1>
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
