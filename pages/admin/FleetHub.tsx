// FleetHub - Central de Gestao de Frota
import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Car, Search, Plus, X, Check, RefreshCw, Eye, Trash2,
    LayoutDashboard, ClipboardList, DollarSign, Video, Wrench,
    Bell, Settings, TrendingUp, AlertTriangle, Clock, CheckCircle2,
    Filter, ChevronDown, MapPin, Calendar, FileText, Shield,
    Fuel, Hash, Palette, BarChart3, Users, Percent, CreditCard,
    Play, XCircle, Edit2, Save, BellRing, Info
} from 'lucide-react';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Toast';
import { fleetService } from '../../services/fleetService';
import {
    FleetVehicle, FleetRental, FleetWeeklyPayment, FleetVideoCheck,
    FleetMaintenanceTicket, FleetAlert, FleetSettings,
    VehicleType, VehicleStatus, RentalStatus, RentalPaymentStatus,
    VEHICLE_TYPE_LABELS, VEHICLE_STATUS_LABELS
} from '../../types';

type TabType = 'dashboard' | 'veiculos' | 'locacoes' | 'pagamentos' | 'videos' | 'manutencao' | 'alertas' | 'config';

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '-';
const fmtDateTime = (d: string) => d ? new Date(d).toLocaleString('pt-BR') : '-';

const RENTAL_STATUS_LABELS: Record<RentalStatus, string> = {
    PENDING: 'Pendente', ACTIVE: 'Ativa', SUSPENDED: 'Suspensa', COMPLETED: 'Finalizada', CANCELLED: 'Cancelada'
};
const PAYMENT_STATUS_LABELS: Record<RentalPaymentStatus, string> = {
    PENDING: 'Pendente', PAID: 'Pago', LATE: 'Atrasado', CANCELLED: 'Cancelado'
};
const VIDEO_STATUS_LABELS: Record<string, string> = {
    PENDING: 'Pendente', SUBMITTED: 'Enviado', APPROVED: 'Aprovado', REJECTED: 'Rejeitado'
};
const TICKET_STATUS_LABELS: Record<string, string> = {
    OPEN: 'Aberto', IN_PROGRESS: 'Em Andamento', RESOLVED: 'Resolvido', CANCELLED: 'Cancelado'
};
const ALERT_TYPE_LABELS: Record<string, string> = {
    NO_ACCESS: 'Sem Acesso', NO_VIDEO: 'Sem Video', LATE_PAYMENT: 'Pagamento Atrasado',
    LOCATION_CHANGE: 'Mudanca Local', VEHICLE_BLOCKED: 'Veiculo Bloqueado'
};
const SEVERITY_LABELS: Record<string, string> = { INFO: 'Info', WARNING: 'Alerta', CRITICAL: 'Critico' };

const statusColor = (s: string) => {
    const m: Record<string, string> = {
        AVAILABLE: 'bg-green-900/30 text-green-400 border-green-500/30',
        RENTED: 'bg-blue-900/30 text-blue-400 border-blue-500/30',
        MAINTENANCE: 'bg-yellow-900/30 text-yellow-400 border-yellow-500/30',
        BLOCKED: 'bg-red-900/30 text-red-400 border-red-500/30',
        RETIRED: 'bg-zinc-800 text-zinc-400 border-zinc-600',
        ACTIVE: 'bg-green-900/30 text-green-400 border-green-500/30',
        PENDING: 'bg-yellow-900/30 text-yellow-400 border-yellow-500/30',
        SUSPENDED: 'bg-orange-900/30 text-orange-400 border-orange-500/30',
        COMPLETED: 'bg-blue-900/30 text-blue-400 border-blue-500/30',
        CANCELLED: 'bg-zinc-800 text-zinc-400 border-zinc-600',
        PAID: 'bg-green-900/30 text-green-400 border-green-500/30',
        LATE: 'bg-red-900/30 text-red-400 border-red-500/30',
        SUBMITTED: 'bg-blue-900/30 text-blue-400 border-blue-500/30',
        APPROVED: 'bg-green-900/30 text-green-400 border-green-500/30',
        REJECTED: 'bg-red-900/30 text-red-400 border-red-500/30',
        OPEN: 'bg-yellow-900/30 text-yellow-400 border-yellow-500/30',
        IN_PROGRESS: 'bg-blue-900/30 text-blue-400 border-blue-500/30',
        RESOLVED: 'bg-green-900/30 text-green-400 border-green-500/30',
    };
    return m[s] || 'bg-zinc-800 text-zinc-400 border-zinc-600';
};

const severityColor = (s: string) => {
    if (s === 'CRITICAL') return 'bg-red-900/30 text-red-400 border-red-500/30';
    if (s === 'WARNING') return 'bg-yellow-900/30 text-yellow-400 border-yellow-500/30';
    return 'bg-blue-900/30 text-blue-400 border-blue-500/30';
};

