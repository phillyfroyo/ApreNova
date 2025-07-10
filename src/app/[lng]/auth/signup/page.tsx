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


export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [language, setLanguage] = useState('es')
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
      body: JSON.stringify({ email, password, nativeLanguage: language, name }),
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
          router.push(`/${language}/stories`)
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
          <H1 className="text-center text-2xl">Create an account</H1>

          <div className="flex flex-col gap-1">
            <p className="text-sm text-black/70">
              Mi idioma nativo es / My native language is:
            </p>

            <div className="relative w-full" ref={dropdownRef}>
              <button
                type="button"
                className="w-full px-4 py-2 border rounded-lg bg-white text-left"
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                {language === 'en' ? 'English' : 'Español'}
              </button>

              {dropdownOpen && (
                <div className="absolute left-0 mt-1 w-full bg-white border rounded-md shadow-md z-10">
                  {language !== 'en' && (
                    <div
                      onClick={() => router.push('/en/auth/signup')}
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                    >
                      English
                    </div>
                  )}
                  {language !== 'es' && (
                    <div
                      onClick={() => router.push(`/${typedLang}/auth/signup`)}
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                    >
                      Español
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="mb-4">
          <label htmlFor="name" className="block text-sm font-medium text-white mb-1">
          First Name
          </label>
          <input
          type="text"
          name="name"
          id="name"
          required
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 rounded-md text-black"
         />
         </div>

          <Input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && <p className="text-red-600 text-sm text-center">{error}</p>}
          {success && (
            <p className="text-green-600 text-sm text-center">
              Account created! Redirecting...
            </p>
          )}

          <Button type="submit" className="w-full" variant="button1">
            Registrarse
          </Button>

          <div className="flex items-center justify-center">
            <Small className="text-black/90 text-center">o</Small>
          </div>

          <button
            type="button"
            onClick={() => signIn('google', { callbackUrl: `/${language}/stories` })}
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
              Registrarse con Google
            </span>
          </button>
          <p className="mt-4 text-center text-[14px] font-['Open_Sans']">
  <span className="text-black">¿Ya tienes una cuenta? </span>
  <Link href={`/${typedLang}/auth/login`} className="text-[#1000c8] hover:underline">
    Inicia sesión
  </Link>
</p>
        </Card>
      </form>
    </div>
  )
}
