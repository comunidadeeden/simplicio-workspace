import { LogIn, ShieldCheck } from 'lucide-react';
import { signInWithGoogle, type AccessStatus } from '../lib/auth';

export function LoginScreen({ status }: { status: AccessStatus }) {
  const denied = status === 'denied';

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-200">
      <div className="w-full max-w-md rounded-2xl border border-slate-900 bg-slate-950 p-6 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-300">
            <ShieldCheck size={18} />
          </div>
          <div>
            <h1 className="text-lg font-display font-bold text-slate-100">Simplicio.</h1>
            <p className="text-[12px] text-slate-500">Acesso seguro ao workspace.</p>
          </div>
        </div>

        {denied && (
          <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-[12px] leading-5 text-amber-200">
            Seu e-mail ainda não foi liberado por um admin. Peça acesso para continuar.
          </div>
        )}

        <button
          onClick={signInWithGoogle}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-[12px] font-bold text-white transition-colors hover:bg-blue-500"
        >
          <LogIn size={14} />
          Entrar com Google
        </button>

        <p className="mt-4 text-center text-[11px] leading-5 text-slate-600">
          Apenas usuários adicionados pelo admin conseguem acessar a operação.
        </p>
      </div>
    </div>
  );
}
