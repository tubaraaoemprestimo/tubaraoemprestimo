import React, { useEffect, useState } from 'react';
import { UserPlus, Upload, Send, Copy, CheckCircle, FileText, RefreshCw, X, Search, PauseCircle, PlayCircle, Smartphone, TrendingUp, Scale, ChevronLeft, ChevronRight, Settings2 } from 'lucide-react';
import { api } from '../../services/apiClient';

// Clientes antigos em 3 etapas (cliente → serviço → conferência), painel com números reais,
// contestações e automações de WhatsApp. Nada aqui dispara mensagem em massa.

type Service = { code: string; label: string; active: boolean; kind?: string; note?: string };
type Match = { id: string; name: string; phone: string; cpfMasked: string | null; hasAccount: boolean; isLegacy: boolean; contracts: number; matchedBy: string };
type LegacyLoan = { id: string; status: string; remainingAmount: number; legacyBalanceConfirmed: boolean; collectionSuspended: boolean; messagesSuspended?: boolean; isLegacy?: boolean; nextPaymentDate: string | null; legacyDevice?: { brand: string | null; model: string | null } | null; disputes?: { id: string }[]; loanRequest?: { profileType?: string } };
type LegacyCustomer = { id: string; name: string; phone: string; activationStatus: string | null; whatsappOptOut: boolean; userId: string | null; joinedAt: string; loans: LegacyLoan[]; investments?: { id: string; amount: number; status: string; nextPayoutDate: string | null }[] };
type Picked = { id: string; name: string; phone: string; hasAccount: boolean };

const STATUS_LABEL: Record<string, string> = {
  PRE_CADASTRO: 'Pré-cadastro', CONVITE_ENVIADO: 'Convite gerado', CONTA_ATIVA: 'Conta ativa',
  TELEFONE_INVALIDO: 'Telefone inválido', SEM_CONTATO: 'Sem contato',
};
const DISPUTE_LABEL: Record<string, string> = { OPEN: 'Aberta', IN_REVIEW: 'Em análise', WAITING_DOCS: 'Aguardando documentação', RESOLVED: 'Resolvida' };
const brl = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const errMsg = (e: any) => (typeof e === 'string' ? e : e?.error || 'Erro inesperado');
const input = 'w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 min-h-[44px] py-2 text-white text-base focus:border-[#D4AF37] outline-none';
const btn = 'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 font-semibold min-h-[48px] disabled:opacity-50';

const emptyContract = { serviceCode: '', amount: '', balance: '', paidAmount: '', installmentAmount: '', remainingInstallments: '1', nextDueDate: '', frequency: 'MONTHLY', interestRate: '', reference: '', originalDate: '', balanceConfirmed: false, notes: '',
  brand: '', model: '', deviceIdentifier: '', originalPrice: '', downPayment: '', financedAmount: '', originalInstallments: '', paidInstallments: '', contractUrl: '', positionDate: '',
  yieldTerms: '', monthlyRate: '', payoutFrequency: 'MONTHLY', paidYieldsTotal: '', pendingConfirmed: '', nextPayoutDate: '', maturityDate: '', invStatus: 'ACTIVE' };

