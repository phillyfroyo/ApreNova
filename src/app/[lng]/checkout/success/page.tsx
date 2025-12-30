// src/app/[lng]/checkout/success/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { CheckCircle, Gem, Loader2, BookOpen, ArrowRight } from 'lucide-react';
import type { Language } from '@/types/i18n';

export default function CheckoutSuccessPage() {
  const { lng } = useParams();
  const router = useRouter();
  const { data: session, update } = useSession();
  const typedLang = (lng as Language) || 'es';
  const [refreshing, setRefreshing] = useState(true);

  // Refresh session to get updated isPremium status
  useEffect(() => {
    const refreshSession = async () => {
      await update();
      setRefreshing(false);
    };

    // Give the webhook a moment to process
    const timer = setTimeout(refreshSession, 2000);
    return () => clearTimeout(timer);
  }, [update]);

  const content = {
    en: {
      title: 'Welcome to Premium!',
      subtitle: 'Your subscription is now active',
      description: 'Thank you for upgrading! You now have access to all premium features including unlimited AI tutoring, all story levels, and more.',
      features: [
        'Unlimited AI Tutor conversations',
        'Access to all story difficulty levels',
        'Priority support',
      ],
      exploreStories: 'Explore Stories',
      goToDashboard: 'Go to Dashboard',
      processing: 'Activating your subscription...',
    },
    es: {
      title: '¡Bienvenido a Premium!',
      subtitle: 'Tu suscripción ya está activa',
      description: 'Gracias por actualizar. Ahora tienes acceso a todas las funciones premium, incluyendo tutoría IA ilimitada, todos los niveles de historias y más.',
      features: [
        'Conversaciones ilimitadas con el Tutor IA',
        'Acceso a todos los niveles de dificultad',
        'Soporte prioritario',
      ],
      exploreStories: 'Explorar Historias',
      goToDashboard: 'Ir al Inicio',
      processing: 'Activando tu suscripción...',
    },
  };

  const txt = content[typedLang];

  if (refreshing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600">{txt.processing}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-4">
      <div className="max-w-md w-full">
        {/* Success Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-8 text-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">{txt.title}</h1>
            <p className="text-indigo-100 mt-1">{txt.subtitle}</p>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Premium Badge */}
            <div className="flex items-center justify-center gap-2 mb-6">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-200 text-gray-700 font-medium">
                <Gem className="w-4 h-4" />
                PRO
              </span>
            </div>

            <p className="text-gray-600 text-center mb-6">{txt.description}</p>

            {/* Features List */}
            <ul className="space-y-3 mb-8">
              {txt.features.map((feature, i) => (
                <li key={i} className="flex items-center gap-3 text-gray-700">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Link
                href={`/${typedLang}/stories`}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg font-medium hover:from-indigo-600 hover:to-purple-700 transition-all"
              >
                <BookOpen className="w-5 h-5" />
                {txt.exploreStories}
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href={`/${typedLang}/dashboard`}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-all"
              >
                {txt.goToDashboard}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
