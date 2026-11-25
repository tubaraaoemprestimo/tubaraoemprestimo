import React, { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { api } from '../services/apiClient';

// Painel do investidor: aportes registrados e repasses já feitos. Só aparece para quem tem investimento.
export function MyInvestments() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { api.get<any>('/my-disputes/investments').then(r => setItems(r.data?.items || [])); }, []);
  if (!items.length) return null;
  const brl = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const STATUS: Record<string, string> = { ACTIVE: 'Ativo', PENDING_REVIEW: 'Em conferência', REDEEMED: 'Resgatado', CANCELLED: 'Encerrado' };
  return (
    <section aria-label="Meus investimentos" className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-bold"><TrendingUp size={18} className="text-cyan-400" /> Meus investimentos</h2>
      {items.map(i => (
        <article key={i.id} className="space-y-2 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-sm">
          <div className="flex justify-between gap-2"><b className="text-base">{brl(i.amount)}</b><span className="rounded-full bg-zinc-800 px-3 py-1 text-xs">{STATUS[i.status] || i.status}</span></div>
          {i.originalDate && <p className="text-zinc-400">Aporte em {new Date(i.originalDate).toLocaleDateString('pt-BR')}</p>}
          {i.yieldTerms && <p className="text-zinc-300">{i.yieldTerms}</p>}
          {i.nextPayoutDate && <p>Próximo repasse: <b>{new Date(i.nextPayoutDate).toLocaleDateString('pt-BR')}</b></p>}
          {i.payouts?.length > 0 && <div><p className="text-zinc-400">Repasses recebidos</p>
            {i.payouts.map((p: any, k: number) => <p key={k} className="flex justify-between"><span>{new Date(p.paidAt).toLocaleDateString('pt-BR')}</span><span>{brl(p.amount)}{p.receiptUrl && <a href={p.receiptUrl} target="_blank" rel="noopener noreferrer" className="ml-2 underline text-[#D4AF37]">comprovante</a>}</span></p>)}</div>}
        </article>
      ))}
    </section>
  );
}
