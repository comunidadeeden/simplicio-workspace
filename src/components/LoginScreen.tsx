import { useState } from 'react';
import { LogIn, ShieldCheck } from 'lucide-react';
import { signInWithGoogle, signInWithGoogleRedirect, type AccessStatus } from '../lib/auth';

export function LoginScreen({ status }: { status: AccessStatus }) {
  const denied = status === 'denied';
  const [authError, setAuthError] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);

  const loginWithPopup = async () => {
    setAuthError('');
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      setAuthError(getAuthMessage(error));
    } finally {
      setIsSigningIn(false);
    }
  };

  const loginWithRedirect = async () => {
    setAuthError('');
    setIsSigningIn(true);
    try {
      await signInWithGoogleRedirect();
    } catch (error) {
      setAuthError(getAuthMessage(error));
      setIsSigningIn(false);
    }
  };

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

        {authError && (
          <div className="mb-4 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-[12px] leading-5 text-rose-200">
            {authError}
          </div>
        )}

        <button
          onClick={loginWithPopup}
          disabled={isSigningIn}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-[12px] font-bold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LogIn size={14} />
          {isSigningIn ? 'Abrindo Google...' : 'Entrar com Google'}
        </button>

        <button
          onClick={loginWithRedirect}
          disabled={isSigningIn}
          className="mt-2 inline-flex h-9 w-full items-center justify-center rounded-lg border border-slate-800 px-3 text-[11px] font-semibold text-slate-400 transition-colors hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Entrar redirecionando
        </button>

        <p className="mt-4 text-center text-[11px] leading-5 text-slate-600">
          Apenas usuários adicionados pelo admin conseguem acessar a operação.
        </p>
      </div>
    </div>
  );
}

function getAuthMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('auth/unauthorized-domain')) {
    return 'Este domínio ainda não está liberado no Firebase Authentication. Adicione simplicio-workspace.vercel.app em Authorized domains.';
  }
  if (message.includes('auth/operation-not-allowed')) {
    return 'O login com Google ainda não está ativado no Firebase Authentication.';
  }
  if (message.includes('auth/popup-closed-by-user')) {
    return 'A janela do Google foi fechada antes de concluir. Tente novamente ou use a opção de redirecionamento.';
  }
  if (message.includes('auth/popup-blocked')) {
    return 'O navegador bloqueou o popup. Use a opção de redirecionamento.';
  }
  return `Não foi possível iniciar o login: ${message}`;
}
