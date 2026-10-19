import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Smartphone, CheckCircle2, Upload, FileCheck2, Info, Loader2, HelpCircle } from 'lucide-react';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Toast';
import { Field, ErrorBox, Loading, Row, inputCls, cardCls } from '../../components/PhoneFinancingUi';
import {
    phoneFinancingService as svc, formatCents, formatBps, formatDate, parseReaisToCents, isFeatureDisabled, TERMS_VERSION,
    type PhoneOffer, type PhoneProduct, type PhoneSku, type Simulation, type DocumentKind,
} from '../../services/phoneFinancingService';

const STEPS = ['Apresentação', 'Aparelho', 'Simulação', 'Seus dados', 'Revisão', 'Concluído'];

const DOCS: { kind: DocumentKind; label: string }[] = [
    { kind: 'ID_FRONT', label: 'RG ou CNH — frente' },
    { kind: 'ID_BACK', label: 'RG ou CNH — verso' },
    { kind: 'PROOF_OF_ADDRESS', label: 'Comprovante de residência' },
    { kind: 'PROOF_OF_INCOME', label: 'Comprovante de renda' },
];

const MY_ROUTE = '/client/financiamento-celulares';

const skuTitle = (p: PhoneProduct, s: PhoneSku) => [p.brand, p.model, s.storage, s.color].filter(Boolean).join(' · ');

