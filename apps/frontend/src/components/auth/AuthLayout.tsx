import type { ReactNode } from 'react';

type AuthLayoutProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export default function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between bg-neutral-900 px-14 py-12 text-white lg:flex">
        <div className="absolute inset-y-0 right-0 w-px bg-white/10" />
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-neutral-400">
            IT Bénédict Zürich
          </p>
          <h1 className="mt-20 text-[2.5rem] font-semibold leading-none tracking-tight">SchulAdmin</h1>
          <div className="mt-5 h-px w-10 bg-brand-red" />
          <p className="mt-8 max-w-[18rem] text-[15px] leading-7 text-neutral-400">
            Interne Verwaltung für Klassen, Absenzen und Noten.
          </p>
        </div>
        <p className="text-[11px] leading-5 text-neutral-500">
          Verarbeitung personenbezogener Daten gemäss nDSG.
        </p>
      </aside>

      <main className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-[360px]">
          <div className="mb-10 lg:hidden">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-neutral-400">
              IT Bénédict Zürich
            </p>
            <p className="mt-2 text-lg font-semibold tracking-tight text-neutral-900">SchulAdmin</p>
            <div className="mt-3 h-px w-8 bg-brand-red" />
          </div>

          <h2 className="text-[1.65rem] font-semibold tracking-tight text-neutral-900">{title}</h2>
          {subtitle ? <p className="mt-2 text-sm leading-6 text-neutral-500">{subtitle}</p> : null}

          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
