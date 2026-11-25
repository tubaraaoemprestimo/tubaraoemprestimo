import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, ExternalLink, AlertTriangle } from 'lucide-react';
import { api } from '../../services/apiClient';
import { Button } from '../Button';
import { useToast } from '../Toast';

/**
 * Conciliação dos comprovantes PENDENTES de parcelas já PAGAS.
 * A classificação vem do backend (somente leitura). A única ação é "rejeitar
 * com motivo" (rota existente /payment-receipts/:id/reject), que NÃO mexe em
 * saldo, parcela nem contrato: só tira o comprovante da fila de pendentes.
 * Lote só para "Possível duplicidade" e "Já conciliado", com confirmação.
 */

type ReconItem = {
  receiptId: string; classification: string; reason: string; customerName: string;
  loanId: string; loanStatus: string; installmentAmount: number; installmentPaidAt: string | null;
  receiptAmount: number; approvedOnInstallment: number; submittedAt: string; receiptUrl: string;
};

const LABEL: Record<string, string> = {
  JA_CONCILIADO: 'Já conciliado', POSSIVEL_DUPLICIDADE: 'Possível duplicidade', PAGAMENTO_PARCIAL: 'Pagamento parcial',
  PAGAMENTO_EXCEDENTE: 'Pagamento excedente', DIVERGENCIA_VALOR: 'Divergência de valor',
  DIVERGENCIA_CONTRATO: 'Divergência de contrato', ANALISE_MANUAL: 'Análise manual',
};
// Só estes podem ser rejeitados em lote: o pagamento já está registrado por outro comprovante.
const BATCH_ELIGIBLE = new Set(['JA_CONCILIADO', 'POSSIVEL_DUPLICIDADE']);
const REJECT_NOTE: Record<string, string> = {
  JA_CONCILIADO: 'Conciliação: parcela já quitada com outro comprovante aprovado de mesmo valor.',
  POSSIVEL_DUPLICIDADE: 'Conciliação: envio repetido do mesmo comprovante (mesmo valor, mesmo dia, mesma parcela).',
};

const fmt = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('pt-BR') : '—');

