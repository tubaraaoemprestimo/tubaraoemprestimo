import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserCheck, Send, ChevronLeft } from 'lucide-react';
import { api } from '../../services/apiClient';

// "Já sou cliente": substitui o formulário antigo de migração (quebrado; a tabela que ele usava não existe).
// Contratos antigos agora são registrados pela equipe e ligados à conta pelo convite seguro.
// Aqui o cliente só pede contato: nenhum valor informado por ele vira cobrança.
export function ReturningClientNotice() {
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const { error: err } = await api.post<any>('/returning-clients/contact', { message });
    if (err) { setError(typeof err === 'string' ? err : err.error || 'Não foi possível enviar. Tente de novo.'); return; }
    setSent(true);
  };

  return (
    <main className="min-h-screen bg-black text-white p-4 flex justify-center">
      <div className="w-full max-w-md space-y-5 pt-4">
        <button onClick={() => navigate(-1)} className="min-h-[44px] inline-flex items-center gap-1 text-zinc-400"><ChevronLeft size={18} /> Voltar</button>
        <div className="flex items-center gap-3"><UserCheck className="text-[#D4AF37]" /><h1 className="text-2xl font-bold">Já sou cliente</h1></div>
        <p className="text-zinc-300">Se você já tinha contrato com a Tubarão Empréstimos antes do app, nossa equipe registra seus contratos e envia um <b>link seguro de ativação</b> pelo WhatsApp. Pelo link, seus contratos aparecem aqui no app, sem precisar contratar de novo.</p>
        {sent ? (
          <p role="status" className="rounded-xl bg-green-900/40 p-4 text-green-200">Pedido enviado! Nossa equipe vai conferir seus contratos e te mandar o link de ativação.</p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <label className="block text-sm">Quer deixar um recado para a equipe? (opcional)
              <textarea rows={3} maxLength={500} value={message} onChange={e => setMessage(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-base" placeholder="Ex.: tenho contrato de moto desde 2025" />
            </label>
            {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
            <button className="w-full min-h-[48px] rounded-lg bg-[#D4AF37] font-bold text-black inline-flex items-center justify-center gap-2"><Send size={18} /> Pedir meu link de ativação</button>
          </form>
        )}
      </div>
    </main>
  );
}
