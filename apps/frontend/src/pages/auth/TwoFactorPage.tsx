// 2FA-Verifizierungsseite

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useVerify2FA } from '../../hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import AuthLayout from '../../components/auth/AuthLayout';

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
    <AuthLayout
      title="Bestätigung"
      subtitle="Gib den 6-stelligen Code aus deiner Authenticator-App ein."
    >
      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-5">
        <div>
          <label htmlFor="totpCode" className="mb-1.5 block text-[13px] font-medium text-neutral-700">
            Einmalcode
          </label>
          <input
            id="totpCode"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            className="input-modern h-12 text-center text-lg font-medium tracking-[0.4em]"
            {...register('totpCode')}
          />
          {errors.totpCode && <p className="mt-1.5 text-[13px] text-error">{errors.totpCode.message}</p>}
        </div>

        {verifyMutation.isError && (
          <p className="text-[13px] leading-5 text-error">Ungültiger Code. Bitte Authenticator prüfen.</p>
        )}

        <button type="submit" disabled={verifyMutation.isPending} className="btn-primary h-11 w-full">
          {verifyMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Prüfen…
            </>
          ) : (
            'Weiter'
          )}
        </button>

        <button
          type="button"
          onClick={() => void navigate('/login')}
          className="w-full py-1 text-center text-[13px] text-neutral-500 transition hover:text-neutral-800"
        >
          Zurück zur Anmeldung
        </button>
      </form>
    </AuthLayout>
  );
}