export const PhoneFinancingWizard: React.FC = () => {
    const navigate = useNavigate();
    const { addToast } = useToast();
    const [step, setStep] = useState(0);

    // Etapa 1
    const [offer, setOffer] = useState<PhoneOffer | null>(null);
    const [offerError, setOfferError] = useState<string | null>(null);
    const [offerDisabled, setOfferDisabled] = useState(false);

    // Etapa 2
    const [products, setProducts] = useState<PhoneProduct[] | null>(null);
    const [productsError, setProductsError] = useState<string | null>(null);
    const [skuId, setSkuId] = useState<string | null>(null);
    const [wantsQuote, setWantsQuote] = useState(false);

    // Etapa 3
    const [downInput, setDownInput] = useState('');
    const [installments, setInstallments] = useState(0);
    const [simulation, setSimulation] = useState<Simulation | null>(null);
    const [simLoading, setSimLoading] = useState(false);
    const [simError, setSimError] = useState<string | null>(null);

    // Etapa 4
    const [incomeInput, setIncomeInput] = useState('');
    const [occupation, setOccupation] = useState('');
    const [notes, setNotes] = useState('');
    const [docs, setDocs] = useState<Partial<Record<DocumentKind, string>>>({});
    const [uploading, setUploading] = useState<DocumentKind | null>(null);
    const [dataErrors, setDataErrors] = useState<Record<string, string>>({});

    // Etapa 5/6
    const [lgpd, setLgpd] = useState(false);
    const [terms, setTerms] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [protocol, setProtocol] = useState<string | null>(null);

    const loadOffer = useCallback(() => {
        setOfferError(null);
        setOffer(null);
        svc.getOffer()
            .then(o => { setOffer(o); setOfferDisabled(!o.enabled); })
            .catch(e => (isFeatureDisabled(e) ? setOfferDisabled(true) : setOfferError(e.message)));
    }, []);

    useEffect(loadOffer, [loadOffer]);

    const loadProducts = useCallback(() => {
        setProductsError(null);
        setProducts(null);
        svc.getProducts().then(setProducts).catch(e => setProductsError(e.message));
    }, []);

    useEffect(() => { if (step === 1 && !products) loadProducts(); }, [step, products, loadProducts]);

    const selected = useMemo(() => {
        for (const p of products ?? []) {
            const s = p.skus.find(x => x.id === skuId);
            if (s) return { product: p, sku: s };
        }
        return null;
    }, [products, skuId]);

    const maxInst = offer?.maxInstallments ?? 0;
    const minDownCents = selected && offer?.minDownPaymentBps != null ? Math.ceil((selected.sku.cashPriceCents * offer.minDownPaymentBps) / 10000) : 0;
    const downCents = parseReaisToCents(downInput);

    useEffect(() => { if (maxInst && !installments) setInstallments(maxInst); }, [maxInst, installments]);
    useEffect(() => { setSimulation(null); }, [skuId, downInput, installments]);

    const downError =
        !selected ? null
            : downCents == null ? 'Informe o valor da entrada (pode ser R$ 0,00 se não houver mínimo).'
                : downCents < minDownCents ? `Entrada mínima: ${formatCents(minDownCents)}.`
                    : downCents >= selected.sku.cashPriceCents ? 'A entrada deve ser menor que o preço do aparelho.'
                        : null;

    const runSimulation = async () => {
        if (!selected || downError || downCents == null || !installments) return;
        setSimLoading(true);
        setSimError(null);
        try {
            setSimulation(await svc.simulate({ skuId: selected.sku.id, downPaymentCents: downCents, installments }));
        } catch (e: any) {
            setSimError(e.code === 'OFFER_NOT_CONFIGURED' ? 'As condições de financiamento ainda não foram configuradas. Tente mais tarde.' : e.message);
        } finally {
            setSimLoading(false);
        }
    };

    const handleUpload = async (kind: DocumentKind, file: File | undefined) => {
        if (!file) return;
        if (file.size > 20 * 1024 * 1024) { addToast('Arquivo muito grande (máx. 20 MB).', 'error'); return; }
        setUploading(kind);
        try {
            const url = await svc.uploadDocument(file);
            setDocs(d => ({ ...d, [kind]: url }));
            setDataErrors(e => { const n = { ...e }; delete n[kind]; return n; });
        } catch (e: any) {
            addToast(e.message || 'Falha no envio do arquivo.', 'error');
        } finally {
            setUploading(null);
        }
    };

    const validateData = () => {
        const errs: Record<string, string> = {};
        const income = parseReaisToCents(incomeInput);
        if (income == null || income <= 0) errs.income = 'Informe sua renda mensal.';
        if (occupation.trim().length < 2) errs.occupation = 'Informe sua ocupação.';
        for (const d of DOCS) if (!docs[d.kind]) errs[d.kind] = 'Envie este documento.';
        setDataErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const submit = async () => {
        if (!lgpd || !terms) return;
        setSubmitting(true);
        setSubmitError(null);
        try {
            const app = await svc.createApplication({
                ...(wantsQuote ? { wantsQuote: true } : { skuId: skuId ?? undefined }),
                requestedInstallments: installments || undefined,
                requestedDownPaymentCents: downCents ?? undefined,
                monthlyIncomeCents: parseReaisToCents(incomeInput) ?? undefined,
                occupation: occupation.trim(),
                notes: notes.trim() || undefined,
                documents: DOCS.filter(d => docs[d.kind]).map(d => ({ kind: d.kind, url: docs[d.kind]! })),
                lgpdConsent: true,
                termsVersion: TERMS_VERSION,
            });
            setProtocol(app.protocol);
            setStep(5);
        } catch (e: any) {
            setSubmitError(isFeatureDisabled(e) ? 'O financiamento de celulares está indisponível no momento.' : e.message);
        } finally {
            setSubmitting(false);
        }
    };

    const back = () => {
        if (step === 0 || step === 5) navigate(-1);
        else setStep(s => (s === 3 && wantsQuote ? 1 : s - 1));
    };

    // ---------- Render ----------

    const header = (
        <header className="flex items-center gap-3 mb-4">
            <button type="button" onClick={back} aria-label="Voltar" className="p-2 rounded-full bg-zinc-900 text-zinc-300 hover:text-white focus-visible:ring-2 focus-visible:ring-[#D4AF37]">
                <ChevronLeft size={20} />
            </button>
            <div className="min-w-0">
                <h1 className="text-lg font-bold text-white truncate">Financiamento de Celulares</h1>
                <p className="text-xs text-zinc-400">Etapa {step + 1} de {STEPS.length} — {STEPS[step]}</p>
            </div>
        </header>
    );

    const progress = (
        <div className="flex gap-1 mb-5" aria-hidden="true">
            {STEPS.map((_, i) => <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-[#D4AF37]' : 'bg-zinc-800'}`} />)}
        </div>
    );

    let body: React.ReactNode;

    if (step === 0) {
        body = offerError ? <ErrorBox message={offerError} onRetry={loadOffer} />
            : offerDisabled ? (
                <div className={`${cardCls} text-center space-y-3`}>
                    <Smartphone size={40} className="mx-auto text-zinc-500" aria-hidden="true" />
                    <h2 className="font-bold text-white">Indisponível no momento</h2>
                    <p className="text-sm text-zinc-400">O financiamento de celulares ainda não está aberto para novas solicitações. Avisaremos quando estiver disponível.</p>
                    <Button variant="secondary" onClick={() => navigate('/client/dashboard')} className="w-full">Voltar ao início</Button>
                </div>
            )
                : !offer ? <Loading label="Carregando condições..." />
                    : (
                        <div className="space-y-4">
                            <div className={`${cardCls} space-y-2`}>
                                <Smartphone size={32} className="text-[#D4AF37]" aria-hidden="true" />
                                <h2 className="text-xl font-bold text-white">Seu celular novo, em parcelas</h2>
                                <p className="text-sm text-zinc-300">Escolha um aparelho, simule a entrada e as parcelas e envie sua proposta para análise.</p>
                            </div>
                            <div className={cardCls}>
                                <h3 className="font-semibold text-white mb-2">Condições</h3>
                                <Row label="Parcelas" value={offer.maxInstallments ? `até ${offer.maxInstallments}x` : '—'} />
                                <Row label="Entrada mínima" value={formatBps(offer.minDownPaymentBps)} />
                                <Row label="Juros ao mês" value={formatBps(offer.monthlyInterestBps)} />
                                {offer.commercialTerms && <p className="text-xs text-zinc-400 mt-3 whitespace-pre-line">{offer.commercialTerms}</p>}
                            </div>
                            <p className="flex gap-2 text-xs text-zinc-400">
                                <Info size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
                                Financiamento próprio em parcelas, diferente de parcelamento no cartão de crédito. Toda proposta passa por análise.
                            </p>
                            <Button variant="gold" className="w-full" onClick={() => setStep(1)}>Começar</Button>
                        </div>
                    );
    } else if (step === 1) {
        body = productsError ? <ErrorBox message={productsError} onRetry={loadProducts} />
            : !products ? <Loading label="Carregando aparelhos..." />
                : (
                    <div className="space-y-4">
                        <fieldset className="space-y-3">
                            <legend className="text-sm text-zinc-300 mb-2">Escolha o aparelho</legend>
                            {products.length === 0 && <p className="text-sm text-zinc-400">Nenhum aparelho disponível na vitrine agora. Você pode solicitar uma cotação.</p>}
                            {products.map(p => (
                                <div key={p.id} className={cardCls}>
                                    <div className="flex gap-3 mb-3">
                                        {p.imageUrl
                                            ? <img src={p.imageUrl} alt="" loading="lazy" className="w-16 h-16 object-contain rounded-lg bg-zinc-900" />
                                            : <div className="w-16 h-16 rounded-lg bg-zinc-900 flex items-center justify-center text-zinc-600"><Smartphone aria-hidden="true" /></div>}
                                        <div className="min-w-0">
                                            <p className="font-bold text-white">{p.brand} {p.model}</p>
                                            {p.description && <p className="text-xs text-zinc-400 line-clamp-2">{p.description}</p>}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        {p.skus.map(s => {
                                            const out = s.availableUnits <= 0;
                                            const checked = !wantsQuote && skuId === s.id;
                                            return (
                                                <label key={s.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer focus-within:ring-2 focus-within:ring-[#D4AF37] ${checked ? 'border-[#D4AF37] bg-[#D4AF37]/10' : 'border-zinc-800'} ${out ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                                    <input type="radio" name="sku" className="accent-[#D4AF37]" disabled={out} checked={checked}
                                                        onChange={() => { setSkuId(s.id); setWantsQuote(false); }} />
                                                    <span className="flex-1 text-sm text-white">{[s.storage, s.color, s.condition].filter(Boolean).join(' · ')}</span>
                                                    <span className="text-right text-sm">
                                                        <span className="block font-bold text-[#D4AF37]">{formatCents(s.cashPriceCents)}</span>
                                                        <span className="block text-[11px] text-zinc-500">{out ? 'Sem estoque' : 'à vista'}</span>
                                                    </span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                            <label className={`flex items-center gap-3 p-4 rounded-2xl border cursor-pointer focus-within:ring-2 focus-within:ring-[#D4AF37] ${wantsQuote ? 'border-[#D4AF37] bg-[#D4AF37]/10' : 'border-zinc-800 bg-[#1a1a1a]'}`}>
                                <input type="radio" name="sku" className="accent-[#D4AF37]" checked={wantsQuote} onChange={() => { setWantsQuote(true); setSkuId(null); }} />
                                <HelpCircle size={18} className="text-[#D4AF37]" aria-hidden="true" />
                                <span className="text-sm text-white">Solicitar cotação sem modelo definido</span>
                            </label>
                        </fieldset>
                        <Button variant="gold" className="w-full" disabled={!skuId && !wantsQuote} onClick={() => setStep(wantsQuote ? 3 : 2)}>Continuar</Button>
                    </div>
                );
    } else if (step === 2 && selected) {
        body = (
            <div className="space-y-4">
                <div className={cardCls}>
                    <p className="text-xs text-zinc-400">Aparelho escolhido</p>
                    <p className="font-bold text-white">{skuTitle(selected.product, selected.sku)}</p>
                    <p className="text-sm text-[#D4AF37]">{formatCents(selected.sku.cashPriceCents)} à vista</p>
                </div>
                <Field id="down" label="Entrada (R$)" error={downInput ? downError : null} hint={minDownCents ? `Mínimo ${formatCents(minDownCents)}` : undefined}>
                    <input id="down" inputMode="decimal" className={inputCls} placeholder="0,00" value={downInput}
                        aria-invalid={!!(downInput && downError)} aria-describedby={downInput && downError ? 'down-error' : undefined}
                        onChange={e => setDownInput(e.target.value)} />
                </Field>
                <Field id="inst" label="Número de parcelas">
                    <select id="inst" className={inputCls} value={installments} onChange={e => setInstallments(Number(e.target.value))}>
                        {Array.from({ length: maxInst }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}x</option>)}
                    </select>
                </Field>
                <ErrorBox message={simError} />
                <Button variant="outline" className="w-full" isLoading={simLoading} disabled={!!downError || downCents == null || !installments} onClick={runSimulation}>Simular</Button>
                {simulation && (
                    <div className={cardCls} aria-live="polite">
                        <Row label="Preço à vista" value={formatCents(simulation.cashPriceCents)} />
                        <Row label="Entrada" value={formatCents(simulation.downPaymentCents)} />
                        <Row label="Valor financiado" value={formatCents(simulation.financedCents)} />
                        <Row label="Parcela" value={`${simulation.schedule.length || installments}x de ${formatCents(simulation.installmentCents)}`} strong />
                        <Row label="Juros ao mês" value={formatBps(simulation.monthlyInterestBps)} />
                        <Row label="Total (entrada + parcelas)" value={formatCents(simulation.totalCents)} />
                        {simulation.schedule[0] && <Row label="1º vencimento previsto" value={formatDate(simulation.schedule[0].dueDate)} />}
                        <p className="text-xs text-zinc-400 mt-3">Simulação sujeita a análise. Financiamento próprio em parcelas, diferente de parcelamento no cartão de crédito.</p>
                    </div>
                )}
                <Button variant="gold" className="w-full" disabled={!simulation} onClick={() => setStep(3)}>Continuar</Button>
            </div>
        );
    } else if (step === 3) {
        body = (
            <div className="space-y-4">
                <Field id="income" label="Renda mensal (R$)" error={dataErrors.income}>
                    <input id="income" inputMode="decimal" className={inputCls} placeholder="0,00" value={incomeInput} aria-invalid={!!dataErrors.income}
                        onChange={e => setIncomeInput(e.target.value)} />
                </Field>
                <Field id="occupation" label="Ocupação" error={dataErrors.occupation}>
                    <input id="occupation" className={inputCls} value={occupation} maxLength={120} aria-invalid={!!dataErrors.occupation}
                        onChange={e => setOccupation(e.target.value)} />
                </Field>
                <Field id="notes" label="Observações (opcional)" hint={wantsQuote ? 'Diga qual modelo, cor e armazenamento você procura.' : undefined}>
                    <textarea id="notes" rows={3} className={inputCls} value={notes} maxLength={1000} onChange={e => setNotes(e.target.value)} />
                </Field>
                <fieldset className="space-y-2">
                    <legend className="text-sm font-medium text-zinc-300 mb-1">Documentos</legend>
                    {DOCS.map(d => (
                        <div key={d.kind}>
                            <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer focus-within:ring-2 focus-within:ring-[#D4AF37] ${docs[d.kind] ? 'border-green-600/50' : dataErrors[d.kind] ? 'border-red-500/60' : 'border-zinc-800'} bg-[#1a1a1a]`}>
                                {uploading === d.kind ? <Loader2 size={18} className="animate-spin text-[#D4AF37]" aria-hidden="true" />
                                    : docs[d.kind] ? <FileCheck2 size={18} className="text-green-400" aria-hidden="true" />
                                        : <Upload size={18} className="text-zinc-400" aria-hidden="true" />}
                                <span className="flex-1 text-sm text-white">{d.label}</span>
                                <span className="text-xs text-zinc-400">{docs[d.kind] ? 'Enviado — trocar' : 'Enviar'}</span>
                                <input type="file" accept="image/*,application/pdf" className="sr-only" disabled={!!uploading} aria-label={d.label}
                                    onChange={e => { handleUpload(d.kind, e.target.files?.[0]); e.target.value = ''; }} />
                            </label>
                            {dataErrors[d.kind] && <p role="alert" className="text-xs text-red-400 mt-1">{dataErrors[d.kind]}</p>}
                        </div>
                    ))}
                </fieldset>
                <Button variant="gold" className="w-full" disabled={!!uploading} onClick={() => validateData() && setStep(4)}>Revisar</Button>
            </div>
        );
    } else if (step === 4) {
        body = (
            <div className="space-y-4">
                <div className={cardCls}>
                    <h2 className="font-semibold text-white mb-2">Resumo</h2>
                    <Row label="Aparelho" value={selected ? skuTitle(selected.product, selected.sku) : 'Cotação sem modelo definido'} />
                    {simulation && <>
                        <Row label="Preço à vista" value={formatCents(simulation.cashPriceCents)} />
                        <Row label="Entrada" value={formatCents(simulation.downPaymentCents)} />
                        <Row label="Parcelas" value={`${installments}x de ${formatCents(simulation.installmentCents)}`} strong />
                        <Row label="Total" value={formatCents(simulation.totalCents)} />
                    </>}
                    <Row label="Renda mensal" value={formatCents(parseReaisToCents(incomeInput))} />
                    <Row label="Ocupação" value={occupation} />
                    <Row label="Documentos" value={`${DOCS.filter(d => docs[d.kind]).length} de ${DOCS.length}`} />
                </div>
                <label className="flex items-start gap-3 text-sm text-zinc-300">
                    <input type="checkbox" className="mt-1 accent-[#D4AF37]" checked={lgpd} onChange={e => setLgpd(e.target.checked)} />
                    <span>Autorizo o tratamento dos meus dados pessoais e documentos para análise desta proposta, conforme a LGPD (Lei 13.709/2018).</span>
                </label>
                <label className="flex items-start gap-3 text-sm text-zinc-300">
                    <input type="checkbox" className="mt-1 accent-[#D4AF37]" checked={terms} onChange={e => setTerms(e.target.checked)} />
                    <span>Li e aceito os termos do financiamento de celulares (versão {TERMS_VERSION}). Entendo que a simulação está sujeita a análise e que é um financiamento próprio, diferente de parcelamento no cartão.</span>
                </label>
                <ErrorBox message={submitError} />
                <Button variant="gold" className="w-full" isLoading={submitting} disabled={!lgpd || !terms} onClick={submit}>Enviar proposta</Button>
            </div>
        );
    } else if (step === 5) {
        body = (
            <div className={`${cardCls} text-center space-y-3`}>
                <CheckCircle2 size={48} className="mx-auto text-green-400" aria-hidden="true" />
                <h2 className="text-xl font-bold text-white">Proposta enviada!</h2>
                <p className="text-sm text-zinc-300">Protocolo</p>
                <p className="text-2xl font-mono font-bold text-[#D4AF37] select-all">{protocol}</p>
                <p className="text-xs text-zinc-400">Nossa equipe vai analisar sua proposta. Você pode acompanhar o andamento a qualquer momento.</p>
                <Button variant="gold" className="w-full" onClick={() => navigate(MY_ROUTE)}>Acompanhar</Button>
            </div>
        );
    } else {
        // Estado inconsistente (ex.: SKU sumiu da vitrine): volta para a escolha.
        body = <Button variant="secondary" className="w-full" onClick={() => setStep(1)}>Escolher aparelho</Button>;
    }

    return (
        <div className="min-h-screen bg-black text-white px-4 py-4 max-w-lg mx-auto">
            {header}
            {progress}
            {body}
        </div>
    );
};

export default PhoneFinancingWizard;
