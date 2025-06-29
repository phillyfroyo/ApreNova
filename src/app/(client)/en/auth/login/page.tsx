'use client'

import { useState, useRef, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo';

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [language, setLanguage] = useState('en') // ✅ for English login page
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [error, setError] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const result = await signIn('credentials', {
      redirect: false,
      email,
      password,
    })

    if (result?.ok) {
      router.push(`/${language}/stories`)
    } else {
      setError('Incorrect credentials. Please try again.')
    }
  }

  return (
  <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[url('/images/background3.png')] bg-cover bg-center text-black">
    <div className="mb-6 text-center">
      <Logo variant="auth" />
    </div>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-white p-8 rounded-xl shadow-lg space-y-6"
      >
        <h1 className="text-2xl font-bold text-center">Log In</h1>

        <div className="flex flex-col gap-1">
          <p className="text-sm italic text-gray-600">
            My native language is / Mi idioma nativo es:
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
                    onClick={() => router.push('/en/auth/login')}
                    className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                  >
                    English
                  </div>
                )}
                {language !== 'es' && (
                  <div
                    onClick={() => router.push('/es/auth/login')}
                    className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                  >
                    Español
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <input
          type="email"
          placeholder="Email"
          className="w-full px-4 py-2 border rounded-lg"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full px-4 py-2 border rounded-lg"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && (
          <p className="text-sm text-center text-red-600">{error}</p>
        )}

        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition-transform duration-200 hover:scale-[1.01]"
        >
          Log In
        </button>

        <div className="flex items-center justify-center my-4">
          <span className="text-sm text-gray-500">or</span>
        </div>

        <button
          type="button"
          onClick={() =>
            signIn('google', { callbackUrl: `/${language}/stories` })
          }
          className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-lg py-2 bg-white hover:bg-gray-100 transition group"
        >
          <img
            src="https://www.svgrepo.com/show/475656/google-color.svg"
            alt="Google"
            className="w-5 h-5 transform transition-transform duration-300 group-hover:translate-x-1"
          />
          <span className="text-sm text-gray-700 font-medium">
            Sign in with Google
          </span>
        </button>
      </form>
    </div>
  )
}
