import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, AlertTriangle, ExternalLink, Search, X, Upload, Loader2 } from 'lucide-react';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Toast';
import { Badge, ErrorBox, Field, Loading, Row, inputCls, cardCls } from '../../components/PhoneFinancingUi';
import {
    phoneFinancingService as svc, formatCents, formatBps, formatDate, formatDateTime, parseReaisToCents, statusLabel, STATUS_LABELS,
    type AdminApplication, type AdminSale, type ApplicationStatus, type CollectionPolicy, type ImportResult, type InventoryUnit,
    type PhoneDashboard, type PhoneFinancingSettings, type PhoneProduct,
} from '../../services/phoneFinancingService';

// ---------- util ----------

function useLoad<T>(fn: () => Promise<T>, deps: React.DependencyList) {
    const [data, setData] = useState<T | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const run = useCallback(() => {
        setLoading(true); setError(null);
        fn().then(setData).catch(e => setError(e.message)).finally(() => setLoading(false));
    }, deps);
    useEffect(run, [run]);
    return { data, error, loading, reload: run };
}

/** Executa ação com toast de sucesso/erro. Retorna true se deu certo. */
function useAction() {
    const { addToast } = useToast();
    const [busy, setBusy] = useState<string | null>(null);
    const exec = async (key: string, fn: () => Promise<unknown>, ok: string, errMap: Record<string, string> = {}) => {
        setBusy(key);
        try { await fn(); addToast(ok, 'success'); return true; }
        catch (e: any) { addToast(errMap[e.code] || e.message, 'error'); return false; }
        finally { setBusy(null); }
    };
    return { busy, exec };
}

const unitTitle = (u: InventoryUnit) => [u.sku?.model, u.sku?.storage, u.sku?.color, u.serialMasked].filter(Boolean).join(' · ');
const applicationSku = (a: AdminApplication) => (a.sku ? [a.sku.brand, a.sku.model, a.sku.storage, a.sku.color].filter(Boolean).join(' · ') || a.sku.sku : 'Cotação sem modelo');
const toInt = (v: string) => (v.trim() === '' ? null : Number.isInteger(Number(v)) ? Number(v) : NaN);

const H2: React.FC<{ children: React.ReactNode }> = ({ children }) => <h2 className="text-lg font-bold text-white mb-3">{children}</h2>;

// ---------- Painel ----------

const Stat: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div className="bg-zinc-900 rounded-xl p-3"><p className="text-xs text-zinc-400">{label}</p><p className="text-xl font-bold text-white">{value}</p></div>
);

const DashboardTab: React.FC = () => {
    const { data, error, loading, reload } = useLoad<PhoneDashboard>(svc.admin.getDashboard, []);
    if (loading) return <Loading />;
    if (error || !data) return <ErrorBox message={error} onRetry={reload} />;
    return (
        <div className="space-y-4">
            <p className="text-xs text-zinc-500">Indicadores exclusivos do financiamento de celulares — não somados aos empréstimos.</p>
            <section className={cardCls}><H2>Propostas</H2><div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Stat label="Recebidas" value={data.applications.submitted} /><Stat label="Em análise" value={data.applications.under_review} />
                <Stat label="Aprovadas" value={data.applications.approved} /><Stat label="Recusadas" value={data.applications.rejected} />
            </div></section>
            <section className={cardCls}><H2>Estoque</H2><div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <Stat label="Disponíveis" value={data.inventory.available} /><Stat label="Reservadas" value={data.inventory.reserved} />
                <Stat label="Vendidas" value={data.inventory.sold} /><Stat label="Entregues" value={data.inventory.delivered} /><Stat label="Devolvidas" value={data.inventory.returned} />
            </div></section>
            <section className={cardCls}><H2>Vendas e carteira</H2><div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <Stat label="Ativas" value={data.sales.active} /><Stat label="Quitadas" value={data.sales.paid_off} /><Stat label="Em cobrança" value={data.sales.in_collection} />
                <Stat label="A receber" value={formatCents(data.receivableCents)} /><Stat label="Recebido" value={formatCents(data.receivedCents)} />
                <Stat label="Em atraso" value={<span className="text-red-400">{formatCents(data.overdueCents)}</span>} />
            </div></section>
            <section className={cardCls}><H2>Apple MDM</H2><div className="grid grid-cols-3 gap-2">
                <Stat label="Gerenciados" value={data.mdm.managed} /><Stat label="Não gerenciados" value={data.mdm.unmanaged} /><Stat label="Liberação pendente" value={data.mdm.releasePending} />
            </div></section>
        </div>
    );
};

// ---------- Propostas ----------

