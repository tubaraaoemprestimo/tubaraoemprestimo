import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ChevronLeft, RefreshCw, Server, KeyRound, FlaskConical, X, Download, MapPin, AlertTriangle } from 'lucide-react';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Toast';
import { Badge, ErrorBox, Field, Loading, Row, inputCls, cardCls } from '../../components/PhoneFinancingUi';
import {
    phoneFinancingService as svc, formatDate, formatDateTime, SENSITIVE_MDM_COMMANDS,
    type MdmStatus, type MdmDevice, type MdmCapability, type MdmCommand, type MdmCommandStatus,
} from '../../services/phoneFinancingService';

const COMMAND_STATUS: Record<MdmCommandStatus, string> = {
    requested: 'Solicitado', authorized: 'Autorizado', queued: 'Na fila', dispatched: 'Enviado',
    acknowledged: 'Confirmado', failed: 'Falhou', expired: 'Expirado', unknown: 'Desconhecido',
};

const OWNERSHIP: Record<string, string> = { ORG_OWNED: 'Da empresa', CUSTOMER_OWNED: 'Do cliente' };

// Bloqueio de propósito ligado a cobrança (o servidor também recusa).
const COLLECTION_WORDS = /inadimpl|cobran|d[ée]bito|atras|d[íi]vida|pagamento|parcela/i;

const daysUntil = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);

const StatusPanel: React.FC<{ status: MdmStatus }> = ({ status: s }) => {
    const certDays = s.pushCert ? daysUntil(s.pushCert.notAfter) : null;
    return (
        <section className={`${cardCls} grid sm:grid-cols-2 lg:grid-cols-4 gap-4`} aria-label="Status do MDM">
            <div>
                <p className="text-xs text-zinc-400 mb-1">Adaptador</p>
                {s.adapter === 'mock'
                    ? <Badge status="pending">Simulado (mock) — nenhum aparelho real é afetado</Badge>
                    : <Badge status="active">NanoHUB (real)</Badge>}
                {!s.enabled && <p className="text-xs text-red-300 mt-1">MDM desligado (APPLE_MDM_ENABLED).</p>}
            </div>
            <div>
                <p className="text-xs text-zinc-400 mb-1">Comandos reais</p>
                <Badge status={s.realCommandsEnabled ? 'failed' : 'zinc'}>{s.realCommandsEnabled ? 'Habilitados' : 'Desabilitados'}</Badge>
                {s.labMode && <p className="flex items-center gap-1 text-xs text-yellow-300 mt-1"><FlaskConical size={12} aria-hidden="true" /> Modo laboratório</p>}
            </div>
            <div>
                <p className="flex items-center gap-1 text-xs text-zinc-400 mb-1"><Server size={12} aria-hidden="true" /> Servidor</p>
                <Badge status={s.server.reachable ? 'active' : 'failed'}>{s.server.reachable ? 'Acessível' : 'Inacessível'}</Badge>
                {s.server.version && <p className="text-xs text-zinc-500 mt-1">Versão {s.server.version}</p>}
                {s.server.error && <p className="text-xs text-red-300 mt-1">{s.server.error}</p>}
            </div>
            <div>
                <p className="flex items-center gap-1 text-xs text-zinc-400 mb-1"><KeyRound size={12} aria-hidden="true" /> Certificado push (APNs)</p>
                {s.pushCert ? (
                    <>
                        <Badge status={certDays! <= 0 ? 'failed' : certDays! <= 30 ? 'pending' : 'active'}>
                            {certDays! <= 0 ? 'Expirado' : `Válido até ${formatDate(s.pushCert.notAfter)}`}
                        </Badge>
                        {certDays! > 0 && certDays! <= 30 && <p className="text-xs text-yellow-300 mt-1">Renovar em {certDays} dia(s).</p>}
                        <p className="text-xs text-zinc-500 mt-1 break-all">{s.pushCert.topic}</p>
                    </>
                ) : <Badge status="zinc">Não configurado</Badge>}
            </div>
        </section>
    );
};

