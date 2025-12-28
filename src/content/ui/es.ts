// /src/content/ui/es.ts
const es = {
  auth: {
  login: "Iniciar sesión",
  signup: "Crear cuenta",
  logout: "Cerrar sesión",
  email: "Correo electrónico",
  password: "Contraseña",
  confirmPassword: "Confirmar contraseña",
  name: "Nombre",
  welcomeBack: "¡Bienvenido de nuevo!",
  error: "Credenciales incorrectas. Inténtalo de nuevo.",
  or: "o",
  googleLogin: "Inicia sesión con Google",
  languagePrompt: "Idioma nativo / Native language:",
  createAccountCard: "Crear una cuenta",
  signupError: "Algo salió mal. Inténtalo de nuevo.",
  signupSuccess: "¡Cuenta creada! Redirigiendo...",
  signupGoogle: "Registrarse con Google",
  alreadyHaveAccount: "¿Ya tienes una cuenta?",
  newHere: "¿Eres nuevo?",
  loggingIn: "Iniciando sesión...",
  creatingAccount: "Creando cuenta...",
},

language: {
  en: "English",
  es: "Español"
},

  stories: {
  goPremium: "Hazte Premium 💎",
  premiumDescription: "Cuentana Premium desbloquea herramientas más inteligentes para aprender más rápido.",
  dashboard: "Panel",
  settings: "Configuración",
  stories: "Historias",
  loading: "Cargando...",
  continue: "Continuar",
  back: "Atrás",
  readStory: "Léeme",
  availableLevels: "Disponible en niveles:",
  level: "Nivel",
  storiesAll: "Historias",
  aiTutor: "Tutor IA",
  takeQuiz: "Haz el Quiz",
  myAccount: "Mi Cuenta",
  createAccount: "Crea una Cuenta",
},

story: {
  page: "Página",
  chapter: "Capítulo",
  navigate: "Navegar ▾",
  home: "Inicio",
  levelSelect: "Seleccionar Nivel",
  prev: "Anterior",
  next: "Siguiente",
  markComplete: "Marcar esta historia como completada",
  markedComplete: "✅ ¡Historia marcada como completada!",
  levelUnavailable: "Esta historia no está disponible en tu nivel actual.",
  availableLevelsAre: "Niveles disponibles:",
  selectLevel: "Selecciona un nivel para continuar leyendo:",
},

levels: {
  l1: "Recién empezado",
  l2: "Principiante",
  l3: "Intermedio",
  l4: "Avanzado",
  l5: "Fluido",
  cefrLabels: {
    l1: "A1",
    l2: "A2",
    l3: "B1",
    l4: "B2",
    l5: "C1",
  },
  cefrDescriptions: {
    l1: "Puede comprender y usar expresiones básicas para necesidades concretas. Puede presentarse y hacer preguntas personales sencillas.",
    l2: "Puede comprender expresiones frecuentes sobre temas familiares como compras, familia y trabajo. Puede manejar intercambios simples y rutinarios.",
    l3: "Puede manejar la mayoría de situaciones al viajar. Puede describir experiencias, eventos y explicar brevemente opiniones y planes.",
    l4: "Puede comprender textos complejos e interactuar con fluidez con hablantes nativos. Puede producir textos claros y detallados sobre una amplia gama de temas.",
    l5: "Puede comprender textos exigentes y reconocer significados implícitos. Puede expresar ideas con fluidez, precisión y flexibilidad.",
  },
},

  home: {
  subtitle: "Aprende más rápido. Aprende con historias.",
  quizTitle: "Haz el Quiz",
  recommended: "(recomendado)",
  letUsPick: "Responde unas preguntas y personalizaremos tu experiencia.",
  startQuiz: "Empezar Quiz",
  noThanksTitle: "No Gracias",
  pickLater: "Puedes personalizar tu nivel más tarde en la aplicación.",
  startLearning: "Comenzar Aprendizaje",
  haveAccount: "¿Ya tienes una cuenta?",
  whyTitle: "¿Por qué",
  placeholderInfo: "Put your additional information here 🚀",
  aboutLink: "Conoce Cuentana",
  aboutPrefix: "Conoce"
},

onboarding: {
  stepLanguage: "Idioma",
  stepLevel: "Nivel",
  stepStart: "Empezar",
  welcomeTitle: "Bienvenido a Cuentana",
  welcomeSubtitle: "Personalicemos tu experiencia de aprendizaje",
  findYourLevel: "Encuentra tu Nivel",
  findYourLevelDesc: "Responde unas preguntas para encontrar tu punto de partida.",
  quizDuration: "4 preguntas",
  knowYourLevel: "¿Ya sabes tu nivel?",
  selectBelow: "Selecciona tu nivel abajo",
  continueToStories: "Ir a las Historias",
  quizProgress: "Pregunta {current} de {total}",
  yourResult: "Tu Nivel",
  startReading: "Empezar a Leer",
  selectLevel: "Seleccionar",
  allSetTitle: "Todo Listo",
  levelSetTo: "Tu nivel está configurado en",
  createAccountTitle: "Crea una Cuenta Gratis",
  createAccountBenefit1: "Guarda tu progreso en todos tus dispositivos",
  createAccountBenefit2: "Sube tus propias historias",
  createAccountBenefit3: "Crea tu lista de vocabulario personal",
  createAccountCta: "Crear Cuenta",
  skipForNow: "Omitir por ahora",
},

settings: {
  notLoggedIn: "No has iniciado sesión.",
  greeting: "¡Hola {name}! 🎉",
  premium: "Premium 💎",
  free: "Gratis",
  memberStatus: "Estado de miembro",
  nativeLanguage: "Mi idioma nativo:",
  takeQuiz: "▶️ Haz el Quiz",
  logOut: "🚪 Cerrar sesión",
  loadingLevel: "Cargando nivel...",
  backToStories: "Volver a historias",
  currentLevel: "Nivel actual",
  levelUndefined: "Nivel actual: indefinido. Haz el quiz",
  changeLevel: "Haz el quiz para cambiar tu nivel",
},

stats: {
  loading: "Cargando tus estadísticas...",
  lessThanOneMinute: "< 1 min",
  minutes: "min",
  title: "Tus estadísticas",
  memberSince: "Miembro desde",
  timeOnApp: "Tiempo en la app",
  timeReading: "Tiempo leyendo",
  storiesCompleted: "Historias completadas"
},

feedback: {
    title1: "Comentarios",
    title2: "Nos encantaría conocer tus comentarios.",
    subtitle: "Ayúdanos a mejorar Cuentana para todos",
    typeLabel: "¿Qué tipo de comentario es?",
    typePlaceholder: "Selecciona un tipo...",
    messageLabel: "Tu mensaje",
    placeholder: "¿En qué estás pensando?",
    optionalEmail: "Correo (para seguimiento)",
    cancel: "Cancelar",
    send: "Enviar Comentario",
    bug: "🐛 Error",
    suggestion: "💡 Sugerencia",
    other: "✏️ Otro",
    optionalFields: "Campos opcionales",
    experienceQuestion: "¿Cómo ha sido tu experiencia hasta ahora?",
    frustrated: "Frustrado/a",
    neutral: "Neutral",
    happy: "Feliz",
    thanks: "¡Gracias por tus comentarios!",
    successMessage: "El formulario se envió con éxito.",
    close: "Cerrar",
  },

premium: {
  title: "Hazte Premium 💎",
  description: "Cuentana Premium desbloquea herramientas más inteligentes para aprender más rápido:",
  benefit1: {
    title: "Traducciones GPT Instantáneas",
    desc: "Traduce cualquier palabra o frase con contexto completo."
  },
  benefit2: {
    title: "Historias Exclusivas",
    desc: "Acceso anticipado a nuevas historias y niveles avanzados."
  },
  benefit3: {
    title: "Modo de Traducción de Oraciones",
    desc: "Traduce oraciones completas con un solo clic y ejemplos de uso."
  },
  currentPlan: "Plan Actual",
  planPremium: "Premium 💎",
  planFree: "Gratis",
  returnToStories: "Volver a las Historias",
  subscribeButton: "Suscribirme a Premium"
},

translator: {
  translation: "Traducción",
  otherCommonUses: "también puede significar",
  translating: "Traduciendo"
},

storyTutor: {
  title: "Tutor de Historia",
  loadingConversation: "Cargando conversación...",
  askAnything: "¡Pregúntame lo que quieras sobre esta historia!",
  helpWith: "Puedo ayudarte con vocabulario, gramática o comprensión de la historia.",
  placeholder: "Haz una pregunta...",
  send: "Enviar",
  autoMessageWord: "¿Qué significa \"{word}\"?",
  autoMessageVerb: "¿Qué significa \"{word}\"? Si es un verbo, ¿puedes mostrarme la conjugación?",
  autoMessageSentence: "¿Puedes ayudarme a entender esta oración?",
  errorMessage: "Lo siento, encontré un error. Por favor intenta de nuevo.",
  youSelected: "Seleccionaste \"{text}\""
},

aiTutor: {
  loading: "Cargando...",
  startConversation: "Inicia una conversación con tu tutor IA",
  practiceSkills: "Practica tus habilidades lingüísticas conversando",
  placeholder: "Escribe tu mensaje...",
  send: "Enviar",
  errorMessage: "Lo siento, encontré un error. Por favor intenta de nuevo."
},

storiesMetadata: {
  "aventura": {
    title: "Aventura",
    description: "Una emocionante historia de descubrimiento y amistad.",
  },
  "the-last-word": {
    title: "La Última Palabra",
    description: "Una conmovedora historia sobre momentos finales e impresiones duraderas.",
  },
  "diego-unplugged": {
    title: "Diego Desconectado",
    description: "Diego descubre lo que sucede cuando la tecnología toma un descanso.",
  },
  "my-day": {
    title: "Mi Día",
    description: "Un poema simple sobre las alegrías de la vida cotidiana.",
  },},};

export default es;


