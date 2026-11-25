import React, { useEffect, useState } from 'react';
import { UserPlus, Upload, Send, Copy, CheckCircle, FileText, RefreshCw, X, Search, PauseCircle, PlayCircle } from 'lucide-react';
import { api } from '../../services/apiClient';

// Clientes antigos: pré-cadastro por telefone, contrato legado (sem caixa) e convite de ativação.
// Nada aqui envia mensagem sozinho: o convite volta como texto/link para o admin mandar.

type Service = { code: string; label: string; active: boolean; kind?: string; note?: string };
type Match = { id: string; name: string; phone: string; cpfMasked: string | null; hasAccount: boolean; isLegacy: boolean; contracts: number; matchedBy: string };
type LegacyLoan = { id: string; status: string; remainingAmount: number; legacyBalanceConfirmed: boolean; collectionSuspended: boolean; messagesSuspended?: boolean; isLegacy?: boolean; nextPaymentDate: string | null; loanRequest?: { profileType?: string } };
type LegacyCustomer = { id: string; name: string; phone: string; activationStatus: string | null; whatsappOptOut: boolean; userId: string | null; joinedAt: string; loans: LegacyLoan[] };

const STATUS_LABEL: Record<string, string> = {
  PRE_CADASTRO: 'Pré-cadastro', CONVITE_ENVIADO: 'Convite gerado', CONTA_ATIVA: 'Conta ativa',
  TELEFONE_INVALIDO: 'Telefone inválido', SEM_CONTATO: 'Sem contato',
};
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const errMsg = (e: any) => (typeof e === 'string' ? e : e?.error || 'Erro inesperado');
const input = 'w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-base focus:border-[#D4AF37] outline-none';
const btn = 'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 font-semibold min-h-[44px] disabled:opacity-50';

const emptyContract = { serviceCode: '', amount: '', balance: '', paidAmount: '', installmentAmount: '', remainingInstallments: '1', nextDueDate: '', frequency: 'MONTHLY', interestRate: '', reference: '', originalDate: '', balanceConfirmed: false, notes: '' };

