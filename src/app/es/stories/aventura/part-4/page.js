// src/app/es/stories/aventura/part-4/page.js
'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Part4() {
  const searchParams = useSearchParams();
  const [level, setLevel] = useState('');

  useEffect(() => {
    const userLevel = searchParams.get('level') || 'beginner';
    setLevel(userLevel);
  }, [searchParams]);

  const lines = [
    'We stay quiet. The two men look at us. I see anger in their faces.',
    '“What did you see in the cave?” one of them asks.',
    'I look at Juan and Ana. We do not speak. At last, I say, “Only some drawings.”',
    'The old man nods. “There is still time, but you cannot go back now.”',
    '“Why not?” Ana asks.',
    '“Someone else is coming tonight. And they will not help you.”',
    'A cold feeling moves through me. Juan makes a tight hand.',
    '“We cannot go without the truth,” he says.',
    'The old man looks at us. “If you want to know more, come with me. You must choose now.”',
    'We look at each other. Ana takes my arm. Her hand gives me courage.',
    '“Let’s go,” she says.',
    'The old man leads us through a small path in the forest. We walk fast. It feels like someone is close.',
    'Then we hear a loud sound behind us.',
    '“Run!” the old man says.',
    'We run. Ana falls. I help her up.',
    '“I’m okay,” she says.',
    'We reach a small place between trees. The old man opens the door.',
    '“Come in. Now.”',
    'Inside, we hear soft voices far away.',
    'Outside, someone is looking.'
  ];

  return (
    <div style={{ padding: '2rem', maxWidth: '700px', margin: '0 auto' }}>
      <h1>Adventure in Guatemala – Part 4</h1>
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