export function LegacyClients() {
  const [tab, setTab] = useState<'cadastro' | 'clientes' | 'contestacoes' | 'automacoes'>('cadastro');
  const [services, setServices] = useState<Service[]>([]);
  const [items, setItems] = useState<LegacyCustomer[]>([]);
  const [dash, setDash] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [invite, setInvite] = useState<{ name: string; phone: string; text: string; link: string; simulation: boolean } | null>(null);
  const [regularize, setRegularize] = useState<{ name: string; phone: string; text: string; simulation: boolean } | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [disputeFor, setDisputeFor] = useState<{ loanId: string; name: string } | null>(null);
  const [prefsFor, setPrefsFor] = useState<LegacyCustomer | null>(null);

  // Assistente
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ phone: '', name: '', cpf: '', origin: '' });
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [phoneConflict, setPhoneConflict] = useState(false);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [contract, setContract] = useState(emptyContract);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [l, d] = await Promise.all([api.get<any>('/legacy-clients'), api.get<any>('/legacy-ops/dashboard')]);
    if (l.data) setItems(l.data.items);
    if (d.data) setDash(d.data);
    setLoading(false);
  };
  useEffect(() => { api.get<any>('/legacy-clients/services').then(r => r.data && setServices(r.data.services)); load(); }, []);

  const set = (k: string, v: any) => setContract(c => ({ ...c, [k]: v }));
  const service = services.find(s => s.code === contract.serviceCode);
  const kind = service?.kind || '';
  const resetWizard = () => { setStep(1); setForm({ phone: '', name: '', cpf: '', origin: '' }); setMatches(null); setPicked(null); setContract(emptyContract); setPhoneConflict(false); };

  // Etapa 1
  const lookup = async () => {
    setMsg(null);
    const { data, error } = await api.get<any>(`/legacy-clients/lookup?phone=${encodeURIComponent(form.phone)}&cpf=${encodeURIComponent(form.cpf)}`);
    if (error) { setMsg({ ok: false, text: errMsg(error) }); return; }
    setMatches(data.matches);
  };
  const createAndNext = async () => {
    setMsg(null);
    const { data, error } = await api.post<any>('/legacy-clients', { ...form, confirmSharedPhone: phoneConflict });
    if (error?.code === 'PHONE_IN_USE') { setPhoneConflict(true); await lookup(); setMsg({ ok: false, text: 'Já existe cadastro com este telefone. Use o cadastro existente abaixo ou confirme que é outra pessoa.' }); return; }
    if (error) { setMsg({ ok: false, text: errMsg(error) }); return; }
    setPicked({ id: data.customer.id, name: data.customer.name, phone: data.customer.phone, hasAccount: false });
    setStep(2);
  };

  // Etapa 3 — salvar
  const save = async () => {
    if (!picked) return;
    setSaving(true); setMsg(null);
    const c = contract;
    let r: any;
    if (kind === 'INVESTMENT') {
      r = await api.post<any>(`/legacy-ops/customers/${picked.id}/investments`, { amount: c.amount, originalDate: c.originalDate, yieldTerms: c.yieldTerms, monthlyRate: c.monthlyRate, payoutFrequency: c.payoutFrequency, paidYieldsTotal: c.paidYieldsTotal, pendingConfirmed: c.pendingConfirmed, nextPayoutDate: c.nextPayoutDate, maturityDate: c.maturityDate, status: c.invStatus, reference: c.reference, contractUrl: c.contractUrl, notes: c.notes });
    } else if (kind === 'DEVICE') {
      r = await api.post<any>(`/legacy-ops/customers/${picked.id}/devices`, { ...c, balance: c.balance, monthlyRate: c.interestRate, originalSaleDate: c.originalDate });
    } else {
      r = await api.post<any>(`/legacy-clients/${picked.id}/contracts`, c);
    }
    setSaving(false);
    if (r.error) { setMsg({ ok: false, text: errMsg(r.error) }); return; }
    const pendingNote = r.data?.missing?.length ? ` Pendente de conferência (falta: ${r.data.missing.join(', ')}).` : r.data?.loan?.collectionSuspended ? ' Cobrança suspensa até você conferir o saldo.' : '';
    setMsg({ ok: true, text: `${kind === 'INVESTMENT' ? 'Investimento' : 'Contrato'} antigo salvo para ${picked.name}.${pendingNote}` });
    setStep(4);
    load();
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
  const makeRegularize = async (c: { name: string; phone: string }, l: { id: string }) => {
    const { data, error } = await api.post<any>(`/legacy-clients/contracts/${l.id}/regularize-message`, { send: true });
    if (error) { setMsg({ ok: false, text: errMsg(error) }); return; }
    setRegularize({ name: c.name, phone: data.phone || c.phone, text: data.text, simulation: data.simulation && !data.whatsappSent });
  };
  const makeInvite = async (c: { id: string; name: string; phone: string }) => {
    const { data, error } = await api.post<any>(`/legacy-clients/${c.id}/invite`, { send: true });
    if (error) { setMsg({ ok: false, text: errMsg(error) }); return; }
    setInvite({ name: c.name, phone: c.phone, ...data, simulation: !data.whatsappSent });
    load();
  };

  const cards: [string, number | undefined, string?][] = dash ? [
    ['Clientes antigos', dash.total], ['Com conta ativa', dash.withAccount], ['Aguardando ativação', dash.waiting], ['Convites gerados', dash.invitesSent],
    ['Contratos ativos', dash.activeLoans], ['Contratos quitados', dash.settledLoans], ['Celulares antigos', dash.devices], ['Investimentos antigos', dash.investments],
    ['Pendentes de conferência', dash.pendingReview, 'text-amber-300'], ['Contestações abertas', dash.openDisputes, 'text-amber-300'], ['Comunicação suspensa', dash.suspendedComm],
    ['Lembretes (7 dias)', dash.remindersScheduled], ['Enviadas (30 dias)', dash.sent30, 'text-green-400'], ['Falhas (30 dias)', dash.failed30, 'text-red-300'],
  ] : [];

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto text-white space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#D4AF37]">Clientes Antigos</h1>
          <p className="text-zinc-400 text-sm">Traga para o app quem já era cliente: contrato, celular, investimento, cobrança e ativação da conta.</p>
        </div>
        <button onClick={() => setShowImport(true)} className={`${btn} bg-zinc-800 hover:bg-zinc-700`}><Upload size={18} /> Importar planilha</button>
      </header>

      {msg && (
        <div role="status" className={`rounded-lg p-3 text-sm flex justify-between gap-2 ${msg.ok ? 'bg-green-900/40 text-green-200' : 'bg-red-900/40 text-red-200'}`}>
          <span>{msg.text}</span><button aria-label="Fechar aviso" onClick={() => setMsg(null)}><X size={16} /></button>
        </div>
      )}

      <section aria-label="Painel" className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {cards.map(([label, n, color]) => (
          <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2"><div className={`text-xl font-bold ${color || ''}`}>{n ?? 0}</div><div className="text-xs text-zinc-400">{label}</div></div>
        ))}
      </section>

      <div className="flex gap-2 overflow-x-auto" role="tablist">
        {([['cadastro', 'Cadastrar', UserPlus], ['clientes', 'Cadastrados', FileText], ['contestacoes', 'Contestações', Scale], ['automacoes', 'Automações WhatsApp', Settings2]] as const).map(([k, l, Icon]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`${btn} shrink-0 ${tab === k ? 'bg-[#D4AF37] text-black' : 'bg-zinc-800'}`}><Icon size={16} /> {l}</button>
        ))}
      </div>

      {tab === 'cadastro' && (
        <section className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-4">
          <ol className="flex gap-2 text-xs" aria-label="Etapas">
            {['Cliente', 'Serviço', 'Conferência'].map((s, i) => (
              <li key={s} className={`flex-1 rounded-full px-3 py-1 text-center ${step === i + 1 ? 'bg-[#D4AF37] text-black font-bold' : step > i + 1 ? 'bg-green-900/50 text-green-200' : 'bg-zinc-800 text-zinc-400'}`}>{i + 1}. {s}</li>
            ))}
          </ol>

          {step === 1 && (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm">Telefone (WhatsApp) *<input required inputMode="tel" className={input} value={form.phone} onChange={e => { setForm({ ...form, phone: e.target.value }); setPhoneConflict(false); setMatches(null); }} placeholder="(11) 98765-4321" /></label>
              <label className="text-sm">CPF (se tiver)<input inputMode="numeric" className={input} value={form.cpf} onChange={e => setForm({ ...form, cpf: e.target.value })} /></label>
              <label className="text-sm">Nome<input className={input} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
              <label className="text-sm">Origem<input className={input} value={form.origin} onChange={e => setForm({ ...form, origin: e.target.value })} placeholder="Ex.: caderno, indicação" /></label>
              <button type="button" onClick={lookup} disabled={!form.phone && !form.cpf} className={`${btn} bg-zinc-800 md:col-span-2`}><Search size={18} /> Buscar cadastro existente</button>
              {matches && (
                <div className="md:col-span-2 text-sm bg-zinc-950 border border-zinc-800 rounded-lg p-3 space-y-2" role="status">
                  {matches.length === 0 ? <p className="text-green-300">Nenhum cadastro com este telefone/CPF.</p> : <>
                    <p className="text-amber-300">Já existe cadastro. Se for a mesma pessoa, use-o (não crie outro):</p>
                    {matches.map(m => (
                      <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800 pt-2">
                        <span>{m.name} · {m.phone}{m.cpfMasked ? ` · CPF ${m.cpfMasked}` : ''} · {m.contracts} contrato(s){m.hasAccount ? ' · tem conta' : ''}</span>
                        <button type="button" onClick={() => { setPicked({ id: m.id, name: m.name, phone: m.phone, hasAccount: m.hasAccount }); setStep(2); }} className={`${btn} bg-[#D4AF37] text-black text-sm`}>Usar este cadastro <ChevronRight size={16} /></button>
                      </div>))}
                  </>}
                </div>
              )}
              <button type="button" onClick={createAndNext} disabled={!form.phone} className={`${btn} md:col-span-2 bg-[#D4AF37] text-black`}>{phoneConflict ? 'É outra pessoa: cadastrar mesmo assim' : 'Cadastrar e continuar'} <ChevronRight size={18} /></button>
            </div>
          )}

          {step === 2 && picked && (
            <div className="space-y-3">
              <p className="text-sm text-zinc-300">Cliente: <b>{picked.name}</b> · {picked.phone}</p>
              <p className="text-sm font-semibold">Qual serviço ele contratou?</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {services.map(s => (
                  <button key={s.code} type="button" aria-pressed={contract.serviceCode === s.code} onClick={() => set('serviceCode', s.code)}
                    className={`rounded-xl border p-3 text-left min-h-[64px] ${contract.serviceCode === s.code ? 'border-[#D4AF37] bg-[#D4AF37]/10' : 'border-zinc-800 bg-zinc-900'}`}>
                    <span className="flex items-center gap-2 font-semibold">{s.kind === 'DEVICE' ? <Smartphone size={16} /> : s.kind === 'INVESTMENT' ? <TrendingUp size={16} /> : <FileText size={16} />}{s.label}</span>
                  </button>
                ))}
              </div>
              {service?.note && <p className="text-xs text-zinc-400">{service.note}</p>}
              {service && <ServiceFields kind={kind} c={contract} set={set} />}
              <div className="flex gap-2">
                <button type="button" onClick={() => setStep(1)} className={`${btn} bg-zinc-800`}><ChevronLeft size={18} /> Voltar</button>
                <button type="button" disabled={!service} onClick={() => setStep(3)} className={`${btn} flex-1 bg-[#D4AF37] text-black`}>Conferir <ChevronRight size={18} /></button>
              </div>
            </div>
          )}

          {step === 3 && picked && service && (
            <div className="space-y-3">
              <h2 className="font-semibold">Confira antes de salvar</h2>
              <Summary kind={kind} c={contract} name={picked.name} service={service.label} />
              {kind !== 'INVESTMENT' && (
                <label className="flex items-start gap-3 text-sm bg-zinc-800/60 rounded-lg p-3">
                  <input type="checkbox" className="mt-1 w-6 h-6" checked={contract.balanceConfirmed} onChange={e => set('balanceConfirmed', e.target.checked)} />
                  <span>Conferi o saldo com o cliente e com os comprovantes. <span className="text-zinc-400">Sem esta marca, o contrato fica salvo como <b>pendente de conferência</b>, fora da cobrança automática.</span></span>
                </label>
              )}
              <p className="text-xs text-zinc-500">Registro antigo não gera saída de caixa, receita, venda nem baixa de estoque.</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setStep(2)} className={`${btn} bg-zinc-800`}><ChevronLeft size={18} /> Voltar</button>
                <button type="button" onClick={save} disabled={saving} className={`${btn} flex-1 bg-[#D4AF37] text-black`}><CheckCircle size={18} /> {saving ? 'Salvando…' : 'Salvar'}</button>
              </div>
            </div>
          )}

          {step === 4 && picked && (
            <div className="space-y-3">
              <p className="text-green-300">Salvo! E agora?</p>
              <div className="flex flex-col sm:flex-row gap-2">
                {!picked.hasAccount && <button onClick={() => makeInvite(picked)} className={`${btn} bg-green-700`}><Send size={18} /> Preparar convite do app</button>}
                <button onClick={() => { setStep(2); setContract(emptyContract); }} className={`${btn} bg-zinc-800`}>Registrar outro serviço deste cliente</button>
                <button onClick={resetWizard} className={`${btn} bg-zinc-800`}>Novo cliente</button>
              </div>
            </div>
          )}
        </section>
      )}

      {tab === 'clientes' && (
        <section className="space-y-3" aria-busy={loading}>
          <div className="flex items-center justify-between"><h2 className="font-semibold">Cadastrados</h2>
            <button onClick={load} aria-label="Atualizar lista" className="text-zinc-400 hover:text-white p-3"><RefreshCw size={18} className={loading ? 'animate-spin' : ''} /></button></div>
          {!loading && items.length === 0 && <p className="text-zinc-500 text-sm">Nenhum cliente antigo cadastrado ainda.</p>}
          {items.map(c => (
            <article key={c.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap justify-between gap-2">
                <div><div className="font-semibold">{c.name}</div><div className="text-sm text-zinc-400">{c.phone}</div></div>
                <span className="text-xs rounded-full px-3 py-1 bg-zinc-800 h-fit">{STATUS_LABEL[c.activationStatus || ''] || (c.userId ? 'Conta ativa' : '—')}{c.whatsappOptOut ? ' · sem WhatsApp' : ''}</span>
              </div>
              {c.loans.filter(l => l.isLegacy !== false).map(l => (
                <div key={l.id} className="text-sm border-t border-zinc-800 pt-2 flex flex-wrap items-center justify-between gap-2">
                  <span>{l.legacyDevice ? <Smartphone size={14} className="inline mr-1 text-zinc-500" /> : <FileText size={14} className="inline mr-1 text-zinc-500" />}
                    {l.legacyDevice ? `${l.legacyDevice.brand || ''} ${l.legacyDevice.model || ''}`.trim() : services.find(s => s.code === l.loanRequest?.profileType)?.label || l.loanRequest?.profileType}
                    {' · '}{l.status === 'COMPLETED' ? 'Quitado' : l.status === 'CANCELLED' ? 'Cancelado' : `Saldo ${brl(l.remainingAmount)}`}
                    {l.nextPaymentDate && l.status === 'ACTIVE' ? ` · vence ${new Date(l.nextPaymentDate).toLocaleDateString('pt-BR')}` : ''}
                    {l.disputes?.length ? <b className="text-amber-300"> · contestação aberta</b> : null}</span>
                  {l.status === 'ACTIVE' && (l.collectionSuspended
                    ? <button onClick={() => confirmBalance(l.id)} className="text-amber-300 underline min-h-[44px]">Pendente de conferência — confirmar saldo</button>
                    : <span className="flex flex-wrap items-center gap-2">
                        <span className={`flex items-center gap-1 ${l.messagesSuspended ? 'text-zinc-400' : 'text-green-400'}`}><CheckCircle size={14} /> {l.messagesSuspended ? 'Mensagens pausadas' : 'Na régua'}</span>
                        <button onClick={() => toggleMessages(l)} className="text-zinc-300 underline min-h-[44px] inline-flex items-center gap-1">{l.messagesSuspended ? <><PlayCircle size={14} /> Retomar</> : <><PauseCircle size={14} /> Pausar mensagens</>}</button>
                        {!l.messagesSuspended && !c.whatsappOptOut && !l.disputes?.length && <button onClick={() => makeRegularize(c, l)} className="text-[#D4AF37] underline min-h-[44px]">Consultar/regularizar</button>}
                      </span>)}
                  {l.status === 'ACTIVE' && <button onClick={() => setDisputeFor({ loanId: l.id, name: c.name })} className="text-zinc-300 underline min-h-[44px] inline-flex items-center gap-1"><Scale size={14} /> Contestação</button>}
                </div>
              ))}
              {(c.investments || []).map(i => (
                <div key={i.id} className="text-sm border-t border-zinc-800 pt-2"><TrendingUp size={14} className="inline mr-1 text-cyan-400" />Investimento {brl(i.amount)} · {i.status === 'PENDING_REVIEW' ? 'pendente de conferência' : i.status === 'ACTIVE' ? 'ativo' : i.status.toLowerCase()}{i.nextPayoutDate ? ` · próximo repasse ${new Date(i.nextPayoutDate).toLocaleDateString('pt-BR')}` : ''}</div>
              ))}
              <div className="flex flex-wrap gap-2">
                <button onClick={() => { setPicked({ id: c.id, name: c.name, phone: c.phone, hasAccount: !!c.userId }); setContract(emptyContract); setStep(2); setTab('cadastro'); }} className={`${btn} bg-zinc-800 text-sm`}><FileText size={16} /> Registrar outro serviço</button>
                {!c.userId && <button onClick={() => makeInvite(c)} className={`${btn} bg-green-700 text-sm`}><Send size={16} /> Gerar convite</button>}
                <button onClick={() => setPrefsFor(c)} className={`${btn} bg-zinc-800 text-sm`}>Preferências de comunicação</button>
              </div>
            </article>
          ))}
        </section>
      )}

      {tab === 'contestacoes' && <DisputesPanel onChange={load} />}
      {tab === 'automacoes' && <AutomationPanel />}

      {invite && <InviteModal invite={invite} onClose={() => setInvite(null)} />}
      {regularize && <InviteModal invite={{ ...regularize, link: '' }} title="Mensagem de regularização" onClose={() => setRegularize(null)} />}
      {showImport && <ImportModal services={services.filter(s => !['DEVICE', 'INVESTMENT'].includes(s.kind || ''))} onClose={() => { setShowImport(false); load(); }} />}
      {disputeFor && <OpenDisputeModal loanId={disputeFor.loanId} name={disputeFor.name} onClose={ok => { setDisputeFor(null); if (ok) { setMsg({ ok: true, text: 'Contestação aberta. As cobranças dessa obrigação ficam suspensas até a resolução.' }); load(); } }} />}
      {prefsFor && <Modal title={`Comunicação — ${prefsFor.name}`} onClose={() => { setPrefsFor(null); load(); }}><CommunicationPreferences customerId={prefsFor.id} /></Modal>}
    </div>
  );
}

