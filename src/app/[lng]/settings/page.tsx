// src/app/[lng]/settings/page.tsx
'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  User,
  Mail,
  Globe,
  Crown,
  GraduationCap,
  Gem,
  LogOut,
  ChevronRight,
  Loader2,
  Check,
  X,
  Pencil,
  CreditCard,
  Trash2,
  AlertTriangle,
} from 'lucide-react'
import type { Language } from '@/types/i18n'
import { t } from '@/lib/t'
import { AppLayout } from '@/components/layout'
import Logo from '@/components/Logo'
import UserStatsCard from '@/components/UserStatsCard'

export default function SettingsPage() {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const { lng } = useParams()
  const typedLang = (lng as Language) || 'es'

  // Edit states
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  // Subscription management
  const [loadingPortal, setLoadingPortal] = useState(false)

  // Delete account modal
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Billing error state
  const [billingError, setBillingError] = useState<string | null>(null)

  if (status === 'loading') {
    return (
      <AppLayout lang={typedLang}>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      </AppLayout>
    )
  }

  if (!session?.user?.email) {
    return (
      <AppLayout lang={typedLang}>
        <div
          className="fixed inset-0 bg-cover bg-center -z-10"
          style={{ backgroundImage: 'url(/images/background3.png)' }}
        />
        <div className="min-h-screen flex flex-col items-center justify-center px-6">
          <div className="glass-card text-center max-w-sm">
            <Logo variant="storiesmain" />
            <p className="mt-6 text-lg font-medium text-gray-900">
              {t(typedLang, 'settings', 'notLoggedIn')}
            </p>
            <p className="mt-2 text-sm text-gray-600">
              {t(typedLang, 'auth', 'alreadyHaveAccount')}
            </p>
            <Link
              href={`/${typedLang}/auth/login`}
              className="mt-4 inline-block w-full py-2.5 px-4 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
            >
              {t(typedLang, 'auth', 'login')}
            </Link>
            <Link
              href={`/${typedLang}/auth/signup`}
              className="mt-2 inline-block w-full py-2.5 px-4 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              {t(typedLang, 'auth', 'createAccountCard')}
            </Link>
          </div>
        </div>
      </AppLayout>
    )
  }

  const updateUserField = async (field: string, value: string) => {
    setSaving(true)
    try {
      await fetch('/api/user/update-field', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, value }),
        credentials: 'include',
      })
      await update()

      if (field === 'nativeLanguage') {
        document.cookie = `preferredLang=${value}; path=/; max-age=31536000`
        router.replace(`/${value}/settings`)
      } else {
        router.refresh()
      }
    } catch (err) {
      console.error('Failed to update user field:', err)
    } finally {
      setSaving(false)
      setEditingField(null)
    }
  }

  const startEditing = (field: string, currentValue: string) => {
    setEditingField(field)
    setEditValue(currentValue)
  }

  const cancelEditing = () => {
    setEditingField(null)
    setEditValue('')
  }

  const openBillingPortal = async () => {
    setLoadingPortal(true)
    setBillingError(null)
    try {
      const res = await fetch('/api/stripe/billing-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lng: typedLang }),
        credentials: 'include',
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        // Show user-friendly error for missing subscription
        if (data.error === 'No subscription found') {
          setBillingError(typedLang === 'es'
            ? 'No se encontró una suscripción activa de Stripe.'
            : 'No active Stripe subscription found.')
        } else {
          setBillingError(data.error)
        }
      }
    } catch (err) {
      console.error('Failed to open billing portal:', err)
      setBillingError(typedLang === 'es' ? 'Error al conectar' : 'Connection error')
    } finally {
      setLoadingPortal(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return
    setDeleting(true)
    try {
      const res = await fetch('/api/user/delete-account', {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.ok) {
        await signOut({ callbackUrl: `/${typedLang}/auth/login`, redirect: true })
      } else {
        const data = await res.json()
        console.error('Failed to delete account:', data.error)
      }
    } catch (err) {
      console.error('Failed to delete account:', err)
    } finally {
      setDeleting(false)
    }
  }

  const content = {
    en: {
      settings: 'Settings',
      profile: 'Profile',
      name: 'Name',
      email: 'Email',
      preferences: 'Preferences',
      nativeLanguage: 'Native Language',
      learning: 'Learning',
      currentLevel: 'Current Level',
      retakeQuiz: 'Retake Placement Quiz',
      membership: 'Membership',
      currentPlan: 'Current Plan',
      free: 'Free',
      premium: 'Premium',
      upgradeToPremium: 'Upgrade to Premium',
      account: 'Account',
      signOut: 'Sign Out',
      save: 'Save',
      cancel: 'Cancel',
      spanish: 'Spanish',
      english: 'English',
      manageSubscription: 'Manage Subscription',
      deleteAccount: 'Delete Account',
      deleteAccountWarning: 'This action cannot be undone. All your data, including reading progress, bookmarks, and stories will be permanently deleted.',
      deleteAccountConfirm: 'Type DELETE to confirm',
      deleteAccountButton: 'Delete My Account',
    },
    es: {
      settings: 'Ajustes',
      profile: 'Perfil',
      name: 'Nombre',
      email: 'Correo',
      preferences: 'Preferencias',
      nativeLanguage: 'Idioma Nativo',
      learning: 'Aprendizaje',
      currentLevel: 'Nivel Actual',
      retakeQuiz: 'Repetir Quiz de Nivel',
      membership: 'Membresía',
      currentPlan: 'Plan Actual',
      free: 'Gratis',
      premium: 'Premium',
      upgradeToPremium: 'Mejorar a Premium',
      account: 'Cuenta',
      signOut: 'Cerrar Sesión',
      save: 'Guardar',
      cancel: 'Cancelar',
      spanish: 'Español',
      english: 'Inglés',
      manageSubscription: 'Gestionar Suscripción',
      deleteAccount: 'Eliminar Cuenta',
      deleteAccountWarning: 'Esta acción no se puede deshacer. Todos tus datos, incluyendo progreso de lectura, marcadores e historias serán eliminados permanentemente.',
      deleteAccountConfirm: 'Escribe DELETE para confirmar',
      deleteAccountButton: 'Eliminar Mi Cuenta',
    },
  }

  const txt = content[typedLang]

  return (
    <AppLayout lang={typedLang}>
      {/* Full-screen background */}
      <div
        className="fixed inset-0 bg-cover bg-center -z-10"
        style={{ backgroundImage: 'url(/images/background3.png)' }}
      />

      <div className="min-h-screen py-8 px-4">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Page Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">{txt.settings}</h1>
          </div>

          {/* Profile Card */}
          <div className="glass-card">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
              {txt.profile}
            </h2>

            {/* Avatar and Name */}
            <div className="flex items-center gap-4 mb-6">
              {session.user.image ? (
                <Image
                  src={session.user.image}
                  alt="Profile"
                  width={64}
                  height={64}
                  className="rounded-full ring-4 ring-white shadow-md"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold ring-4 ring-white shadow-md">
                  {session.user.name?.[0] || session.user.email?.[0] || '?'}
                </div>
              )}
              <div className="flex-1">
                <p className="text-lg font-semibold text-gray-900">
                  {session.user.name || 'User'}
                </p>
                <p className="text-sm text-gray-500">{session.user.email}</p>
              </div>
            </div>

            {/* Editable Fields */}
            <div className="space-y-4">
              {/* Name Field */}
              <div className="flex items-center justify-between py-3 border-t border-gray-100">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">{txt.name}</p>
                    {editingField === 'name' ? (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        autoFocus
                      />
                    ) : (
                      <p className="text-sm font-medium text-gray-900">
                        {session.user.name || '—'}
                      </p>
                    )}
                  </div>
                </div>
                {editingField === 'name' ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateUserField('name', editValue)}
                      disabled={saving}
                      className="p-1.5 text-green-600 hover:bg-green-50 rounded-full transition-colors"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-full transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => startEditing('name', session.user.name || '')}
                    className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Email Field */}
              <div className="flex items-center justify-between py-3 border-t border-gray-100">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">{txt.email}</p>
                    {editingField === 'email' ? (
                      <input
                        type="email"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        autoFocus
                      />
                    ) : (
                      <p className="text-sm font-medium text-gray-900">
                        {session.user.email}
                      </p>
                    )}
                  </div>
                </div>
                {editingField === 'email' ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateUserField('email', editValue)}
                      disabled={saving}
                      className="p-1.5 text-green-600 hover:bg-green-50 rounded-full transition-colors"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-full transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => startEditing('email', session.user.email || '')}
                    className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Preferences Card */}
          <div className="glass-card">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
              {txt.preferences}
            </h2>

            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">{txt.nativeLanguage}</p>
                  <p className="text-sm font-medium text-gray-900">
                    {session.user.nativeLanguage === 'es' ? txt.spanish : txt.english}
                  </p>
                </div>
              </div>
              <select
                value={session.user.nativeLanguage || 'es'}
                onChange={(e) => updateUserField('nativeLanguage', e.target.value)}
                className="text-sm bg-white border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="es">{txt.spanish}</option>
                <option value="en">{txt.english}</option>
              </select>
            </div>
          </div>

          {/* Learning Card */}
          <div className="glass-card">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
              {txt.learning}
            </h2>

            <div className="flex items-center justify-between py-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <Crown className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{txt.currentLevel}</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {session.user.quizLevel || 'Level 2'}
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => router.push(`/${typedLang}/home/quiz/placement`)}
              className="w-full flex items-center justify-between py-3 px-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-medium hover:from-green-600 hover:to-emerald-700 transition-all shadow-sm"
            >
              <div className="flex items-center gap-3">
                <GraduationCap className="w-5 h-5" />
                <span>{txt.retakeQuiz}</span>
              </div>
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Membership Card */}
          <div className="glass-card">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
              {txt.membership}
            </h2>

            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  session.user.isPremium ? 'bg-gray-200' : 'bg-gray-100'
                }`}>
                  <Gem className={`w-5 h-5 ${session.user.isPremium ? 'text-gray-700' : 'text-gray-400'}`} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{txt.currentPlan}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">
                      {session.user.isPremium ? txt.premium : txt.free}
                    </p>
                    {session.user.isPremium && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-700 text-[10px] font-medium">
                        <Gem className="w-2.5 h-2.5" />
                        PRO
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {session.user.isPremium ? (
              <div className="mt-4">
                <button
                  onClick={openBillingPortal}
                  disabled={loadingPortal}
                  className="w-full flex items-center justify-between py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-all"
                >
                  <div className="flex items-center gap-3">
                    {loadingPortal ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <CreditCard className="w-5 h-5" />
                    )}
                    <span>{txt.manageSubscription}</span>
                  </div>
                  <ChevronRight className="w-5 h-5" />
                </button>
                {billingError && (
                  <p className="mt-2 text-sm text-amber-600 text-center">{billingError}</p>
                )}
              </div>
            ) : (
              <Link
                href={`/${typedLang}/premium`}
                className="mt-4 w-full flex items-center justify-between py-3 px-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg font-medium hover:from-indigo-600 hover:to-purple-700 transition-all shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <Gem className="w-5 h-5" />
                  <span>{txt.upgradeToPremium}</span>
                </div>
                <ChevronRight className="w-5 h-5" />
              </Link>
            )}
          </div>

          {/* Stats Card */}
          <Suspense fallback={
            <div className="glass-card flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            </div>
          }>
            <UserStatsCard />
          </Suspense>

          {/* Account Actions Card */}
          <div className="glass-card">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
              {txt.account}
            </h2>

            <button
              onClick={() => signOut({ callbackUrl: `/${typedLang}/auth/login`, redirect: true })}
              className="w-full flex items-center justify-between py-3 px-4 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-3">
                <LogOut className="w-5 h-5" />
                <span className="font-medium">{txt.signOut}</span>
              </div>
              <ChevronRight className="w-5 h-5" />
            </button>

            <button
              onClick={() => setShowDeleteModal(true)}
              className="w-full flex items-center justify-between py-3 px-4 text-red-600 hover:bg-red-50 rounded-lg transition-colors mt-2"
            >
              <div className="flex items-center gap-3">
                <Trash2 className="w-5 h-5" />
                <span className="font-medium">{txt.deleteAccount}</span>
              </div>
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">{txt.deleteAccount}</h3>
            </div>

            <p className="text-gray-600 mb-6">
              {txt.deleteAccountWarning}
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {txt.deleteAccountConfirm}
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="DELETE"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setDeleteConfirmText('')
                }}
                className="flex-1 py-2.5 px-4 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                {txt.cancel}
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== 'DELETE' || deleting}
                className="flex-1 py-2.5 px-4 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                {txt.deleteAccountButton}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
