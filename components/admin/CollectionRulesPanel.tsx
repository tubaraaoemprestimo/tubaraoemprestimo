import React, { useEffect, useState } from 'react';
import { Settings, CalendarClock, Send, AlertTriangle, Save } from 'lucide-react';
import { api } from '../../services/apiClient';

// Configuração da régua (liga/desliga, dias de antecedência, hora, template por dia),
// mensagens programadas (com motivo quando não sairão) e histórico de envios/falhas.

type Rules = { enabled: boolean; reminderDays: number[]; sendHour: number; templates: Record<string, string> };
type Scheduled = { sendOn: string; dueDate: string; trigger: string; daysBefore: number; amount: number; loanId: string; customerName: string; whatsapp: boolean; status: string; reason: string | null };
type Dispatch = { id: string; createdAt: string; triggerEvent: string; dueDate: string; status: string; error: string | null; attempts: number; customerName: string | null; loanId: string; channels: any };

const TRIGGER_LABEL = (t: string) => {
  const m = t.match(/^INSTALLMENT_DUE_(\d+)_DAYS$/); if (m) return `${m[1]} dias antes`;
  if (t === 'INSTALLMENT_DUE_TODAY') return 'Vence hoje';
  const o = t.match(/^INSTALLMENT_OVERDUE_(\d+)_DAYS?$/); if (o) return `${o[1]} dia(s) de atraso`;
  return t;
};
const fmtD = (s: string) => new Date(s).toLocaleDateString('pt-BR');
const card = 'bg-zinc-900 border border-zinc-800 rounded-xl p-4';
const btn = 'inline-flex items-center justify-center gap-2 rounded-lg px-4 min-h-[44px] font-semibold disabled:opacity-50';
const CHOICES = [10, 7, 5, 3, 2, 1];