function F({ label, k, c, set, type = 'text', hint }: { label: string; k: string; c: any; set: (k: string, v: any) => void; type?: string; hint?: string }) {
  const numeric = type === 'money' || type === 'int';
  return <label className="text-sm">{label}<input type={numeric ? 'number' : type} step={type === 'money' ? '0.01' : undefined} min={numeric ? '0' : undefined} inputMode={type === 'money' ? 'decimal' : type === 'int' ? 'numeric' : undefined} className={input} value={c[k]} onChange={e => set(k, e.target.value)} />{hint && <span className="block text-xs text-zinc-400 mt-1">{hint}</span>}</label>;
}

/** Campos de cada modalidade. */
function ServiceFields({ kind, c, set }: { kind: string; c: any; set: (k: string, v: any) => void }) {
  const brl2 = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const n = Number(c.remainingInstallments), v = Number(c.installmentAmount), b = Number(c.balance);
  const hint = n && v && b ? (Math.abs(n * v - b) <= 0.01 * n ? `${n} × ${brl2(v)} = ${brl2(n * v)} (confere com o saldo)` : `${n} × ${brl2(v)} = ${brl2(n * v)} — precisa somar o saldo ${brl2(b)}`) : undefined;
  const freq = <label className="text-sm">Frequência<select className={input} value={c.frequency} onChange={e => set('frequency', e.target.value)}><option value="MONTHLY">Mensal</option><option value="WEEKLY">Semanal</option><option value="DAILY">Diária</option></select></label>;
  const common = <>
    <F label="Referência do contrato antigo (evita duplicar)" k="reference" c={c} set={set} />
    <F label="Link do contrato original (https://…)" k="contractUrl" c={c} set={set} type="url" />
    <label className="text-sm md:col-span-2">Observações<textarea className={input} rows={2} value={c.notes} onChange={e => set('notes', e.target.value)} /></label>
  </>;
  if (kind === 'INVESTMENT') return (
    <div className="grid gap-3 md:grid-cols-2">
      <F label="Valor investido *" k="amount" c={c} set={set} type="money" />
      <F label="Data do aporte" k="originalDate" c={c} set={set} type="date" />
      <label className="text-sm md:col-span-2">Condições de rendimento (como estão no contrato)<textarea className={input} rows={2} value={c.yieldTerms} onChange={e => set('yieldTerms', e.target.value)} placeholder="Ex.: 2,5% ao mês, pago todo dia 10" /></label>
      <F label="Rendimento ao mês (%) — só se estiver no contrato" k="monthlyRate" c={c} set={set} type="money" />
      <label className="text-sm">Frequência dos rendimentos<select className={input} value={c.payoutFrequency} onChange={e => set('payoutFrequency', e.target.value)}><option value="MONTHLY">Mensal</option><option value="QUARTERLY">Trimestral</option><option value="AT_MATURITY">No vencimento</option><option value="OTHER">Outra</option></select></label>
      <F label="Rendimentos já pagos (comprovados)" k="paidYieldsTotal" c={c} set={set} type="money" />
      <F label="Valor pendente conferido" k="pendingConfirmed" c={c} set={set} type="money" />
      <F label="Próximo repasse" k="nextPayoutDate" c={c} set={set} type="date" />
      <F label="Vencimento do investimento" k="maturityDate" c={c} set={set} type="date" />
      <label className="text-sm">Situação<select className={input} value={c.invStatus} onChange={e => set('invStatus', e.target.value)}><option value="ACTIVE">Ativo</option><option value="REDEEMED">Resgatado</option><option value="CANCELLED">Cancelado</option></select></label>
      {common}
    </div>);
  if (kind === 'DEVICE') return (
    <div className="grid gap-3 md:grid-cols-2">
      <F label="Marca" k="brand" c={c} set={set} /><F label="Modelo *" k="model" c={c} set={set} />
      <F label="IMEI/série (se tiver)" k="deviceIdentifier" c={c} set={set} /><F label="Data da venda original" k="originalDate" c={c} set={set} type="date" />
      <F label="Valor do aparelho" k="originalPrice" c={c} set={set} type="money" /><F label="Entrada paga" k="downPayment" c={c} set={set} type="money" />
      <F label="Valor financiado" k="financedAmount" c={c} set={set} type="money" /><F label="Juros ao mês (%) do contrato" k="interestRate" c={c} set={set} type="money" />
      <F label="Parcelas no contrato original" k="originalInstallments" c={c} set={set} type="int" /><F label="Parcelas já pagas" k="paidInstallments" c={c} set={set} type="int" />
      <F label="Parcelas restantes" k="remainingInstallments" c={c} set={set} type="int" /><F label="Valor de cada parcela" k="installmentAmount" c={c} set={set} type="money" />
      <F label="Saldo em aberto (0 = quitado)" k="balance" c={c} set={set} type="money" hint={hint} /><F label="Próximo vencimento" k="nextDueDate" c={c} set={set} type="date" />
      {freq}<F label="Data da posição (saldo conferido em)" k="positionDate" c={c} set={set} type="date" />
      <label className="text-sm">Situação<select className={input} value={c.status || ''} onChange={e => set('status', e.target.value)}><option value="">Ativo / pendente</option><option value="PAID">Quitado</option><option value="CANCELLED">Cancelado</option></select></label>
      {common}
    </div>);
  const rollover = kind === 'ROLLOVER';
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <F label="Valor contratado *" k="amount" c={c} set={set} type="money" /><F label="Saldo em aberto * (0 = quitado)" k="balance" c={c} set={set} type="money" />
      <F label="Já pago (informativo)" k="paidAmount" c={c} set={set} type="money" /><F label="Juros ao mês (%) contratado" k="interestRate" c={c} set={set} type="money" />
      <F label={rollover ? 'Juros do mês (valor)' : 'Valor de cada parcela'} k="installmentAmount" c={c} set={set} type="money" />
      {!rollover && <F label="Parcelas restantes" k="remainingInstallments" c={c} set={set} type="int" hint={hint} />}
      <F label={rollover ? 'Vencimento dos juros' : 'Vencimento da próxima parcela'} k="nextDueDate" c={c} set={set} type="date" />
      {freq}<F label="Data do contrato original" k="originalDate" c={c} set={set} type="date" />
      {common}
    </div>);
}

