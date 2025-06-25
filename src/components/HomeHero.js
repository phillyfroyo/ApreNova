export default function HomeHero({ language }) {
  return (
    <div>
      <p>
        {language === 'es'
          ? 'Aprende más inteligente, no más difícil. Aprende con historias.'
          : 'Learn smarter, not harder. Learn with stories.'}
      </p>
      <button
        onClick={() => {
          window.location.href = '/login';
        }}
        style={{
          backgroundColor: '#0074D9',
          color: 'white',
          fontSize: '1rem',
          padding: '1rem 2rem',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
        }}
      >
        {language === 'es' ? 'Empieza ahora' : 'Start Now'}
      </button>
    </div>
  );
}
