// Login-Seite
// Formular für E-Mail + Passwort, IT Bénédict Branding

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import { useLogin } from '../../hooks/useAuth';
import { Loader2, LogIn } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Ungültige E-Mail-Adresse'),
  password: z.string().min(1, 'Passwort erforderlich'),
});

type LoginFormData = z.infer<typeof loginSchema>;

function getLoginErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 429) {
      return 'Zu viele Anmeldeversuche. Bitte kurz warten und es erneut versuchen.';
    }
    const apiError = error.response?.data as { error?: string } | undefined;
    if (apiError?.error) return apiError.error;
  }
  return 'Ungültige Anmeldedaten. Bitte überprüfe E-Mail und Passwort.';
}

export default function LoginPage() {
  const loginMutation = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = (data: LoginFormData) => {
    loginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-red rounded-2xl mb-4">
            <LogIn className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">SchulAdmin</h1>
          <p className="text-neutral-500 mt-1">IT Bénédict Zürich</p>
        </div>

        {/* Login-Formular */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-8">
          <h2 className="text-xl font-semibold text-neutral-900 mb-6">Anmelden</h2>

          <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
            {/* E-Mail */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-neutral-700 mb-1.5"
              >
                E-Mail-Adresse
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red focus:border-transparent"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-error text-sm mt-1">{errors.email.message}</p>
              )}
            </div>

            {/* Passwort */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-neutral-700 mb-1.5"
              >
                Passwort
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red focus:border-transparent"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-error text-sm mt-1">{errors.password.message}</p>
              )}
            </div>

            {/* Fehler-Anzeige */}
            {loginMutation.isError && (
              <div className="bg-brand-red-light border border-brand-red rounded-lg p-3">
                <p className="text-brand-red-dark text-sm">
                  {getLoginErrorMessage(loginMutation.error)}
                </p>
              </div>
            )}

            {/* Submit-Button */}
            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full flex items-center justify-center gap-2 bg-brand-red hover:bg-brand-red-dark text-white font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Anmelden...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Anmelden
                </>
              )}
            </button>
          </form>
        </div>

        {/* Datenschutz-Hinweis */}
        {import.meta.env.DEV && (
          <p className="text-center text-xs text-neutral-500 mt-4">
            Dev-Login: admin@itbenedickt.ch / Schuladmin1234!
          </p>
        )}
        <p className="text-center text-xs text-neutral-400 mt-2">
          Dieses System verarbeitet personenbezogene Daten gemäss nDSG.
        </p>
      </div>
    </div>
  );
}