function Summary({ kind, c, name, service }: { kind: string; c: any; name: string; service: string }) {
  const rows: [string, any][] = kind === 'INVESTMENT'
    ? [['Investidor', name], ['Serviço', service], ['Valor investido', c.amount && brl(Number(c.amount))], ['Condições', c.yieldTerms || (c.monthlyRate ? `${c.monthlyRate}% ao mês` : 'não informadas — fica pendente de conferência')], ['Rendimentos já pagos', c.paidYieldsTotal && brl(Number(c.paidYieldsTotal))], ['Próximo repasse', c.nextPayoutDate]]
    : [['Cliente', name], ['Serviço', service], kind === 'DEVICE' ? ['Aparelho', `${c.brand} ${c.model}`.trim()] : ['Valor contratado', c.amount && brl(Number(c.amount))],
       ['Saldo em aberto', c.balance !== '' && brl(Number(c.balance))], ['Juros ao mês', c.interestRate && `${c.interestRate}%`], ['Cobranças', kind === 'ROLLOVER' ? `juros de ${brl(Number(c.installmentAmount))}/mês` : `${c.remainingInstallments || '?'} × ${brl(Number(c.installmentAmount))}`],
       ['Próximo vencimento', c.nextDueDate && new Date(c.nextDueDate + 'T12:00').toLocaleDateString('pt-BR')]];
  return <dl className="grid grid-cols-2 gap-2 text-sm bg-zinc-950 rounded-lg p-3">{rows.map(([k, v]) => <React.Fragment key={k}><dt className="text-zinc-400">{k}</dt><dd>{v || '—'}</dd></React.Fragment>)}</dl>;
}

