import React, { useEffect, useState } from 'react';
import { Scale, X } from 'lucide-react';
import { api } from '../services/apiClient';

// Cliente informa divergência e pede conferência do próprio contrato.
// Enquanto a equipe confere, as cobranças desse contrato ficam suspensas.
export function DisputeButton({ loanId }: { loanId: string }) {
  const [open, setOpen] = useState(false);
  const [mine, setMine] = useState<any[]>([]);
  const [description, setDescription] = useState('');
  const [msg, setMsg] = useState('');
  const load = () => api.get<any>('/my-disputes').then(r => setMine((r.data?.items || []).filter((d: any) => d.loanId === loanId)));
  useEffect(() => { load(); }, [loanId]);
  const active = mine.find(d => d.status !== 'RESOLVED');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await api.post<any>('/my-disputes', { loanId, description });
    if (error) { setMsg(typeof error === 'string' ? error : error.error || 'Não foi possível enviar.'); return; }
    setMsg('Recebemos seu pedido. Nossa equipe vai conferir e responder. Enquanto isso, as cobranças deste contrato ficam pausadas.');
    setDescription(''); load();
  };

  return (
    <>
      {active
        ? <p className="rounded-2xl border border-amber-700/50 bg-amber-900/20 p-3 text-sm text-amber-200">Conferência em andamento ({active.status === 'OPEN' ? 'aberta' : 'em análise'}). As cobranças deste contrato estão pausadas até a resposta.</p>
        : <button onClick={() => setOpen(true)} className="w-full min-h-[48px] rounded-2xl border border-zinc-700 text-sm text-zinc-300 inline-flex items-center justify-center gap-2"><Scale size={16} /> Algo errado? Pedir conferência</button>}
      {open && (
        <div role="dialog" aria-modal="true" aria-label="Pedir conferência" className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 sm:items-center" onClick={() => setOpen(false)}>
          <form onSubmit={submit} onClick={e => e.stopPropagation()} className="w-full space-y-3 rounded-t-2xl bg-zinc-950 p-4 sm:max-w-md sm:rounded-2xl">
            <div className="flex items-center justify-between"><h3 className="font-bold">Pedir conferência</h3><button type="button" aria-label="Fechar" onClick={() => setOpen(false)} className="p-2"><X /></button></div>
            {msg ? <p role="status" className="text-sm text-green-300">{msg}</p> : <>
              <label className="block text-sm">O que está diferente?<textarea required minLength={10} maxLength={2000} rows={4} value={description} onChange={e => setDescription(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-base" placeholder="Ex.: já paguei a parcela de 10/12 pelo Pix" /></label>
              <button className="w-full min-h-[48px] rounded-lg bg-[#D4AF37] font-bold text-black">Enviar pedido</button>
            </>}
          </form>
        </div>
      )}
    </>
  );
}
