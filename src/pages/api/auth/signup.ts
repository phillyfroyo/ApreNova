import { NextApiRequest, NextApiResponse } from "next";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";

interface SignupRequestBody {
  email: string;
  password: string;
  nativeLanguage?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, password, nativeLanguage } = req.body as SignupRequestBody;

  if (!email || !password) {
    return res.status(400).json({ error: "Missing email or password" });
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: "User already exists" });
    }

    const hashed = await hash(password, 10);
    await prisma.user.create({
  data: {
    email,
    password: hashed,
    nativeLanguage: nativeLanguage ?? null,
  },
});

    return res.status(201).json({ success: true });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
