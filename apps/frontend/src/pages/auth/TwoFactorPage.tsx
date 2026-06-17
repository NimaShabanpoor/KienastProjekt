// 2FA-Verifizierungsseite
// TOTP-Code-Eingabe nach erfolgreichem Login

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useVerify2FA } from '../../hooks/useAuth';
import { ShieldCheck, Loader2 } from 'lucide-react';
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
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-red rounded-2xl mb-4">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">Zwei-Faktor-Authentifizierung</h1>
          <p className="text-neutral-500 mt-1">Bitte gib den Code aus deiner Authenticator-App ein.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-8">
          <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
            <div>
              <label htmlFor="totpCode" className="block text-sm font-medium text-neutral-700 mb-1.5">
                6-stelliger Code
              </label>
              <input
                id="totpCode"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                className="w-full px-3 py-3 border border-neutral-300 rounded-lg text-center text-2xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-brand-red focus:border-transparent"
                {...register('totpCode')}
              />
              {errors.totpCode && (
                <p className="text-error text-sm mt-1">{errors.totpCode.message}</p>
              )}
            </div>

            {verifyMutation.isError && (
              <div className="bg-brand-red-light border border-brand-red rounded-lg p-3">
                <p className="text-brand-red-dark text-sm">
                  Ungültiger Code. Bitte überprüfe deinen Authenticator.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={verifyMutation.isPending}
              className="w-full flex items-center justify-center gap-2 bg-brand-red hover:bg-brand-red-dark text-white font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              {verifyMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Verifizieren...</>
              ) : (
                <><ShieldCheck className="w-4 h-4" />Verifizieren</>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
