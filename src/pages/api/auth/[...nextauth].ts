import NextAuth from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma"; // ✅ import your PrismaClient
import { compare } from "bcryptjs";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import type { SessionStrategy } from "next-auth";

export const authOptions = {
  adapter: PrismaAdapter(prisma), // 👈 this saves users to your DB
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    CredentialsProvider({
        name: "Credentials",
        credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials: any) => {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.password) return null;

        const isValid = await compare(credentials.password, user.password);
        if (!isValid) return null;

        return {
          id: user.id.toString(),
          email: user.email,
        };
      },
    }),
  ],
  callbacks: {
  jwt: async ({ token, user }) => {
  if (user?.email) {
    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
    });

    if (dbUser?.nativeLanguage) {
      token.nativeLanguage = dbUser.nativeLanguage;
    }
    if (dbUser?.quizLevel) {
        token.quizLevel = dbUser.quizLevel;
  }
  }
  return token;
},

  session: async ({ session, token }) => {
  if (session.user && token.quizLevel) { // force git to see change
      session.user.quizLevel = token.quizLevel as string;

    // Only assign nativeLanguage if it exists
    if (token?.nativeLanguage) {
      session.user.nativeLanguage = token.nativeLanguage;
    }
  }

  return session;
}
},
  pages: {
    signIn: "/es/auth/login",
  },
  session: {
  strategy: "jwt" as SessionStrategy,
},
  secret: process.env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions);
