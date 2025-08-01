// src/lib/env-validation.ts

interface RequiredEnvVars {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  NEXTAUTH_SECRET: string;
  DATABASE_URL: string;
  OPENAI_API_KEY: string;
  AZURE_SPEECH_KEY: string;
  AZURE_SPEECH_REGION: string;
}

class EnvValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvValidationError';
  }
}

function validateEnvVar(name: keyof RequiredEnvVars, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new EnvValidationError(
      `Missing required environment variable: ${name}. Please check your .env file.`
    );
  }
  return value.trim();
}

function createEnvGetter() {
  const cache: Partial<RequiredEnvVars> = {};
  
  return function getEnv<K extends keyof RequiredEnvVars>(name: K): RequiredEnvVars[K] {
    if (cache[name]) {
      return cache[name] as RequiredEnvVars[K];
    }
    
    const value = validateEnvVar(name, process.env[name]);
    cache[name] = value as RequiredEnvVars[K];
    return value as RequiredEnvVars[K];
  };
}

export const getEnv = createEnvGetter();

export function validateAllRequiredEnvVars(): void {
  const required: (keyof RequiredEnvVars)[] = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET', 
    'NEXTAUTH_SECRET',
    'DATABASE_URL',
    'OPENAI_API_KEY',
    'AZURE_SPEECH_KEY',
    'AZURE_SPEECH_REGION'
  ];

  const missing: string[] = [];

  for (const envVar of required) {
    try {
      getEnv(envVar);
    } catch (error) {
      if (error instanceof EnvValidationError) {
        missing.push(envVar);
      }
    }
  }

  if (missing.length > 0) {
    throw new EnvValidationError(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }
}

export { EnvValidationError };