const ApplicationsTab: React.FC = () => {
    const [status, setStatus] = useState('');
    const [q, setQ] = useState('');
    const [query, setQuery] = useState('');
    const { data, error, loading, reload } = useLoad(() => svc.admin.listApplications(status, query), [status, query]);
    const [sel, setSel] = useState<AdminApplication | null>(null);
    const [newStatus, setNewStatus] = useState<ApplicationStatus | ''>('');
    const [reason, setReason] = useState('');
    const [unitId, setUnitId] = useState('');
    const [units, setUnits] = useState<InventoryUnit[]>([]);
    const { busy, exec } = useAction();

    useEffect(() => {
        if (!sel) return;
        setNewStatus(''); setReason(''); setUnitId('');
        svc.admin.listInventory('available').then(setUnits).catch(() => setUnits([]));
    }, [sel]);

    const changeStatus = async () => {
        if (!sel || !newStatus) return;
        const ok = await exec('status', () => svc.admin.updateApplicationStatus(sel.id, newStatus, reason.trim() || undefined), 'Status atualizado.',
            { INVALID_TRANSITION: 'Transição de status não permitida a partir do status atual.' });
        if (ok) { setSel({ ...sel, status: newStatus }); reload(); }
    };

    const reserve = async () => {
        if (!sel || !unitId) return;
        const ok = await exec('reserve', () => svc.admin.reserveUnit(sel.id, unitId), 'Unidade reservada por 72h.',
            { UNIT_UNAVAILABLE: 'Unidade indisponível. Escolha outra.' });
        if (ok) setUnitId('');
    };

    const needsReason = newStatus === 'rejected' || newStatus === 'cancelled' || newStatus === 'awaiting_documents';

    return (
        <div className="grid lg:grid-cols-2 gap-4">
            <div className="space-y-3">
                <form className="flex flex-col sm:flex-row gap-2" onSubmit={e => { e.preventDefault(); setQuery(q.trim()); }}>
                    <label className="sr-only" htmlFor="app-status">Status</label>
                    <select id="app-status" className={inputCls} value={status} onChange={e => setStatus(e.target.value)}>
                        <option value="">Todos os status</option>
                        {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <label className="sr-only" htmlFor="app-q">Buscar</label>
                    <input id="app-q" className={inputCls} placeholder="Protocolo, nome ou CPF" value={q} onChange={e => setQ(e.target.value)} />
                    <Button type="submit" variant="secondary" aria-label="Buscar"><Search size={18} /></Button>
                </form>
                {loading ? <Loading /> : error ? <ErrorBox message={error} onRetry={reload} /> : !data?.length ? <p className="text-sm text-zinc-500">Nenhuma proposta.</p> : (
                    <ul className="space-y-2">
                        {data.map(a => (
                            <li key={a.id}>
                                <button type="button" onClick={() => setSel(a)}
                                    className={`w-full text-left ${cardCls} focus-visible:ring-2 focus-visible:ring-[#D4AF37] ${sel?.id === a.id ? 'border-[#D4AF37]' : 'hover:border-zinc-600'}`}>
                                    <div className="flex justify-between gap-2"><span className="font-mono text-sm text-[#D4AF37]">{a.protocol}</span><Badge status={a.status}>{statusLabel(a.status)}</Badge></div>
                                    <p className="text-sm text-white">{a.customer.name} <span className="text-zinc-500">· {a.customer.cpfMasked}</span></p>
                                    <p className="text-xs text-zinc-400">{applicationSku(a)} · {formatDate(a.createdAt)}</p>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {sel && (
                <section className={`${cardCls} space-y-4 lg:sticky lg:top-4 self-start`} aria-label="Detalhe da proposta">
                    <div className="flex justify-between items-start">
                        <div><p className="font-mono text-[#D4AF37]">{sel.protocol}</p><p className="font-bold text-white">{sel.customer.name}</p></div>
                        <button type="button" onClick={() => setSel(null)} aria-label="Fechar detalhe" className="text-zinc-400 hover:text-white"><X size={20} /></button>
                    </div>
                    <div>
                        <Row label="Status" value={<Badge status={sel.status}>{statusLabel(sel.status)}</Badge>} />
                        <Row label="CPF" value={sel.customer.cpfMasked} />
                        <Row label="Telefone" value={sel.customer.phone || '—'} />
                        <Row label="Aparelho" value={applicationSku(sel)} />
                        <Row label="Entrada pretendida" value={sel.requestedDownPaymentCents != null ? formatCents(sel.requestedDownPaymentCents) : '—'} />
                        <Row label="Parcelas pretendidas" value={sel.requestedInstallments ? `${sel.requestedInstallments}x` : '—'} />
                        {sel.monthlyIncomeCents != null && <Row label="Renda mensal" value={formatCents(sel.monthlyIncomeCents)} />}
                        {sel.occupation && <Row label="Ocupação" value={sel.occupation} />}
                        {sel.notes && <p className="text-sm text-zinc-300 mt-2 whitespace-pre-line">{sel.notes}</p>}
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-zinc-300 mb-2">Documentos</h3>
                        {!sel.documents?.length ? <p className="text-sm text-zinc-500">Nenhum documento.</p> : (
                            <ul className="space-y-1">{sel.documents.map((d, i) => (
                                <li key={i}><a href={d.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-[#D4AF37] hover:underline">{d.kind} <ExternalLink size={14} aria-hidden="true" /></a></li>
                            ))}</ul>
                        )}
                    </div>
                    <div className="space-y-2 pt-3 border-t border-zinc-800">
                        <h3 className="text-sm font-semibold text-zinc-300">Alterar status</h3>
                        <Field id="new-status" label="Novo status">
                            <select id="new-status" className={inputCls} value={newStatus} onChange={e => setNewStatus(e.target.value as ApplicationStatus)}>
                                <option value="">Selecione</option>
                                {Object.entries(STATUS_LABELS).filter(([k]) => k !== sel.status).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                        </Field>
                        <Field id="reason" label={needsReason ? 'Motivo (obrigatório)' : 'Motivo (opcional)'}>
                            <textarea id="reason" rows={2} className={inputCls} value={reason} onChange={e => setReason(e.target.value)} />
                        </Field>
                        <Button size="sm" variant="gold" isLoading={busy === 'status'} disabled={!newStatus || (needsReason && !reason.trim())} onClick={changeStatus}>Aplicar</Button>
                    </div>
                    <div className="space-y-2 pt-3 border-t border-zinc-800">
                        <h3 className="text-sm font-semibold text-zinc-300">Reservar unidade (72h)</h3>
                        <Field id="reserve-unit" label="Unidade disponível">
                            <select id="reserve-unit" className={inputCls} value={unitId} onChange={e => setUnitId(e.target.value)}>
                                <option value="">Selecione</option>
                                {units.filter(u => !sel.sku?.id || u.skuId === sel.sku.id).map(u => <option key={u.id} value={u.id}>{unitTitle(u)}</option>)}
                            </select>
                        </Field>
                        <Button size="sm" variant="outline" isLoading={busy === 'reserve'} disabled={!unitId} onClick={reserve}>Reservar</Button>
                    </div>
                </section>
            )}
        </div>
    );
};

// ---------- Estoque ----------

const ProductForm: React.FC<{ onDone: () => void }> = ({ onDone }) => {
    const [f, setF] = useState({ brand: '', line: '', model: '', description: '', imageUrl: '' });
    const { busy, exec } = useAction();
    const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        const body = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim() || undefined])) as { brand: string; model: string };
        if (await exec('p', () => svc.admin.createProduct(body), 'Produto criado.')) { setF({ brand: '', line: '', model: '', description: '', imageUrl: '' }); onDone(); }
    };
    return (
        <form onSubmit={save} className={`${cardCls} grid sm:grid-cols-2 gap-3`}>
            <h3 className="sm:col-span-2 font-semibold text-white">Novo produto</h3>
            <Field id="p-brand" label="Marca"><input id="p-brand" required className={inputCls} value={f.brand} onChange={set('brand')} /></Field>
            <Field id="p-model" label="Modelo"><input id="p-model" required className={inputCls} value={f.model} onChange={set('model')} /></Field>
            <Field id="p-line" label="Linha (opcional)"><input id="p-line" className={inputCls} value={f.line} onChange={set('line')} /></Field>
            <Field id="p-img" label="URL da imagem (opcional)"><input id="p-img" type="url" className={inputCls} value={f.imageUrl} onChange={set('imageUrl')} /></Field>
            <div className="sm:col-span-2"><Field id="p-desc" label="Descrição (opcional)"><input id="p-desc" className={inputCls} value={f.description} onChange={set('description')} /></Field></div>
            <Button type="submit" size="sm" variant="gold" isLoading={busy === 'p'} className="sm:col-span-2 sm:justify-self-start">Criar produto</Button>
        </form>
    );
};

const SkuForm: React.FC<{ products: PhoneProduct[]; onDone: () => void }> = ({ products, onDone }) => {
    const [f, setF] = useState({ productId: '', sku: '', storage: '', color: '', condition: 'new', cost: '', cash: '', financed: '' });
    const [err, setErr] = useState<string | null>(null);
    const { busy, exec } = useAction();
    const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        const costCents = parseReaisToCents(f.cost), cashPriceCents = parseReaisToCents(f.cash);
        const financedPriceCents = f.financed ? parseReaisToCents(f.financed) : undefined;
        if (!f.productId || !f.sku.trim() || costCents == null || !cashPriceCents || financedPriceCents === null) { setErr('Preencha produto, SKU, custo e preço à vista com valores válidos.'); return; }
        setErr(null);
        const ok = await exec('s', () => svc.admin.createSku(f.productId, {
            sku: f.sku.trim(), storage: f.storage.trim() || undefined, color: f.color.trim() || undefined, condition: f.condition, costCents, cashPriceCents, financedPriceCents,
        }), 'SKU criado.');
        if (ok) { setF({ ...f, sku: '', storage: '', color: '', cost: '', cash: '', financed: '' }); onDone(); }
    };
    return (
        <form onSubmit={save} className={`${cardCls} grid sm:grid-cols-2 gap-3`}>
            <h3 className="sm:col-span-2 font-semibold text-white">Novo SKU</h3>
            <Field id="s-prod" label="Produto"><select id="s-prod" required className={inputCls} value={f.productId} onChange={set('productId')}>
                <option value="">Selecione</option>{products.map(p => <option key={p.id} value={p.id}>{p.brand} {p.model}</option>)}
            </select></Field>
            <Field id="s-sku" label="Código SKU"><input id="s-sku" required className={inputCls} value={f.sku} onChange={set('sku')} /></Field>
            <Field id="s-storage" label="Armazenamento"><input id="s-storage" className={inputCls} placeholder="128 GB" value={f.storage} onChange={set('storage')} /></Field>
            <Field id="s-color" label="Cor"><input id="s-color" className={inputCls} value={f.color} onChange={set('color')} /></Field>
            <Field id="s-cond" label="Condição"><select id="s-cond" className={inputCls} value={f.condition} onChange={set('condition')}>
                <option value="new">Novo</option><option value="refurbished">Recondicionado</option><option value="used">Usado</option>
            </select></Field>
            <Field id="s-cost" label="Custo (R$, interno)"><input id="s-cost" inputMode="decimal" required className={inputCls} value={f.cost} onChange={set('cost')} /></Field>
            <Field id="s-cash" label="Preço à vista (R$)"><input id="s-cash" inputMode="decimal" required className={inputCls} value={f.cash} onChange={set('cash')} /></Field>
            <Field id="s-fin" label="Preço financiado (R$, opcional)"><input id="s-fin" inputMode="decimal" className={inputCls} value={f.financed} onChange={set('financed')} /></Field>
            <div className="sm:col-span-2"><ErrorBox message={err} /></div>
            <Button type="submit" size="sm" variant="gold" isLoading={busy === 's'} className="sm:col-span-2 sm:justify-self-start">Criar SKU</Button>
        </form>
    );
};

const UNIT_FIELDS: { k: string; label: string; type?: string }[] = [
    { k: 'serialNumber', label: 'Nº de série' }, { k: 'imei', label: 'IMEI' }, { k: 'imei2', label: 'IMEI 2' }, { k: 'assetTag', label: 'Patrimônio' },
    { k: 'supplier', label: 'Fornecedor' }, { k: 'invoiceNumber', label: 'Nº nota fiscal' }, { k: 'invoiceUrl', label: 'URL da nota fiscal', type: 'url' },
    { k: 'purchasedAt', label: 'Data da compra', type: 'date' }, { k: 'storageLocation', label: 'Local de guarda' }, { k: 'physicalCondition', label: 'Estado físico' },
    { k: 'legalOwner', label: 'Proprietário legal' }, { k: 'custodian', label: 'Responsável pela guarda' },
];

const UnitForm: React.FC<{ products: PhoneProduct[]; onDone: () => void }> = ({ products, onDone }) => {
    const [skuId, setSkuId] = useState('');
    const [f, setF] = useState<Record<string, string>>({});
    const { busy, exec } = useAction();
    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!skuId || !f.serialNumber?.trim()) return;
        const body = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim() || undefined]).filter(([, v]) => v));
        const ok = await exec('u', () => svc.admin.createUnit({ skuId, serialNumber: f.serialNumber.trim(), ...body }), 'Unidade cadastrada.',
            { DUPLICATE_SERIAL: 'Já existe uma unidade com este número de série.' });
        if (ok) { setF({}); onDone(); }
    };
    return (
        <form onSubmit={save} className={`${cardCls} grid sm:grid-cols-2 lg:grid-cols-3 gap-3`} autoComplete="off">
            <h3 className="sm:col-span-2 lg:col-span-3 font-semibold text-white">Nova unidade</h3>
            <Field id="u-sku" label="SKU"><select id="u-sku" required className={inputCls} value={skuId} onChange={e => setSkuId(e.target.value)}>
                <option value="">Selecione</option>
                {products.flatMap(p => p.skus.map(s => <option key={s.id} value={s.id}>{p.model} · {s.sku}</option>))}
            </select></Field>
            {UNIT_FIELDS.map(x => (
                <Field key={x.k} id={`u-${x.k}`} label={x.k === 'serialNumber' ? `${x.label} (obrigatório)` : x.label}>
                    <input id={`u-${x.k}`} type={x.type || 'text'} required={x.k === 'serialNumber'} className={inputCls} value={f[x.k] || ''} onChange={e => setF({ ...f, [x.k]: e.target.value })} />
                </Field>
            ))}
            <Button type="submit" size="sm" variant="gold" isLoading={busy === 'u'} className="sm:col-span-2 lg:col-span-3 sm:justify-self-start">Cadastrar unidade</Button>
        </form>
    );
};

