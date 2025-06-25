// /src/pages/api/auth/[...nextauth].js
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";

export default NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // Mock user for testing
        const user = { id: "1", name: "Test User", email: "test@example.com" };
        if (
          credentials.email === "test@example.com" &&
          credentials.password === "password123"
        ) {
          return user;
        }
        return null;
      },
    }),
  ],
  pages: {
    signIn: "/es/stories/login",
  },
  callbacks: {
    async redirect({ url, baseUrl }) {
      // Redirect to /es/stories after login
      return "/es/stories";
    },
  },
});
