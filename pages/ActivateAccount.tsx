import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../services/apiClient';

// Ativação de conta de cliente antigo pelo link do convite (/#/ativar?c=TOKEN).
// Confere identidade (4 últimos dígitos do telefone + CPF quando cadastrado) antes de criar a conta.
export function ActivateAccount() {
  const [params] = useSearchParams();
  const token = params.get('c') || '';
  const [state, setState] = useState<'loading' | 'invalid' | 'form' | 'done'>('loading');
  const [info, setInfo] = useState<{ firstName: string; needsCpf: boolean } | null>(null);
  const [f, setF] = useState({ phoneLast4: '', cpf: '', newCpf: '', name: '', email: '', password: '', acceptTerms: false });
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!token) { setState('invalid'); return; }
    api.post<any>('/activation/check', { token }).then(({ data }) => {
      if (data) { setInfo(data); setState('form'); } else setState('invalid');
    });
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSending(true);
    const { error: err } = await api.post<any>('/activation/complete', { token, ...f });
    setSending(false);
    if (err) {
      setError(typeof err === 'string' ? err : err.error || 'Não foi possível ativar.');
      if (err?.attemptsLeft === 0) setState('invalid');
      return;
    }
    setState('done');
  };

  const input = 'w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-3 text-white text-base focus:border-[#D4AF37] outline-none';
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-5">
        <h1 className="text-2xl font-bold text-[#D4AF37]">Tubarão Empréstimos</h1>
        {state === 'loading' && <p className="text-zinc-400">Verificando convite…</p>}
        {state === 'invalid' && (
          <div className="space-y-3">
            <p>Este convite não é válido, expirou ou já foi usado.</p>
            <p className="text-zinc-400 text-sm">Peça um novo link ao nosso atendimento. Se você já ativou, é só entrar.</p>
            <Link to="/login" className="block text-center rounded-lg bg-[#D4AF37] text-black font-semibold py-3">Entrar</Link>
          </div>
        )}
        {state === 'done' && (
          <div className="space-y-3">
            <p>Pronto! Sua conta foi ativada.</p>
            <p className="text-zinc-400 text-sm">Entre com o e-mail e a senha que você acabou de criar para ver seus contratos e pagamentos.</p>
            <Link to="/login" className="block text-center rounded-lg bg-[#D4AF37] text-black font-semibold py-3">Entrar</Link>
          </div>
        )}
        {state === 'form' && info && (
          <form onSubmit={submit} className="space-y-4">
            <p>Olá, {info.firstName}! Para sua segurança, confirme alguns dados e crie sua senha.</p>
            <label className="block text-sm">4 últimos dígitos do seu telefone
              <input required inputMode="numeric" maxLength={4} pattern="\d{4}" className={input} value={f.phoneLast4} onChange={e => setF({ ...f, phoneLast4: e.target.value.replace(/\D/g, '') })} /></label>
            {info.needsCpf
              ? <label className="block text-sm">Seu CPF<input required inputMode="numeric" className={input} value={f.cpf} onChange={e => setF({ ...f, cpf: e.target.value })} /></label>
              : <label className="block text-sm">Seu CPF (opcional)<input inputMode="numeric" className={input} value={f.newCpf} onChange={e => setF({ ...f, newCpf: e.target.value })} /></label>}
            <label className="block text-sm">Nome completo<input autoComplete="name" className={input} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></label>
            <label className="block text-sm">E-mail<input required type="email" autoComplete="email" className={input} value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></label>
            <label className="block text-sm">Crie uma senha (mínimo 8 caracteres)<input required type="password" minLength={8} autoComplete="new-password" className={input} value={f.password} onChange={e => setF({ ...f, password: e.target.value })} /></label>
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" required className="mt-1 w-5 h-5" checked={f.acceptTerms} onChange={e => setF({ ...f, acceptTerms: e.target.checked })} />
              <span>Li e aceito os termos de uso e a política de privacidade.</span></label>
            {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
            <button disabled={sending} className="w-full rounded-lg bg-[#D4AF37] text-black font-semibold py-3 disabled:opacity-50">{sending ? 'Ativando…' : 'Ativar minha conta'}</button>
          </form>
        )}
      </div>
    </main>
  );
}