export function LegacyClients() {
  const [services, setServices] = useState<Service[]>([]);
  const [items, setItems] = useState<LegacyCustomer[]>([]);
  const [byStatus, setByStatus] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ phone: '', name: '', cpf: '', origin: '' });
  const [phoneConflict, setPhoneConflict] = useState(false);
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [regularize, setRegularize] = useState<{ name: string; phone: string; text: string; simulation: boolean } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [contractFor, setContractFor] = useState<LegacyCustomer | null>(null);
  const [contract, setContract] = useState(emptyContract);
  const [invite, setInvite] = useState<{ name: string; phone: string; text: string; link: string; simulation: boolean } | null>(null);
  const [showImport, setShowImport] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await api.get<any>(`/legacy-clients${filter ? `?status=${filter}` : ''}`);
    if (data) { setItems(data.items); setByStatus(data.byStatus || {}); }
    setLoading(false);
  };
  useEffect(() => { api.get<any>('/legacy-clients/services').then(r => r.data && setServices(r.data.services)); }, []);
  useEffect(() => { load(); }, [filter]);

  const lookup = async () => {
    setMsg(null);
    const { data, error } = await api.get<any>(`/legacy-clients/lookup?phone=${encodeURIComponent(form.phone)}&cpf=${encodeURIComponent(form.cpf)}`);
    if (error) { setMsg({ ok: false, text: errMsg(error) }); return; }
    setMatches(data.matches);
  };

  const createCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const { data, error } = await api.post<any>('/legacy-clients', { ...form, confirmSharedPhone: phoneConflict });
    if (error?.code === 'PHONE_IN_USE') { setPhoneConflict(true); setMsg({ ok: false, text: 'Já existe cliente com este telefone. Se for outra pessoa, clique em salvar de novo para confirmar.' }); return; }
    if (error) { setMsg({ ok: false, text: errMsg(error) }); return; }
    setMsg({ ok: true, text: `Cliente ${data.customer.name} pré-cadastrado. Agora registre o contrato antigo.` });
    setContractFor({ id: data.customer.id, name: data.customer.name, phone: data.customer.phone, activationStatus: 'PRE_CADASTRO', whatsappOptOut: false, userId: null, joinedAt: '', loans: [] });
    setContract(emptyContract);
    setMatches(null);
    setForm({ phone: '', name: '', cpf: '', origin: '' });
    setPhoneConflict(false);
    load();
  };

  const saveContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractFor) return;
    const { error } = await api.post<any>(`/legacy-clients/${contractFor.id}/contracts`, contract);
    if (error) { setMsg({ ok: false, text: errMsg(error) }); return; }
    setMsg({ ok: true, text: contract.balanceConfirmed || Number(contract.balance) === 0 ? 'Contrato antigo registrado.' : 'Contrato registrado com cobrança SUSPENSA até você confirmar o saldo.' });
    setContractFor(null); setContract(emptyContract); load();
  };

  const confirmBalance = async (loanId: string) => {
    if (!window.confirm('Confirma que o saldo deste contrato foi conferido? A partir daí ele entra na régua de cobrança.')) return;
    const { error } = await api.patch<any>(`/legacy-clients/contracts/${loanId}/collection`, { confirmBalance: true });
    setMsg(error ? { ok: false, text: errMsg(error) } : { ok: true, text: 'Saldo confirmado. Cobrança liberada.' });
    load();
  };

  const toggleMessages = async (l: LegacyLoan) => {
    const { error } = await api.patch<any>(`/collection-automation/loans/${l.id}/messages`, { suspended: !l.messagesSuspended });
    setMsg(error ? { ok: false, text: errMsg(error) } : { ok: true, text: l.messagesSuspended ? 'Mensagens automáticas retomadas.' : 'Mensagens automáticas pausadas neste contrato.' });
    load();
  };

  const makeRegularize = async (c: LegacyCustomer, l: LegacyLoan) => {
    const { data, error } = await api.post<any>(`/legacy-clients/contracts/${l.id}/regularize-message`, { send: true });
    if (error) { setMsg({ ok: false, text: errMsg(error) }); return; }
    setRegularize({ name: c.name, phone: data.phone || c.phone, text: data.text, simulation: data.simulation });
  };

  const makeInvite = async (c: LegacyCustomer) => {
    const { data, error } = await api.post<any>(`/legacy-clients/${c.id}/invite`, { send: true });
    if (error) { setMsg({ ok: false, text: errMsg(error) }); return; }
    setInvite({ name: c.name, phone: c.phone, ...data });
    load();
  };

  const selectedService = services.find(s => s.code === contract.serviceCode);
  const rollover = selectedService?.kind === 'ROLLOVER';
  const scheduleHint = (() => {
    const n = Number(contract.remainingInstallments), v = Number(contract.installmentAmount), b = Number(contract.balance);
    if (!n || !v || !b) return null;
    const total = n * v;
    return Math.abs(total - b) <= 0.01 * n ? { ok: true, text: `${n} × ${brl(v)} = ${brl(total)} (confere com o saldo)` } : { ok: false, text: `${n} × ${brl(v)} = ${brl(total)} — precisa somar o saldo ${brl(b)}` };
  })();

  const counters = [['', 'Todos', Object.values(byStatus).reduce((a, b) => a + b, 0)], ...Object.keys(STATUS_LABEL).map(k => [k, STATUS_LABEL[k], byStatus[k] || 0])] as [string, string, number][];

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto text-white space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Clientes Antigos</h1>
          <p className="text-zinc-400 text-sm">Traga para a plataforma quem já era cliente antes do app: cadastro pelo telefone, contrato antigo e convite para ativar a conta.</p>
        </div>
        <button onClick={() => setShowImport(true)} className={`${btn} bg-zinc-800 hover:bg-zinc-700`}><Upload size={18} /> Importar planilha</button>
      </header>

      {msg && (
        <div role="status" className={`rounded-lg p-3 text-sm flex justify-between gap-2 ${msg.ok ? 'bg-green-900/40 text-green-200' : 'bg-red-900/40 text-red-200'}`}>
          <span>{msg.text}</span><button aria-label="Fechar aviso" onClick={() => setMsg(null)}><X size={16} /></button>
        </div>
      )}

      <section aria-label="Resumo" className="flex gap-2 overflow-x-auto pb-1">
        {counters.map(([k, label, n]) => (
          <button key={k || 'all'} onClick={() => setFilter(k)} aria-pressed={filter === k}
            className={`shrink-0 rounded-xl px-4 py-2 text-left border ${filter === k ? 'border-[#D4AF37] bg-[#D4AF37]/10' : 'border-zinc-800 bg-zinc-900'}`}>
            <div className="text-xl font-bold">{n}</div><div className="text-xs text-zinc-400">{label}</div>
          </button>
        ))}
      </section>

      <form onSubmit={createCustomer} className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 grid gap-3 md:grid-cols-4">
        <h2 className="md:col-span-4 font-semibold flex items-center gap-2"><UserPlus size={18} className="text-[#D4AF37]" /> Novo cliente antigo</h2>
        <label className="text-sm">Telefone (WhatsApp) *<input required inputMode="tel" className={input} value={form.phone} onChange={e => { setForm({ ...form, phone: e.target.value }); setPhoneConflict(false); }} placeholder="(11) 98765-4321" /></label>
        <label className="text-sm">Nome<input className={input} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
        <label className="text-sm">CPF (se tiver)<input inputMode="numeric" className={input} value={form.cpf} onChange={e => setForm({ ...form, cpf: e.target.value })} /></label>
        <label className="text-sm">Origem<input className={input} value={form.origin} onChange={e => setForm({ ...form, origin: e.target.value })} placeholder="Ex.: caderno, indicação" /></label>
        <div className="md:col-span-4 flex flex-col sm:flex-row gap-2">
          <button type="button" onClick={lookup} disabled={!form.phone && !form.cpf} className={`${btn} bg-zinc-800 hover:bg-zinc-700`}><Search size={18} /> Consultar se já existe</button>
          <button className={`${btn} flex-1 bg-[#D4AF37] text-black hover:bg-[#c9a432]`}>{phoneConflict ? 'Confirmar: é outra pessoa' : 'Salvar e registrar contrato'}</button>
        </div>
        {matches && (
          <div className="md:col-span-4 text-sm bg-zinc-950 border border-zinc-800 rounded-lg p-3 space-y-2" role="status">
            {matches.length === 0 ? <p className="text-green-300">Nenhum cadastro com este telefone/CPF. Pode cadastrar.</p> : <>
              <p className="text-amber-300">Já existe cadastro. Se for a mesma pessoa, registre o contrato antigo nele (não crie outro):</p>
              {matches.map(m => (
                <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800 pt-2">
                  <span>{m.name} · {m.phone}{m.cpfMasked ? ` · CPF ${m.cpfMasked}` : ''} · {m.contracts} contrato(s){m.hasAccount ? ' · tem conta no app' : ''}</span>
                  <button type="button" onClick={() => { setContractFor({ id: m.id, name: m.name, phone: m.phone, activationStatus: null, whatsappOptOut: false, userId: m.hasAccount ? 'x' : null, joinedAt: '', loans: [] }); setContract(emptyContract); }} className={`${btn} bg-zinc-800 text-sm`}><FileText size={16} /> Registrar contrato neste cliente</button>
                </div>))}
            </>}
          </div>
        )}
      </form>

      <section className="space-y-3" aria-busy={loading}>
        <div className="flex items-center justify-between"><h2 className="font-semibold">Cadastrados</h2>
          <button onClick={load} aria-label="Atualizar lista" className="text-zinc-400 hover:text-white p-2"><RefreshCw size={18} className={loading ? 'animate-spin' : ''} /></button></div>
        {!loading && items.length === 0 && <p className="text-zinc-500 text-sm">Nenhum cliente antigo {filter ? 'neste filtro' : 'cadastrado ainda'}.</p>}
        {items.map(c => (
          <article key={c.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap justify-between gap-2">
              <div><div className="font-semibold">{c.name}</div><div className="text-sm text-zinc-400">{c.phone}</div></div>
              <span className="text-xs rounded-full px-3 py-1 bg-zinc-800 h-fit">{STATUS_LABEL[c.activationStatus || ''] || '—'}{c.whatsappOptOut ? ' · sem WhatsApp' : ''}</span>
            </div>
            {c.loans.map(l => (
              <div key={l.id} className="text-sm border-t border-zinc-800 pt-2 flex flex-wrap items-center justify-between gap-2">
                <span><FileText size={14} className="inline mr-1 text-zinc-500" />{services.find(s => s.code === l.loanRequest?.profileType)?.label || l.loanRequest?.profileType}
                  {' · '}{l.status === 'COMPLETED' ? 'Quitado' : `Saldo ${brl(l.remainingAmount)}`}
                  {l.nextPaymentDate && l.status !== 'COMPLETED' ? ` · vence ${new Date(l.nextPaymentDate).toLocaleDateString('pt-BR')}` : ''}</span>
                {l.status === 'ACTIVE' && (l.collectionSuspended
                  ? <button onClick={() => confirmBalance(l.id)} className="text-amber-300 underline min-h-[44px]">Cobrança suspensa — confirmar saldo</button>
                  : <span className="flex flex-wrap items-center gap-2">
                      <span className={`flex items-center gap-1 ${l.messagesSuspended ? 'text-zinc-400' : 'text-green-400'}`}><CheckCircle size={14} /> {l.messagesSuspended ? 'Mensagens pausadas' : 'Na régua'}</span>
                      <button onClick={() => toggleMessages(l)} className="text-zinc-300 underline min-h-[44px] inline-flex items-center gap-1">{l.messagesSuspended ? <><PlayCircle size={14} /> Retomar</> : <><PauseCircle size={14} /> Pausar mensagens</>}</button>
                      {!l.messagesSuspended && !c.whatsappOptOut && <button onClick={() => makeRegularize(c, l)} className="text-[#D4AF37] underline min-h-[44px]">Consultar/regularizar</button>}
                    </span>)}
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <button onClick={() => { setContractFor(c); setContract(emptyContract); }} className={`${btn} bg-zinc-800 hover:bg-zinc-700 text-sm`}><FileText size={16} /> Registrar contrato antigo</button>
              {!c.userId && <button onClick={() => makeInvite(c)} className={`${btn} bg-green-700 hover:bg-green-600 text-sm`}><Send size={16} /> Gerar convite</button>}
            </div>
          </article>
        ))}
      </section>

      {contractFor && (
        <Modal title={`Contrato antigo — ${contractFor.name}`} onClose={() => setContractFor(null)}>
          <form onSubmit={saveContract} className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2">Serviço contratado *
              <select required className={input} value={contract.serviceCode} onChange={e => setContract({ ...contract, serviceCode: e.target.value })}>
                <option value="">Selecione…</option>
                {services.map(s => <option key={s.code} value={s.code} disabled={s.kind === 'UNSUPPORTED'}>{s.label}{s.active ? '' : ' (inativo)'}{s.kind === 'UNSUPPORTED' ? ' — ainda não suportado' : ''}</option>)}
              </select>
              {selectedService?.note && <span className="block text-xs text-zinc-400 mt-1">{selectedService.note}</span>}</label>
            <Num label="Valor contratado *" v={contract.amount} set={v => setContract({ ...contract, amount: v })} required />
            <Num label="Saldo em aberto * (0 = quitado)" v={contract.balance} set={v => setContract({ ...contract, balance: v })} required />
            <Num label="Já pago (informativo)" v={contract.paidAmount} set={v => setContract({ ...contract, paidAmount: v })} />
            <Num label={rollover ? 'Juros do mês (valor)' : 'Valor de cada parcela'} v={contract.installmentAmount} set={v => setContract({ ...contract, installmentAmount: v })} />
            {!rollover && <label className="text-sm">Parcelas restantes<input type="number" min="1" max="360" inputMode="numeric" className={input} value={contract.remainingInstallments} onChange={e => setContract({ ...contract, remainingInstallments: e.target.value })} />
              {scheduleHint && <span className={`block text-xs mt-1 ${scheduleHint.ok ? 'text-zinc-400' : 'text-red-300'}`}>{scheduleHint.text}</span>}</label>}
            <label className="text-sm">{rollover ? 'Vencimento dos juros' : 'Vencimento da próxima parcela'}<input type="date" className={input} value={contract.nextDueDate} onChange={e => setContract({ ...contract, nextDueDate: e.target.value })} /></label>
            <label className="text-sm">Periodicidade<select className={input} value={contract.frequency} onChange={e => setContract({ ...contract, frequency: e.target.value })}>
              <option value="MONTHLY">Mensal</option><option value="WEEKLY">Semanal</option><option value="DAILY">Diária</option></select></label>
            <Num label="Taxa de juros ao mês (%)" v={contract.interestRate} set={v => setContract({ ...contract, interestRate: v })} />
            <label className="text-sm">Data do contrato original<input type="date" className={input} value={contract.originalDate} onChange={e => setContract({ ...contract, originalDate: e.target.value })} /></label>
            <label className="text-sm sm:col-span-2">Referência (nº/identificação do contrato antigo — evita duplicar)<input className={input} value={contract.reference} onChange={e => setContract({ ...contract, reference: e.target.value })} /></label>
            <label className="text-sm sm:col-span-2">Observações<textarea className={input} rows={2} value={contract.notes} onChange={e => setContract({ ...contract, notes: e.target.value })} /></label>
            <label className="sm:col-span-2 flex items-start gap-2 text-sm bg-zinc-800/60 rounded-lg p-3">
              <input type="checkbox" className="mt-1 w-5 h-5" checked={contract.balanceConfirmed} onChange={e => setContract({ ...contract, balanceConfirmed: e.target.checked })} />
              <span>Conferi o saldo com o cliente. <span className="text-zinc-400">Sem esta marca, o contrato fica registrado mas a cobrança automática fica suspensa.</span></span>
            </label>
            <p className="sm:col-span-2 text-xs text-zinc-500">Contrato antigo não gera saída de caixa nem receita: só registra o que o cliente ainda deve. Juros e multas daqui pra frente seguem as regras atuais.</p>
            <button className={`${btn} sm:col-span-2 bg-[#D4AF37] text-black`}>Salvar contrato</button>
          </form>
        </Modal>
      )}

      {invite && <InviteModal invite={invite} onClose={() => setInvite(null)} />}
      {regularize && <InviteModal invite={{ ...regularize, link: '' }} title="Mensagem de regularização" onClose={() => setRegularize(null)} />}
      {showImport && <ImportModal services={services} onClose={() => { setShowImport(false); load(); }} />}
    </div>
  );
}

function Num({ label, v, set, required }: { label: string; v: string; set: (v: string) => void; required?: boolean }) {
  return <label className="text-sm">{label}<input required={required} type="number" step="0.01" min="0" inputMode="decimal" className={input} value={v} onChange={e => set(e.target.value)} /></label>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-zinc-950 border border-zinc-800 w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-4 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center"><h3 className="font-bold text-lg">{title}</h3><button aria-label="Fechar" onClick={onClose} className="p-2"><X /></button></div>
        {children}
      </div>
    </div>
  );
}

function InviteModal({ invite, onClose, title = 'Convite' }: { invite: { name: string; phone: string; text: string; link: string; simulation: boolean }; onClose: () => void; title?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(invite.text); setCopied(true); } catch { /* sem permissão de área de transferência */ } };
  const wa = `https://wa.me/${invite.phone.replace(/\D/g, '')}?text=${encodeURIComponent(invite.text)}`;
  return (
    <Modal title={`${title} — ${invite.name}`} onClose={onClose}>
      <p className="text-sm text-zinc-400">{invite.simulation ? 'Envio automático desligado: mande você mesmo pelo WhatsApp.' : 'Mensagem enviada pelo WhatsApp da empresa.'}{invite.link ? ' O link vale 7 dias, serve uma vez e gerar outro cancela este.' : ' A mensagem não leva valores nem dados pessoais: o cliente vê os detalhes ao entrar no app.'}</p>
      <pre className="whitespace-pre-wrap bg-zinc-900 rounded-lg p-3 text-sm">{invite.text}</pre>
      <div className="flex flex-wrap gap-2">
        <button onClick={copy} className={`${btn} bg-zinc-800`}><Copy size={16} /> {copied ? 'Copiado' : 'Copiar mensagem'}</button>
        <a href={wa} target="_blank" rel="noopener noreferrer" className={`${btn} bg-green-700`}><Send size={16} /> Abrir no WhatsApp</a>
      </div>
    </Modal>
  );
}

