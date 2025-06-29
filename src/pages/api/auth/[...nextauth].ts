import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/prisma";
import { compare } from "bcrypt";
import type { CredentialsConfig } from "next-auth/providers/credentials";

// Inject secure authorize logic into the Credentials provider
authOptions.providers.forEach((provider) => {
  if (provider.name === "Credentials") {
    (provider as CredentialsConfig).authorize = async (credentials: any) => {
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
    };
  }
});

export default NextAuth(authOptions);
