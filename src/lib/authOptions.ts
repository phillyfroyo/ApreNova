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
    allowDangerousEmailAccountLinking: true,
  }),
];

// Only add Facebook provider if credentials are available
if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
  providers.push(
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
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
        if (!user?.password || user.deletedAt) return null;

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
    jwt: async ({ token, user, trigger }) => {
  // On initial sign-in, populate token from DB
  if (user) {
    const dbUser = user.id
  ? await prisma.user.findUnique({ where: { id: user.id } })
  : user.email
    ? await prisma.user.findUnique({ where: { email: user.email } })
    : null;

    if (dbUser && !dbUser.deletedAt) {
      token.id = dbUser.id;
      if (dbUser.image) token.image = dbUser.image;
      if (dbUser.nativeLanguage) token.nativeLanguage = dbUser.nativeLanguage;
      if (dbUser.quizLevel) token.quizLevel = dbUser.quizLevel;
      if (dbUser.name) token.name = dbUser.name;
      if (dbUser.isPremium !== undefined) token.isPremium = dbUser.isPremium;
    }
  }

  // On session update (e.g. after level change), refresh mutable fields from DB
  if (trigger === "update" && token.id) {
    const dbUser = await prisma.user.findUnique({
      where: { id: token.id as string },
      select: { quizLevel: true, isPremium: true, nativeLanguage: true, name: true },
    });
    if (dbUser) {
      token.quizLevel = dbUser.quizLevel ?? undefined;
      token.isPremium = dbUser.isPremium ?? false;
      token.nativeLanguage = dbUser.nativeLanguage ?? undefined;
      if (dbUser.name) token.name = dbUser.name;
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
    session.user.image = dbUser.image ?? undefined;
    session.user.nativeLanguage = dbUser.nativeLanguage ?? undefined;
    session.user.quizLevel = dbUser.quizLevel ?? undefined;
    session.user.isPremium = dbUser.isPremium ?? false;
  }

  return session;
}
  },

  events: {
    // Grant premium to first 100 users (Google OAuth signups)
    createUser: async ({ user }) => {
      const userCount = await prisma.user.count();
      if (userCount <= 100) {
        await prisma.user.update({
          where: { id: user.id },
          data: { isPremium: true },
        });
      }
    },
  },

  session: {
    strategy: "jwt" as SessionStrategy,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  pages: {
    signIn: "/es/auth/login",
  },

  secret: getEnv('NEXTAUTH_SECRET'),
};
