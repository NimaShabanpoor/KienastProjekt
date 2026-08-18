// Login-Seite

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import { useLogin } from '../../hooks/useAuth';
import { Loader2 } from 'lucide-react';
import AuthLayout from '../../components/auth/AuthLayout';

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
  return 'E-Mail oder Passwort ist ungültig.';
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

  return (
    <AuthLayout title="Anmelden" subtitle="Mit deinem SchulAdmin-Konto fortfahren.">
      <form onSubmit={(e) => void handleSubmit((data) => loginMutation.mutate(data))(e)} className="space-y-5">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-[13px] font-medium text-neutral-700">
            E-Mail
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="input-modern h-11"
            {...register('email')}
          />
          {errors.email && <p className="mt-1.5 text-[13px] text-error">{errors.email.message}</p>}
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-[13px] font-medium text-neutral-700">
            Passwort
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className="input-modern h-11"
            {...register('password')}
          />
          {errors.password && <p className="mt-1.5 text-[13px] text-error">{errors.password.message}</p>}
        </div>

        {loginMutation.isError && (
          <p className="text-[13px] leading-5 text-error">{getLoginErrorMessage(loginMutation.error)}</p>
        )}

        <button type="submit" disabled={loginMutation.isPending} className="btn-primary h-11 w-full">
          {loginMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Anmelden…
            </>
          ) : (
            'Anmelden'
          )}
        </button>
      </form>

      {import.meta.env.DEV && (
        <p className="mt-8 text-[11px] text-neutral-400">
          Entwicklung: admin@itbenedickt.ch
        </p>
      )}
    </AuthLayout>
  );
}