const CsvImport: React.FC<{ onDone: () => void }> = ({ onDone }) => {
    const [csv, setCsv] = useState('');
    const [preview, setPreview] = useState<ImportResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState<'dry' | 'real' | null>(null);
    const { addToast } = useToast();
    const run = async (dryRun: boolean) => {
        setBusy(dryRun ? 'dry' : 'real'); setError(null);
        try {
            const r = await svc.admin.importInventory(csv, dryRun);
            if (dryRun) setPreview(r);
            else { addToast(`${r.created} unidade(s) importada(s).`, 'success'); setCsv(''); setPreview(null); onDone(); }
        } catch (e: any) { setError(e.message); } finally { setBusy(null); }
    };
    return (
        <div className={`${cardCls} space-y-3`}>
            <h3 className="font-semibold text-white">Importar CSV</h3>
            <p className="text-xs text-zinc-400">Colunas: <code>sku,serial,imei,imei2,invoice,supplier,location</code>. Primeiro valide; depois confirme.</p>
            <label className="inline-flex items-center gap-2 text-sm text-[#D4AF37] cursor-pointer focus-within:ring-2 focus-within:ring-[#D4AF37] rounded">
                <Upload size={16} aria-hidden="true" /> Carregar arquivo
                <input type="file" accept=".csv,text/csv" className="sr-only" onChange={async e => { const file = e.target.files?.[0]; if (file) { setCsv(await file.text()); setPreview(null); } }} />
            </label>
            <Field id="csv" label="Conteúdo CSV">
                <textarea id="csv" rows={5} className={`${inputCls} font-mono text-xs`} value={csv} onChange={e => { setCsv(e.target.value); setPreview(null); }} />
            </Field>
            <ErrorBox message={error} />
            {preview && (
                <div className="text-sm space-y-1" aria-live="polite">
                    <p className="text-green-400">{preview.valid} linha(s) válida(s).</p>
                    {preview.errors.length > 0 && (
                        <ul role="alert" className="text-red-300 text-xs max-h-40 overflow-auto space-y-0.5">
                            {preview.errors.map((er, i) => <li key={i}>Linha {er.line}: {er.message}</li>)}
                        </ul>
                    )}
                </div>
            )}
            <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" disabled={!csv.trim()} isLoading={busy === 'dry'} onClick={() => run(true)}>Validar (simulação)</Button>
                <Button size="sm" variant="gold" disabled={!preview || preview.errors.length > 0 || preview.valid === 0} isLoading={busy === 'real'} onClick={() => run(false)}>Confirmar importação</Button>
            </div>
        </div>
    );
};

