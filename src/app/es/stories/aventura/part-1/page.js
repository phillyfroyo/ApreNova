// src/app/es/stories/aventura/part-1/page.js
'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

const sentences = [
  {
    en: "My name is Pedro. I live in Guatemala. One day, Juan comes to my house with a map.",
    es: "Me llamo Pedro. Vivo en Guatemala. Un d\u00eda, Juan viene a mi casa con un mapa."
  },
  {
    en: "\"I got this at school,\" he says. \"It shows a way through the forest.\"",
    es: "\"Lo obtuve en la escuela,\" dice. \"Muestra un camino por el bosque.\""
  },
  {
    en: "We leave early and walk all day. There are many trees. We see water near the path.",
    es: "Salimos temprano y caminamos todo el d\u00eda. Hay muchos \u00e1rboles. Vemos agua cerca del camino."
  },
  {
    en: "After some time, we find a cave.",
    es: "Despu\u00e9s de un tiempo, encontramos una cueva."
  },
  {
    en: "\"The map shows something here,\" Juan says.",
    es: "\"El mapa muestra algo aqu\u00ed,\" dice Juan."
  },
  {
    en: "We go in. It is dark. We see drawings on the wall. They show people and places from long ago.",
    es: "Entramos. Est\u00e1 oscuro. Vemos dibujos en la pared. Muestran personas y lugares de hace mucho."
  },
  {
    en: "\"This is more than gold,\" Juan says. \"It is better than anything I have seen.\"",
    es: "\"Esto es m\u00e1s que oro,\" dice Juan. \"Es mejor que todo lo que he visto.\""
  },
  {
    en: "We look for a while, then go back. The sun is down. The sky is dark.",
    es: "Miramos por un rato, luego regresamos. El sol se ha puesto. El cielo est\u00e1 oscuro."
  },
  {
    en: "\"This is the start of something,\" I say.",
    es: "\"Esto es el comienzo de algo,\" digo."
  },
  {
    en: "As we walk, we hear something in the forest. Juan stops.",
    es: "Mientras caminamos, escuchamos algo en el bosque. Juan se detiene."
  },
  {
    en: "\"I think we are not alone,\" he says.",
    es: "\"Creo que no estamos solos,\" dice."
  },
  {
    en: "We see something move. We stop. We feel like someone is near.",
    es: "Vemos algo moverse. Nos detenemos. Sentimos que alguien est\u00e1 cerca."
  },
  {
    en: "A man comes out. He is old. He looks at us.",
    es: "Un hombre sale. Es viejo. Nos mira."
  },
  {
    en: "\"You found the cave,\" he says. \"Be careful what you do.\"",
    es: "\"Encontraron la cueva,\" dice. \"Tengan cuidado con lo que hacen.\""
  },
  {
    en: "We do not say a word. But we know something real has started.",
    es: "No decimos una palabra. Pero sabemos que algo real ha comenzado."
  }
];

export default function Part1Page() {
  const searchParams = useSearchParams();
  const level = searchParams.get('level') || 'beginner';

  const speak = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  };

  const toggleTranslation = (e) => {
    const translation = e.currentTarget.nextSibling;
    translation.style.display =
      translation.style.display === 'block' ? 'none' : 'block';
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '700px', margin: 'auto' }}>
      <h1>Adventure in Guatemala – Part 1</h1>
      <h3>Level: {level}</h3>
      {sentences.map((sentence, index) => (
        <div
          key={index}
          style={{ marginBottom: '2rem', borderBottom: '1px solid #ccc', paddingBottom: '1rem' }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button onClick={() => speak(sentence.en)} style={{ marginRight: '0.5rem' }}>
              🔊
            </button>
            <button onClick={toggleTranslation}>
              ✍️
            </button>
            <div style={{ marginLeft: '1rem' }}>{sentence.en}</div>
          </div>
          <div style={{ display: 'none', marginTop: '0.5rem', fontStyle: 'italic', color: '#555' }}>
            {sentence.es}
          </div>
        </div>
      ))}
    </div>
  );
}
