// src/app/en/quiz/page.js
<a href="/en/quiz/start/">Start Quiz</a>

export default function QuizWelcomeEN() {
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
          <h2 style={headingStyle}>Take the Quiz</h2>
          <p style={{ marginTop: '-0.5rem' }}>(recommended)</p>
          <p style={{ margin: '1rem 0' }}>Let us determine where you start</p>
          <Link href="/en/quiz/start/">Start Quiz</Link>
        </div>

        <div style={cardStyle}>
          <h2 style={headingStyle}>No Thanks</h2>
          <p style={{ margin: '1rem 0' }}>You can choose your level later</p>
          <Link href="/en/stories/">Start Learning</Link>
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