function OpenDisputeModal({ loanId, name, onClose }: { loanId: string; name: string; onClose: (ok: boolean) => void }) {
  const [reason, setReason] = useState(''); const [description, setDescription] = useState(''); const [docs, setDocs] = useState(''); const [err, setErr] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await api.post<any>('/legacy-ops/disputes', { loanId, reason, description, documentUrls: docs.split(/\s+/).filter(Boolean) });
    if (error) { setErr(errMsg(error)); return; }
    onClose(true);
  };
  return (
    <Modal title={`Abrir contestação — ${name}`} onClose={() => onClose(false)}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm">Motivo *<select required className={input} value={reason} onChange={e => setReason(e.target.value)}><option value="">Selecione…</option>{['Valor cobrado diverge', 'Pagamento não reconhecido', 'Parcela já paga', 'Contrato não reconhecido', 'Outro'].map(r => <option key={r}>{r}</option>)}</select></label>
        <label className="block text-sm">Descrição<textarea className={input} rows={3} value={description} onChange={e => setDescription(e.target.value)} /></label>
        <label className="block text-sm">Links de documentos (https://…, separados por espaço)<input className={input} value={docs} onChange={e => setDocs(e.target.value)} /></label>
        <p className="text-xs text-zinc-400">Enquanto aberta, os lembretes e cobranças deste contrato ficam suspensos. O saldo não muda.</p>
        {err && <p role="alert" className="text-sm text-red-300">{err}</p>}
        <button className={`${btn} w-full bg-[#D4AF37] text-black`}>Abrir contestação</button>
      </form>
    </Modal>
  );
}