export const ReceiptReconciliation: React.FC = () => {
  const { addToast } = useToast();
  const [items, setItems] = useState<ReconItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('ALL');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const { data, error: e } = await api.get<{ items: ReconItem[] }>('/payment-receipts/reconciliation');
    if (e) { setError(typeof e === 'string' ? e : e?.error || 'Erro ao carregar'); return; }
    setItems(data?.items || []); setSelected(new Set());
  }, []);
  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => (items || []).reduce<Record<string, number>>((a, i) => ({ ...a, [i.classification]: (a[i.classification] || 0) + 1 }), {}), [items]);
  const visible = (items || []).filter(i => filter === 'ALL' || i.classification === filter);

  const reject = async (list: ReconItem[]) => {
    if (!list.length) return;
    const msg = list.length === 1
      ? `Rejeitar o comprovante de ${fmt(list[0].receiptAmount)} de ${list[0].customerName}?\n\nMotivo: ${REJECT_NOTE[list[0].classification] || list[0].reason}\n\nO saldo e a parcela NÃO mudam.`
      : `Rejeitar ${list.length} comprovantes selecionados?\n\nO saldo e as parcelas NÃO mudam. Cada um recebe o motivo da sua classificação.`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    let ok = 0; const fail: string[] = [];
    for (const it of list) {
      const { error: e } = await api.put(`/payment-receipts/${it.receiptId}/reject`, { notes: REJECT_NOTE[it.classification] || `Conciliação: ${it.reason}` });
      if (e) fail.push(it.receiptId.slice(0, 8)); else ok++;
    }
    setBusy(false);
    addToast(fail.length ? `${ok} rejeitado(s); ${fail.length} falharam (${fail.join(', ')}).` : `${ok} comprovante(s) rejeitado(s).`, fail.length ? 'error' : 'success');
    load();
  };

  if (error) return <div className="p-6 text-red-300">{error} <Button size="sm" variant="secondary" onClick={load}>Tentar de novo</Button></div>;
  if (!items) return <div className="p-6 text-zinc-500">Carregando conciliação...</div>;

  const selectedItems = visible.filter(i => selected.has(i.receiptId));

  return (
    <section className="space-y-4" aria-label="Conciliação de comprovantes">
      <div className="flex items-start gap-3 rounded-xl border border-amber-700/40 bg-amber-950/20 p-4 text-sm text-amber-200">
        <AlertTriangle size={18} className="shrink-0 mt-0.5" aria-hidden="true" />
        <p>Comprovantes ainda pendentes de parcelas que já constam como pagas. Rejeitar aqui só tira o comprovante da fila (com o motivo registrado); <b>não altera saldo, parcela nem contrato</b>. Casos de valor divergente ou análise manual devem ser conferidos um a um.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {['ALL', ...Object.keys(LABEL)].filter(k => k === 'ALL' || counts[k]).map(k => (
          <button key={k} type="button" onClick={() => { setFilter(k); setSelected(new Set()); }}
            className={`min-h-[40px] px-3 rounded-lg text-sm ${filter === k ? 'bg-[#D4AF37] text-black font-bold' : 'bg-zinc-900 text-zinc-300 border border-zinc-800'}`}>
            {k === 'ALL' ? `Todos (${items.length})` : `${LABEL[k]} (${counts[k]})`}
          </button>
        ))}
        <button type="button" onClick={load} aria-label="Atualizar" className="min-h-[40px] px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300"><RefreshCw size={16} /></button>
      </div>

      {selectedItems.length > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-xl bg-zinc-900 border border-zinc-700 p-3">
          <span className="text-sm text-white">{selectedItems.length} selecionado(s)</span>
          <Button size="sm" variant="danger" isLoading={busy} onClick={() => reject(selectedItems)}>Rejeitar selecionados</Button>
        </div>
      )}

      {visible.length === 0 ? <p className="text-zinc-500 p-6 text-center">Nada para conciliar neste filtro.</p> : (
        <ul className="space-y-2">
          {visible.map(i => {
            const eligible = BATCH_ELIGIBLE.has(i.classification);
            return (
              <li key={i.receiptId} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                <div className="flex items-start gap-3">
                  <input type="checkbox" disabled={!eligible} checked={selected.has(i.receiptId)}
                    onChange={e => setSelected(s => { const n = new Set(s); e.target.checked ? n.add(i.receiptId) : n.delete(i.receiptId); return n; })}
                    aria-label={eligible ? `Selecionar comprovante de ${i.customerName}` : 'Não elegível para lote'}
                    title={eligible ? '' : 'Só "Já conciliado" e "Possível duplicidade" podem ir em lote'}
                    className="mt-1 h-5 w-5 shrink-0 accent-[#D4AF37] disabled:opacity-30" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-white break-words">{i.customerName || '—'}</p>
                      <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-[#D4AF37]">{LABEL[i.classification] || i.classification}</span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">{i.reason}</p>
                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs">
                      <p className="text-zinc-500">Comprovante<br /><span className="text-white font-semibold">{fmt(i.receiptAmount)}</span></p>
                      <p className="text-zinc-500">Parcela<br /><span className="text-white font-semibold">{fmt(i.installmentAmount)}</span></p>
                      <p className="text-zinc-500">Já aprovado na parcela<br /><span className="text-white font-semibold">{fmt(i.approvedOnInstallment)}</span></p>
                      <p className="text-zinc-500">Enviado / baixa<br /><span className="text-white">{fmtDate(i.submittedAt)} / {fmtDate(i.installmentPaidAt)}</span></p>
                    </div>
                    <p className="text-[11px] text-zinc-600 mt-1">Contrato {i.loanId.slice(0, 8)} · {i.loanStatus}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {i.receiptUrl && <a href={i.receiptUrl} target="_blank" rel="noopener noreferrer" className="min-h-[40px] inline-flex items-center gap-1 rounded-lg bg-zinc-800 px-3 text-xs text-zinc-200"><ExternalLink size={14} /> Ver comprovante</a>}
                  <a href={`#/admin/contracts?loan=${i.loanId}`} className="min-h-[40px] inline-flex items-center rounded-lg bg-zinc-800 px-3 text-xs text-zinc-200">Abrir contrato</a>
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => reject([i])}>Rejeitar com motivo</Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
