// Login-Seite
// Formular für E-Mail + Passwort, IT Bénédict Branding

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLogin } from '../../hooks/useAuth';
import { ArrowRight, Loader2, LogIn, ShieldCheck } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Ungültige E-Mail-Adresse'),
  password: z.string().min(1, 'Passwort erforderlich'),
});

type LoginFormData = z.infer<typeof loginSchema>;

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
    <div className="bg-app-gradient flex min-h-screen items-center justify-center p-4">
      <div className="grid w-full max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="hidden overflow-hidden rounded-[2rem] border border-white/60 bg-slate-950 p-10 text-white shadow-2xl lg:block">
          <div className="max-w-lg">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-200">
              <ShieldCheck className="h-4 w-4" />
              Datenschutzkonforme Schulverwaltung
            </div>
            <h1 className="mt-8 text-5xl font-semibold leading-tight">
              Moderne Verwaltung für Unterricht, Absenzen und Noten.
            </h1>
            <p className="mt-5 text-lg leading-8 text-slate-300">
              Ein aufgeräumtes Dashboard für Lehrpersonen und Abteilungsleitung mit
              klaren Aktionen, schnellen Übersichten und sicherem Login.
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm text-slate-400">Schneller Überblick</p>
                <p className="mt-2 text-2xl font-semibold">Dashboard & Aktionen</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm text-slate-400">Sicherer Zugriff</p>
                <p className="mt-2 text-2xl font-semibold">JWT + 2FA</p>
              </div>
            </div>
          </div>
        </section>

        <div className="surface-card w-full rounded-[2rem] p-8 sm:p-10">
          <div className="mb-8">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-red text-white shadow-lg shadow-rose-200">
              <LogIn className="h-8 w-8" />
            </div>
            <p className="mt-6 text-sm font-semibold uppercase tracking-[0.3em] text-brand-red">
              SchulAdmin
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-slate-950">Willkommen zurück</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Melde dich an, um Klassen, Schülerdaten, Absenzen und Noten zentral zu verwalten.
            </p>
          </div>

          <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
                E-Mail-Adresse
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className="input-modern"
                {...register('email')}
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
                Passwort
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className="input-modern"
                {...register('password')}
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            {loginMutation.isError && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                <p className="text-sm text-rose-700">
                  Ungültige Anmeldedaten. Bitte überprüfe E-Mail und Passwort.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="btn-primary w-full py-3 text-base"
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Anmelden...
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  Anmelden
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
            Dieses System verarbeitet personenbezogene Daten gemäss nDSG und unterstützt
            geschützte Logins mit optionaler Zwei-Faktor-Authentifizierung.
          </div>
        </div>
      </div>
    </div>
  );
}
