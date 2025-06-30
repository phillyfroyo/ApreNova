import NextAuth from "next-auth";
import { prisma } from "@/lib/prisma";
import { compare } from "bcryptjs";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import type { SessionStrategy } from "next-auth";

export const authOptions = {
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
    async session({ session, token }: any) {
      session.user.id = token.sub;
      return session;
    },
    async jwt({ token, user }: any) {
      if (user) token.sub = user.id;
      return token;
    },
  },
  pages: {
    signIn: "/es/auth/login",
    newUser: "/es/auth/signup",
  },
  session: {
  strategy: "jwt" as SessionStrategy,
},
  secret: process.env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions);
