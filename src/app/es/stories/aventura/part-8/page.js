// src/app/es/stories/aventura/part-8/page.js
'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Part8() {
  const searchParams = useSearchParams();
  const [level, setLevel] = useState('');

  useEffect(() => {
    const userLevel = searchParams.get('level') || 'beginner';
    setLevel(userLevel);
  }, [searchParams]);

  const lines = [
    'The old man looks at us. His face is serious.',
    '“If they find the red stone, many things can change,” he says. “Not just because it has power, but because of what people want to do with it.”',
    '“What do they want?” I ask.',
    '“To take control,” the old man says. “The stone can help the one who has it. But if used in the wrong way, it can bring great danger.”',
    '“How do we stop them?” Ana asks.',
    '“There is one way,” he says. “Put it back where it came from.”',
    'Then we hear a sound outside. Someone is close.',
    '“They will not stop,” says Juan. “What now?”',
    '“We go out the back,” the old man says. “It may be our only way.”',
    'We stand and walk to the door. I take Ana’s hand.',
    'We are ready. But we know the forest is full of danger, and the men are still near.'
  ];

  return (
    <div style={{ padding: '2rem', maxWidth: '700px', margin: '0 auto' }}>
      <h1>Adventure in Guatemala – Part 8</h1>
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
