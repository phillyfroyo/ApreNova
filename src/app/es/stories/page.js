// src/app/es/stories/page.js
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

export default function StoriesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialLevel = searchParams.get('level') || 'beginner';

  const [selectedLevel, setSelectedLevel] = useState(initialLevel);

  useEffect(() => {
  const level = searchParams.get('level');
  if (level && level !== selectedLevel) {
    setSelectedLevel(level);
  }
}, [searchParams, selectedLevel]);

  const stories = [
    {
      title: 'Aventura en Guatemala',
      thumbnail: '/aventura-thumbnail.png',
      link: '/es/stories/aventura/part-1',
    },
    {
      title: 'El Viaje Misterioso',
      thumbnail: '/placeholder1.png',
      link: '/es/stories/viaje',
    },
    {
      title: 'La Ciudad Perdida',
      thumbnail: '/placeholder2.png',
      link: '/es/stories/ciudad',
    },
    {
      title: 'El Secreto del Bosque',
      thumbnail: '/placeholder3.png',
      link: '/es/stories/bosque',
    },
    {
      title: 'Tesoro Escondido',
      thumbnail: '/placeholder4.png',
      link: '/es/stories/tesoro',
    },
  ];

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="level">Nivel:</label>
        <select
          id="level"
          value={selectedLevel}
          onChange={(e) => {
            setSelectedLevel(e.target.value);
            router.push(`/es/stories?level=${e.target.value}`);
          }}
        >
          <option value="brandnew">Brand New</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
          <option value="expert">Expert</option>
        </select>
      </div>

      <h2>Historias para el nivel: {selectedLevel}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
        {stories.map((story, idx) => (
          <Link href={story.link + `?level=${selectedLevel}`} key={idx} style={{ textAlign: 'center' }}>
            <Image src={story.thumbnail} alt={story.title} width={160} height={240} />
            <p>{story.title}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
