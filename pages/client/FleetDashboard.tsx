import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Car, Calendar, DollarSign, Video, FileText, Download, MapPin,
    CheckCircle, Clock, AlertTriangle, Wrench, ChevronDown, ChevronUp,
    Send, Copy, Check, Phone, Upload
} from 'lucide-react';
import { Button } from '../../components/Button';
import { Skeleton } from '../../components/Skeleton';
import { VideoUpload } from '../../components/VideoUpload';
import { PixQrCode } from '../../components/PixQrCode';
import { useToast } from '../../components/Toast';
import { fleetService } from '../../services/fleetService';
import { locationTrackingService } from '../../services/locationTrackingService';
import { supabase } from '../../services/supabaseClient';
import {
    FleetRental, FleetWeeklyPayment, FleetVideoCheck,
    FleetSettings, VEHICLE_TYPE_LABELS
} from '../../types';

export const FleetDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { addToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [rental, setRental] = useState<FleetRental | null>(null);
    const [payments, setPayments] = useState<FleetWeeklyPayment[]>([]);
    const [videoChecks, setVideoChecks] = useState<FleetVideoCheck[]>([]);
    const [settings, setSettings] = useState<FleetSettings | null>(null);
    const [showPaymentHistory, setShowPaymentHistory] = useState(false);
    const [showVideoHistory, setShowVideoHistory] = useState(false);
    const [copiedPix, setCopiedPix] = useState(false);

    // Video upload state
    const [videoExterior, setVideoExterior] = useState('');
    const [videoDashboard, setVideoDashboard] = useState('');
    const [videoResidence, setVideoResidence] = useState('');
    const [submittingVideo, setSubmittingVideo] = useState(false);

    // Maintenance ticket
    const [showTicketForm, setShowTicketForm] = useState(false);
    const [ticketTitle, setTicketTitle] = useState('');
    const [ticketDescription, setTicketDescription] = useState('');
    const [submittingTicket, setSubmittingTicket] = useState(false);

    // Payment proof upload
    const [uploadingProof, setUploadingProof] = useState(false);

    useEffect(() => {
        loadData();
        // Log GPS silently
        captureLocation();
    }, []);

    const captureLocation = async () => {
        try {
            const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
            });
            if (rental) {
                await fleetService.logLocation({
                    rentalId: rental.id,
                    customerId: rental.customerId,
                    eventType: 'DASHBOARD_ACCESS',
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                    accuracy: pos.coords.accuracy,
                });
            }
            // Also save to general location tracking
            locationTrackingService.captureAndSave().catch(() => {});
        } catch {
            // Silent fail
        }
    };

    const loadData = async () => {
        setLoading(true);
        try {
            // Get current user's customer ID
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { navigate('/login'); return; }

            const { data: userData } = await supabase
                .from('users')
                .select('id, email')
                .eq('auth_id', user.id)
                .single();

            if (!userData) return;

            const { data: customer } = await supabase
                .from('customers')
                .select('id')
                .eq('email', userData.email)
                .maybeSingle();

            if (!customer) {
                setLoading(false);
                return;
            }

            const activeRental = await fleetService.getActiveRentalByCustomer(customer.id);
            setRental(activeRental);

            if (activeRental) {
                const [paymentsData, videosData, settingsData] = await Promise.all([
                    fleetService.getPaymentsByRental(activeRental.id),
                    fleetService.getVideoChecksByRental(activeRental.id),
                    fleetService.getFleetSettings(),
                ]);
                setPayments(paymentsData);
                setVideoChecks(videosData);
                setSettings(settingsData);

                // Log location with rental context
                captureLocation();
            }
        } catch (err) {
            console.error('Erro ao carregar dados:', err);
            addToast('Erro ao carregar dados da locacao', 'error');
        } finally {
            setLoading(false);
        }
    };

    const currentPayment = payments.find(p => p.status === 'PENDING' || p.status === 'LATE');
    const currentVideoCheck = videoChecks.find(v => v.status === 'PENDING');
    const paidPayments = payments.filter(p => p.status === 'PAID');
    const totalPaid = paidPayments.reduce((sum, p) => sum + p.totalDue, 0);

    const handleSubmitVideos = async () => {
        if (!currentVideoCheck) return;
        if (!videoExterior && !videoDashboard && !videoResidence) {
            addToast('Envie pelo menos um video', 'error');
            return;
        }
        setSubmittingVideo(true);
        try {
            let geo: { latitude: number; longitude: number; accuracy?: number } | undefined;
            try {
                const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
                });
                geo = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy };
            } catch { /* GPS optional */ }

            await fleetService.submitVideoCheck(currentVideoCheck.id, {
                videoExteriorUrl: videoExterior || undefined,
                videoDashboardUrl: videoDashboard || undefined,
                videoResidenceUrl: videoResidence || undefined,
            }, geo);

            addToast('Videos enviados com sucesso!', 'success');
            setVideoExterior('');
            setVideoDashboard('');
            setVideoResidence('');
            await loadData();
        } catch (err) {
            addToast('Erro ao enviar videos', 'error');
        } finally {
            setSubmittingVideo(false);
        }
    };

    const handleUploadProof = async (paymentId: string, file: File) => {
        setUploadingProof(true);
        try {
            const path = `fleet/proofs/${paymentId}_${Date.now()}.${file.name.split('.').pop()}`;
            const { error: uploadErr } = await supabase.storage.from('documents').upload(path, file);
            if (uploadErr) throw uploadErr;
            const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path);

            await supabase.from('fleet_weekly_payments').update({
                proof_url: publicUrl,
            }).eq('id', paymentId);

            addToast('Comprovante enviado!', 'success');
            await loadData();
        } catch {
            addToast('Erro ao enviar comprovante', 'error');
        } finally {
            setUploadingProof(false);
        }
    };

    const handleSubmitTicket = async () => {
        if (!rental || !ticketTitle.trim()) return;
        setSubmittingTicket(true);
        try {
            await fleetService.createTicket({
                vehicleId: rental.vehicleId,
                rentalId: rental.id,
                customerId: rental.customerId,
                type: 'MAINTENANCE',
                title: ticketTitle,
                description: ticketDescription,
                priority: 'NORMAL',
            });
            addToast('Chamado aberto com sucesso!', 'success');
            setTicketTitle('');
            setTicketDescription('');
            setShowTicketForm(false);
        } catch {
            addToast('Erro ao abrir chamado', 'error');
        } finally {
            setSubmittingTicket(false);
        }
    };

    const copyPix = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedPix(true);
        setTimeout(() => setCopiedPix(false), 2000);
    };

    const formatCurrency = (val: number) => `R$ ${val.toFixed(2).replace('.', ',')}`;
    const formatDate = (d: string) => {
        if (!d) return '--';
        const [y, m, day] = d.split('-');
        return `${day}/${m}/${y}`;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black p-4 space-y-4">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
            </div>
        );
    }

    if (!rental) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <div className="text-center space-y-4">
                    <Car size={64} className="text-zinc-600 mx-auto" />
                    <h2 className="text-xl font-bold text-white">Nenhuma locacao ativa</h2>
                    <p className="text-zinc-400">Voce nao possui nenhum veiculo alugado no momento.</p>
                    <Button onClick={() => navigate('/client/wizard')} className="bg-emerald-600 hover:bg-emerald-700">
                        Solicitar Locacao
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black p-4 pb-24 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold text-white">Meu Veiculo</h1>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    rental.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' :
                    rental.status === 'SUSPENDED' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-zinc-500/20 text-zinc-400'
                }`}>
                    {rental.status === 'ACTIVE' ? 'Ativo' : rental.status === 'SUSPENDED' ? 'Suspenso' : rental.status}
                </span>
            </div>

            {/* Vehicle Card */}
            {rental.vehicle && (
                <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-700 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                        {rental.vehicle.photoUrls?.[0] ? (
                            <img src={rental.vehicle.photoUrls[0]} alt="Veiculo" className="w-20 h-20 rounded-lg object-cover" />
                        ) : (
                            <div className="w-20 h-20 bg-zinc-700 rounded-lg flex items-center justify-center">
                                <Car size={32} className="text-zinc-500" />
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <h3 className="text-white font-bold text-lg truncate">
                                {rental.vehicle.brand} {rental.vehicle.model}
                            </h3>
                            <p className="text-zinc-400 text-sm">{rental.vehicle.year} - {VEHICLE_TYPE_LABELS[rental.vehicle.type]}</p>
                            <p className="text-[#D4AF37] font-bold mt-1">{rental.vehicle.licensePlate}</p>
                            {rental.vehicle.color && (
                                <p className="text-zinc-500 text-xs mt-1">Cor: {rental.vehicle.color}</p>
                            )}
                        </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-zinc-700 flex justify-between text-sm">
                        <div>
                            <span className="text-zinc-400">Contrato</span>
                            <p className="text-white font-mono text-xs">{rental.contractNumber || '--'}</p>
                        </div>
                        <div className="text-right">
                            <span className="text-zinc-400">Inicio</span>
                            <p className="text-white">{formatDate(rental.startDate)}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Current Payment */}
            {currentPayment && (
                <div className={`border rounded-xl p-4 ${
                    currentPayment.status === 'LATE'
                        ? 'bg-red-950/30 border-red-500/30'
                        : 'bg-zinc-900 border-zinc-700'
                }`}>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <DollarSign size={20} className={currentPayment.status === 'LATE' ? 'text-red-400' : 'text-emerald-400'} />
                            <h3 className="text-white font-bold">Pagamento Semana {currentPayment.weekNumber}</h3>
                        </div>
                        {currentPayment.status === 'LATE' && (
                            <span className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded text-xs font-bold">ATRASADO</span>
                        )}
                    </div>

                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-zinc-400">Periodo</span>
                            <span className="text-white">{formatDate(currentPayment.periodStart)} - {formatDate(currentPayment.periodEnd)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-zinc-400">Valor</span>
                            <span className="text-white">{formatCurrency(currentPayment.amount)}</span>
                        </div>
                        {currentPayment.lateFee > 0 && (
                            <div className="flex justify-between">
                                <span className="text-red-400">Multa</span>
                                <span className="text-red-400">{formatCurrency(currentPayment.lateFee)}</span>
                            </div>
                        )}
                        {currentPayment.lateInterest > 0 && (
                            <div className="flex justify-between">
                                <span className="text-red-400">Juros</span>
                                <span className="text-red-400">{formatCurrency(currentPayment.lateInterest)}</span>
                            </div>
                        )}
                        <div className="flex justify-between pt-2 border-t border-zinc-700">
                            <span className="text-zinc-300 font-bold">Total</span>
                            <span className="text-[#D4AF37] font-bold text-lg">{formatCurrency(currentPayment.totalDue)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-zinc-400">Vencimento</span>
                            <span className={`font-bold ${currentPayment.status === 'LATE' ? 'text-red-400' : 'text-white'}`}>
                                {formatDate(currentPayment.dueDate)}
                            </span>
                        </div>
                    </div>

                    {/* PIX Payment */}
                    {settings?.pixKey && (
                        <div className="mt-4 pt-3 border-t border-zinc-700">
                            <PixQrCode
                                pixKey={settings.pixKey}
                                pixKeyType={(settings.pixKeyType?.toUpperCase() || 'CPF') as any}
                                receiverName={settings.pixReceiverName || 'Tubarao Locacao'}
                                amount={currentPayment.totalDue}
                                description={`Locacao Semana ${currentPayment.weekNumber}`}
                            />
                        </div>
                    )}

                    {/* Upload proof */}
                    {!currentPayment.proofUrl ? (
                        <div className="mt-3">
                            <label className="flex items-center gap-2 justify-center bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-4 rounded-lg cursor-pointer text-sm font-bold transition-colors">
                                <Upload size={16} />
                                {uploadingProof ? 'Enviando...' : 'Enviar Comprovante'}
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    disabled={uploadingProof}
                                    onChange={(e) => {
                                        const f = e.target.files?.[0];
                                        if (f) handleUploadProof(currentPayment.id, f);
                                    }}
                                />
                            </label>
                        </div>
                    ) : (
                        <div className="mt-3 flex items-center gap-2 text-emerald-400 text-sm">
                            <CheckCircle size={16} />
                            <span>Comprovante enviado - aguardando confirmacao</span>
                        </div>
                    )}
                </div>
            )}

            {/* No pending payment */}
            {!currentPayment && payments.length > 0 && (
                <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
                    <CheckCircle size={24} className="text-emerald-400" />
                    <div>
                        <p className="text-white font-bold">Pagamento em dia!</p>
                        <p className="text-zinc-400 text-sm">Nenhum pagamento pendente no momento.</p>
                    </div>
                </div>
            )}

            {/* Weekly Video Check */}
            {currentVideoCheck && (
                <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Video size={20} className="text-purple-400" />
                        <h3 className="text-white font-bold">Videos Obrigatorios - Semana {currentVideoCheck.weekNumber}</h3>
                    </div>
                    <p className="text-zinc-400 text-sm mb-3">
                        Envie os 3 videos obrigatorios ate {formatDate(currentVideoCheck.dueDate)}
                    </p>

                    <div className="space-y-3">
                        <VideoUpload
                            label="Video Exterior do Veiculo"
                            subtitle="Grave mostrando todos os lados do veiculo"
                            videoUrl={videoExterior}
                            onUpload={setVideoExterior}
                            onRemove={() => setVideoExterior('')}
                        />
                        <VideoUpload
                            label="Video do Painel/KM"
                            subtitle="Grave mostrando o painel com quilometragem"
                            videoUrl={videoDashboard}
                            onUpload={setVideoDashboard}
                            onRemove={() => setVideoDashboard('')}
                        />
                        <VideoUpload
                            label="Video da Residencia"
                            subtitle="Grave mostrando o veiculo na sua residencia"
                            videoUrl={videoResidence}
                            onUpload={setVideoResidence}
                            onRemove={() => setVideoResidence('')}
                        />
                    </div>

                    <Button
                        onClick={handleSubmitVideos}
                        disabled={submittingVideo || (!videoExterior && !videoDashboard && !videoResidence)}
                        className="w-full mt-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
                    >
                        <Send size={16} className="mr-2" />
                        {submittingVideo ? 'Enviando...' : 'Enviar Videos'}
                    </Button>
                </div>
            )}

            {/* No pending video */}
            {!currentVideoCheck && videoChecks.length > 0 && videoChecks.every(v => v.status !== 'PENDING') && (
                <div className="bg-purple-950/30 border border-purple-500/30 rounded-xl p-4 flex items-center gap-3">
                    <CheckCircle size={16} className="text-purple-400" />
                    <p className="text-zinc-300 text-sm">Todos os videos da semana foram enviados.</p>
                </div>
            )}

            {/* Payment Summary */}
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4">
                <div className="grid grid-cols-2 gap-3 text-center">
                    <div>
                        <p className="text-zinc-400 text-xs">Valor Semanal</p>
                        <p className="text-[#D4AF37] font-bold">{formatCurrency(rental.weeklyRate)}</p>
                    </div>
                    <div>
                        <p className="text-zinc-400 text-xs">Total Pago</p>
                        <p className="text-emerald-400 font-bold">{formatCurrency(totalPaid)}</p>
                    </div>
                    <div>
                        <p className="text-zinc-400 text-xs">Semanas Pagas</p>
                        <p className="text-white font-bold">{paidPayments.length}</p>
                    </div>
                    <div>
                        <p className="text-zinc-400 text-xs">Caucao</p>
                        <p className={`font-bold ${rental.depositPaid ? 'text-emerald-400' : 'text-yellow-400'}`}>
                            {rental.depositPaid ? 'Pago' : formatCurrency(rental.depositAmount)}
                        </p>
                    </div>
                </div>
            </div>

            {/* Payment History */}
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden">
                <button
                    onClick={() => setShowPaymentHistory(!showPaymentHistory)}
                    className="w-full flex items-center justify-between p-4 text-white"
                >
                    <div className="flex items-center gap-2">
                        <Calendar size={18} className="text-zinc-400" />
                        <span className="font-bold">Historico de Pagamentos</span>
                        <span className="bg-zinc-700 px-2 py-0.5 rounded text-xs">{payments.length}</span>
                    </div>
                    {showPaymentHistory ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
                {showPaymentHistory && (
                    <div className="border-t border-zinc-700 divide-y divide-zinc-800">
                        {payments.map((p) => (
                            <div key={p.id} className="p-3 flex items-center justify-between text-sm">
                                <div>
                                    <span className="text-white">Semana {p.weekNumber}</span>
                                    <p className="text-zinc-500 text-xs">{formatDate(p.periodStart)} - {formatDate(p.periodEnd)}</p>
                                </div>
                                <div className="text-right">
                                    <span className="text-white font-bold">{formatCurrency(p.totalDue)}</span>
                                    <p className={`text-xs font-bold ${
                                        p.status === 'PAID' ? 'text-emerald-400' :
                                        p.status === 'LATE' ? 'text-red-400' :
                                        p.status === 'PENDING' ? 'text-yellow-400' : 'text-zinc-500'
                                    }`}>
                                        {p.status === 'PAID' ? 'Pago' : p.status === 'LATE' ? 'Atrasado' : p.status === 'PENDING' ? 'Pendente' : 'Cancelado'}
                                    </p>
                                </div>
                            </div>
                        ))}
                        {payments.length === 0 && (
                            <p className="p-4 text-center text-zinc-500 text-sm">Nenhum pagamento registrado</p>
                        )}
                    </div>
                )}
            </div>

            {/* Video History */}
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden">
                <button
                    onClick={() => setShowVideoHistory(!showVideoHistory)}
                    className="w-full flex items-center justify-between p-4 text-white"
                >
                    <div className="flex items-center gap-2">
                        <Video size={18} className="text-zinc-400" />
                        <span className="font-bold">Historico de Videos</span>
                        <span className="bg-zinc-700 px-2 py-0.5 rounded text-xs">{videoChecks.length}</span>
                    </div>
                    {showVideoHistory ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
                {showVideoHistory && (
                    <div className="border-t border-zinc-700 divide-y divide-zinc-800">
                        {videoChecks.map((v) => (
                            <div key={v.id} className="p-3 flex items-center justify-between text-sm">
                                <div>
                                    <span className="text-white">Semana {v.weekNumber}</span>
                                    <p className="text-zinc-500 text-xs">Vence: {formatDate(v.dueDate)}</p>
                                </div>
                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                    v.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400' :
                                    v.status === 'SUBMITTED' ? 'bg-blue-500/20 text-blue-400' :
                                    v.status === 'REJECTED' ? 'bg-red-500/20 text-red-400' :
                                    'bg-yellow-500/20 text-yellow-400'
                                }`}>
                                    {v.status === 'APPROVED' ? 'Aprovado' : v.status === 'SUBMITTED' ? 'Enviado' : v.status === 'REJECTED' ? 'Rejeitado' : 'Pendente'}
                                </span>
                            </div>
                        ))}
                        {videoChecks.length === 0 && (
                            <p className="p-4 text-center text-zinc-500 text-sm">Nenhum video registrado</p>
                        )}
                    </div>
                )}
            </div>

            {/* Contract Download */}
            {rental.contractPdfUrl && (
                <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 border border-emerald-500/30 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <FileText size={24} className="text-emerald-400" />
                            <div>
                                <p className="text-white font-bold">Contrato de Locacao</p>
                                <p className="text-zinc-400 text-xs">{rental.contractNumber}</p>
                            </div>
                        </div>
                        <a
                            href={rental.contractPdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-sm font-bold transition-colors"
                        >
                            <Download size={16} />
                            PDF
                        </a>
                    </div>
                </div>
            )}

            {/* Open Maintenance Ticket */}
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4">
                <button
                    onClick={() => setShowTicketForm(!showTicketForm)}
                    className="w-full flex items-center gap-2 text-white"
                >
                    <Wrench size={18} className="text-orange-400" />
                    <span className="font-bold">Abrir Chamado de Manutencao</span>
                </button>

                {showTicketForm && (
                    <div className="mt-3 pt-3 border-t border-zinc-700 space-y-3">
                        <input
                            type="text"
                            placeholder="Titulo do chamado (ex: Barulho no motor)"
                            value={ticketTitle}
                            onChange={(e) => setTicketTitle(e.target.value)}
                            className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-white text-sm placeholder-zinc-500"
                        />
                        <textarea
                            placeholder="Descreva o problema em detalhes..."
                            value={ticketDescription}
                            onChange={(e) => setTicketDescription(e.target.value)}
                            rows={3}
                            className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-white text-sm placeholder-zinc-500 resize-none"
                        />
                        <Button
                            onClick={handleSubmitTicket}
                            disabled={submittingTicket || !ticketTitle.trim()}
                            className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50"
                        >
                            {submittingTicket ? 'Enviando...' : 'Enviar Chamado'}
                        </Button>
                    </div>
                )}
            </div>

            {/* Contact Support */}
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4">
                <div className="flex items-center gap-2 text-zinc-400 text-sm">
                    <Phone size={16} />
                    <span>Duvidas? Entre em contato com o suporte pelo WhatsApp.</span>
                </div>
            </div>
        </div>
    );
};
