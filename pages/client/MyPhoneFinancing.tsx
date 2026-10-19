import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Smartphone, FileText, Plus, CreditCard } from 'lucide-react';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Toast';
import { Badge, ErrorBox, Loading, Row, cardCls } from '../../components/PhoneFinancingUi';
import {
    phoneFinancingService as svc, formatCents, formatDate, statusLabel, isFeatureDisabled,
    type MyApplication, type MySale, type PhoneInstallment,
} from '../../services/phoneFinancingService';

const INSTALLMENT_LABELS: Record<string, string> = { pending: 'Em aberto', open: 'Em aberto', paid: 'Paga', overdue: 'Atrasada', partial: 'Parcial', cancelled: 'Cancelada' };
const SALE_LABELS: Record<string, string> = { active: 'Ativo', paid_off: 'Quitado', in_collection: 'Em cobrança', cancelled: 'Cancelado' };
const CONTRACT_LABELS: Record<string, string> = { legal_template_pending: 'Modelo jurídico pendente', generated: 'Gerado', signed: 'Assinado' };

const isOpen = (i: PhoneInstallment) => !['paid', 'cancelled'].includes(i.status.toLowerCase());

export const MyPhoneFinancing: React.FC = () => {
    const navigate = useNavigate();
    const { addToast } = useToast();
    const [apps, setApps] = useState<MyApplication[] | null>(null);
    const [sales, setSales] = useState<MySale[] | null>(null);
    const [installments, setInstallments] = useState<PhoneInstallment[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [disabled, setDisabled] = useState(false);
    const [paying, setPaying] = useState<string | null>(null);

    const load = useCallback(async () => {
        setError(null);
        try {
            const [a, s, i] = await Promise.all([svc.getMyApplications(), svc.getMyContracts(), svc.getMyInstallments()]);
            setApps(a); setSales(s); setInstallments(i);
        } catch (e: any) {
            if (isFeatureDisabled(e)) setDisabled(true);
            else setError(e.message);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const pay = async (inst: PhoneInstallment) => {
        // Abre a aba antes do await para não ser bloqueada como pop-up.
        const win = window.open('', '_blank');
        setPaying(inst.id);
        try {
            const charge = await svc.payInstallment(inst.id);
            if (!charge.checkoutUrl) throw new Error('Link de pagamento indisponível. Tente novamente.');
            if (win) { win.opener = null; win.location.href = charge.checkoutUrl; }
            else window.location.href = charge.checkoutUrl;
        } catch (e: any) {
            win?.close();
            addToast(isFeatureDisabled(e) ? 'Pagamento online indisponível no momento. Fale com nosso atendimento.' : e.message, 'error');
        } finally {
            setPaying(null);
        }
    };

    let content: React.ReactNode;
    if (disabled) {
        content = <p className={`${cardCls} text-sm text-zinc-400`}>O financiamento de celulares está indisponível no momento.</p>;
    } else if (error) {
        content = <ErrorBox message={error} onRetry={load} />;
    } else if (!apps || !sales) {
        content = <Loading />;
    } else {
        content = (
            <div className="space-y-6">
                <section aria-labelledby="sec-contracts">
                    <h2 id="sec-contracts" className="text-sm font-semibold text-zinc-300 mb-2">Contratos</h2>
                    {sales.length === 0 ? <p className="text-sm text-zinc-500">Nenhum contrato ainda.</p> : (
                        <div className="space-y-3">
                            {sales.map(s => {
                                const insts = installments.filter(i => i.saleId === s.id).sort((a, b) => a.number - b.number);
                                return (
                                    <article key={s.id} className={cardCls}>
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <Smartphone size={20} className="text-[#D4AF37] shrink-0" aria-hidden="true" />
                                                <h3 className="font-bold text-white truncate">{[s.device.model, s.device.storage, s.device.color].filter(Boolean).join(' · ')}</h3>
                                            </div>
                                            <Badge status={s.status}>{SALE_LABELS[s.status] || s.status}</Badge>
                                        </div>
                                        <Row label="Nº de série" value={s.device.serialMasked || '—'} />
                                        <Row label="IMEI" value={s.device.imeiMasked || '—'} />
                                        <Row label="Preço à vista" value={formatCents(s.cashPriceCents)} />
                                        <Row label="Entrada" value={formatCents(s.downPaymentCents)} />
                                        <Row label="Total financiado" value={formatCents(s.totalCents)} />
                                        <Row label="Pago" value={formatCents(s.paidCents)} />
                                        <Row label="Saldo" value={formatCents(s.balanceCents)} strong />
                                        {s.nextInstallment && (
                                            <Row label="Próxima parcela" value={`${formatCents(s.nextInstallment.amountCents)} em ${formatDate(s.nextInstallment.dueDate)}`} />
                                        )}
                                        <Row label="Entrega" value={formatDate(s.physicalDeliveryDate)} />
                                        <Row label="Quitação" value={formatDate(s.paidOffAt)} />
                                        <Row label="Transferência de titularidade" value={formatDate(s.legalTitleTransferDate)} />
                                        {s.contract && (
                                            <div className="flex items-center justify-between gap-2 pt-2 mt-2 border-t border-zinc-800 text-sm">
                                                <span className="text-zinc-400">Contrato: {CONTRACT_LABELS[s.contract.status] || s.contract.status}</span>
                                                {s.contract.pdfUrl && (
                                                    <a href={s.contract.pdfUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[#D4AF37] font-semibold hover:underline">
                                                        <FileText size={16} aria-hidden="true" /> Ver PDF
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                        {insts.length > 0 && (
                                            <div className="mt-3 pt-3 border-t border-zinc-800">
                                                <h4 className="text-xs font-semibold text-zinc-400 mb-2">Parcelas</h4>
                                                <ul className="space-y-2">
                                                    {insts.map(i => (
                                                        <li key={i.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-zinc-900">
                                                            <span className="text-xs text-zinc-500 w-8">{i.kind === 'down_payment' || i.kind === 'DOWN_PAYMENT' ? 'Ent.' : `${i.number}ª`}</span>
                                                            <span className="flex-1 min-w-0">
                                                                <span className="block text-sm text-white">{formatCents(i.amountCents - (i.paidCents || 0))}</span>
                                                                <span className="block text-xs text-zinc-500">Vence {formatDate(i.dueDate)}</span>
                                                            </span>
                                                            <Badge status={i.status.toLowerCase()}>{INSTALLMENT_LABELS[i.status.toLowerCase()] || i.status}</Badge>
                                                            {isOpen(i) && (
                                                                <Button size="sm" variant="gold" isLoading={paying === i.id} disabled={!!paying} onClick={() => pay(i)} aria-label={`Pagar parcela ${i.number}`}>
                                                                    <CreditCard size={14} aria-hidden="true" /> Pagar
                                                                </Button>
                                                            )}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </section>

                <section aria-labelledby="sec-apps">
                    <h2 id="sec-apps" className="text-sm font-semibold text-zinc-300 mb-2">Propostas</h2>
                    {apps.length === 0 ? <p className="text-sm text-zinc-500">Nenhuma proposta enviada.</p> : (
                        <ul className="space-y-2">
                            {apps.map(a => (
                                <li key={a.id} className={`${cardCls} flex items-center justify-between gap-3`}>
                                    <div className="min-w-0">
                                        <p className="font-mono text-sm text-[#D4AF37]">{a.protocol}</p>
                                        <p className="text-sm text-white truncate">{a.sku ? [a.sku.brand, a.sku.model, a.sku.storage, a.sku.color].filter(Boolean).join(' · ') || a.sku.sku : 'Cotação sem modelo'}</p>
                                        <p className="text-xs text-zinc-500">{formatDate(a.createdAt)}</p>
                                    </div>
                                    <Badge status={a.status}>{a.statusLabel || statusLabel(a.status)}</Badge>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white px-4 py-4 max-w-lg mx-auto pb-24">
            <header className="flex items-center gap-3 mb-5">
                <button type="button" onClick={() => navigate(-1)} aria-label="Voltar" className="p-2 rounded-full bg-zinc-900 text-zinc-300 hover:text-white focus-visible:ring-2 focus-visible:ring-[#D4AF37]">
                    <ChevronLeft size={20} />
                </button>
                <h1 className="flex-1 text-lg font-bold">Meus financiamentos de celulares</h1>
            </header>
            {content}
            {!disabled && (
                <Button variant="outline" className="w-full mt-6" onClick={() => navigate('/client/financiamento-celulares/solicitar')}>
                    <Plus size={18} aria-hidden="true" /> Nova solicitação
                </Button>
            )}
        </div>
    );
};

export default MyPhoneFinancing;
