'use client'

import { useState, useEffect, useRef, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [language, setLanguage] = useState('en') // default to English
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const leaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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


  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.message || 'Something went wrong')
    } else {
      setSuccess(true)

      const result = await signIn('credentials', {
        redirect: false,
        email,
        password,
      })

      if (result?.ok) {
        // Give the session cookie a moment to set
        setTimeout(() => {
          router.push(`/${language}/stories`)
        }, 300)
      } else {
        setError('Login after signup failed.')
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form
  onSubmit={handleSubmit}
  className="w-full max-w-md bg-white p-8 rounded-xl shadow-lg space-y-6"
>
        <h1 className="text-2xl font-bold text-center">Create an Account</h1>

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
            onClick={() => router.push('/en/auth/signup')}
            className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
          >
            English
          </div>
        )}
        {language !== 'es' && (
          <div
            onClick={() => router.push('/es/auth/signup')}
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
  className="w-full px-4 py-2 border rounded-lg mb-4"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  required
/>

<input
  type="password"
  placeholder="Password"
  className="w-full px-4 py-2 border rounded-lg mb-4"
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

<button
  type="submit"
  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition-transform duration-200 hover:scale-[1.01]"
>
  Sign Up
</button>

<div className="flex items-center justify-center my-4">
  <span className="text-sm text-gray-500">or</span>
</div>

<button
  type="button"
  onClick={() => signIn('google', { callbackUrl: `/${language}/stories` })}
  className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-lg py-2 bg-white hover:bg-gray-100 transition group"
>
  <img
    src="https://www.svgrepo.com/show/475656/google-color.svg"
    alt="Google"
    className="w-5 h-5 transform transition-transform duration-300 group-hover:translate-x-1"
  />
  <span className="text-sm text-gray-700 font-medium">
    Sign up with Google
  </span>
</button>
      </form>
    </div>
  )
}
