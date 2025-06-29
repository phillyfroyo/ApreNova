// src/app/en/stories/page.js
'use client';

import { useState } from 'react';

export default function StoriesPageEN() {
  const [level, setLevel] = useState('Beginner');
  const levels = ['Brand New', 'Beginner', 'Intermediate', 'Advanced', 'Expert'];

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundImage: "url('/background2.png')",
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        padding: '2rem'
      }}
    >
      {/* Level Dropdown */}
      <div style={{ position: 'absolute', top: '1rem', left: '1rem' }}>
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            border: '1px solid #ccc',
            backgroundColor: 'white',
            fontWeight: 'bold'
          }}
        >
          {levels.map((lvl) => (
            <option key={lvl} value={lvl}>{`Level: ${lvl}`}</option>
          ))}
        </select>
      </div>

      {/* Placeholder for stories */}
      <main style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh'
      }}>
        <h1 style={{
          backgroundColor: 'rgba(255,255,255,0.95)',
          padding: '2rem',
          borderRadius: '2rem',
          fontSize: '2rem',
          fontWeight: 'bold',
          textAlign: 'center',
          boxShadow: '0 0 20px rgba(0,0,0,0.1)'
        }}>
          Showing stories for level: {level}
        </h1>
      </main>
    </div>
  );
}