// Importação: CSV (Excel → "Salvar como CSV"). Pré-visualiza, valida e só grava ao confirmar. Não envia mensagens.
const COLS = ['telefone', 'nome', 'cpf', 'servico', 'valor', 'saldo', 'valor_cobranca', 'vencimento', 'referencia'] as const;
type Row = Record<(typeof COLS)[number], string> & { _line: number; _problem?: string; _result?: string };

const toNumber = (s: string) => (s ? Number(s.replace(/[R$\s.]/g, '').replace(',', '.')) : NaN);
const toIsoDate = (s: string) => { const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : s; };

function parseCsv(text: string, services: Service[]): Row[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];
  const sep = lines[0].includes(';') ? ';' : ',';
  const header = lines[0].split(sep).map(h => h.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''));
  return lines.slice(1).map((line, i) => {
    const cells = line.split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
    const row = { _line: i + 2 } as Row;
    COLS.forEach(c => { const idx = header.indexOf(c); row[c] = idx >= 0 ? cells[idx] || '' : ''; });
    const digits = row.telefone.replace(/\D/g, '');
    if (digits.length < 10) row._problem = 'telefone inválido';
    else if (row.servico && !services.some(s => s.code === row.servico.toUpperCase())) row._problem = 'serviço não existe no catálogo';
    else if (row.servico && (isNaN(toNumber(row.valor)) || isNaN(toNumber(row.saldo)))) row._problem = 'valor/saldo inválido';
    else if (row.servico && toNumber(row.saldo) > 0 && (!row.vencimento || isNaN(toNumber(row.valor_cobranca)))) row._problem = 'saldo sem vencimento/valor da cobrança';
    return row;
  });
}