export const FleetHub: React.FC = () => {
    const { addToast } = useToast();
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<TabType>('dashboard');
    const [loading, setLoading] = useState(true);

    // Data
    const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
    const [rentals, setRentals] = useState<FleetRental[]>([]);
    const [payments, setPayments] = useState<FleetWeeklyPayment[]>([]);
    const [videoChecks, setVideoChecks] = useState<FleetVideoCheck[]>([]);
    const [tickets, setTickets] = useState<FleetMaintenanceTicket[]>([]);
    const [alerts, setAlerts] = useState<FleetAlert[]>([]);
    const [settings, setSettings] = useState<FleetSettings | null>(null);
    const [dashStats, setDashStats] = useState<any>(null);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [vehicleStatusFilter, setVehicleStatusFilter] = useState<VehicleStatus | 'ALL'>('ALL');
    const [vehicleTypeFilter, setVehicleTypeFilter] = useState<VehicleType | 'ALL'>('ALL');
    const [rentalStatusFilter, setRentalStatusFilter] = useState<RentalStatus | 'ALL'>('ALL');
    const [paymentStatusFilter, setPaymentStatusFilter] = useState<RentalPaymentStatus | 'ALL'>('ALL');
    const [videoStatusFilter, setVideoStatusFilter] = useState<string>('ALL');
    const [ticketStatusFilter, setTicketStatusFilter] = useState<string>('ALL');
    const [alertTypeFilter, setAlertTypeFilter] = useState<string>('ALL');
    const [alertResolvedFilter, setAlertResolvedFilter] = useState<string>('active');

    // Modals
    const [showVehicleModal, setShowVehicleModal] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState<Partial<FleetVehicle> | null>(null);
    const [showRentalModal, setShowRentalModal] = useState(false);
    const [editingRental, setEditingRental] = useState<Partial<FleetRental> | null>(null);
    const [showTicketModal, setShowTicketModal] = useState(false);
    const [editingTicket, setEditingTicket] = useState<Partial<FleetMaintenanceTicket> | null>(null);
    const [showVideoReviewModal, setShowVideoReviewModal] = useState(false);
    const [reviewingVideo, setReviewingVideo] = useState<FleetVideoCheck | null>(null);
    const [videoAdminNotes, setVideoAdminNotes] = useState('');
    const [saving, setSaving] = useState(false);

    // Settings form
    const [settingsForm, setSettingsForm] = useState<Partial<FleetSettings>>({});

    // Read tab from URL
    useEffect(() => {
        const tabParam = searchParams.get('tab');
        const validTabs: TabType[] = ['dashboard', 'veiculos', 'locacoes', 'pagamentos', 'videos', 'manutencao', 'alertas', 'config'];
        if (tabParam && validTabs.includes(tabParam as TabType)) {
            setActiveTab(tabParam as TabType);
        }
    }, [searchParams]);

    useEffect(() => { loadAllData(); }, []);

    const loadAllData = async () => {
        setLoading(true);
        try {
            const [v, r, p, vc, t, a, s, ds] = await Promise.all([
                fleetService.getVehicles(),
                fleetService.getRentals(),
                fleetService.getAllPayments(),
                fleetService.getPendingVideoChecks(),
                fleetService.getAllTickets(),
                fleetService.getAllAlerts(),
                fleetService.getFleetSettings(),
                fleetService.getFleetDashboardStats(),
            ]);
            setVehicles(v);
            setRentals(r);
            setPayments(p);
            setVideoChecks(vc);
            setTickets(t);
            setAlerts(a);
            setSettings(s);
            setDashStats(ds);
            if (s) setSettingsForm(s);
        } catch (err) {
            console.error('Error loading fleet data:', err);
            addToast('Erro ao carregar dados da frota', 'error');
        }
        setLoading(false);
    };

    // ============ VEHICLE HANDLERS ============
    const openVehicleModal = (vehicle?: FleetVehicle) => {
        setEditingVehicle(vehicle ? { ...vehicle } : {
            type: 'CAR' as VehicleType, status: 'AVAILABLE' as VehicleStatus,
            brand: '', model: '', year: new Date().getFullYear(), licensePlate: '',
            weeklyRate: 0, depositAmount: 0, mileage: 0, photoUrls: [], blockable: true,
        });
        setShowVehicleModal(true);
    };

    const handleSaveVehicle = async () => {
        if (!editingVehicle?.brand || !editingVehicle?.model || !editingVehicle?.licensePlate) {
            addToast('Preencha marca, modelo e placa', 'warning'); return;
        }
        setSaving(true);
        try {
            if (editingVehicle.id) {
                await fleetService.updateVehicle(editingVehicle.id, editingVehicle);
                addToast('Veiculo atualizado com sucesso', 'success');
            } else {
                await fleetService.createVehicle(editingVehicle);
                addToast('Veiculo cadastrado com sucesso', 'success');
            }
            setShowVehicleModal(false);
            loadAllData();
        } catch (err) {
            addToast('Erro ao salvar veiculo', 'error');
        }
        setSaving(false);
    };

    const handleDeleteVehicle = async (id: string) => {
        if (!confirm('Excluir este veiculo?')) return;
        try {
            await fleetService.deleteVehicle(id);
            addToast('Veiculo excluido', 'success');
            loadAllData();
        } catch (err) { addToast('Erro ao excluir veiculo', 'error'); }
    };

    const handleChangeVehicleStatus = async (id: string, status: VehicleStatus) => {
        try {
            await fleetService.updateVehicleStatus(id, status);
            addToast('Status atualizado', 'success');
            loadAllData();
        } catch (err) { addToast('Erro ao atualizar status', 'error'); }
    };

    // ============ RENTAL HANDLERS ============
    const openRentalModal = () => {
        setEditingRental({
            vehicleId: '', customerId: '', status: 'PENDING' as RentalStatus,
            startDate: new Date().toISOString().split('T')[0], weeklyRate: 0,
            depositAmount: 0, depositPaid: false, lateFixedFee: settings?.defaultLateFixedFee || 50,
            lateDailyInterest: settings?.defaultLateDailyInterest || 1, termsAccepted: false,
        });
        setShowRentalModal(true);
    };

    const handleSaveRental = async () => {
        if (!editingRental?.vehicleId || !editingRental?.customerId) {
            addToast('Selecione veiculo e cliente', 'warning'); return;
        }
        setSaving(true);
        try {
            await fleetService.createRental(editingRental);
            addToast('Locacao criada com sucesso', 'success');
            setShowRentalModal(false);
            loadAllData();
        } catch (err) { addToast('Erro ao criar locacao', 'error'); }
        setSaving(false);
    };

    const handleChangeRentalStatus = async (id: string, status: RentalStatus) => {
        const reason = status === 'CANCELLED' ? prompt('Motivo do cancelamento:') : undefined;
        if (status === 'CANCELLED' && !reason) return;
        try {
            await fleetService.updateRentalStatus(id, status, reason || undefined);
            addToast('Status da locacao atualizado', 'success');
            loadAllData();
        } catch (err) { addToast('Erro ao atualizar locacao', 'error'); }
    };

    // ============ PAYMENT HANDLERS ============
    const handleConfirmPayment = async (paymentId: string) => {
        try {
            await fleetService.confirmPayment(paymentId, 'Admin');
            addToast('Pagamento confirmado', 'success');
            loadAllData();
        } catch (err) { addToast('Erro ao confirmar pagamento', 'error'); }
    };

    const handleCalcLateFees = async (paymentId: string) => {
        try {
            const fee = settings?.defaultLateFixedFee || 50;
            const interest = settings?.defaultLateDailyInterest || 1;
            await fleetService.calculateLateFees(paymentId, fee, interest);
            addToast('Multa e juros calculados', 'success');
            loadAllData();
        } catch (err) { addToast('Erro ao calcular multa', 'error'); }
    };

    // ============ VIDEO HANDLERS ============
    const openVideoReview = (video: FleetVideoCheck) => {
        setReviewingVideo(video);
        setVideoAdminNotes('');
        setShowVideoReviewModal(true);
    };

    const handleReviewVideo = async (status: 'APPROVED' | 'REJECTED') => {
        if (!reviewingVideo) return;
        setSaving(true);
        try {
            await fleetService.reviewVideoCheck(reviewingVideo.id, status, 'Admin', videoAdminNotes || undefined);
            addToast(status === 'APPROVED' ? 'Video aprovado' : 'Video rejeitado', 'success');
            setShowVideoReviewModal(false);
            loadAllData();
        } catch (err) { addToast('Erro ao analisar video', 'error'); }
        setSaving(false);
    };

    // ============ MAINTENANCE HANDLERS ============
    const openTicketModal = () => {
        setEditingTicket({
            vehicleId: '', type: 'MAINTENANCE', title: '', description: '',
            photoUrls: [], priority: 'NORMAL', status: 'OPEN' as any,
        });
        setShowTicketModal(true);
    };

    const handleSaveTicket = async () => {
        if (!editingTicket?.vehicleId || !editingTicket?.title) {
            addToast('Preencha veiculo e titulo', 'warning'); return;
        }
        setSaving(true);
        try {
            await fleetService.createTicket(editingTicket);
            addToast('Ticket criado com sucesso', 'success');
            setShowTicketModal(false);
            loadAllData();
        } catch (err) { addToast('Erro ao criar ticket', 'error'); }
        setSaving(false);
    };

    const handleResolveTicket = async (id: string) => {
        const resolution = prompt('Descricao da resolucao:');
        if (!resolution) return;
        try {
            await fleetService.updateTicketStatus(id, 'RESOLVED', 'Admin', resolution);
            addToast('Ticket resolvido', 'success');
            loadAllData();
        } catch (err) { addToast('Erro ao resolver ticket', 'error'); }
    };

    // ============ ALERT HANDLERS ============
    const handleResolveAlert = async (id: string) => {
        try {
            await fleetService.resolveAlert(id, 'Admin');
            addToast('Alerta resolvido', 'success');
            loadAllData();
        } catch (err) { addToast('Erro ao resolver alerta', 'error'); }
    };

    const handleCheckAlerts = async () => {
        try {
            const count = await fleetService.checkAndGenerateAlerts();
            addToast(`${count} novo(s) alerta(s) gerado(s)`, 'info');
            loadAllData();
        } catch (err) { addToast('Erro ao verificar alertas', 'error'); }
    };

    // ============ SETTINGS HANDLERS ============
    const handleSaveSettings = async () => {
        setSaving(true);
        try {
            const updated = await fleetService.updateFleetSettings(settingsForm);
            setSettings(updated);
            setSettingsForm(updated);
            addToast('Configuracoes salvas', 'success');
        } catch (err) { addToast('Erro ao salvar configuracoes', 'error'); }
        setSaving(false);
    };

    // ============ FILTERED DATA ============
    const filteredVehicles = useMemo(() => vehicles.filter(v => {
        if (vehicleStatusFilter !== 'ALL' && v.status !== vehicleStatusFilter) return false;
        if (vehicleTypeFilter !== 'ALL' && v.type !== vehicleTypeFilter) return false;
        if (searchTerm) {
            const s = searchTerm.toLowerCase();
            if (!(`${v.brand} ${v.model} ${v.licensePlate}`.toLowerCase().includes(s))) return false;
        }
        return true;
    }), [vehicles, vehicleStatusFilter, vehicleTypeFilter, searchTerm]);

    const filteredRentals = useMemo(() => rentals.filter(r => {
        if (rentalStatusFilter !== 'ALL' && r.status !== rentalStatusFilter) return false;
        if (searchTerm) {
            const s = searchTerm.toLowerCase();
            const match = `${r.customerName || ''} ${r.vehicle?.brand || ''} ${r.vehicle?.model || ''} ${r.vehicle?.licensePlate || ''} ${r.contractNumber || ''}`.toLowerCase();
            if (!match.includes(s)) return false;
        }
        return true;
    }), [rentals, rentalStatusFilter, searchTerm]);

    const filteredPayments = useMemo(() => payments.filter(p => {
        if (paymentStatusFilter !== 'ALL' && p.status !== paymentStatusFilter) return false;
        return true;
    }), [payments, paymentStatusFilter]);

    const filteredVideoChecks = useMemo(() => videoChecks.filter(v => {
        if (videoStatusFilter !== 'ALL' && v.status !== videoStatusFilter) return false;
        return true;
    }), [videoChecks, videoStatusFilter]);

    const filteredTickets = useMemo(() => tickets.filter(t => {
        if (ticketStatusFilter !== 'ALL' && t.status !== ticketStatusFilter) return false;
        return true;
    }), [tickets, ticketStatusFilter]);

    const filteredAlerts = useMemo(() => alerts.filter(a => {
        if (alertTypeFilter !== 'ALL' && a.type !== alertTypeFilter) return false;
        if (alertResolvedFilter === 'active' && a.resolved) return false;
        if (alertResolvedFilter === 'resolved' && !a.resolved) return false;
        return true;
    }), [alerts, alertTypeFilter, alertResolvedFilter]);

    const availableVehiclesForRental = vehicles.filter(v => v.status === 'AVAILABLE');

    // ============ TABS ============
    const tabs = [
        { id: 'dashboard' as TabType, label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
        { id: 'veiculos' as TabType, label: 'Veiculos', icon: <Car size={18} />, badge: vehicles.length },
        { id: 'locacoes' as TabType, label: 'Locacoes', icon: <ClipboardList size={18} />, badge: rentals.filter(r => r.status === 'ACTIVE').length },
        { id: 'pagamentos' as TabType, label: 'Pagamentos', icon: <DollarSign size={18} />, badge: payments.filter(p => p.status === 'PENDING' || p.status === 'LATE').length },
        { id: 'videos' as TabType, label: 'Videos', icon: <Video size={18} />, badge: videoChecks.filter(v => v.status === 'SUBMITTED').length },
        { id: 'manutencao' as TabType, label: 'Manutencao', icon: <Wrench size={18} />, badge: tickets.filter(t => t.status === 'OPEN').length },
        { id: 'alertas' as TabType, label: 'Alertas', icon: <Bell size={18} />, badge: alerts.filter(a => !a.resolved).length },
        { id: 'config' as TabType, label: 'Config', icon: <Settings size={18} /> },
    ];

    // ============ RENDER ============
    return (
        <div className="p-4 md:p-8 bg-black min-h-screen text-white pb-32">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-[#D4AF37] flex items-center gap-2">
                        <Car size={32} /> Gestao de Frota
                    </h1>
                    <p className="text-zinc-500 mt-1">Veiculos, Locacoes, Pagamentos e Manutencao</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={loadAllData}>
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} /> Atualizar
                    </Button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => { setActiveTab(tab.id); setSearchTerm(''); }}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === tab.id
                            ? 'bg-[#D4AF37] text-black'
                            : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
                        }`}
                    >
                        {tab.icon}
                        {tab.label}
                        {tab.badge !== undefined && tab.badge > 0 && (
                            <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-red-500 text-white">{tab.badge}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* ==================== DASHBOARD TAB ==================== */}
            {activeTab === 'dashboard' && (
                <div className="space-y-6">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <div className="bg-gradient-to-br from-blue-500/20 to-blue-900/10 border border-blue-500/30 rounded-2xl p-5">
                            <div className="flex items-center gap-2 mb-2">
                                <Car className="text-blue-400" size={20} />
                                <span className="text-zinc-400 text-xs">Total Veiculos</span>
                            </div>
                            <p className="text-2xl font-bold text-white">{dashStats?.totalVehicles || 0}</p>
                            <p className="text-xs text-zinc-500 mt-1">{dashStats?.availableVehicles || 0} disponiveis</p>
                        </div>
                        <div className="bg-gradient-to-br from-green-500/20 to-green-900/10 border border-green-500/30 rounded-2xl p-5">
                            <div className="flex items-center gap-2 mb-2">
                                <ClipboardList className="text-green-400" size={20} />
                                <span className="text-zinc-400 text-xs">Locacoes Ativas</span>
                            </div>
                            <p className="text-2xl font-bold text-white">{dashStats?.activeRentals || 0}</p>
                        </div>
                        <div className="bg-gradient-to-br from-[#D4AF37]/20 to-yellow-900/10 border border-[#D4AF37]/30 rounded-2xl p-5">
                            <div className="flex items-center gap-2 mb-2">
                                <DollarSign className="text-[#D4AF37]" size={20} />
                                <span className="text-zinc-400 text-xs">Receita Mensal</span>
                            </div>
                            <p className="text-2xl font-bold text-white">{formatBRL(dashStats?.monthlyRevenue || 0)}</p>
                        </div>
                        <div className="bg-gradient-to-br from-red-500/20 to-red-900/10 border border-red-500/30 rounded-2xl p-5">
                            <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="text-red-400" size={20} />
                                <span className="text-zinc-400 text-xs">Inadimplentes</span>
                            </div>
                            <p className="text-2xl font-bold text-white">{dashStats?.overdueCount || 0}</p>
                        </div>
                        <div className="bg-gradient-to-br from-orange-500/20 to-orange-900/10 border border-orange-500/30 rounded-2xl p-5">
                            <div className="flex items-center gap-2 mb-2">
                                <BellRing className="text-orange-400" size={20} />
                                <span className="text-zinc-400 text-xs">Alertas Ativos</span>
                            </div>
                            <p className="text-2xl font-bold text-white">{dashStats?.activeAlerts || 0}</p>
                        </div>
                        <div className="bg-gradient-to-br from-purple-500/20 to-purple-900/10 border border-purple-500/30 rounded-2xl p-5">
                            <div className="flex items-center gap-2 mb-2">
                                <BarChart3 className="text-purple-400" size={20} />
                                <span className="text-zinc-400 text-xs">Taxa Ocupacao</span>
                            </div>
                            <p className="text-2xl font-bold text-white">{dashStats?.occupancyRate || 0}%</p>
                        </div>
                    </div>

                    {/* Vehicle status breakdown */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Car className="text-[#D4AF37]" size={20} /> Veiculos por Status
                            </h3>
                            <div className="space-y-3">
                                {[
                                    { label: 'Disponiveis', count: dashStats?.availableVehicles || 0, color: 'bg-green-500' },
                                    { label: 'Alugados', count: dashStats?.rentedVehicles || 0, color: 'bg-blue-500' },
                                    { label: 'Manutencao', count: dashStats?.maintenanceVehicles || 0, color: 'bg-yellow-500' },
                                    { label: 'Bloqueados', count: dashStats?.blockedVehicles || 0, color: 'bg-red-500' },
                                ].map(item => (
                                    <div key={item.label} className="flex items-center justify-between p-3 bg-black rounded-xl border border-zinc-800">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-3 h-3 rounded-full ${item.color}`} />
                                            <span className="text-white">{item.label}</span>
                                        </div>
                                        <span className="font-bold text-white">{item.count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <AlertTriangle className="text-red-400" size={20} /> Pendencias
                            </h3>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between p-3 bg-black rounded-xl border border-zinc-800">
                                    <span className="text-zinc-400">Pagamentos atrasados</span>
                                    <span className="font-bold text-red-400">{dashStats?.overdueCount || 0}</span>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-black rounded-xl border border-zinc-800">
                                    <span className="text-zinc-400">Videos pendentes</span>
                                    <span className="font-bold text-yellow-400">{dashStats?.pendingVideos || 0}</span>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-black rounded-xl border border-zinc-800">
                                    <span className="text-zinc-400">Tickets abertos</span>
                                    <span className="font-bold text-orange-400">{tickets.filter(t => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length}</span>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-black rounded-xl border border-zinc-800">
                                    <span className="text-zinc-400">Alertas ativos</span>
                                    <span className="font-bold text-orange-400">{dashStats?.activeAlerts || 0}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Recent rentals */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <ClipboardList className="text-green-400" size={20} /> Locacoes Recentes
                        </h3>
                        <div className="space-y-3">
                            {rentals.slice(0, 5).map(r => (
                                <div key={r.id} className="flex items-center justify-between p-3 bg-black rounded-xl border border-zinc-800">
                                    <div>
                                        <p className="font-bold text-white">{r.customerName || 'Cliente'}</p>
                                        <p className="text-xs text-zinc-500">
                                            {r.vehicle ? `${r.vehicle.brand} ${r.vehicle.model} - ${r.vehicle.licensePlate}` : r.vehicleId}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-[#D4AF37]">{formatBRL(r.weeklyRate)}/sem</p>
                                        <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColor(r.status)}`}>
                                            {RENTAL_STATUS_LABELS[r.status]}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            {rentals.length === 0 && <p className="text-center text-zinc-500 py-4">Nenhuma locacao registrada</p>}
                        </div>
                    </div>
                </div>
            )}

            {/* ==================== VEICULOS TAB ==================== */}
            {activeTab === 'veiculos' && (
                <div className="space-y-6">
                    <div className="flex flex-wrap gap-4 items-center">
                        <div className="relative flex-1 min-w-[200px] max-w-sm">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <input type="text" placeholder="Buscar marca, modelo, placa..." value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:border-[#D4AF37] outline-none" />
                        </div>
                        <select value={vehicleStatusFilter} onChange={e => setVehicleStatusFilter(e.target.value as any)}
                            className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:border-[#D4AF37] outline-none">
                            <option value="ALL">Todos Status</option>
                            {(Object.keys(VEHICLE_STATUS_LABELS) as VehicleStatus[]).map(s => (
                                <option key={s} value={s}>{VEHICLE_STATUS_LABELS[s]}</option>
                            ))}
                        </select>
                        <select value={vehicleTypeFilter} onChange={e => setVehicleTypeFilter(e.target.value as any)}
                            className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:border-[#D4AF37] outline-none">
                            <option value="ALL">Todos Tipos</option>
                            {(Object.keys(VEHICLE_TYPE_LABELS) as VehicleType[]).map(t => (
                                <option key={t} value={t}>{VEHICLE_TYPE_LABELS[t]}</option>
                            ))}
                        </select>
                        <Button onClick={() => openVehicleModal()} className="bg-[#D4AF37] text-black">
                            <Plus size={18} /> Novo Veiculo
                        </Button>
                    </div>

                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                        {loading ? (
                            <div className="p-8 text-center text-zinc-500">Carregando...</div>
                        ) : filteredVehicles.length === 0 ? (
                            <div className="p-8 text-center text-zinc-500">Nenhum veiculo encontrado</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-zinc-950">
                                        <tr className="border-b border-zinc-800">
                                            <th className="text-left p-4 text-zinc-400 text-sm">Veiculo</th>
                                            <th className="text-left p-4 text-zinc-400 text-sm">Placa</th>
                                            <th className="text-left p-4 text-zinc-400 text-sm">Tipo</th>
                                            <th className="text-left p-4 text-zinc-400 text-sm">Valor Semanal</th>
                                            <th className="text-left p-4 text-zinc-400 text-sm">Status</th>
                                            <th className="text-right p-4 text-zinc-400 text-sm">Acoes</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredVehicles.map(v => (
                                            <tr key={v.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                                                <td className="p-4">
                                                    <p className="font-bold text-white">{v.brand} {v.model}</p>
                                                    <p className="text-xs text-zinc-500">{v.year} {v.color ? `- ${v.color}` : ''}</p>
                                                </td>
                                                <td className="p-4 text-white font-mono">{v.licensePlate}</td>
                                                <td className="p-4 text-zinc-400">{VEHICLE_TYPE_LABELS[v.type]}</td>
                                                <td className="p-4 font-bold text-[#D4AF37]">{formatBRL(v.weeklyRate)}</td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-bold border ${statusColor(v.status)}`}>
                                                        {VEHICLE_STATUS_LABELS[v.status]}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button onClick={() => openVehicleModal(v)} className="p-2 bg-zinc-800 text-zinc-400 rounded-lg hover:bg-zinc-700" title="Editar">
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button onClick={() => handleDeleteVehicle(v.id)} className="p-2 bg-red-900/30 text-red-400 rounded-lg hover:bg-red-900/50" title="Excluir">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ==================== LOCACOES TAB ==================== */}
            {activeTab === 'locacoes' && (
                <div className="space-y-6">
                    <div className="flex flex-wrap gap-4 items-center">
                        <div className="relative flex-1 min-w-[200px] max-w-sm">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <input type="text" placeholder="Buscar cliente, veiculo, contrato..." value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:border-[#D4AF37] outline-none" />
                        </div>
                        <select value={rentalStatusFilter} onChange={e => setRentalStatusFilter(e.target.value as any)}
                            className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:border-[#D4AF37] outline-none">
                            <option value="ALL">Todos Status</option>
                            {(Object.keys(RENTAL_STATUS_LABELS) as RentalStatus[]).map(s => (
                                <option key={s} value={s}>{RENTAL_STATUS_LABELS[s]}</option>
                            ))}
                        </select>
                        <Button onClick={openRentalModal} className="bg-[#D4AF37] text-black">
                            <Plus size={18} /> Nova Locacao
                        </Button>
                    </div>

                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                        {loading ? (
                            <div className="p-8 text-center text-zinc-500">Carregando...</div>
                        ) : filteredRentals.length === 0 ? (
                            <div className="p-8 text-center text-zinc-500">Nenhuma locacao encontrada</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-zinc-950">
                                        <tr className="border-b border-zinc-800">
                                            <th className="text-left p-4 text-zinc-400 text-sm">Contrato</th>
                                            <th className="text-left p-4 text-zinc-400 text-sm">Cliente</th>
                                            <th className="text-left p-4 text-zinc-400 text-sm">Veiculo</th>
                                            <th className="text-left p-4 text-zinc-400 text-sm">Valor/Sem</th>
                                            <th className="text-left p-4 text-zinc-400 text-sm">Inicio</th>
                                            <th className="text-left p-4 text-zinc-400 text-sm">Status</th>
                                            <th className="text-right p-4 text-zinc-400 text-sm">Acoes</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRentals.map(r => (
                                            <tr key={r.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                                                <td className="p-4 text-zinc-400 font-mono text-xs">{r.contractNumber || '-'}</td>
                                                <td className="p-4">
                                                    <p className="font-bold text-white">{r.customerName || 'N/A'}</p>
                                                    <p className="text-xs text-zinc-500">{r.customerPhone || ''}</p>
                                                </td>
                                                <td className="p-4">
                                                    {r.vehicle ? (
                                                        <div>
                                                            <p className="text-white">{r.vehicle.brand} {r.vehicle.model}</p>
                                                            <p className="text-xs text-zinc-500">{r.vehicle.licensePlate}</p>
                                                        </div>
                                                    ) : <span className="text-zinc-500">-</span>}
                                                </td>
                                                <td className="p-4 font-bold text-[#D4AF37]">{formatBRL(r.weeklyRate)}</td>
                                                <td className="p-4 text-zinc-400 text-sm">{fmtDate(r.startDate)}</td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-bold border ${statusColor(r.status)}`}>
                                                        {RENTAL_STATUS_LABELS[r.status]}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="flex justify-end gap-1">
                                                        {r.status === 'PENDING' && (
                                                            <button onClick={() => handleChangeRentalStatus(r.id, 'ACTIVE')}
                                                                className="p-1.5 bg-green-900/30 text-green-400 rounded-lg hover:bg-green-900/50 text-xs" title="Ativar">
                                                                <Check size={14} />
                                                            </button>
                                                        )}
                                                        {r.status === 'ACTIVE' && (
                                                            <>
                                                                <button onClick={() => handleChangeRentalStatus(r.id, 'SUSPENDED')}
                                                                    className="p-1.5 bg-yellow-900/30 text-yellow-400 rounded-lg hover:bg-yellow-900/50" title="Suspender">
                                                                    <Clock size={14} />
                                                                </button>
                                                                <button onClick={() => handleChangeRentalStatus(r.id, 'COMPLETED')}
                                                                    className="p-1.5 bg-blue-900/30 text-blue-400 rounded-lg hover:bg-blue-900/50" title="Finalizar">
                                                                    <CheckCircle2 size={14} />
                                                                </button>
                                                            </>
                                                        )}
                                                        {r.status === 'SUSPENDED' && (
                                                            <button onClick={() => handleChangeRentalStatus(r.id, 'ACTIVE')}
                                                                className="p-1.5 bg-green-900/30 text-green-400 rounded-lg hover:bg-green-900/50" title="Reativar">
                                                                <Play size={14} />
                                                            </button>
                                                        )}
                                                        {(r.status === 'PENDING' || r.status === 'ACTIVE' || r.status === 'SUSPENDED') && (
                                                            <button onClick={() => handleChangeRentalStatus(r.id, 'CANCELLED')}
                                                                className="p-1.5 bg-red-900/30 text-red-400 rounded-lg hover:bg-red-900/50" title="Cancelar">
                                                                <XCircle size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ==================== PAGAMENTOS TAB ==================== */}
            {activeTab === 'pagamentos' && (
                <div className="space-y-6">
                    <div className="flex flex-wrap gap-2">
                        {(['ALL', 'PENDING', 'PAID', 'LATE', 'CANCELLED'] as const).map(f => (
                            <button key={f} onClick={() => setPaymentStatusFilter(f as any)}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${paymentStatusFilter === f
                                    ? 'bg-[#D4AF37] text-black'
                                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                }`}>
                                {f === 'ALL' ? 'Todos' : PAYMENT_STATUS_LABELS[f as RentalPaymentStatus]}
                                {f !== 'ALL' && (
                                    <span className="ml-1 text-xs">({payments.filter(p => p.status === f).length})</span>
                                )}
                            </button>
                        ))}
                    </div>

                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                        {loading ? (
                            <div className="p-8 text-center text-zinc-500">Carregando...</div>
                        ) : filteredPayments.length === 0 ? (
                            <div className="p-8 text-center text-zinc-500">Nenhum pagamento encontrado</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-zinc-950">
                                        <tr className="border-b border-zinc-800">
                                            <th className="text-left p-4 text-zinc-400 text-sm">Semana</th>
                                            <th className="text-left p-4 text-zinc-400 text-sm">Periodo</th>
                                            <th className="text-left p-4 text-zinc-400 text-sm">Valor</th>
                                            <th className="text-left p-4 text-zinc-400 text-sm">Multa</th>
                                            <th className="text-left p-4 text-zinc-400 text-sm">Total</th>
                                            <th className="text-left p-4 text-zinc-400 text-sm">Vencimento</th>
                                            <th className="text-left p-4 text-zinc-400 text-sm">Status</th>
                                            <th className="text-right p-4 text-zinc-400 text-sm">Acoes</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredPayments.map(p => (
                                            <tr key={p.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                                                <td className="p-4 text-white font-bold">Sem {p.weekNumber}</td>
                                                <td className="p-4 text-zinc-400 text-sm">{fmtDate(p.periodStart)} - {fmtDate(p.periodEnd)}</td>
                                                <td className="p-4 text-white">{formatBRL(p.amount)}</td>
                                                <td className="p-4 text-red-400">
                                                    {(p.lateFee || 0) + (p.lateInterest || 0) > 0 ? formatBRL((p.lateFee || 0) + (p.lateInterest || 0)) : '-'}
                                                </td>
                                                <td className="p-4 font-bold text-[#D4AF37]">{formatBRL(p.totalDue)}</td>
                                                <td className="p-4 text-zinc-400 text-sm">{fmtDate(p.dueDate)}</td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-bold border ${statusColor(p.status)}`}>
                                                        {PAYMENT_STATUS_LABELS[p.status]}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        {(p.status === 'PENDING' || p.status === 'LATE') && (
                                                            <button onClick={() => handleConfirmPayment(p.id)}
                                                                className="p-2 bg-green-900/30 text-green-400 rounded-lg hover:bg-green-900/50" title="Confirmar Pagamento">
                                                                <Check size={16} />
                                                            </button>
                                                        )}
                                                        {p.status === 'PENDING' && new Date(p.dueDate) < new Date() && (
                                                            <button onClick={() => handleCalcLateFees(p.id)}
                                                                className="p-2 bg-red-900/30 text-red-400 rounded-lg hover:bg-red-900/50" title="Calcular Multa">
                                                                <Percent size={16} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ==================== VIDEOS TAB ==================== */}
            {activeTab === 'videos' && (
                <div className="space-y-6">
                    <div className="flex flex-wrap gap-2">
                        {['ALL', 'PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED'].map(f => (
                            <button key={f} onClick={() => setVideoStatusFilter(f)}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${videoStatusFilter === f
                                    ? 'bg-[#D4AF37] text-black'
                                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                }`}>
                                {f === 'ALL' ? 'Todos' : VIDEO_STATUS_LABELS[f]}
                            </button>
                        ))}
                    </div>

                    {loading ? (
                        <div className="p-8 text-center text-zinc-500">Carregando...</div>
                    ) : filteredVideoChecks.length === 0 ? (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center text-zinc-500">
                            Nenhum video check encontrado
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredVideoChecks.map(vc => (
                                <div key={vc.id} className={`bg-zinc-900 border rounded-2xl p-5 ${vc.status === 'SUBMITTED' ? 'border-[#D4AF37]/50' : 'border-zinc-800'}`}>
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-white font-bold">Semana {vc.weekNumber}</span>
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold border ${statusColor(vc.status)}`}>
                                            {VIDEO_STATUS_LABELS[vc.status]}
                                        </span>
                                    </div>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-zinc-500">Vencimento</span>
                                            <span className="text-zinc-300">{fmtDate(vc.dueDate)}</span>
                                        </div>
                                        {vc.address && (
                                            <div className="flex items-start gap-1">
                                                <MapPin size={14} className="text-zinc-500 mt-0.5 shrink-0" />
                                                <span className="text-zinc-400 text-xs">{vc.address}</span>
                                            </div>
                                        )}
                                        <div className="flex gap-2 mt-2">
                                            {vc.videoExteriorUrl && (
                                                <a href={vc.videoExteriorUrl} target="_blank" rel="noopener noreferrer"
                                                    className="flex items-center gap-1 px-2 py-1 bg-zinc-800 rounded text-xs text-blue-400 hover:bg-zinc-700">
                                                    <Video size={12} /> Exterior
                                                </a>
                                            )}
                                            {vc.videoDashboardUrl && (
                                                <a href={vc.videoDashboardUrl} target="_blank" rel="noopener noreferrer"
                                                    className="flex items-center gap-1 px-2 py-1 bg-zinc-800 rounded text-xs text-blue-400 hover:bg-zinc-700">
                                                    <Video size={12} /> Painel
                                                </a>
                                            )}
                                            {vc.videoResidenceUrl && (
                                                <a href={vc.videoResidenceUrl} target="_blank" rel="noopener noreferrer"
                                                    className="flex items-center gap-1 px-2 py-1 bg-zinc-800 rounded text-xs text-blue-400 hover:bg-zinc-700">
                                                    <Video size={12} /> Residencia
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                    {vc.status === 'SUBMITTED' && (
                                        <div className="mt-4 flex gap-2">
                                            <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => openVideoReview(vc)}>
                                                <Check size={14} /> Aprovar
                                            </Button>
                                            <Button size="sm" variant="danger" className="flex-1" onClick={() => openVideoReview(vc)}>
                                                <X size={14} /> Rejeitar
                                            </Button>
                                        </div>
                                    )}
                                    {vc.adminNotes && (
                                        <p className="mt-2 text-xs text-zinc-500 italic">Obs: {vc.adminNotes}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ==================== MANUTENCAO TAB ==================== */}
            {activeTab === 'manutencao' && (
                <div className="space-y-6">
                    <div className="flex flex-wrap gap-4 items-center">
                        <div className="flex gap-2">
                            {['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED'].map(f => (
                                <button key={f} onClick={() => setTicketStatusFilter(f)}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${ticketStatusFilter === f
                                        ? 'bg-[#D4AF37] text-black'
                                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                    }`}>
                                    {f === 'ALL' ? 'Todos' : TICKET_STATUS_LABELS[f]}
                                </button>
                            ))}
                        </div>
                        <Button onClick={openTicketModal} className="bg-[#D4AF37] text-black ml-auto">
                            <Plus size={18} /> Novo Ticket
                        </Button>
                    </div>

                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                        {loading ? (
                            <div className="p-8 text-center text-zinc-500">Carregando...</div>
                        ) : filteredTickets.length === 0 ? (
                            <div className="p-8 text-center text-zinc-500">Nenhum ticket encontrado</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-zinc-950">
                                        <tr className="border-b border-zinc-800">
                                            <th className="text-left p-4 text-zinc-400 text-sm">Titulo</th>
                                            <th className="text-left p-4 text-zinc-400 text-sm">Tipo</th>
                                            <th className="text-left p-4 text-zinc-400 text-sm">Prioridade</th>
                                            <th className="text-left p-4 text-zinc-400 text-sm">Custo</th>
                                            <th className="text-left p-4 text-zinc-400 text-sm">Status</th>
                                            <th className="text-left p-4 text-zinc-400 text-sm">Criado</th>
                                            <th className="text-right p-4 text-zinc-400 text-sm">Acoes</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredTickets.map(t => (
                                            <tr key={t.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                                                <td className="p-4">
                                                    <p className="font-bold text-white">{t.title}</p>
                                                    <p className="text-xs text-zinc-500 truncate max-w-[200px]">{t.description}</p>
                                                </td>
                                                <td className="p-4 text-zinc-400 text-sm">{t.type}</td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${t.priority === 'URGENT' ? 'bg-red-900/30 text-red-400' :
                                                        t.priority === 'HIGH' ? 'bg-orange-900/30 text-orange-400' :
                                                        t.priority === 'NORMAL' ? 'bg-blue-900/30 text-blue-400' :
                                                        'bg-zinc-800 text-zinc-400'
                                                    }`}>{t.priority}</span>
                                                </td>
                                                <td className="p-4 text-zinc-400">{t.cost ? formatBRL(t.cost) : '-'}</td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-bold border ${statusColor(t.status)}`}>
                                                        {TICKET_STATUS_LABELS[t.status]}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-zinc-400 text-sm">{fmtDate(t.createdAt)}</td>
                                                <td className="p-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        {(t.status === 'OPEN' || t.status === 'IN_PROGRESS') && (
                                                            <button onClick={() => handleResolveTicket(t.id)}
                                                                className="p-2 bg-green-900/30 text-green-400 rounded-lg hover:bg-green-900/50" title="Resolver">
                                                                <CheckCircle2 size={16} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ==================== ALERTAS TAB ==================== */}
            {activeTab === 'alertas' && (
                <div className="space-y-6">
                    <div className="flex flex-wrap gap-4 items-center">
                        <div className="flex gap-2">
                            {['active', 'resolved', 'all'].map(f => (
                                <button key={f} onClick={() => setAlertResolvedFilter(f)}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${alertResolvedFilter === f
                                        ? 'bg-[#D4AF37] text-black'
                                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                    }`}>
                                    {f === 'active' ? 'Ativos' : f === 'resolved' ? 'Resolvidos' : 'Todos'}
                                </button>
                            ))}
                        </div>
                        <select value={alertTypeFilter} onChange={e => setAlertTypeFilter(e.target.value)}
                            className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:border-[#D4AF37] outline-none">
                            <option value="ALL">Todos Tipos</option>
                            {Object.keys(ALERT_TYPE_LABELS).map(t => (
                                <option key={t} value={t}>{ALERT_TYPE_LABELS[t]}</option>
                            ))}
                        </select>
                        <Button onClick={handleCheckAlerts} variant="secondary" className="ml-auto">
                            <RefreshCw size={18} /> Verificar Alertas
                        </Button>
                    </div>

                    {loading ? (
                        <div className="p-8 text-center text-zinc-500">Carregando...</div>
                    ) : filteredAlerts.length === 0 ? (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center text-zinc-500">
                            Nenhum alerta encontrado
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredAlerts.map(a => (
                                <div key={a.id} className={`bg-zinc-900 border rounded-2xl p-5 ${a.resolved ? 'border-zinc-800 opacity-60' : 'border-zinc-700'}`}>
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start gap-3">
                                            <div className={`p-2 rounded-lg mt-0.5 ${a.severity === 'CRITICAL' ? 'bg-red-900/30' : a.severity === 'WARNING' ? 'bg-yellow-900/30' : 'bg-blue-900/30'}`}>
                                                {a.severity === 'CRITICAL' ? <AlertTriangle size={20} className="text-red-400" /> :
                                                 a.severity === 'WARNING' ? <Bell size={20} className="text-yellow-400" /> :
                                                 <Info size={20} className="text-blue-400" />}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <p className="font-bold text-white">{a.title}</p>
                                                    <span className={`px-2 py-0.5 rounded text-xs font-bold border ${severityColor(a.severity)}`}>
                                                        {SEVERITY_LABELS[a.severity]}
                                                    </span>
                                                    <span className="px-2 py-0.5 rounded text-xs bg-zinc-800 text-zinc-400">
                                                        {ALERT_TYPE_LABELS[a.type] || a.type}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-zinc-400">{a.message}</p>
                                                <p className="text-xs text-zinc-600 mt-1">{fmtDateTime(a.createdAt)}</p>
                                                {a.resolved && a.resolvedBy && (
                                                    <p className="text-xs text-green-500 mt-1">Resolvido por {a.resolvedBy} em {fmtDateTime(a.resolvedAt || '')}</p>
                                                )}
                                            </div>
                                        </div>
                                        {!a.resolved && (
                                            <Button size="sm" variant="secondary" onClick={() => handleResolveAlert(a.id)}>
                                                <Check size={14} /> Resolver
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ==================== CONFIG TAB ==================== */}
            {activeTab === 'config' && (
                <div className="space-y-6">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                            <Settings className="text-[#D4AF37]" size={20} /> Configuracoes da Frota
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Multas e juros */}
                            <div className="space-y-4">
                                <h4 className="font-bold text-zinc-300 flex items-center gap-2"><DollarSign size={16} /> Multas e Juros</h4>
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-1">Multa fixa por atraso (R$)</label>
                                    <input type="number" step="0.01"
                                        value={settingsForm.defaultLateFixedFee || ''}
                                        onChange={e => setSettingsForm({ ...settingsForm, defaultLateFixedFee: parseFloat(e.target.value) || 0 })}
                                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-1">Juros diario por atraso (%)</label>
                                    <input type="number" step="0.01"
                                        value={settingsForm.defaultLateDailyInterest || ''}
                                        onChange={e => setSettingsForm({ ...settingsForm, defaultLateDailyInterest: parseFloat(e.target.value) || 0 })}
                                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-1">Dias atraso antes de bloquear veiculo</label>
                                    <input type="number"
                                        value={settingsForm.maxDaysLateBeforeBlock || ''}
                                        onChange={e => setSettingsForm({ ...settingsForm, maxDaysLateBeforeBlock: parseInt(e.target.value) || 0 })}
                                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none" />
                                </div>
                            </div>

                            {/* Video checks */}
                            <div className="space-y-4">
                                <h4 className="font-bold text-zinc-300 flex items-center gap-2"><Video size={16} /> Video Checks</h4>
                                <div className="flex items-center justify-between p-3 bg-black rounded-lg border border-zinc-700">
                                    <span className="text-zinc-400">Video check obrigatorio</span>
                                    <button onClick={() => setSettingsForm({ ...settingsForm, videoCheckRequired: !settingsForm.videoCheckRequired })}
                                        className={`w-12 h-6 rounded-full transition-colors ${settingsForm.videoCheckRequired ? 'bg-[#D4AF37]' : 'bg-zinc-700'}`}>
                                        <div className={`w-5 h-5 bg-white rounded-full transition-transform ${settingsForm.videoCheckRequired ? 'translate-x-6' : 'translate-x-0.5'}`} />
                                    </button>
                                </div>
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-1">Dia da semana para video (0=Dom, 1=Seg...)</label>
                                    <select value={settingsForm.videoCheckDayOfWeek ?? 1}
                                        onChange={e => setSettingsForm({ ...settingsForm, videoCheckDayOfWeek: parseInt(e.target.value) })}
                                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none">
                                        <option value={0}>Domingo</option>
                                        <option value={1}>Segunda</option>
                                        <option value={2}>Terca</option>
                                        <option value={3}>Quarta</option>
                                        <option value={4}>Quinta</option>
                                        <option value={5}>Sexta</option>
                                        <option value={6}>Sabado</option>
                                    </select>
                                </div>
                            </div>

                            {/* Notificacoes */}
                            <div className="space-y-4">
                                <h4 className="font-bold text-zinc-300 flex items-center gap-2"><Bell size={16} /> Notificacoes</h4>
                                <div className="flex items-center justify-between p-3 bg-black rounded-lg border border-zinc-700">
                                    <span className="text-zinc-400">Lembrete WhatsApp automatico</span>
                                    <button onClick={() => setSettingsForm({ ...settingsForm, autoSendWhatsappReminders: !settingsForm.autoSendWhatsappReminders })}
                                        className={`w-12 h-6 rounded-full transition-colors ${settingsForm.autoSendWhatsappReminders ? 'bg-[#D4AF37]' : 'bg-zinc-700'}`}>
                                        <div className={`w-5 h-5 bg-white rounded-full transition-transform ${settingsForm.autoSendWhatsappReminders ? 'translate-x-6' : 'translate-x-0.5'}`} />
                                    </button>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-black rounded-lg border border-zinc-700">
                                    <span className="text-zinc-400">Lembrete Email automatico</span>
                                    <button onClick={() => setSettingsForm({ ...settingsForm, autoSendEmailReminders: !settingsForm.autoSendEmailReminders })}
                                        className={`w-12 h-6 rounded-full transition-colors ${settingsForm.autoSendEmailReminders ? 'bg-[#D4AF37]' : 'bg-zinc-700'}`}>
                                        <div className={`w-5 h-5 bg-white rounded-full transition-transform ${settingsForm.autoSendEmailReminders ? 'translate-x-6' : 'translate-x-0.5'}`} />
                                    </button>
                                </div>
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-1">Dias antes do vencimento para lembrete</label>
                                    <input type="number"
                                        value={settingsForm.daysBeforeDueReminder || ''}
                                        onChange={e => setSettingsForm({ ...settingsForm, daysBeforeDueReminder: parseInt(e.target.value) || 0 })}
                                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none" />
                                </div>
                            </div>

                            {/* PIX */}
                            <div className="space-y-4">
                                <h4 className="font-bold text-zinc-300 flex items-center gap-2"><CreditCard size={16} /> Configuracao PIX</h4>
                                <div className="flex items-center justify-between p-3 bg-black rounded-lg border border-zinc-700">
                                    <span className="text-zinc-400">Gerar PIX automaticamente</span>
                                    <button onClick={() => setSettingsForm({ ...settingsForm, autoGeneratePix: !settingsForm.autoGeneratePix })}
                                        className={`w-12 h-6 rounded-full transition-colors ${settingsForm.autoGeneratePix ? 'bg-[#D4AF37]' : 'bg-zinc-700'}`}>
                                        <div className={`w-5 h-5 bg-white rounded-full transition-transform ${settingsForm.autoGeneratePix ? 'translate-x-6' : 'translate-x-0.5'}`} />
                                    </button>
                                </div>
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-1">Tipo da chave PIX</label>
                                    <select value={settingsForm.pixKeyType || ''}
                                        onChange={e => setSettingsForm({ ...settingsForm, pixKeyType: e.target.value })}
                                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none">
                                        <option value="">Selecione...</option>
                                        <option value="CPF">CPF</option>
                                        <option value="CNPJ">CNPJ</option>
                                        <option value="EMAIL">Email</option>
                                        <option value="PHONE">Telefone</option>
                                        <option value="RANDOM">Aleatoria</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-1">Chave PIX</label>
                                    <input type="text"
                                        value={settingsForm.pixKey || ''}
                                        onChange={e => setSettingsForm({ ...settingsForm, pixKey: e.target.value })}
                                        placeholder="Sua chave PIX"
                                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-1">Nome do recebedor</label>
                                    <input type="text"
                                        value={settingsForm.pixReceiverName || ''}
                                        onChange={e => setSettingsForm({ ...settingsForm, pixReceiverName: e.target.value })}
                                        placeholder="Nome que aparece no PIX"
                                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none" />
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 flex justify-end">
                            <Button onClick={handleSaveSettings} isLoading={saving} className="bg-[#D4AF37] text-black">
                                <Save size={18} /> Salvar Configuracoes
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ==================== MODALS ==================== */}

            {/* Vehicle Modal */}
            {showVehicleModal && editingVehicle && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="sticky top-0 bg-zinc-900 p-6 pb-4 border-b border-zinc-800 flex justify-between items-center z-10">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Car className="text-[#D4AF37]" /> {editingVehicle.id ? 'Editar Veiculo' : 'Novo Veiculo'}
                            </h3>
                            <button onClick={() => setShowVehicleModal(false)}><X className="text-zinc-500 hover:text-white" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-zinc-400 mb-1">Tipo *</label>
                                    <select value={editingVehicle.type || 'CAR'}
                                        onChange={e => setEditingVehicle({ ...editingVehicle, type: e.target.value as VehicleType })}
                                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none">
                                        {(Object.keys(VEHICLE_TYPE_LABELS) as VehicleType[]).map(t => (
                                            <option key={t} value={t}>{VEHICLE_TYPE_LABELS[t]}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-zinc-400 mb-1">Status</label>
                                    <select value={editingVehicle.status || 'AVAILABLE'}
                                        onChange={e => setEditingVehicle({ ...editingVehicle, status: e.target.value as VehicleStatus })}
                                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none">
                                        {(Object.keys(VEHICLE_STATUS_LABELS) as VehicleStatus[]).map(s => (
                                            <option key={s} value={s}>{VEHICLE_STATUS_LABELS[s]}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-zinc-400 mb-1">Marca *</label>
                                    <input type="text" value={editingVehicle.brand || ''}
                                        onChange={e => setEditingVehicle({ ...editingVehicle, brand: e.target.value })}
                                        placeholder="Ex: Toyota" className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-zinc-400 mb-1">Modelo *</label>
                                    <input type="text" value={editingVehicle.model || ''}
                                        onChange={e => setEditingVehicle({ ...editingVehicle, model: e.target.value })}
                                        placeholder="Ex: Corolla" className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none" />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-zinc-400 mb-1">Ano</label>
                                    <input type="number" value={editingVehicle.year || ''}
                                        onChange={e => setEditingVehicle({ ...editingVehicle, year: parseInt(e.target.value) || 0 })}
                                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-zinc-400 mb-1">Placa *</label>
                                    <input type="text" value={editingVehicle.licensePlate || ''}
                                        onChange={e => setEditingVehicle({ ...editingVehicle, licensePlate: e.target.value.toUpperCase() })}
                                        placeholder="ABC-1234" className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-zinc-400 mb-1">Cor</label>
                                    <input type="text" value={editingVehicle.color || ''}
                                        onChange={e => setEditingVehicle({ ...editingVehicle, color: e.target.value })}
                                        placeholder="Preto" className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none" />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-zinc-400 mb-1">Valor Semanal (R$)</label>
                                    <input type="number" step="0.01" value={editingVehicle.weeklyRate || ''}
                                        onChange={e => setEditingVehicle({ ...editingVehicle, weeklyRate: parseFloat(e.target.value) || 0 })}
                                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-zinc-400 mb-1">Caucao (R$)</label>
                                    <input type="number" step="0.01" value={editingVehicle.depositAmount || ''}
                                        onChange={e => setEditingVehicle({ ...editingVehicle, depositAmount: parseFloat(e.target.value) || 0 })}
                                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-zinc-400 mb-1">KM Atual</label>
                                    <input type="number" value={editingVehicle.mileage || ''}
                                        onChange={e => setEditingVehicle({ ...editingVehicle, mileage: parseInt(e.target.value) || 0 })}
                                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-zinc-400 mb-1">Combustivel</label>
                                    <input type="text" value={editingVehicle.fuelType || ''}
                                        onChange={e => setEditingVehicle({ ...editingVehicle, fuelType: e.target.value })}
                                        placeholder="Flex" className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-zinc-400 mb-1">Chassis</label>
                                    <input type="text" value={editingVehicle.chassis || ''}
                                        onChange={e => setEditingVehicle({ ...editingVehicle, chassis: e.target.value })}
                                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-zinc-400 mb-1">RENAVAM</label>
                                    <input type="text" value={editingVehicle.renavam || ''}
                                        onChange={e => setEditingVehicle({ ...editingVehicle, renavam: e.target.value })}
                                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-zinc-400 mb-1">Apolice Seguro</label>
                                    <input type="text" value={editingVehicle.insurancePolicy || ''}
                                        onChange={e => setEditingVehicle({ ...editingVehicle, insurancePolicy: e.target.value })}
                                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-zinc-400 mb-1">Observacoes</label>
                                <textarea value={editingVehicle.notes || ''}
                                    onChange={e => setEditingVehicle({ ...editingVehicle, notes: e.target.value })}
                                    className="w-full h-20 bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none resize-none" />
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-black rounded-lg border border-zinc-700">
                                <input type="checkbox" checked={editingVehicle.blockable ?? true}
                                    onChange={e => setEditingVehicle({ ...editingVehicle, blockable: e.target.checked })}
                                    className="w-4 h-4" />
                                <span className="text-zinc-400">Veiculo pode ser bloqueado remotamente</span>
                            </div>
                            <Button onClick={handleSaveVehicle} isLoading={saving} className="w-full bg-[#D4AF37] text-black">
                                <Save size={18} /> {editingVehicle.id ? 'Salvar Alteracoes' : 'Cadastrar Veiculo'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Rental Modal */}
            {showRentalModal && editingRental && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="sticky top-0 bg-zinc-900 p-6 pb-4 border-b border-zinc-800 flex justify-between items-center z-10">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <ClipboardList className="text-[#D4AF37]" /> Nova Locacao
                            </h3>
                            <button onClick={() => setShowRentalModal(false)}><X className="text-zinc-500 hover:text-white" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-zinc-400 mb-1">Veiculo *</label>
                                <select value={editingRental.vehicleId || ''}
                                    onChange={e => {
                                        const v = availableVehiclesForRental.find(veh => veh.id === e.target.value);
                                        setEditingRental({
                                            ...editingRental, vehicleId: e.target.value,
                                            weeklyRate: v?.weeklyRate || editingRental.weeklyRate,
                                            depositAmount: v?.depositAmount || editingRental.depositAmount,
                                        });
                                    }}
                                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none">
                                    <option value="">Selecione um veiculo...</option>
                                    {availableVehiclesForRental.map(v => (
                                        <option key={v.id} value={v.id}>{v.brand} {v.model} - {v.licensePlate} ({formatBRL(v.weeklyRate)}/sem)</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-zinc-400 mb-1">ID do Cliente *</label>
                                <input type="text" value={editingRental.customerId || ''}
                                    onChange={e => setEditingRental({ ...editingRental, customerId: e.target.value })}
                                    placeholder="UUID do cliente" className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-zinc-400 mb-1">Data Inicio</label>
                                <input type="date" value={editingRental.startDate || ''}
                                    onChange={e => setEditingRental({ ...editingRental, startDate: e.target.value })}
                                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-zinc-400 mb-1">Valor Semanal (R$)</label>
                                    <input type="number" step="0.01" value={editingRental.weeklyRate || ''}
                                        onChange={e => setEditingRental({ ...editingRental, weeklyRate: parseFloat(e.target.value) || 0 })}
                                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-zinc-400 mb-1">Caucao (R$)</label>
                                    <input type="number" step="0.01" value={editingRental.depositAmount || ''}
                                        onChange={e => setEditingRental({ ...editingRental, depositAmount: parseFloat(e.target.value) || 0 })}
                                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-zinc-400 mb-1">Multa fixa atraso (R$)</label>
                                    <input type="number" step="0.01" value={editingRental.lateFixedFee || ''}
                                        onChange={e => setEditingRental({ ...editingRental, lateFixedFee: parseFloat(e.target.value) || 0 })}
                                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-zinc-400 mb-1">Juros diario (%)</label>
                                    <input type="number" step="0.01" value={editingRental.lateDailyInterest || ''}
                                        onChange={e => setEditingRental({ ...editingRental, lateDailyInterest: parseFloat(e.target.value) || 0 })}
                                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none" />
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-black rounded-lg border border-zinc-700">
                                <input type="checkbox" checked={editingRental.depositPaid ?? false}
                                    onChange={e => setEditingRental({ ...editingRental, depositPaid: e.target.checked })}
                                    className="w-4 h-4" />
                                <span className="text-zinc-400">Caucao paga</span>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-zinc-400 mb-1">Observacoes admin</label>
                                <textarea value={editingRental.adminNotes || ''}
                                    onChange={e => setEditingRental({ ...editingRental, adminNotes: e.target.value })}
                                    className="w-full h-20 bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none resize-none" />
                            </div>
                            <Button onClick={handleSaveRental} isLoading={saving} className="w-full bg-[#D4AF37] text-black">
                                <Save size={18} /> Criar Locacao
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Ticket Modal */}
            {showTicketModal && editingTicket && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="sticky top-0 bg-zinc-900 p-6 pb-4 border-b border-zinc-800 flex justify-between items-center z-10">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Wrench className="text-[#D4AF37]" /> Novo Ticket
                            </h3>
                            <button onClick={() => setShowTicketModal(false)}><X className="text-zinc-500 hover:text-white" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-zinc-400 mb-1">Veiculo *</label>
                                <select value={editingTicket.vehicleId || ''}
                                    onChange={e => setEditingTicket({ ...editingTicket, vehicleId: e.target.value })}
                                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none">
                                    <option value="">Selecione...</option>
                                    {vehicles.map(v => (
                                        <option key={v.id} value={v.id}>{v.brand} {v.model} - {v.licensePlate}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-zinc-400 mb-1">Tipo</label>
                                    <select value={editingTicket.type || 'MAINTENANCE'}
                                        onChange={e => setEditingTicket({ ...editingTicket, type: e.target.value as any })}
                                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none">
                                        <option value="MAINTENANCE">Manutencao</option>
                                        <option value="INCIDENT">Incidente</option>
                                        <option value="INSPECTION">Inspecao</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-zinc-400 mb-1">Prioridade</label>
                                    <select value={editingTicket.priority || 'NORMAL'}
                                        onChange={e => setEditingTicket({ ...editingTicket, priority: e.target.value as any })}
                                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none">
                                        <option value="LOW">Baixa</option>
                                        <option value="NORMAL">Normal</option>
                                        <option value="HIGH">Alta</option>
                                        <option value="URGENT">Urgente</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-zinc-400 mb-1">Titulo *</label>
                                <input type="text" value={editingTicket.title || ''}
                                    onChange={e => setEditingTicket({ ...editingTicket, title: e.target.value })}
                                    placeholder="Descricao breve do problema" className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-zinc-400 mb-1">Descricao</label>
                                <textarea value={editingTicket.description || ''}
                                    onChange={e => setEditingTicket({ ...editingTicket, description: e.target.value })}
                                    placeholder="Detalhes do problema..."
                                    className="w-full h-24 bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none resize-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-zinc-400 mb-1">Custo estimado (R$)</label>
                                <input type="number" step="0.01" value={editingTicket.cost || ''}
                                    onChange={e => setEditingTicket({ ...editingTicket, cost: parseFloat(e.target.value) || 0 })}
                                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none" />
                            </div>
                            <Button onClick={handleSaveTicket} isLoading={saving} className="w-full bg-[#D4AF37] text-black">
                                <Save size={18} /> Criar Ticket
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Video Review Modal */}
            {showVideoReviewModal && reviewingVideo && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="sticky top-0 bg-zinc-900 p-6 pb-4 border-b border-zinc-800 flex justify-between items-center z-10">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Video className="text-[#D4AF37]" /> Analisar Video - Semana {reviewingVideo.weekNumber}
                            </h3>
                            <button onClick={() => setShowVideoReviewModal(false)}><X className="text-zinc-500 hover:text-white" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="space-y-2">
                                <div className="flex justify-between p-3 bg-black rounded-lg border border-zinc-800">
                                    <span className="text-zinc-500">Vencimento</span>
                                    <span className="text-white">{fmtDate(reviewingVideo.dueDate)}</span>
                                </div>
                                {reviewingVideo.capturedAt && (
                                    <div className="flex justify-between p-3 bg-black rounded-lg border border-zinc-800">
                                        <span className="text-zinc-500">Capturado em</span>
                                        <span className="text-white">{fmtDateTime(reviewingVideo.capturedAt)}</span>
                                    </div>
                                )}
                                {reviewingVideo.address && (
                                    <div className="flex justify-between p-3 bg-black rounded-lg border border-zinc-800">
                                        <span className="text-zinc-500">Local</span>
                                        <span className="text-white text-right text-sm max-w-[200px]">{reviewingVideo.address}</span>
                                    </div>
                                )}
                            </div>
                            <div className="space-y-2">
                                <p className="text-sm font-bold text-zinc-400">Videos enviados:</p>
                                {reviewingVideo.videoExteriorUrl && (
                                    <a href={reviewingVideo.videoExteriorUrl} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-2 p-3 bg-black rounded-lg border border-zinc-800 text-blue-400 hover:border-blue-500/50">
                                        <Video size={16} /> Video Exterior
                                    </a>
                                )}
                                {reviewingVideo.videoDashboardUrl && (
                                    <a href={reviewingVideo.videoDashboardUrl} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-2 p-3 bg-black rounded-lg border border-zinc-800 text-blue-400 hover:border-blue-500/50">
                                        <Video size={16} /> Video Painel
                                    </a>
                                )}
                                {reviewingVideo.videoResidenceUrl && (
                                    <a href={reviewingVideo.videoResidenceUrl} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-2 p-3 bg-black rounded-lg border border-zinc-800 text-blue-400 hover:border-blue-500/50">
                                        <Video size={16} /> Video Residencia
                                    </a>
                                )}
                                {!reviewingVideo.videoExteriorUrl && !reviewingVideo.videoDashboardUrl && !reviewingVideo.videoResidenceUrl && (
                                    <p className="text-zinc-500 text-sm italic">Nenhum video enviado ainda</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-zinc-400 mb-1">Observacoes do admin</label>
                                <textarea value={videoAdminNotes}
                                    onChange={e => setVideoAdminNotes(e.target.value)}
                                    placeholder="Observacoes sobre os videos..."
                                    className="w-full h-20 bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none resize-none" />
                            </div>
                            <div className="flex gap-4">
                                <Button variant="danger" className="flex-1" onClick={() => handleReviewVideo('REJECTED')} isLoading={saving}>
                                    <X size={18} /> Rejeitar
                                </Button>
                                <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => handleReviewVideo('APPROVED')} isLoading={saving}>
                                    <Check size={18} /> Aprovar
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FleetHub;
