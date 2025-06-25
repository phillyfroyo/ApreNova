// src/app/es/stories/aventura/part-9/page.js
'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Part9() {
  const searchParams = useSearchParams();
  const [level, setLevel] = useState('');

  useEffect(() => {
    const userLevel = searchParams.get('level') || 'beginner';
    setLevel(userLevel);
  }, [searchParams]);

  const lines = [
    'We run through the dark way. We hear only our steps and our breath. Juan goes first. Ana stays close to me.',
    '“How far is it?” I ask.',
    '“It is long, but we are near,” the old man says.',
    'Then, the ground moves. A loud sound comes from behind.',
    '“Something fell!” Juan says.',
    'Ana takes my arm. “We must go fast!”',
    'We see light ahead. We run to it. At last, we come out. We are in the forest, near water.',
    'The old man takes out the map. “We must follow this way.”',
    'We hear voices. We hide behind the trees. Two men walk past.',
    '“They must be close,” one says.',
    'I look at Juan. He makes a strong hand. Ana looks at me. She looks afraid.',
    '“We go with no sound,” the old man says.',
    'We cross the water with care. It is cold. But we do not stop.',
    'Then we see the cave. The old man puts his hand on a rock.',
    '“This is the place,” he says.',
    'The stone moves. A door opens.',
    'Ana takes my hand.',
    '“Ready?” she says.',
    'We look at each other.',
    'There is no turn back now.'
  ];

  return (
    <div style={{ padding: '2rem', maxWidth: '700px', margin: '0 auto' }}>
      <h1>Adventure in Guatemala – Part 9</h1>
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