// Inscrição de aparelho corporativo: perfis para baixar e passo a passo.
const EnrollPanel: React.FC = () => {
    const { addToast } = useToast();
    const [busy, setBusy] = useState<string | null>(null);
    const get = async (key: string, kind: 'enrollment' | 'restrictions', locked = false) => {
        setBusy(key);
        try { await svc.mdm.downloadProfile(kind, locked); }
        catch (e: any) { addToast(e.message, 'error'); }
        finally { setBusy(null); }
    };
    return (
        <section className={`${cardCls} space-y-3`} aria-label="Inscrever aparelho">
            <h2 className="text-lg font-bold">Inscrever iPhone de funcionário</h2>
            <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="gold" isLoading={busy === 'e'} onClick={() => get('e', 'enrollment')}><Download size={14} aria-hidden="true" /> Perfil de inscrição</Button>
                <Button size="sm" variant="secondary" isLoading={busy === 'el'} onClick={() => get('el', 'enrollment', true)}><Download size={14} aria-hidden="true" /> Inscrição travada (Configurator)</Button>
                <Button size="sm" variant="secondary" isLoading={busy === 'r'} onClick={() => get('r', 'restrictions')}><Download size={14} aria-hidden="true" /> Restrições (Configurator)</Button>
            </div>
            <ol className="list-decimal pl-5 text-sm text-zinc-400 space-y-1">
                <li>Sem Mac: envie o <b>perfil de inscrição</b> ao iPhone (AirDrop ou e-mail) e instale em Ajustes → Perfil baixado. O funcionário consegue remover; se remover, você recebe alerta.</li>
                <li>Com Mac (Apple Configurator): Preparar → Supervisionar (apaga o aparelho). Depois adicione os perfis <b>Inscrição travada</b> e <b>Restrições</b>. Em aparelho supervisionado o funcionário não remove e não sai do iCloud.</li>
                <li>Sempre: iCloud da empresa com Buscar iPhone ligado; o funcionário não sabe a senha.</li>
            </ol>
            <p className="text-xs text-zinc-500">O arquivo de inscrição contém um segredo: não publique nem envie para grupos.</p>
        </section>
    );
};

