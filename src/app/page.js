import { getServerSession } from "next-auth";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/es/stories");
  }

  return (
    <section className="min-h-screen flex flex-col items-center justify-center bg-[url('/images/background.png')] bg-cover bg-center text-black px-6">
      {/* Logo and subtitle */}
      <div className="text-center mb-12">
        <h1 className="text-[64px] font-bold font-[Alice] leading-none">
          <span className="text-[#5ce1e6]">Apre</span>
          <span className="text-[#5100a2]">Nova</span>
        </h1>
        <p className="mt-4 text-[18px] font-[Alice]">
          Aprende más rápido. Aprende con historias.
        </p>
      </div>

      {/* Language choice buttons */}
      <div className="flex flex-col md:flex-row items-center gap-10">
        <div className="bg-[#fff5eb] p-8 rounded-3xl shadow-md max-w-xs text-center relative">
          <p className="text-[24px] font-bold mb-4">
            Mi lengua materna es el español
          </p>
          <Link href="/es/home">
            <button className="bg-[#1000c8] text-white px-6 py-2 rounded-full hover:opacity-90 transition">
              Continuar
            </button>
          </Link>
        </div>
        <div className="bg-[#fff5eb] p-8 rounded-3xl shadow-md max-w-xs text-center relative">
          <p className="text-[24px] font-bold mb-4">
            My native language is English
          </p>
          <Link href="/en">
            <button className="bg-[#1000c8] text-white px-6 py-2 rounded-full hover:opacity-90 transition">
              Continue
            </button>
          </Link>
        </div>
      </div>

      <p className="mt-4 text-[14px] font-['Open_Sans']">
        <span className="text-black">¿Ya tienes una cuenta? </span>
        <a href="/es/auth/login" className="text-[#1000c8] hover:underline">
          Inicia sesión
        </a>
      </p>

      <p className="mt-2 text-[14px] font-['Open_Sans']">
        <span className="text-black">New to ApreNova? </span>
        <a href="/es/auth/signup" className="text-[#1000c8] hover:underline">
          Create a free account
        </a>
      </p>
    </section>
  );
}
