// src/app/[lng]/auth/signup/page.tsx
'use client'

import { useState, useEffect, useRef, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import Logo from '@/components/Logo'
import { Card, Input, Button, H1, Small } from '@/components/ui'
import Link from "next/link";
import { useParams } from 'next/navigation';
import type { Language } from '@/types/i18n';
import Image from "next/image";
import { t } from '@/lib/t';


export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { lng } = useParams();
  const typedLang = lng as Language;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, nativeLanguage: typedLang, name }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || data.message || 'Something went wrong')
    } else {
      setSuccess(true)

      const result = await signIn('credentials', {
        redirect: false,
        email,
        password,
      })

      if (result?.ok) {
        setTimeout(() => {
          router.push(`/${typedLang}/stories`)
        }, 300)
      } else {
        setError('Login after signup failed.')
      }
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[url('/images/background3.png')] bg-cover bg-center text-black">
      <div className="mb-6 text-center">
        <Logo variant="auth" />
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-md">
        <Card className="glass-card space-y-6">
          <H1 className="text-center text-[23px]">{t(typedLang, "auth", "createAccountCard")}</H1>

          <div className="flex flex-col gap-1">
            <p className="text-sm text-black/70">
              {t(typedLang, "auth", "languagePrompt")}
            </p>

            <div className="relative w-full" ref={dropdownRef}>
              <button
                type="button"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-left"
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                {t(typedLang, "language", typedLang)}
              </button>

              {dropdownOpen && (
                <div className="absolute left-0 mt-1 w-full bg-white border rounded-lg shadow-md z-10">
                  {typedLang !== 'en' && (
  <div
    onClick={() => router.push('/en/auth/signup')}
    className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
  >
    {t(typedLang, "language", "en")}
  </div>
)}
{typedLang !== 'es' && (
  <div
    onClick={() => router.push('/es/auth/signup')}
    className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
  >
    {t(typedLang, "language", "es")}
  </div>
)}
                </div>
              )}
            </div>
          </div>
          <input
          type="text"
          name="name"
          id="name"
          required
          placeholder={t(typedLang, "auth", "name")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 text-black placeholder-gray-400"
         />

          <Input
            type="email"
            placeholder={t(typedLang, "auth", "email")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            type="password"
            placeholder={t(typedLang, "auth", "password")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && (
  <p className="text-red-600 text-sm text-center">
    {t(typedLang, "auth", "signupError")}
  </p>
)}

{success && (
  <p className="text-green-600 text-sm text-center">
    {t(typedLang, "auth", "signupSuccess")}
  </p>
)}

          <Button type="submit" className="w-full" variant="button1">
           {t(typedLang, "auth", "signup")}
          </Button>

          <div className="flex items-center justify-center">
            <Small className="!text-black text-center">{t(typedLang, "auth", "or")}</Small>
          </div>

          <button
            type="button"
            onClick={() =>
            signIn('google', {
            callbackUrl: `${window.location.origin}/api/post-login?lang=${typedLang}`,
            })
          }
            className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-lg py-2 bg-white hover:bg-gray-100 transition group"
          >
            <Image
  src="https://www.svgrepo.com/show/475656/google-color.svg"
  alt="Google"
  width={20}
  height={20}
  className="w-5 h-5 transform transition-transform duration-300 group-hover:translate-x-1"
/>
            <span className="text-sm text-gray-700 font-medium">
            {t(typedLang, "auth", "signupGoogle")}
            </span>

          </button>
          <p className="mt-4 text-center text-[14px] font-['Open_Sans']">
  <span className="text-black">{t(typedLang, "auth", "alreadyHaveAccount")} </span>
  <Link href={`/${typedLang}/auth/login`} className="text-[#1000c8] hover:underline">
    {t(typedLang, "auth", "login")}
  </Link>
</p>
        </Card>
      </form>
    </div>
  )
}
