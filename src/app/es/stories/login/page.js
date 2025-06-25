'use client';

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useSearchParams } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const handleLogin = async (e) => {
    e.preventDefault();
    await signIn("credentials", {
      email,
      password,
      callbackUrl: "/es/stories",
    });
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-4 border rounded shadow">
      <h1 className="text-2xl font-bold mb-4 text-center">Log in to ApreNova</h1>

      {/* Error Message */}
      {error === "CredentialsSignin" && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 text-sm">
          Incorrect email or password.
        </div>
      )}

      {/* Email/Password Login */}
      <form onSubmit={handleLogin} className="space-y-4">
        <input
          type="email"
          placeholder="Email"
          className="w-full p-2 border rounded"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full p-2 border rounded"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button
          type="submit"
          className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
        >
          Log in with Email
        </button>
      </form>

      {/* Divider */}
      <div className="my-6 text-center text-gray-500 text-sm">or</div>

      {/* Google Login Button */}
      <button
        onClick={() => signIn("google", { callbackUrl: "/es/stories" })}
        className="w-full bg-red-500 text-white p-2 rounded hover:bg-red-600"
      >
        Continue with Google
      </button>
    </div>
  );
}
