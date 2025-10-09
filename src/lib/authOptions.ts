// src/lib/authOptions.ts
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { compare } from "bcryptjs";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import CredentialsProvider from "next-auth/providers/credentials";
import type { AuthOptions, SessionStrategy } from "next-auth";
import { getEnv } from "@/lib/env-validation";

const providers: any[] = [
  GoogleProvider({
    clientId: getEnv('GOOGLE_CLIENT_ID'),
    clientSecret: getEnv('GOOGLE_CLIENT_SECRET'),
  }),
];

// Only add Facebook provider if credentials are available
if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
  providers.push(
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    })
  );
}

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    ...providers,
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });
        if (!user?.password) return null;

        const isValid = await compare(credentials.password, user.password);
        return isValid
  ? {
      id: user.id.toString(),
      email: user.email,
      name: user.name ?? undefined,
      nativeLanguage: user.nativeLanguage ?? undefined,
      quizLevel: user.quizLevel ?? undefined, // ✅ this is the fix
      isPremium: user.isPremium ?? false,
    }
  : null;
      },
    }),
  ],

  callbacks: {
    signIn: async ({ user, account }) => {
      console.log('🔐 signIn callback triggered', { provider: account?.provider, email: user.email });

      // Allow credential-based sign-ins
      if (account?.provider === "credentials") return true;

      // For OAuth providers (Google, Facebook), check if user exists with this email
      if (account && user.email) {
        try {
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email },
            include: { accounts: true },
          });

          console.log('👤 Existing user check:', {
            found: !!existingUser,
            email: user.email,
            hasPassword: !!existingUser?.password,
            existingAccounts: existingUser?.accounts.map(a => a.provider)
          });

          // SECURITY: Block OAuth sign-in if email exists with password (credentials account)
          // User must explicitly link accounts through authenticated flow
          if (existingUser?.password) {
            const accountExists = existingUser.accounts.find(
              (acc) => acc.provider === account.provider
            );

            // If this OAuth provider isn't already linked, block sign-in
            if (!accountExists) {
              console.log('⛔ OAuth sign-in blocked: Email exists with password. User must link accounts explicitly.');
              // Return false to trigger OAuthAccountNotLinked error
              // This will redirect to the error page where user can be informed
              return false;
            }

            console.log('✅ OAuth account already linked, allowing sign-in');
          }

          // Allow sign-in if:
          // 1. No existing user (new OAuth registration)
          // 2. Existing user without password (was created via OAuth)
          // 3. Existing user with this OAuth account already linked
          return true;
        } catch (error) {
          console.error('❌ Error in signIn callback:', error);
          return false;
        }
      }

      return true;
    },

    jwt: async ({ token, user }) => {
  if (user) {
    const dbUser = user.id
  ? await prisma.user.findUnique({ where: { id: user.id } })
  : user.email
    ? await prisma.user.findUnique({ where: { email: user.email } })
    : null;

    if (dbUser) {
      token.id = dbUser.id;
      if (dbUser.nativeLanguage) token.nativeLanguage = dbUser.nativeLanguage;
      if (dbUser.quizLevel) token.quizLevel = dbUser.quizLevel;
      if (dbUser.name) token.name = dbUser.name;
      if (dbUser.isPremium !== undefined) token.isPremium = dbUser.isPremium;
    }
  }
  return token;
},

    session: async ({ session, token }) => {
  if (!token?.id) return session;

  const dbUser = await prisma.user.findUnique({
    where: { id: token.id },
  });

  if (session.user && dbUser) {
    session.user.id = dbUser.id;
    session.user.name = dbUser.name ?? undefined;
    session.user.email = dbUser.email ?? undefined;
    session.user.nativeLanguage = dbUser.nativeLanguage ?? undefined;
    session.user.quizLevel = dbUser.quizLevel ?? undefined;
    session.user.isPremium = dbUser.isPremium ?? false;
  }

  return session;
}
  },

  session: {
    strategy: "jwt" as SessionStrategy,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production'
        ? '__Secure-next-auth.session-token'
        : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        domain: process.env.NODE_ENV === 'production'
          ? '.vercel.app'
          : undefined,
      },
    },
  },

  pages: {
    signIn: "/es/auth/login",
  },

  secret: getEnv('NEXTAUTH_SECRET'),
};