function ImportModal({ services, onClose }: { services: Service[]; onClose: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const valid = rows.filter(r => !r._problem && !r._result);

  const onFile = async (f?: File) => { if (f) setRows(parseCsv(await f.text(), services)); };
  const run = async () => {
    if (!window.confirm(`Importar ${valid.length} linha(s)? Contratos entram com cobrança SUSPENSA até você confirmar cada saldo. Nenhuma mensagem será enviada.`)) return;
    setRunning(true);
    const next = [...rows];
    for (const r of next) {
      if (r._problem || r._result) continue;
      const c = await api.post<any>('/legacy-clients', { phone: r.telefone, name: r.nome, cpf: r.cpf, origin: 'Importação de planilha' });
      if (c.error) { r._result = `não importado: ${errMsg(c.error)}`; setRows([...next]); continue; }
      if (r.servico) {
        const k = await api.post<any>(`/legacy-clients/${c.data.customer.id}/contracts`, {
          serviceCode: r.servico.toUpperCase(), amount: toNumber(r.valor), balance: toNumber(r.saldo),
          installmentAmount: toNumber(r.valor_cobranca) || undefined, nextDueDate: toIsoDate(r.vencimento) || undefined,
          reference: r.referencia || undefined, balanceConfirmed: false,
        });
        r._result = k.error ? `cliente criado; contrato não: ${errMsg(k.error)}` : 'importado';
      } else r._result = 'importado (sem contrato)';
      setRows([...next]);
    }
    setRunning(false);
  };

  return (
    <Modal title="Importar clientes antigos" onClose={running ? () => {} : onClose}>
      <p className="text-sm text-zinc-400">Planilha em CSV com cabeçalho: <code className="text-zinc-200 break-all">{COLS.join(';')}</code>. Só telefone é obrigatório. Serviço usa o código do catálogo ({services.map(s => s.code).join(', ')}). Datas em dd/mm/aaaa.</p>
      <input type="file" accept=".csv,text/csv" onChange={e => onFile(e.target.files?.[0])} className="text-sm" aria-label="Arquivo CSV" />
      {rows.length > 0 && (
        <>
          <p className="text-sm">{rows.length} linha(s): <b className="text-green-400">{rows.filter(r => !r._problem).length} válidas</b>, <b className="text-red-400">{rows.filter(r => r._problem).length} com problema</b> (não serão importadas).</p>
          <div className="overflow-x-auto max-h-72 border border-zinc-800 rounded-lg">
            <table className="text-xs w-full"><thead className="bg-zinc-900 sticky top-0"><tr><th className="p-2 text-left">Linha</th><th className="p-2 text-left">Telefone</th><th className="p-2 text-left">Nome</th><th className="p-2 text-left">Serviço</th><th className="p-2 text-left">Saldo</th><th className="p-2 text-left">Situação</th></tr></thead>
              <tbody>{rows.map(r => (
                <tr key={r._line} className="border-t border-zinc-800">
                  <td className="p-2">{r._line}</td><td className="p-2">{r.telefone}</td><td className="p-2">{r.nome}</td><td className="p-2">{r.servico}</td><td className="p-2">{r.saldo}</td>
                  <td className={`p-2 ${r._problem ? 'text-red-400' : r._result?.startsWith('importado') ? 'text-green-400' : r._result ? 'text-amber-300' : ''}`}>{r._problem || r._result || 'pronta'}</td>
                </tr>))}</tbody></table>
          </div>
          <button disabled={running || !valid.length} onClick={run} className={`${btn} w-full bg-[#D4AF37] text-black`}>{running ? 'Importando…' : `Importar ${valid.length} linha(s)`}</button>
        </>
      )}
    </Modal>
  );
}
