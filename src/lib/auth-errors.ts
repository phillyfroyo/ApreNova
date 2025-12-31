// src/lib/auth-errors.ts
// Centralized auth error codes for granular error handling

export const AUTH_ERROR_CODES = {
  // Login errors
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  INVALID_PASSWORD: 'INVALID_PASSWORD',
  INVALID_PASSWORD_HAS_OAUTH: 'INVALID_PASSWORD_HAS_OAUTH',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  OAUTH_ONLY_ACCOUNT: 'OAUTH_ONLY_ACCOUNT',

  // Signup errors
  EMAIL_EXISTS: 'EMAIL_EXISTS',
  INVALID_EMAIL: 'INVALID_EMAIL',
  MISSING_REQUIRED_FIELDS: 'MISSING_REQUIRED_FIELDS',

  // Rate limiting
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',

  // General
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
} as const;

export type AuthErrorCode = typeof AUTH_ERROR_CODES[keyof typeof AUTH_ERROR_CODES];

// Error messages by language
export const AUTH_ERROR_MESSAGES: Record<string, Record<AuthErrorCode, string>> = {
  en: {
    INVALID_CREDENTIALS: 'Invalid email or password. Please try again.',
    INVALID_PASSWORD: 'Invalid password. Please try again.',
    INVALID_PASSWORD_HAS_OAUTH: 'Invalid password. You can also sign in with Google.',
    USER_NOT_FOUND: 'No account found with this email.',
    ACCOUNT_LOCKED: 'Account temporarily locked. Please try again later.',
    OAUTH_ONLY_ACCOUNT: 'This account uses Google sign-in. Please use Google to log in.',
    EMAIL_EXISTS: 'This email is already registered. Try logging in instead.',
    INVALID_EMAIL: 'Please enter a valid email address.',
    MISSING_REQUIRED_FIELDS: 'Please fill in all required fields.',
    TOO_MANY_REQUESTS: 'Too many attempts. Please wait a moment and try again.',
    INTERNAL_ERROR: 'Something went wrong. Please try again.',
    NETWORK_ERROR: 'Connection error. Please check your internet and try again.',
  },
  es: {
    INVALID_CREDENTIALS: 'Correo o contraseña incorrectos. Inténtalo de nuevo.',
    INVALID_PASSWORD: 'Contraseña incorrecta. Inténtalo de nuevo.',
    INVALID_PASSWORD_HAS_OAUTH: 'Contraseña incorrecta. También puedes iniciar sesión con Google.',
    USER_NOT_FOUND: 'No se encontró una cuenta con este correo.',
    ACCOUNT_LOCKED: 'Cuenta bloqueada temporalmente. Inténtalo más tarde.',
    OAUTH_ONLY_ACCOUNT: 'Esta cuenta usa Google. Por favor inicia sesión con Google.',
    EMAIL_EXISTS: 'Este correo ya está registrado. Intenta iniciar sesión.',
    INVALID_EMAIL: 'Por favor ingresa un correo electrónico válido.',
    MISSING_REQUIRED_FIELDS: 'Por favor completa todos los campos requeridos.',
    TOO_MANY_REQUESTS: 'Demasiados intentos. Espera un momento e inténtalo de nuevo.',
    INTERNAL_ERROR: 'Algo salió mal. Inténtalo de nuevo.',
    NETWORK_ERROR: 'Error de conexión. Verifica tu internet e inténtalo de nuevo.',
  },
};

export function getAuthErrorMessage(code: AuthErrorCode, lang: string = 'en'): string {
  const messages = AUTH_ERROR_MESSAGES[lang] || AUTH_ERROR_MESSAGES.en;
  return messages[code] || messages.INTERNAL_ERROR;
}

// Email validation
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