const LocationRow: React.FC<{ loc: NonNullable<MdmDevice['lastLocation']> }> = ({ loc }) => (
    <a href={`https://www.google.com/maps?q=${loc.lat},${loc.lng}`} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-sm text-[#D4AF37] underline">
        <MapPin size={14} aria-hidden="true" /> {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}{loc.accuracy ? ` (±${Math.round(loc.accuracy)} m)` : ''} · {formatDateTime(loc.at)}
    </a>
);

const DeviceDetail: React.FC<{ id: string; status: MdmStatus; onClose: () => void }> = ({ id, status, onClose }) => {
    const { addToast } = useToast();
    const [device, setDevice] = useState<MdmDevice | null>(null);
    const [caps, setCaps] = useState<MdmCapability[]>([]);
    const [history, setHistory] = useState<MdmCommand[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [requestType, setRequestType] = useState('');
    const [purpose, setPurpose] = useState('');
    const [ack, setAck] = useState(false);
    const [lostMsg, setLostMsg] = useState('Este iPhone pertence à Tubarão Empréstimos. Se encontrou, ligue para o número abaixo.');
    const [lostPhone, setLostPhone] = useState('');
    const [assignee, setAssignee] = useState('');

    const load = useCallback(async () => {
        setError(null);
        try {
            const [d, c, h] = await Promise.all([svc.mdm.getDevice(id), svc.mdm.getCapabilities(id), svc.mdm.listCommands(id)]);
            setDevice(d); setCaps(c); setHistory(h); setAssignee(d.assignedTo || '');
        } catch (e: any) { setError(e.message); }
    }, [id]);

    useEffect(() => { load(); }, [load]);

    const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
        setBusy(key);
        try { await fn(); addToast(ok, 'success'); await load(); return true; }
        catch (e: any) { addToast(e.message, 'error'); return false; }
        finally { setBusy(null); }
    };

    if (error) return <section className={cardCls}><ErrorBox message={error} onRetry={load} /></section>;
    if (!device) return <section className={cardCls}><Loading /></section>;

    const orgOwned = device.ownership === 'ORG_OWNED';
    const sensitive = SENSITIVE_MDM_COMMANDS.includes(requestType);
    // Corporativo: o servidor despacha direto (sem 2º admin), salvo modo laboratório.
    const needsSecond = sensitive && (!device.corporate || status.labMode);
    const lost = requestType === 'EnableLostMode';
    const purposeError = purpose && COLLECTION_WORDS.test(purpose) ? 'Propósito ligado a cobrança é proibido.' : purpose && purpose.trim().length < 10 ? 'Descreva o propósito (mín. 10 caracteres).' : null;
    const canSend = orgOwned && requestType && purpose.trim().length >= 10 && !purposeError && (!sensitive || ack) && (!lost || lostMsg.trim() || lostPhone.trim());

    const send = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSend) return;
        const params = lost ? { Message: lostMsg.trim(), PhoneNumber: lostPhone.trim() } : undefined;
        const ok = await run('cmd', () => svc.mdm.sendCommand(id, { requestType, purpose: purpose.trim(), idempotencyKey: crypto.randomUUID(), params }),
            needsSecond ? 'Comando registrado. Aguarda aprovação de um segundo administrador.' : 'Comando enviado.');
        if (ok) { setRequestType(''); setPurpose(''); setAck(false); }
    };

    return (
        <section className={`${cardCls} space-y-5`} aria-label="Detalhe do dispositivo">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-white font-semibold">{device.deviceName || device.model || 'iPhone'}</p>
                    <p className="font-mono text-sm text-zinc-300">{device.serialMasked}</p>
                    <p className="text-xs text-zinc-500">Registro {device.enrollmentId || '—'}</p>
                </div>
                <button type="button" onClick={onClose} aria-label="Fechar detalhe" className="text-zinc-400 hover:text-white"><X size={20} /></button>
            </div>
            {device.unenrolledAt && (
                <p role="alert" className="flex items-center gap-2 text-sm text-red-300"><AlertTriangle size={16} aria-hidden="true" /> Perfil MDM removido em {formatDateTime(device.unenrolledAt)}. Use o Buscar iPhone (icloud.com/find) e reinscreva.</p>
            )}
            {device.lostMode && <p role="status" className="text-sm font-semibold text-yellow-300">Modo Perdido ATIVO</p>}
            {device.lastLocation && <LocationRow loc={device.lastLocation} />}
            <div className="grid sm:grid-cols-2 gap-x-6">
                <Row label="Propriedade" value={device.corporate ? 'Corporativo (funcionário)' : OWNERSHIP[device.ownership] || device.ownership} />
                <Row label="Supervisionado" value={device.supervised == null ? '—' : device.supervised ? 'Sim' : 'Não'} />
                <Row label="Modelo" value={device.model || '—'} />
                <Row label="iOS" value={device.osVersion || '—'} />
                <Row label="Último contato" value={formatDateTime(device.lastSeenAt)} />
                {device.inventory?.BatteryLevel != null && <Row label="Bateria" value={`${Math.round(Number(device.inventory.BatteryLevel) * 100)}%`} />}
                {device.inventory?.PhoneNumber && <Row label="Número" value={String(device.inventory.PhoneNumber)} />}
                {device.inventory?.IMEI && <Row label="IMEI" value={String(device.inventory.IMEI)} />}
                {device.inventory?.IsActivationLockEnabled != null && <Row label="Bloqueio de Ativação" value={device.inventory.IsActivationLockEnabled ? 'Ativo' : 'DESLIGADO'} />}
                {!device.corporate && <Row label="Apple Business Manager" value={device.abmAssigned ? 'Atribuído' : 'Não atribuído'} />}
            </div>
            {device.corporate && (
                <form className="flex gap-2 items-end" onSubmit={e => { e.preventDefault(); run('assign', () => svc.mdm.assignDevice(id, assignee), 'Responsável salvo.'); }}>
                    <Field id="assignee" label="Funcionário responsável">
                        <input id="assignee" className={inputCls} value={assignee} maxLength={120} onChange={e => setAssignee(e.target.value)} />
                    </Field>
                    <Button type="submit" size="sm" variant="secondary" isLoading={busy === 'assign'}>Salvar</Button>
                </form>
            )}
            <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" isLoading={busy === 'sync'} onClick={() => run('sync', () => svc.mdm.syncDevice(id), 'Sincronização de inventário enfileirada.')}>
                    <RefreshCw size={14} aria-hidden="true" /> Sincronizar inventário
                </Button>
                {!device.corporate && (
                    <Button size="sm" variant="outline" isLoading={busy === 'release'} onClick={() => run('release', () => svc.mdm.releaseReview(id), 'Marcado para revisão de liberação.')}>
                        Marcar para liberação
                    </Button>
                )}
            </div>

            <div>
                <h3 className="text-sm font-semibold text-zinc-300 mb-2">Capacidades</h3>
                <ul className="flex flex-wrap gap-2">{caps.map(c => (
                    <li key={c.requestType} title={c.reason}><Badge status={c.allowed ? 'active' : 'zinc'}>{c.requestType}{!c.allowed && c.reason ? ` — ${c.reason}` : ''}</Badge></li>
                ))}</ul>
            </div>

            <form onSubmit={send} className="space-y-3 pt-3 border-t border-zinc-800">
                <h3 className="text-sm font-semibold text-zinc-300">Enviar comando</h3>
                {!orgOwned && <p role="alert" className="text-sm text-yellow-300">Comandos só podem ser enviados para aparelhos da empresa (ORG_OWNED).</p>}
                {status.adapter === 'mock' && <p className="text-xs text-zinc-400">Adaptador simulado: o comando não chega a nenhum aparelho real.</p>}
                <Field id="cmd-type" label="Comando">
                    <select id="cmd-type" className={inputCls} disabled={!orgOwned} value={requestType} onChange={e => { setRequestType(e.target.value); setAck(false); }}>
                        <option value="">Selecione</option>
                        {caps.filter(c => c.allowed).map(c => <option key={c.requestType} value={c.requestType}>{c.requestType}{SENSITIVE_MDM_COMMANDS.includes(c.requestType) && (!device.corporate || status.labMode) ? ' (exige 2º admin)' : ''}</option>)}
                    </select>
                </Field>
                {lost && (
                    <>
                        <Field id="lost-msg" label="Mensagem na tela bloqueada">
                            <textarea id="lost-msg" rows={2} maxLength={200} className={inputCls} value={lostMsg} onChange={e => setLostMsg(e.target.value)} />
                        </Field>
                        <Field id="lost-phone" label="Telefone para contato (opcional)">
                            <input id="lost-phone" type="tel" maxLength={30} className={inputCls} value={lostPhone} onChange={e => setLostPhone(e.target.value)} />
                        </Field>
                        <p className="text-xs text-zinc-400">Depois de ativado, envie "DeviceLocation" para obter a localização.</p>
                    </>
                )}
                <Field id="cmd-purpose" label="Propósito (obrigatório)" error={purposeError} hint="Ex.: aparelho de estoque extraviado durante transporte.">
                    <textarea id="cmd-purpose" rows={2} className={inputCls} disabled={!orgOwned} value={purpose} aria-invalid={!!purposeError} onChange={e => setPurpose(e.target.value)} />
                </Field>
                {sensitive && (
                    <label className="flex items-start gap-2 text-sm text-yellow-200">
                        <input type="checkbox" className="mt-1 accent-[#D4AF37]" checked={ack} onChange={e => setAck(e.target.checked)} />
                        {device.corporate
                            ? 'Confirmo que este aparelho é da empresa e que o comando é por perda, roubo ou segurança.'
                            : 'Confirmo que este aparelho é da empresa e que o comando não tem relação com inadimplência ou cobrança.'}
                    </label>
                )}
                <Button type="submit" size="sm" variant={sensitive ? 'danger' : 'gold'} isLoading={busy === 'cmd'} disabled={!canSend}>Enviar comando</Button>
            </form>

            <div className="pt-3 border-t border-zinc-800">
                <h3 className="text-sm font-semibold text-zinc-300 mb-2">Histórico de comandos</h3>
                {!history.length ? <p className="text-sm text-zinc-500">Nenhum comando.</p> : (
                    <ul className="space-y-2">{history.map(c => (
                        <li key={c.id} className="bg-zinc-900 rounded-xl p-3 text-sm space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-white">{c.requestType || '—'}</span>
                                <Badge status={c.status}>{COMMAND_STATUS[c.status] || c.status}</Badge>
                                <span className="text-xs text-zinc-500 ml-auto">{formatDateTime(c.createdAt)}</span>
                            </div>
                            {c.purpose && <p className="text-zinc-400">{c.purpose}</p>}
                            <p className="text-xs text-zinc-500">
                                {c.requestedBy && <>Solicitado por {c.requestedBy}. </>}
                                {c.approvedBy && <>Aprovado por {c.approvedBy}. </>}
                                {c.commandUuid && <span className="font-mono">{c.commandUuid}</span>}
                            </p>
                            {c.error && <p className="text-xs text-red-300">{c.error}</p>}
                            {c.status === 'requested' && SENSITIVE_MDM_COMMANDS.includes(c.requestType || '') && !c.approvedBy && (
                                <Button size="sm" variant="outline" isLoading={busy === `ap-${c.id}`}
                                    onClick={() => run(`ap-${c.id}`, () => svc.mdm.approveCommand(c.id), 'Comando aprovado.')}>
                                    Aprovar (2º administrador)
                                </Button>
                            )}
                        </li>
                    ))}</ul>
                )}
            </div>
        </section>
    );
};