function DisputesPanel({ onChange }: { onChange: () => void }) {
  const [items, setItems] = useState<any[]>([]); const [filter, setFilter] = useState('OPEN_ALL'); const [msg, setMsg] = useState('');
  const load = async () => { const { data } = await api.get<any>(`/legacy-ops/disputes${filter ? `?status=${filter}` : ''}`); setItems(data?.items || []); };
  useEffect(() => { load(); }, [filter]);
  const change = async (d: any, status: string) => {
    let note = '', confirm = '';
    if (status === 'RESOLVED') {
      note = window.prompt('Como foi resolvida? (fica registrado)') || '';
      if (!note) return;
      confirm = window.prompt('Resolver retoma as cobranças dos próximos vencimentos deste contrato.\nSe houver ajuste de valor, faça no contrato.\n\nDigite RESOLVER para confirmar:') || '';
    } else note = window.prompt('Observação (opcional)') || '';
    const { error } = await api.patch<any>(`/legacy-ops/disputes/${d.id}`, { status, note, confirm });
    setMsg(error ? errMsg(error) : 'Contestação atualizada.'); load(); onChange();
  };
  return (
    <section className="space-y-3">
      <div className="flex gap-2 overflow-x-auto">{[['OPEN_ALL', 'Em andamento'], ['RESOLVED', 'Resolvidas'], ['', 'Todas']].map(([k, l]) => <button key={k} onClick={() => setFilter(k)} aria-pressed={filter === k} className={`${btn} text-sm shrink-0 ${filter === k ? 'bg-[#D4AF37] text-black' : 'bg-zinc-800'}`}>{l}</button>)}</div>
      {msg && <p role="status" className="text-sm text-zinc-300">{msg}</p>}
      {items.length === 0 && <p className="text-sm text-zinc-500">Nenhuma contestação.</p>}
      {items.map(d => (
        <article key={d.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2 text-sm">
          <div className="flex flex-wrap justify-between gap-2"><b>{d.customer?.name}</b><span className="rounded-full bg-zinc-800 px-3 py-1 text-xs">{DISPUTE_LABEL[d.status]}{d.openedByRole === 'CLIENT' ? ' · aberta pelo cliente' : ''}</span></div>
          <p>{d.reason}{d.description ? ` — ${d.description}` : ''}</p>
          <p className="text-xs text-zinc-400">Aberta em {new Date(d.createdAt).toLocaleDateString('pt-BR')}{d.resolution ? ` · Resolução: ${d.resolution}` : ''}</p>
          {(d.history || []).length > 1 && <ul className="text-xs text-zinc-400 list-disc pl-5">{d.history.map((h: any, i: number) => <li key={i}>{new Date(h.at).toLocaleString('pt-BR')} · {h.by}: {DISPUTE_LABEL[h.action] || h.action}{h.note ? ` — ${h.note}` : ''}</li>)}</ul>}
          {d.status !== 'RESOLVED' && <div className="flex flex-wrap gap-2">
            {d.status !== 'IN_REVIEW' && <button onClick={() => change(d, 'IN_REVIEW')} className={`${btn} bg-zinc-800 text-sm`}>Em análise</button>}
            {d.status !== 'WAITING_DOCS' && <button onClick={() => change(d, 'WAITING_DOCS')} className={`${btn} bg-zinc-800 text-sm`}>Aguardando documentos</button>}
            <button onClick={() => change(d, 'RESOLVED')} className={`${btn} bg-green-700 text-sm`}>Resolver</button>
            <a href={`#/admin/contracts?loan=${d.loanId}`} className={`${btn} bg-zinc-800 text-sm`}>Abrir contrato</a>
          </div>}
        </article>
      ))}
    </section>
  );
}

export function CommunicationPreferences({ customerId }: { customerId: string }) {
  const [p, setP] = useState<any>(null); const [msg, setMsg] = useState(''); const [reason, setReason] = useState(''); const [until, setUntil] = useState('');
  const load = async () => { const { data } = await api.get<any>(`/legacy-ops/customers/${customerId}/communication`); setP(data?.preferences || null); };
  useEffect(() => { load(); }, [customerId]);
  const save = async (patch: any) => { const { error } = await api.patch<any>(`/legacy-ops/customers/${customerId}/communication`, patch); setMsg(error ? errMsg(error) : 'Preferência salva.'); load(); };
  if (!p) return <p className="text-sm text-zinc-400">Carregando…</p>;
  const suspended = p.commSuspendedReason && (!p.commSuspendedUntil || new Date(p.commSuspendedUntil) > new Date());
  const Toggle = ({ label, on, onChange, hint }: { label: string; on: boolean; onChange: (v: boolean) => void; hint?: string }) => (
    <label className="flex items-center justify-between gap-3 border-t border-zinc-800 py-2 min-h-[48px]"><span>{label}{hint && <span className="block text-xs text-zinc-400">{hint}</span>}</span><input type="checkbox" className="w-6 h-6" checked={on} onChange={e => onChange(e.target.checked)} /></label>
  );
  return (
    <section aria-label="Preferências de comunicação" className="space-y-1 text-sm">
      <Toggle label="Receber comunicações por WhatsApp" on={!p.whatsappOptOut} onChange={v => save({ whatsappOptOut: !v })} hint="Lembretes, cobranças e avisos de pagamento." />
      <Toggle label="Receber convite de ativação do app" on={!p.inviteOptOut} onChange={v => save({ inviteOptOut: !v })} />
      <Toggle label="Receber mensagens promocionais" on={!p.promoOptOut} onChange={v => save({ promoOptOut: !v })} hint="Campanhas e ofertas (separado das cobranças)." />
      <Toggle label="Telefone confirmado (é do titular)" on={p.phoneConfirmed} onChange={v => save({ phoneConfirmed: v })} hint="Sem confirmação, mensagens não mostram valores." />
      <Toggle label="Telefone inválido" on={p.phoneInvalid} onChange={v => save({ phoneInvalid: v })} />
      <div className="border-t border-zinc-800 pt-2 space-y-2">
        <b>Suspensão temporária</b>
        {suspended ? <><p className="text-amber-300">Suspensa{p.commSuspendedUntil ? ` até ${new Date(p.commSuspendedUntil).toLocaleDateString('pt-BR')}` : ''}: {p.commSuspendedReason}</p><button onClick={() => save({ suspend: false })} className={`${btn} bg-zinc-800 w-full`}>Retomar comunicações</button></>
          : <div className="grid gap-2 sm:grid-cols-2">
              <label>Motivo<input className={input} value={reason} onChange={e => setReason(e.target.value)} placeholder="Ex.: pediu para não ser contatado este mês" /></label>
              <label>Até (opcional)<input type="date" className={input} value={until} onChange={e => setUntil(e.target.value)} /></label>
              <button disabled={!reason} onClick={() => save({ suspend: true, suspendedReason: reason, suspendedUntil: until || null })} className={`${btn} bg-zinc-800 sm:col-span-2`}>Suspender comunicações</button>
            </div>}
      </div>
      <p className="text-xs text-zinc-500 pt-2">Última alteração: {p.commPrefsUpdatedAt ? new Date(p.commPrefsUpdatedAt).toLocaleString('pt-BR') : '—'}. Toda alteração fica na auditoria. Nunca usamos telefones de familiares ou referências.</p>
      {msg && <p role="status" className="text-green-300">{msg}</p>}
    </section>
  );
}

function AutomationPanel() {
  const [d, setD] = useState<any>(null); const [testPhone, setTestPhone] = useState(''); const [msg, setMsg] = useState('');
  const load = async () => { const { data } = await api.get<any>('/legacy-ops/automation'); setD(data); setTestPhone(data?.settings?.testPhone || ''); };
  useEffect(() => { load(); }, []);
  const save = async (patch: any, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    const { error } = await api.put<any>('/legacy-ops/automation', patch); setMsg(error ? errMsg(error) : 'Configuração salva.'); load();
  };
  if (!d) return <p className="text-sm text-zinc-400">Carregando…</p>;
  const s = d.settings;
  const KIND: Record<string, string> = { INVITE: 'Convite', REGULARIZE: 'Regularizar', PAYMENT_CONFIRMED: 'Pagamento confirmado', PAYMENT_REJECTED: 'Comprovante recusado', SETTLED: 'Quitação', INVESTMENT_PAYOUT: 'Repasse ao investidor' };
  return (
    <section className="space-y-4 text-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
        <p>Provedor: <b>{d.provider.name}</b> · instância <b>{d.provider.instance || '—'}</b> · {d.provider.connected ? <span className="text-green-400">conectado</span> : <span className="text-red-300">desconectado</span>}</p>
        <label className="flex items-center justify-between gap-3 min-h-[48px]"><span><b>Automações de WhatsApp</b><span className="block text-xs text-zinc-400">Pausar aqui interrompe na hora todas as mensagens automáticas (régua, convites, confirmações).</span></span>
          <input type="checkbox" className="w-6 h-6" checked={s.automationEnabled} onChange={e => save({ automationEnabled: e.target.checked }, e.target.checked ? undefined : 'Pausar TODAS as mensagens automáticas de WhatsApp?')} /></label>
        <label className="flex items-center justify-between gap-3 min-h-[48px] border-t border-zinc-800 pt-2"><span><b>Convite e "regularizar" pelo sistema</b><span className="block text-xs text-zinc-400">Desligado: o admin envia pelo botão "Abrir no WhatsApp". Ligado: sai um por vez, ao clicar.</span></span>
          <input type="checkbox" className="w-6 h-6" checked={s.inviteWhatsapp} onChange={e => save({ inviteWhatsapp: e.target.checked }, e.target.checked ? (s.testPhone ? undefined : 'Ligar o envio REAL ao cliente? (Dica: teste antes com um número de teste.)') : undefined)} /></label>
        <div className="border-t border-zinc-800 pt-2 space-y-2">
          <b>Modo de teste</b><span className="block text-xs text-zinc-400">Com um número aqui, convites e mensagens de serviço vão SÓ para ele (homologação). Deixe vazio para envio real.</span>
          <div className="flex gap-2"><input inputMode="tel" className={input} value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="(11) 98765-4321" /><button onClick={() => save({ testPhone })} className={`${btn} bg-zinc-800 shrink-0`}>Salvar</button></div>
          {s.testPhone && <p className="text-amber-300">Modo de teste ATIVO: mensagens vão para o final {s.testPhone.slice(-4)}.</p>}
        </div>
      </div>
      {msg && <p role="status" className="text-green-300">{msg}</p>}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
        <b>Últimas mensagens de serviço</b>
        {d.recent.length === 0 && <p className="text-zinc-500">Nenhuma ainda.</p>}
        {d.recent.map((r: any, i: number) => (
          <div key={i} className="flex flex-wrap justify-between gap-2 border-t border-zinc-800 pt-2"><span>{new Date(r.createdAt).toLocaleString('pt-BR')} · {KIND[r.subject] || r.subject} · {r.customerName || '—'}{r.metadata?.mode === 'TEST' ? ' · teste' : ''}</span>
            <span className={r.status === 'SENT' ? 'text-green-400' : r.status === 'BLOCKED' ? 'text-zinc-400' : 'text-red-300'}>{r.status === 'SENT' ? 'Enviada' : r.status === 'BLOCKED' ? `Bloqueada: ${r.errorMessage}` : `Falha: ${r.errorMessage}`}</span></div>
        ))}
      </div>
      <p className="text-xs text-zinc-500">Lembretes de vencimento (7, 5 e 3 dias) e cobranças: configure em <a className="underline" href="#/admin/collection-automation">Réguas de Cobrança</a>.</p>
    </section>
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
