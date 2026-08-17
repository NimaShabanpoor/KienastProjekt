// 2FA-Verifizierungsseite
// TOTP-Code-Eingabe nach erfolgreichem Login

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useVerify2FA } from '../../hooks/useAuth';
import { ArrowLeft, Loader2, ShieldCheck, Smartphone } from 'lucide-react';
import { useEffect } from 'react';

const totpSchema = z.object({
  totpCode: z
    .string()
    .length(6, 'Code muss genau 6 Stellen haben')
    .regex(/^\d{6}$/, 'Nur Ziffern erlaubt'),
});

type TotpFormData = z.infer<typeof totpSchema>;

export default function TwoFactorPage() {
  const navigate = useNavigate();
  const verifyMutation = useVerify2FA();

  // Wenn kein tempToken vorhanden: zur Login-Seite
  useEffect(() => {
    const tempToken = sessionStorage.getItem('tempToken');
    if (!tempToken) {
      void navigate('/login');
    }
  }, [navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TotpFormData>({
    resolver: zodResolver(totpSchema),
  });

  const onSubmit = (data: TotpFormData) => {
    const tempToken = sessionStorage.getItem('tempToken') ?? '';
    verifyMutation.mutate({ tempToken, totpCode: data.totpCode });
  };

  return (
    <div className="bg-app-gradient flex min-h-screen items-center justify-center p-4">
      <div className="surface-card w-full max-w-lg rounded-[2rem] p-8 sm:p-10">
        <button
          type="button"
          onClick={() => void navigate('/login')}
          className="btn-secondary mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück zum Login
        </button>

        <div className="mb-8 text-center">
          <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-red text-white shadow-lg shadow-rose-200">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.3em] text-brand-red">
            Sicherheitsprüfung
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-950">
            Zwei-Faktor-Authentifizierung
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Gib den aktuellen 6-stelligen Code aus deiner Authenticator-App ein, um den Login
            abzuschließen.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
          <div className="mb-5 flex items-start gap-3 rounded-2xl bg-white p-4 text-sm text-slate-500">
            <Smartphone className="mt-0.5 h-5 w-5 text-brand-red" />
            <p>
              Öffne deine Authenticator-App und nutze einen aktuell gültigen Einmalcode. Codes
              laufen in kurzen Intervallen ab.
            </p>
          </div>

          <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
            <div>
              <label htmlFor="totpCode" className="mb-1.5 block text-sm font-medium text-slate-700">
                6-stelliger Code
              </label>
              <input
                id="totpCode"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                className="input-modern text-center text-2xl font-semibold tracking-[0.4em]"
                {...register('totpCode')}
              />
              {errors.totpCode && (
                <p className="mt-1 text-sm text-red-600">{errors.totpCode.message}</p>
              )}
            </div>

            {verifyMutation.isError && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                <p className="text-sm text-rose-700">
                  Ungültiger Code. Bitte überprüfe deinen Authenticator.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={verifyMutation.isPending}
              className="btn-primary w-full py-3 text-base"
            >
              {verifyMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifizieren...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  Verifizieren
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
