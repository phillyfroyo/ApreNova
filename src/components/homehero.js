'use client';

import { useRouter } from 'next/navigation';

export default function HomeHero({ language }) {
  const router = useRouter();

  const handleStartClick = () => {
    router.push(`/${language}/quiz`);
  };

  const isSpanish = language === 'es';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: "url('/background.png') center/cover no-repeat",
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontSize: '4rem', fontWeight: 'bold', color: '#2d00f7' }}>
        <span style={{ color: '#0033cc' }}>Apre</span>Nova
      </h1>
      <p style={{ fontSize: '1.5rem', margin: '1rem 0' }}>
        {isSpanish
          ? 'Aprende más inteligente, no más difícil. Aprende con historias.'
          : 'Learn smarter, not harder. Learn with stories.'}
      </p>
      <button
        onClick={handleStartClick}
        style={{
          backgroundColor: '#0074D9',
          color: 'white',
          fontSize: '1rem',
          padding: '1rem 2rem',
          borderRadius: '2rem',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        {isSpanish ? 'Empieza hoy, gratis →' : 'Start today, for free →'}
      </button>
    </div>
  );
}