export function CollectionRulesPanel() {
  const [rules, setRules] = useState<Rules | null>(null);
  const [templates, setTemplates] = useState<{ triggerEvent: string; channel: string; name: string }[]>([]);
  const [waConnected, setWaConnected] = useState(false);
  const [scheduled, setScheduled] = useState<Scheduled[]>([]);
  const [dispatches, setDispatches] = useState<{ items: Dispatch[]; byStatus: Record<string, number> }>({ items: [], byStatus: {} });
  const [dispFilter, setDispFilter] = useState('');
  const [tab, setTab] = useState<'config' | 'scheduled' | 'history'>('config');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    const r = await api.get<any>('/collection-automation/rules');
    if (r.data) { setRules(r.data.rules); setTemplates(r.data.templates); setWaConnected(r.data.whatsappConnected); }
    const s = await api.get<any>('/collection-automation/scheduled?days=7');
    if (s.data) setScheduled(s.data.items);
  };
  const loadDispatches = async () => {
    const d = await api.get<any>(`/collection-automation/dispatches?limit=100${dispFilter ? `&status=${dispFilter}` : ''}`);
    if (d.data) setDispatches(d.data);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { loadDispatches(); }, [dispFilter]);

  const save = async () => {
    if (!rules) return;
    setSaving(true);
    const { data, error } = await api.put<any>('/collection-automation/rules', rules);
    setSaving(false);
    setMsg(error ? (error.error || 'Erro ao salvar') : 'Regras salvas. Valem a partir da próxima rodada.');
    if (data) { setRules(data.rules); load(); }
  };

  const toggleDay = (d: number) => rules && setRules({ ...rules, reminderDays: rules.reminderDays.includes(d) ? rules.reminderDays.filter(x => x !== d) : [...rules.reminderDays, d].sort((a, b) => b - a) });
  const reminderTriggers = () => [...new Set(templates.map(t => t.triggerEvent))].filter(t => t.startsWith('INSTALLMENT_DUE_') && t !== 'INSTALLMENT_DUE_TODAY');
  const hasTemplate = (t: string) => templates.some(x => x.triggerEvent === t);

  if (!rules) return <div className={card}>Carregando configuração da régua…</div>;
  const willSend = scheduled.filter(s => s.status === 'PROGRAMADA').length;

  return (
    <section className="space-y-4" aria-label="Configuração da régua">
      <div className="flex gap-2 overflow-x-auto" role="tablist">
        {([['config', 'Configuração', Settings], ['scheduled', `Programadas (${willSend})`, CalendarClock], ['history', 'Enviadas e falhas', Send]] as const).map(([k, label, Icon]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`${btn} shrink-0 ${tab === k ? 'bg-[#D4AF37] text-black' : 'bg-zinc-800 text-zinc-200'}`}><Icon size={16} /> {label}</button>
        ))}
      </div>
      {msg && <p role="status" className="text-sm text-green-300">{msg}</p>}

      {tab === 'config' && (
        <div className={`${card} space-y-4`}>
          <label className="flex items-center justify-between gap-3">
            <span><b>Régua automática</b><span className="block text-sm text-zinc-400">Desligada: nenhuma mensagem automática sai (multas e juros continuam sendo calculados).</span></span>
            <input type="checkbox" className="w-6 h-6" checked={rules.enabled} onChange={e => setRules({ ...rules, enabled: e.target.checked })} aria-label="Régua automática ligada" />
          </label>
          {!waConnected && <p className="flex items-center gap-2 text-sm text-amber-300"><AlertTriangle size={16} /> WhatsApp desconectado: lembretes saem só por e-mail/app.</p>}
          <div>
            <b>Lembretes antes do vencimento</b>
            <div className="flex flex-wrap gap-2 mt-2">
              {CHOICES.map(d => (
                <button key={d} type="button" aria-pressed={rules.reminderDays.includes(d)} onClick={() => toggleDay(d)}
                  className={`${btn} ${rules.reminderDays.includes(d) ? 'bg-[#D4AF37] text-black' : 'bg-zinc-800 text-zinc-300'}`}>{d} dias</button>
              ))}
            </div>
          </div>
          {rules.reminderDays.map(d => {
            const current = rules.templates[String(d)] || `INSTALLMENT_DUE_${d}_DAYS`;
            const opts = [...new Set([`INSTALLMENT_DUE_${d}_DAYS`, ...reminderTriggers()])];
            return (
              <label key={d} className="block text-sm">Mensagem do aviso de {d} dias
                <select className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 min-h-[44px] mt-1" value={current}
                  onChange={e => setRules({ ...rules, templates: { ...rules.templates, [String(d)]: e.target.value } })}>
                  {opts.map(t => <option key={t} value={t}>{TRIGGER_LABEL(t)} ({t}){hasTemplate(t) ? '' : ' — sem template cadastrado'}</option>)}
                </select>
                {!hasTemplate(current) && <span className="text-xs text-red-300">Sem template ativo: este aviso não sai.</span>}
              </label>
            );
          })}
          <label className="block text-sm">Horário da rodada diária (Brasília)
            <select className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 min-h-[44px] mt-1" value={rules.sendHour} onChange={e => setRules({ ...rules, sendHour: Number(e.target.value) })}>
              {Array.from({ length: 14 }, (_, i) => i + 7).map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}h</option>)}
            </select>
          </label>
          <p className="text-xs text-zinc-500">Cada contrato recebe no máximo 1 cobrança de atraso por dia e cada lembrete sai uma única vez por vencimento. Não envia para contratos quitados, com saldo zero, saldo antigo não conferido, mensagens pausadas, pagamento aguardando conferência ou cliente que pediu para não receber WhatsApp.</p>
          <button onClick={save} disabled={saving} className={`${btn} w-full bg-[#D4AF37] text-black`}><Save size={16} /> {saving ? 'Salvando…' : 'Salvar regras'}</button>
        </div>
      )}

      {tab === 'scheduled' && (
        <div className={`${card} space-y-2`}>
          <p className="text-sm text-zinc-400">Próximos 7 dias. Atrasos não aparecem aqui (dependem do pagamento até lá).</p>
          {scheduled.length === 0 && <p className="text-zinc-500 text-sm">Nada programado.</p>}
          {scheduled.map((s, i) => (
            <div key={i} className="flex flex-wrap justify-between gap-2 border-t border-zinc-800 pt-2 text-sm">
              <span><b>{fmtD(s.sendOn)}</b> · {TRIGGER_LABEL(s.trigger)} · {s.customerName} · vence {fmtD(s.dueDate)}</span>
              <span className={s.status === 'PROGRAMADA' ? 'text-green-400' : 'text-zinc-400'}>{s.status === 'PROGRAMADA' ? (s.whatsapp ? 'Programada' : 'Programada (sem WhatsApp)') : s.reason}</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'history' && (
        <div className={`${card} space-y-2`}>
          <div className="flex gap-2">
            {[['', `Todas`], ['SENT', `Enviadas (${dispatches.byStatus.SENT || 0})`], ['FAILED', `Falhas (${dispatches.byStatus.FAILED || 0})`]].map(([k, l]) => (
              <button key={k} onClick={() => setDispFilter(k)} aria-pressed={dispFilter === k} className={`${btn} text-sm ${dispFilter === k ? 'bg-[#D4AF37] text-black' : 'bg-zinc-800'}`}>{l}</button>
            ))}
          </div>
          {dispatches.items.length === 0 && <p className="text-zinc-500 text-sm">Nenhum envio registrado ainda (o registro começa a partir desta versão).</p>}
          {dispatches.items.map(d => (
            <div key={d.id} className="flex flex-wrap justify-between gap-2 border-t border-zinc-800 pt-2 text-sm">
              <span>{new Date(d.createdAt).toLocaleString('pt-BR')} · {TRIGGER_LABEL(d.triggerEvent)} · {d.customerName || d.loanId.slice(0, 8)}</span>
              <span className={d.status === 'SENT' ? 'text-green-400' : 'text-red-300'}>{d.status === 'SENT' ? `Enviada${d.channels?.whatsapp ? ' (WhatsApp)' : ''}` : `Falha: ${d.error}`}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