const INVENTORY_STATUS = ['available', 'reserved', 'sold', 'delivered', 'returned'];
const INVENTORY_LABELS: Record<string, string> = { available: 'Disponível', reserved: 'Reservada', sold: 'Vendida', delivered: 'Entregue', returned: 'Devolvida' };

const InventoryTab: React.FC = () => {
    const products = useLoad(svc.admin.listProducts, []);
    const [status, setStatus] = useState('');
    const inventory = useLoad(() => svc.admin.listInventory(status), [status]);
    const list = products.data ?? [];
    return (
        <div className="space-y-4">
            <section className={cardCls}>
                <H2>Produtos e SKUs</H2>
                {products.loading ? <Loading /> : products.error ? <ErrorBox message={products.error} onRetry={products.reload} /> : !list.length ? <p className="text-sm text-zinc-500">Nenhum produto.</p> : (
                    <ul className="space-y-3">{list.map(p => (
                        <li key={p.id}>
                            <p className="font-semibold text-white">{p.brand} {p.model} {p.active === false && <Badge status="cancelled">Inativo</Badge>}</p>
                            <ul className="text-sm text-zinc-400 pl-3">{p.skus.map(s => (
                                <li key={s.id}>{s.sku} · {[s.storage, s.color, s.condition].filter(Boolean).join(' · ')} · {formatCents(s.cashPriceCents)} · {s.availableUnits} disp.</li>
                            ))}</ul>
                        </li>
                    ))}</ul>
                )}
            </section>
            <div className="grid lg:grid-cols-2 gap-4">
                <ProductForm onDone={products.reload} />
                <SkuForm products={list} onDone={products.reload} />
            </div>
            <UnitForm products={list} onDone={() => { inventory.reload(); products.reload(); }} />
            <CsvImport onDone={() => { inventory.reload(); products.reload(); }} />
            <section className={cardCls}>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <H2>Unidades</H2>
                    <label className="sr-only" htmlFor="inv-status">Filtrar status</label>
                    <select id="inv-status" className={`${inputCls} w-auto`} value={status} onChange={e => setStatus(e.target.value)}>
                        <option value="">Todas</option>{INVENTORY_STATUS.map(s => <option key={s} value={s}>{INVENTORY_LABELS[s]}</option>)}
                    </select>
                </div>
                {inventory.loading ? <Loading /> : inventory.error ? <ErrorBox message={inventory.error} onRetry={inventory.reload} /> : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="text-left text-zinc-400"><tr><th className="py-2 pr-3">Aparelho</th><th className="pr-3">Série</th><th className="pr-3">IMEI</th><th className="pr-3">Comercial</th><th>MDM</th></tr></thead>
                            <tbody>{(inventory.data ?? []).map(u => (
                                <tr key={u.id} className="border-t border-zinc-800">
                                    <td className="py-2 pr-3 text-white">{u.sku?.model || u.skuId}</td>
                                    <td className="pr-3 font-mono">{u.serialMasked}</td>
                                    <td className="pr-3 font-mono">{u.imeiMasked || '—'}</td>
                                    <td className="pr-3"><Badge status={u.commercialStatus}>{INVENTORY_LABELS[u.commercialStatus] || u.commercialStatus}</Badge></td>
                                    <td className="text-zinc-300">{u.mdmStatus || '—'}{u.mdmStatusSource && <span className="text-zinc-500 text-xs"> ({u.mdmStatusSource})</span>}</td>
                                </tr>
                            ))}</tbody>
                        </table>
                        {!inventory.data?.length && <p className="text-sm text-zinc-500 py-2">Nenhuma unidade.</p>}
                    </div>
                )}
            </section>
        </div>
    );
};

// ---------- Vendas ----------

const SaleCreateForm: React.FC<{ onDone: () => void }> = ({ onDone }) => {
    const apps = useLoad(() => svc.admin.listApplications('approved'), []);
    const [units, setUnits] = useState<InventoryUnit[]>([]);
    const [f, setF] = useState({ applicationId: '', unitId: '', down: '', installments: '', firstDueDate: '' });
    const [err, setErr] = useState<string | null>(null);
    const { busy, exec } = useAction();

    useEffect(() => {
        Promise.all([svc.admin.listInventory('available'), svc.admin.listInventory('reserved')])
            .then(([a, r]) => setUnits([...r, ...a])).catch(() => setUnits([]));
    }, []);

    const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        const downPaymentCents = parseReaisToCents(f.down), installments = toInt(f.installments);
        if (!f.applicationId || !f.unitId || downPaymentCents == null || !installments || installments < 1 || !f.firstDueDate) { setErr('Preencha todos os campos com valores válidos.'); return; }
        setErr(null);
        const ok = await exec('sale', () => svc.admin.createSale({ applicationId: f.applicationId, unitId: f.unitId, downPaymentCents, installments, firstDueDate: f.firstDueDate }),
            'Venda criada com cronograma.', { UNIT_UNAVAILABLE: 'Unidade indisponível.', INVALID_TRANSITION: 'A proposta não está apta para venda.' });
        if (ok) { setF({ applicationId: '', unitId: '', down: '', installments: '', firstDueDate: '' }); apps.reload(); onDone(); }
    };
    return (
        <form onSubmit={save} className={`${cardCls} grid sm:grid-cols-2 lg:grid-cols-5 gap-3`}>
            <h3 className="sm:col-span-2 lg:col-span-5 font-semibold text-white">Nova venda (proposta aprovada)</h3>
            <Field id="v-app" label="Proposta"><select id="v-app" className={inputCls} value={f.applicationId} onChange={set('applicationId')}>
                <option value="">Selecione</option>{(apps.data ?? []).map(a => <option key={a.id} value={a.id}>{a.protocol} · {a.customer.name}</option>)}
            </select></Field>
            <Field id="v-unit" label="Unidade"><select id="v-unit" className={inputCls} value={f.unitId} onChange={set('unitId')}>
                <option value="">Selecione</option>{units.map(u => <option key={u.id} value={u.id}>{unitTitle(u)} ({INVENTORY_LABELS[u.commercialStatus] || u.commercialStatus})</option>)}
            </select></Field>
            <Field id="v-down" label="Entrada (R$)"><input id="v-down" inputMode="decimal" className={inputCls} value={f.down} onChange={set('down')} /></Field>
            <Field id="v-inst" label="Parcelas"><input id="v-inst" type="number" min={1} className={inputCls} value={f.installments} onChange={set('installments')} /></Field>
            <Field id="v-due" label="1º vencimento"><input id="v-due" type="date" className={inputCls} value={f.firstDueDate} onChange={set('firstDueDate')} /></Field>
            <div className="sm:col-span-2 lg:col-span-5"><ErrorBox message={err || apps.error} /></div>
            <Button type="submit" size="sm" variant="gold" isLoading={busy === 'sale'} className="sm:col-span-2 lg:col-span-5 sm:justify-self-start">Criar venda</Button>
        </form>
    );
};

