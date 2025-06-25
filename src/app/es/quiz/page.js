// src/app/es/quiz/page.js

export default function QuizWelcomeES() {
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundImage: "url('/background2.png')",
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem'
      }}
    >
      <main style={{ display: 'flex', gap: '3rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <div style={cardStyle}>
          <h2 style={headingStyle}>Haz el Quiz</h2>
          <p style={{ marginTop: '-0.5rem' }}>(recomendado)</p>
          <p style={{ margin: '1rem 0' }}>Déjanos determinar tu nivel</p>
          <a href="/es/quiz/brandnew/q1" style={buttonStyle}>Empezar Quiz</a>
        </div>

        <div style={cardStyle}>
          <h2 style={headingStyle}>No Gracias</h2>
          <p style={{ margin: '1rem 0' }}>Puedes elegir tu nivel después</p>
          <a href="/es/stories" style={buttonStyle}>Comenzar Aprendizaje</a>
        </div>
      </main>
    </div>
  );
}

const cardStyle = {
  backgroundColor: 'rgba(255,255,255,0.95)',
  padding: '2rem',
  borderRadius: '2rem',
  width: '300px',
  textAlign: 'center',
  boxShadow: '0 0 20px rgba(0,0,0,0.1)'
};

const headingStyle = {
  fontSize: '1.5rem',
  fontWeight: 'bold'
};

const buttonStyle = {
  display: 'inline-block',
  marginTop: '1rem',
  padding: '0.75rem 1.5rem',
  backgroundColor: '#0047AB',
  color: '#fff',
  borderRadius: '1rem',
  textDecoration: 'none',
  fontWeight: 'bold'
};
