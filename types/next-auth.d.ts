import NextAuth from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name?: string
      image?: string
      nativeLanguage?: string
    }
  }

  interface User {
    nativeLanguage?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    nativeLanguage?: string
  }
}