export const AppleMdmAdmin: React.FC = () => {
    const [status, setStatus] = useState<MdmStatus | null>(null);
    const [devices, setDevices] = useState<MdmDevice[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [sel, setSel] = useState<string | null>(null);

    const load = useCallback(async () => {
        setError(null);
        try {
            const [s, d] = await Promise.all([svc.mdm.getStatus(), svc.mdm.listDevices()]);
            setStatus(s); setDevices(d);
        } catch (e: any) {
            setError(e.code === 'FEATURE_DISABLED' ? 'Apple MDM está desligado neste ambiente (APPLE_MDM_ENABLED).' : e.message);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    return (
        <div className="p-4 md:p-8 bg-black min-h-screen text-white space-y-4">
            <div className="flex flex-wrap items-center gap-3">
                <Link to="/admin/phone-financing" aria-label="Voltar ao financiamento de celulares" className="p-2 rounded-full bg-zinc-900 text-zinc-300 hover:text-white focus-visible:ring-2 focus-visible:ring-[#D4AF37]">
                    <ChevronLeft size={20} />
                </Link>
                <h1 className="flex-1 text-2xl md:text-3xl font-bold text-[#D4AF37]">Apple / MDM</h1>
                <Button size="sm" variant="secondary" onClick={load}><RefreshCw size={16} aria-hidden="true" /> Recarregar</Button>
            </div>

            <div role="note" className="sticky top-0 z-10 flex items-start gap-3 p-4 rounded-2xl border-2 border-red-500/60 bg-red-950/80 backdrop-blur">
                <ShieldAlert className="text-red-400 shrink-0" aria-hidden="true" />
                <p className="text-sm font-semibold text-red-100">Comandos de segurança apenas para aparelhos da empresa. Proibido usar por inadimplência.</p>
            </div>

            {error ? <ErrorBox message={error} onRetry={load} /> : !status || !devices ? <Loading /> : (
                <>
                    <StatusPanel status={status} />
                    <EnrollPanel />
                    <div className="grid lg:grid-cols-[2fr_3fr] gap-4">
                        <section className={cardCls} aria-label="Dispositivos">
                            <h2 className="text-lg font-bold mb-3">Dispositivos</h2>
                            {!devices.length ? <p className="text-sm text-zinc-500">Nenhum dispositivo registrado.</p> : (
                                <ul className="space-y-2">{devices.map(d => (
                                    <li key={d.id}>
                                        <button type="button" onClick={() => setSel(d.id)}
                                            className={`w-full text-left p-3 rounded-xl border focus-visible:ring-2 focus-visible:ring-[#D4AF37] ${sel === d.id ? 'border-[#D4AF37]' : 'border-zinc-800 hover:border-zinc-600'}`}>
                                            <div className="flex justify-between gap-2">
                                                <span className="text-sm text-white">{d.deviceName || d.model || <span className="font-mono">{d.serialMasked}</span>}</span>
                                                {d.unenrolledAt ? <Badge status="failed">Perfil removido</Badge>
                                                    : d.lostMode ? <Badge status="pending">Modo Perdido</Badge>
                                                    : <Badge status={d.ownership === 'ORG_OWNED' ? 'submitted' : 'zinc'}>{d.corporate ? 'Corporativo' : OWNERSHIP[d.ownership] || d.ownership}</Badge>}
                                            </div>
                                            {d.assignedTo && <p className="text-xs text-zinc-300">{d.assignedTo}</p>}
                                            <p className="text-xs text-zinc-400">iOS {d.osVersion || '—'} · {d.supervised ? 'supervisionado' : 'não supervisionado'} · visto {formatDateTime(d.lastSeenAt)}</p>
                                        </button>
                                    </li>
                                ))}</ul>
                            )}
                        </section>
                        {sel && <DeviceDetail key={sel} id={sel} status={status} onClose={() => setSel(null)} />}
                    </div>
                </>
            )}
        </div>
    );
};

export default AppleMdmAdmin;
