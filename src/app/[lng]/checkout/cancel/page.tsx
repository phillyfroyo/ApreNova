// src/app/[lng]/checkout/cancel/page.tsx
'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { XCircle, ArrowLeft, HelpCircle } from 'lucide-react';
import type { Language } from '@/types/i18n';

export default function CheckoutCancelPage() {
  const { lng } = useParams();
  const typedLang = (lng as Language) || 'es';

  const content = {
    en: {
      title: 'Checkout Cancelled',
      subtitle: "No worries, you weren't charged",
      description: "Your checkout was cancelled. You can try again anytime or continue using the free features of the app.",
      tryAgain: 'Try Again',
      backToStories: 'Back to Stories',
      needHelp: 'Need help?',
      contactSupport: 'Contact Support',
    },
    es: {
      title: 'Compra Cancelada',
      subtitle: 'No te preocupes, no se realizó ningún cargo',
      description: 'Tu compra fue cancelada. Puedes intentarlo de nuevo en cualquier momento o continuar usando las funciones gratuitas de la app.',
      tryAgain: 'Intentar de Nuevo',
      backToStories: 'Volver a Historias',
      needHelp: '¿Necesitas ayuda?',
      contactSupport: 'Contactar Soporte',
    },
  };

  const txt = content[typedLang];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100 p-4">
      <div className="max-w-md w-full">
        {/* Cancel Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-gray-600 to-gray-700 px-6 py-8 text-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">{txt.title}</h1>
            <p className="text-gray-200 mt-1">{txt.subtitle}</p>
          </div>

          {/* Content */}
          <div className="p-6">
            <p className="text-gray-600 text-center mb-8">{txt.description}</p>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Link
                href={`/${typedLang}/premium`}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg font-medium hover:from-indigo-600 hover:to-purple-700 transition-all"
              >
                {txt.tryAgain}
              </Link>
              <Link
                href={`/${typedLang}/stories`}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                {txt.backToStories}
              </Link>
            </div>

            {/* Help Link */}
            <div className="mt-6 pt-6 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-500 mb-2">{txt.needHelp}</p>
              <Link
                href={`mailto:support@cuentana.com`}
                className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                <HelpCircle className="w-4 h-4" />
                {txt.contactSupport}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