const RELEASE_STEP_STATUS = [['pending', 'Pendente'], ['done', 'Concluído'], ['blocked', 'Bloqueado']];

const SaleDetail: React.FC<{ id: string; onClose: () => void }> = ({ id, onClose }) => {
    const { data: sale, error, loading, reload } = useLoad<AdminSale>(() => svc.admin.getSale(id), [id]);
    const { busy, exec } = useAction();
    const { addToast } = useToast();
    const [delivery, setDelivery] = useState({ deliveredAt: '', receivedBy: '', receiptUrl: '', notes: '' });
    const [manual, setManual] = useState({ installmentId: '', amount: '', receiptUrl: '', note: '' });
    const [uploadingReceipt, setUploadingReceipt] = useState(false);
    const [transferDate, setTransferDate] = useState('');
    const [stepEdits, setStepEdits] = useState<Record<string, { status: string; evidence: string }>>({});

    if (loading) return <section className={cardCls}><Loading /></section>;
    if (error || !sale) return <section className={cardCls}><ErrorBox message={error} onRetry={reload} /></section>;

    const act = async (key: string, fn: () => Promise<unknown>, ok: string, map?: Record<string, string>) => { if (await exec(key, fn, ok, map)) reload(); };

    const uploadReceipt = async (file?: File) => {
        if (!file) return;
        setUploadingReceipt(true);
        try { const url = await svc.uploadDocument(file); setManual(m => ({ ...m, receiptUrl: url })); }
        catch (e: any) { addToast(e.message, 'error'); } finally { setUploadingReceipt(false); }
    };

    const manualCents = parseReaisToCents(manual.amount);

    return (
        <section className={`${cardCls} space-y-5`} aria-label="Detalhe da venda">
            <div className="flex justify-between items-start">
                <div><p className="font-bold text-white">{sale.customer?.name || 'Venda'} · {sale.device?.model}</p><p className="text-xs text-zinc-500">{sale.device?.serialMasked} · {sale.device?.imeiMasked}</p></div>
                <button type="button" onClick={onClose} aria-label="Fechar detalhe" className="text-zinc-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="grid sm:grid-cols-2 gap-x-6">
                <Row label="Status" value={<Badge status={sale.status}>{sale.status}</Badge>} />
                <Row label="Preço à vista" value={formatCents(sale.cashPriceCents)} />
                <Row label="Entrada" value={formatCents(sale.downPaymentCents)} />
                <Row label="Financiado" value={formatCents(sale.financedCents)} />
                <Row label="Total" value={formatCents(sale.totalCents)} />
                <Row label="Saldo" value={formatCents(sale.balanceCents)} strong />
            </div>

            <div>
                <h3 className="text-sm font-semibold text-zinc-300 mb-2">Parcelas</h3>
                <div className="overflow-x-auto"><table className="w-full text-sm">
                    <thead className="text-left text-zinc-400"><tr><th className="py-1 pr-3">Nº</th><th className="pr-3">Vencimento</th><th className="pr-3">Valor</th><th className="pr-3">Pago</th><th>Status</th></tr></thead>
                    <tbody>{(sale.installments ?? []).map(i => (
                        <tr key={i.id} className="border-t border-zinc-800">
                            <td className="py-1.5 pr-3">{i.number}</td><td className="pr-3">{formatDate(i.dueDate)}</td><td className="pr-3">{formatCents(i.amountCents)}</td>
                            <td className="pr-3">{formatCents(i.paidCents)}</td><td><Badge status={i.status.toLowerCase()}>{i.status}</Badge></td>
                        </tr>
                    ))}</tbody>
                </table></div>
            </div>

            <div>
                <h3 className="text-sm font-semibold text-zinc-300 mb-2">Pagamentos</h3>
                {!sale.payments?.length ? <p className="text-sm text-zinc-500">Nenhum pagamento.</p> : (
                    <ul className="space-y-2">{sale.payments.map(p => (
                        <li key={p.id} className="flex flex-wrap items-center gap-2 text-sm bg-zinc-900 rounded-xl p-2.5">
                            <span className="text-white">{formatCents(p.amountCents)}</span>
                            <span className="text-zinc-500">{p.method} · {formatDateTime(p.createdAt)}</span>
                            <Badge status={p.status}>{p.status}</Badge>
                            {p.receiptUrl && <a href={p.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-[#D4AF37] hover:underline">Comprovante</a>}
                            {(p.needsSecondApproval || /second|awaiting/i.test(p.status)) && (
                                <Button size="sm" variant="outline" className="ml-auto" isLoading={busy === `pa-${p.id}`}
                                    onClick={() => act(`pa-${p.id}`, () => svc.admin.secondApprovePayment(p.id), 'Baixa efetivada.')}>2ª aprovação</Button>
                            )}
                        </li>
                    ))}</ul>
                )}
            </div>

            <form className="space-y-2 pt-3 border-t border-zinc-800" onSubmit={e => {
                e.preventDefault();
                if (!manual.installmentId || !manualCents || !manual.receiptUrl || !manual.note.trim()) return;
                act('manual', () => svc.admin.manualPayment(sale.id, { installmentId: manual.installmentId, amountCents: manualCents, receiptUrl: manual.receiptUrl, note: manual.note.trim() }),
                    'Baixa manual registrada. Acima do limite, exige 2ª aprovação por outro admin.').then(() => setManual({ installmentId: '', amount: '', receiptUrl: '', note: '' }));
            }}>
                <h3 className="text-sm font-semibold text-zinc-300">Baixa manual</h3>
                <div className="grid sm:grid-cols-2 gap-2">
                    <Field id="m-inst" label="Parcela"><select id="m-inst" className={inputCls} value={manual.installmentId} onChange={e => setManual({ ...manual, installmentId: e.target.value })}>
                        <option value="">Selecione</option>{(sale.installments ?? []).filter(i => i.status.toLowerCase() !== 'paid').map(i => <option key={i.id} value={i.id}>{i.number}ª · {formatDate(i.dueDate)} · {formatCents(i.amountCents - i.paidCents)}</option>)}
                    </select></Field>
                    <Field id="m-amount" label="Valor (R$)"><input id="m-amount" inputMode="decimal" className={inputCls} value={manual.amount} onChange={e => setManual({ ...manual, amount: e.target.value })} /></Field>
                    <Field id="m-note" label="Observação (obrigatória)"><input id="m-note" className={inputCls} value={manual.note} onChange={e => setManual({ ...manual, note: e.target.value })} /></Field>
                    <div className="space-y-1">
                        <span className="block text-sm font-medium text-zinc-300">Comprovante (obrigatório)</span>
                        <label className="flex items-center gap-2 text-sm text-[#D4AF37] cursor-pointer py-2.5 focus-within:ring-2 focus-within:ring-[#D4AF37] rounded">
                            {uploadingReceipt ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Upload size={16} aria-hidden="true" />}
                            {manual.receiptUrl ? 'Comprovante enviado — trocar' : 'Enviar comprovante'}
                            <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={e => { uploadReceipt(e.target.files?.[0]); e.target.value = ''; }} />
                        </label>
                    </div>
                </div>
                <Button type="submit" size="sm" variant="gold" isLoading={busy === 'manual'} disabled={uploadingReceipt || !manual.installmentId || !manualCents || !manual.receiptUrl || !manual.note.trim()}>Registrar baixa</Button>
            </form>

            <div className="space-y-2 pt-3 border-t border-zinc-800">
                <h3 className="text-sm font-semibold text-zinc-300">Contrato</h3>
                {sale.contract ? (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                        <Badge status={sale.contract.status}>{sale.contract.status === 'legal_template_pending' ? 'Modelo jurídico pendente' : sale.contract.status}</Badge>
                        {sale.contract.templateVersion && <span className="text-zinc-500">v{sale.contract.templateVersion}</span>}
                        {sale.contract.pdfUrl && <a href={sale.contract.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-[#D4AF37] hover:underline">PDF</a>}
                    </div>
                ) : <p className="text-sm text-zinc-500">Não gerado.</p>}
                <Button size="sm" variant="outline" isLoading={busy === 'contract'} onClick={() => act('contract', async () => {
                    const c = await svc.admin.generateContract(sale.id);
                    if (c.status === 'legal_template_pending') throw new Error('Modelo jurídico ainda não aprovado. Contrato não gerado.');
                }, 'Contrato gerado.')}>Gerar contrato</Button>
            </div>

            <form className="space-y-2 pt-3 border-t border-zinc-800" onSubmit={e => {
                e.preventDefault();
                if (!delivery.deliveredAt || !delivery.receivedBy.trim()) return;
                act('delivery', () => svc.admin.registerDelivery(sale.id, {
                    deliveredAt: new Date(delivery.deliveredAt).toISOString(), receivedBy: delivery.receivedBy.trim(),
                    receiptUrl: delivery.receiptUrl.trim() || undefined, notes: delivery.notes.trim() || undefined,
                }), 'Entrega registrada.');
            }}>
                <h3 className="text-sm font-semibold text-zinc-300">Entrega {sale.deliveries?.length ? `(${sale.deliveries.length} registrada)` : ''}</h3>
                {sale.deliveries?.map(d => <p key={d.id} className="text-sm text-zinc-400">{formatDateTime(d.deliveredAt)} — recebido por {d.receivedBy}</p>)}
                <div className="grid sm:grid-cols-2 gap-2">
                    <Field id="d-at" label="Data/hora da entrega"><input id="d-at" type="datetime-local" className={inputCls} value={delivery.deliveredAt} onChange={e => setDelivery({ ...delivery, deliveredAt: e.target.value })} /></Field>
                    <Field id="d-by" label="Recebido por"><input id="d-by" className={inputCls} value={delivery.receivedBy} onChange={e => setDelivery({ ...delivery, receivedBy: e.target.value })} /></Field>
                    <Field id="d-rec" label="URL do termo de recebimento (opcional)"><input id="d-rec" type="url" className={inputCls} value={delivery.receiptUrl} onChange={e => setDelivery({ ...delivery, receiptUrl: e.target.value })} /></Field>
                    <Field id="d-notes" label="Observações (opcional)"><input id="d-notes" className={inputCls} value={delivery.notes} onChange={e => setDelivery({ ...delivery, notes: e.target.value })} /></Field>
                </div>
                <Button type="submit" size="sm" variant="outline" isLoading={busy === 'delivery'} disabled={!delivery.deliveredAt || !delivery.receivedBy.trim()}>Registrar entrega</Button>
            </form>

            <div className="space-y-2 pt-3 border-t border-zinc-800">
                <h3 className="text-sm font-semibold text-zinc-300">Transferência de titularidade</h3>
                <div className="flex flex-wrap items-end gap-2">
                    <Field id="t-date" label="Data da transferência"><input id="t-date" type="date" className={inputCls} value={transferDate} onChange={e => setTransferDate(e.target.value)} /></Field>
                    <Button size="sm" variant="outline" isLoading={busy === 'title'} disabled={!transferDate}
                        onClick={() => act('title', () => svc.admin.titleTransfer(sale.id, transferDate), 'Caso de liberação aberto.')}>Registrar</Button>
                </div>
                {sale.releaseCase && (
                    <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-zinc-400">Checklist de liberação</h4>
                        {(sale.releaseCase.steps ?? []).map(s => {
                            const ed = stepEdits[s.step] ?? { status: s.status, evidence: s.evidence || '' };
                            return (
                                <div key={s.step} className="bg-zinc-900 rounded-xl p-2.5 grid sm:grid-cols-[1fr_auto_2fr_auto] gap-2 items-end">
                                    <span className="text-sm text-white">{s.label || s.step}</span>
                                    <label className="sr-only" htmlFor={`rs-${s.step}`}>Status de {s.label || s.step}</label>
                                    <select id={`rs-${s.step}`} className={inputCls} value={ed.status} onChange={e => setStepEdits({ ...stepEdits, [s.step]: { ...ed, status: e.target.value } })}>
                                        {RELEASE_STEP_STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                        {!RELEASE_STEP_STATUS.some(([v]) => v === ed.status) && <option value={ed.status}>{ed.status}</option>}
                                    </select>
                                    <label className="sr-only" htmlFor={`re-${s.step}`}>Evidência</label>
                                    <input id={`re-${s.step}`} className={inputCls} placeholder="Evidência (link ou descrição)" value={ed.evidence} onChange={e => setStepEdits({ ...stepEdits, [s.step]: { ...ed, evidence: e.target.value } })} />
                                    <Button size="sm" variant="secondary" isLoading={busy === `rs-${s.step}`} disabled={!ed.evidence.trim()}
                                        onClick={() => act(`rs-${s.step}`, () => svc.admin.updateReleaseStep(sale.releaseCase!.id, s.step, { status: ed.status, evidence: ed.evidence.trim() }), 'Etapa atualizada.')}>Salvar</Button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </section>
    );
};

const SalesTab: React.FC = () => {
    const [status, setStatus] = useState('');
    const sales = useLoad(() => svc.admin.listSales(status), [status]);
    const [sel, setSel] = useState<string | null>(null);
    return (
        <div className="space-y-4">
            <SaleCreateForm onDone={sales.reload} />
            <div className="grid lg:grid-cols-[2fr_3fr] gap-4">
                <section className={cardCls}>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <H2>Vendas</H2>
                        <label className="sr-only" htmlFor="sale-status">Filtrar status</label>
                        <select id="sale-status" className={`${inputCls} w-auto`} value={status} onChange={e => setStatus(e.target.value)}>
                            <option value="">Todas</option><option value="active">Ativas</option><option value="paid_off">Quitadas</option><option value="in_collection">Em cobrança</option>
                        </select>
                    </div>
                    {sales.loading ? <Loading /> : sales.error ? <ErrorBox message={sales.error} onRetry={sales.reload} /> : !sales.data?.length ? <p className="text-sm text-zinc-500">Nenhuma venda.</p> : (
                        <ul className="space-y-2">{sales.data.map(s => (
                            <li key={s.id}>
                                <button type="button" onClick={() => setSel(s.id)} className={`w-full text-left p-3 rounded-xl border focus-visible:ring-2 focus-visible:ring-[#D4AF37] ${sel === s.id ? 'border-[#D4AF37]' : 'border-zinc-800 hover:border-zinc-600'}`}>
                                    <div className="flex justify-between gap-2"><span className="text-sm text-white">{s.customer?.name || s.id}</span><Badge status={s.status}>{s.status}</Badge></div>
                                    <p className="text-xs text-zinc-400">{s.device?.model} · saldo {formatCents(s.balanceCents)}</p>
                                </button>
                            </li>
                        ))}</ul>
                    )}
                </section>
                {sel && <SaleDetail key={sel} id={sel} onClose={() => setSel(null)} />}
            </div>
        </div>
    );
};

// ---------- Cobrança ----------

const CollectionTab: React.FC = () => {
    const policy = useLoad(svc.admin.getCollectionPolicy, []);
    const [f, setF] = useState({ reminderDaysBefore: '', graceDaysAfterDue: '', contactHour: '' });
    const [err, setErr] = useState<string | null>(null);
    const { busy, exec } = useAction();
    const sales = useLoad(() => svc.admin.listSales(), []);
    const [saleId, setSaleId] = useState('');
    const sale = useLoad(() => (saleId ? svc.admin.getSale(saleId) : Promise.resolve(null)), [saleId]);

    useEffect(() => {
        if (policy.data) setF({
            reminderDaysBefore: String(policy.data.reminderDaysBefore ?? ''), graceDaysAfterDue: String(policy.data.graceDaysAfterDue ?? ''), contactHour: String(policy.data.contactHour ?? ''),
        });
    }, [policy.data]);

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        const body: CollectionPolicy = { reminderDaysBefore: toInt(f.reminderDaysBefore), graceDaysAfterDue: toInt(f.graceDaysAfterDue), contactHour: toInt(f.contactHour) };
        if (Object.values(body).some(v => v != null && (Number.isNaN(v) || v < 0)) || (body.contactHour != null && body.contactHour > 23)) {
            setErr('Use números inteiros. Horário de contato entre 0 e 23.'); return;
        }
        setErr(null);
        if (await exec('policy', () => svc.admin.updateCollectionPolicy(body), 'Política salva.')) policy.reload();
    };

    return (
        <div className="space-y-4">
            <form onSubmit={save} className={`${cardCls} space-y-3`}>
                <H2>Política de cobrança</H2>
                <p className="text-xs text-zinc-400">Lembretes respeitosos, dentro do horário configurado. Nenhuma ação sobre o aparelho é usada como cobrança.</p>
                {policy.loading ? <Loading /> : policy.error ? <ErrorBox message={policy.error} onRetry={policy.reload} /> : (
                    <div className="grid sm:grid-cols-3 gap-3">
                        <Field id="c-rem" label="Lembrete (dias antes)"><input id="c-rem" type="number" min={0} className={inputCls} value={f.reminderDaysBefore} onChange={e => setF({ ...f, reminderDaysBefore: e.target.value })} /></Field>
                        <Field id="c-grace" label="Carência (dias após vencimento)"><input id="c-grace" type="number" min={0} className={inputCls} value={f.graceDaysAfterDue} onChange={e => setF({ ...f, graceDaysAfterDue: e.target.value })} /></Field>
                        <Field id="c-hour" label="Horário de contato (0–23)"><input id="c-hour" type="number" min={0} max={23} className={inputCls} value={f.contactHour} onChange={e => setF({ ...f, contactHour: e.target.value })} /></Field>
                    </div>
                )}
                <ErrorBox message={err} />
                <Button type="submit" size="sm" variant="gold" isLoading={busy === 'policy'} disabled={policy.loading || !!policy.error}>Salvar política</Button>
            </form>

            <section className={`${cardCls} space-y-3`}>
                <H2>Pausar cobrança de parcela</H2>
                <Field id="c-sale" label="Venda">
                    <select id="c-sale" className={inputCls} value={saleId} onChange={e => setSaleId(e.target.value)}>
                        <option value="">Selecione</option>{(sales.data ?? []).map(s => <option key={s.id} value={s.id}>{s.customer?.name || s.id} · {s.device?.model}</option>)}
                    </select>
                </Field>
                {saleId && (sale.loading ? <Loading /> : sale.error ? <ErrorBox message={sale.error} onRetry={sale.reload} /> : (
                    <ul className="space-y-2">{(sale.data?.installments ?? []).filter(i => i.status.toLowerCase() !== 'paid').map(i => (
                        <li key={i.id} className="flex items-center gap-3 bg-zinc-900 rounded-xl p-2.5 text-sm">
                            <span className="flex-1 text-white">{i.number}ª · {formatDate(i.dueDate)} · {formatCents(i.amountCents - i.paidCents)}</span>
                            {i.collectionPaused && <Badge status="pending">Pausada</Badge>}
                            <Button size="sm" variant="secondary" isLoading={busy === `cp-${i.id}`}
                                onClick={async () => { if (await exec(`cp-${i.id}`, () => svc.admin.pauseInstallmentCollection(i.id, !i.collectionPaused), i.collectionPaused ? 'Cobrança retomada.' : 'Cobrança pausada.')) sale.reload(); }}>
                                {i.collectionPaused ? 'Retomar' : 'Pausar'}
                            </Button>
                        </li>
                    ))}</ul>
                ))}
            </section>
        </div>
    );
};

// ---------- Configurações ----------

const SettingsTab: React.FC = () => {
    const { data, error, loading, reload } = useLoad<PhoneFinancingSettings>(svc.admin.getSettings, []);
    const [f, setF] = useState({ offerEnabled: false, commercialTerms: '', monthlyInterestPct: '', maxInstallments: '', minDownPct: '' });
    const [err, setErr] = useState<string | null>(null);
    const { busy, exec } = useAction();

    useEffect(() => {
        if (!data) return;
        const pct = (bps: number | null | undefined) => (bps == null ? '' : String(bps / 100).replace('.', ','));
        setF({ offerEnabled: !!data.offerEnabled, commercialTerms: data.commercialTerms || '', monthlyInterestPct: pct(data.monthlyInterestBps), maxInstallments: data.maxInstallments == null ? '' : String(data.maxInstallments), minDownPct: pct(data.minDownPaymentBps) });
    }, [data]);

    if (loading) return <Loading />;
    if (error || !data) return <ErrorBox message={error} onRetry={reload} />;

    const legalPending = data.legalTemplateStatus !== 'approved';
    const toBps = (v: string) => { const c = parseReaisToCents(v); return v.trim() === '' ? null : c; }; // "2,5" → 250 (mesma escala de centavos)

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        const monthlyInterestBps = toBps(f.monthlyInterestPct), minDownPaymentBps = toBps(f.minDownPct), maxInstallments = toInt(f.maxInstallments);
        if (Number.isNaN(maxInstallments) || (maxInstallments != null && maxInstallments < 1) || (minDownPaymentBps != null && minDownPaymentBps > 10000)) {
            setErr('Valores inválidos. Parcelas: inteiro ≥ 1. Entrada mínima: até 100%.'); return;
        }
        setErr(null);
        const ok = await exec('settings', () => svc.admin.updateSettings({
            offerEnabled: f.offerEnabled, commercialTerms: f.commercialTerms.trim() || null, monthlyInterestBps, maxInstallments, minDownPaymentBps,
        }), 'Configurações salvas.', {
            OFFER_NOT_READY: 'Oferta não pode ser ligada: preencha juros, parcelas máximas e entrada mínima, e aguarde a aprovação do modelo jurídico.',
        });
        if (ok) reload(); else setF(x => ({ ...x, offerEnabled: !!data.offerEnabled }));
    };

    return (
        <form onSubmit={save} className="space-y-4">
            {legalPending && (
                <div role="alert" className="flex gap-3 p-4 rounded-2xl border-2 border-yellow-500/60 bg-yellow-500/10">
                    <AlertTriangle className="text-yellow-400 shrink-0" aria-hidden="true" />
                    <div className="text-sm">
                        <p className="font-bold text-yellow-200">Modelo jurídico pendente ({data.legalTemplateStatus || 'legal_template_pending'})</p>
                        <p className="text-yellow-100/80">Enquanto o contrato não for aprovado pelo jurídico, a oferta não pode ser ligada para clientes e nenhum contrato é gerado.</p>
                    </div>
                </div>
            )}
            <div className={`${cardCls} space-y-3`}>
                <H2>Condições comerciais</H2>
                <div className="grid sm:grid-cols-3 gap-3">
                    <Field id="st-int" label="Juros ao mês (%)" hint={`Atual: ${formatBps(data.monthlyInterestBps)}`}><input id="st-int" inputMode="decimal" className={inputCls} value={f.monthlyInterestPct} onChange={e => setF({ ...f, monthlyInterestPct: e.target.value })} /></Field>
                    <Field id="st-max" label="Parcelas máximas"><input id="st-max" type="number" min={1} className={inputCls} value={f.maxInstallments} onChange={e => setF({ ...f, maxInstallments: e.target.value })} /></Field>
                    <Field id="st-down" label="Entrada mínima (%)" hint={`Atual: ${formatBps(data.minDownPaymentBps)}`}><input id="st-down" inputMode="decimal" className={inputCls} value={f.minDownPct} onChange={e => setF({ ...f, minDownPct: e.target.value })} /></Field>
                </div>
                <Field id="st-terms" label="Texto de condições exibido ao cliente">
                    <textarea id="st-terms" rows={4} className={inputCls} value={f.commercialTerms} onChange={e => setF({ ...f, commercialTerms: e.target.value })} />
                </Field>
                <label className="flex items-center gap-3 text-sm text-white">
                    <input type="checkbox" className="accent-[#D4AF37] w-4 h-4" checked={f.offerEnabled} onChange={e => setF({ ...f, offerEnabled: e.target.checked })} />
                    Oferta ligada para clientes
                </label>
                {f.offerEnabled && legalPending && <p className="text-xs text-yellow-300" role="alert">Será recusado pelo servidor (OFFER_NOT_READY) enquanto o modelo jurídico estiver pendente.</p>}
                <ErrorBox message={err} />
                <Button type="submit" size="sm" variant="gold" isLoading={busy === 'settings'}>Salvar</Button>
            </div>
        </form>
    );
};

// ---------- Página ----------

const TABS = [
    { id: 'dashboard', label: 'Painel', C: DashboardTab },
    { id: 'applications', label: 'Propostas', C: ApplicationsTab },
    { id: 'inventory', label: 'Estoque', C: InventoryTab },
    { id: 'sales', label: 'Vendas', C: SalesTab },
    { id: 'collection', label: 'Cobrança', C: CollectionTab },
    { id: 'settings', label: 'Configurações', C: SettingsTab },
] as const;

export const PhoneFinancingAdmin: React.FC = () => {
    const [tab, setTab] = useState<(typeof TABS)[number]['id']>('dashboard');
    const [nonce, setNonce] = useState(0);
    const Active = TABS.find(t => t.id === tab)!.C;
    return (
        <div className="p-4 md:p-8 bg-black min-h-screen text-white">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <h1 className="text-2xl md:text-3xl font-bold text-[#D4AF37]">Financiamento de Celulares</h1>
                <Button size="sm" variant="secondary" onClick={() => setNonce(n => n + 1)} aria-label="Recarregar aba"><RefreshCw size={16} /> Recarregar</Button>
            </div>
            <div role="tablist" aria-label="Seções" className="flex gap-2 overflow-x-auto pb-2 mb-4">
                {TABS.map(t => (
                    <button key={t.id} type="button" role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls="pf-panel" onClick={() => setTab(t.id)}
                        className={`shrink-0 px-4 py-2 rounded-lg text-sm font-semibold border focus-visible:ring-2 focus-visible:ring-[#D4AF37] ${tab === t.id ? 'bg-[#D4AF37] text-black border-[#D4AF37]' : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-600'}`}>
                        {t.label}
                    </button>
                ))}
                <Link to="/admin/phone-financing/mdm" className="shrink-0 px-4 py-2 rounded-lg text-sm font-semibold border bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-600 focus-visible:ring-2 focus-visible:ring-[#D4AF37] inline-flex items-center gap-1">
                    Apple / MDM <ExternalLink size={14} aria-hidden="true" />
                </Link>
            </div>
            <div id="pf-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
                <Active key={`${tab}-${nonce}`} />
            </div>
        </div>
    );
};

export default PhoneFinancingAdmin;
