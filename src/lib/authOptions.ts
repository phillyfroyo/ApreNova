// src/lib/authOptions.ts
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { compare } from "bcryptjs";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import CredentialsProvider from "next-auth/providers/credentials";
import type { AuthOptions, SessionStrategy } from "next-auth";

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID!,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
    }),
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
      name: user.name,
      nativeLanguage: user.nativeLanguage,
      quizLevel: user.quizLevel,
      isPremium: user.isPremium,
    }
  : null;
      },
    }),
  ],

  callbacks: {
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

  pages: {
    signIn: "/es/auth/login",
  },

  secret: process.env.NEXTAUTH_SECRET,
};
