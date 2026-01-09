import React, { useState, useEffect, useRef } from 'react';
import {
    MapPin, Navigation, Route, Users, AlertTriangle,
    Clock, Target, Play, CheckCircle, Trash2, Plus,
    Filter, RefreshCw, Download, Eye, ChevronRight
} from 'lucide-react';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Toast';
import { Customer, GeoCluster, CollectionRoute } from '../../types';
import { geolocationService } from '../../services/geolocationService';
import { supabaseService } from '../../services/supabaseService';

export const GeolocationPage: React.FC = () => {
    const { addToast } = useToast();
    const mapRef = useRef<HTMLDivElement>(null);

    const [customers, setCustomers] = useState<Customer[]>([]);
    const [clusters, setClusters] = useState<GeoCluster[]>([]);
    const [routes, setRoutes] = useState<CollectionRoute[]>([]);
    const [selectedCluster, setSelectedCluster] = useState<GeoCluster | null>(null);
    const [activeTab, setActiveTab] = useState<'map' | 'clusters' | 'routes'>('map');
    const [filterStatus, setFilterStatus] = useState<'all' | 'defaulted'>('all');
    const [isCreatingRoute, setIsCreatingRoute] = useState(false);
    const [selectedCustomersForRoute, setSelectedCustomersForRoute] = useState<Customer[]>([]);
    const [routeName, setRouteName] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const customersData = await supabaseService.getCustomers();

            // Add mock geolocation data to customers
            const customersWithGeo = customersData.map((c, index) => {
                const neighborhoods = Object.keys(geolocationService.neighborhoodCoordinates);
                const randomNeighborhood = neighborhoods[index % neighborhoods.length];
                const coords = geolocationService.neighborhoodCoordinates[randomNeighborhood];

                return {
                    ...c,
                    neighborhood: c.neighborhood || randomNeighborhood,
                    city: c.city || 'Recife',
                    state: c.state || 'PE',
                    latitude: c.latitude || (coords.lat + (Math.random() - 0.5) * 0.01),
                    longitude: c.longitude || (coords.lng + (Math.random() - 0.5) * 0.01)
                };
            });

            setCustomers(customersWithGeo);
            setClusters(geolocationService.generateClusters(customersWithGeo));
            setRoutes(geolocationService.getRoutes());
        } catch (error) {
            console.error('Error loading data:', error);
            addToast('Erro ao carregar dados', 'error');
        }
    };

    const filteredCustomers = filterStatus === 'defaulted'
        ? customers.filter(c => c.totalDebt > 0 || c.status === 'BLOCKED')
        : customers;

    const handleCreateRoute = () => {
        if (!routeName.trim()) {
            addToast('Digite um nome para a rota', 'warning');
            return;
        }
        if (selectedCustomersForRoute.length < 2) {
            addToast('Selecione pelo menos 2 clientes', 'warning');
            return;
        }

        const route = geolocationService.createCollectionRoute(routeName, selectedCustomersForRoute);
        setRoutes([...routes, route]);
        setIsCreatingRoute(false);
        setSelectedCustomersForRoute([]);
        setRouteName('');
        addToast(`Rota "${route.name}" criada com ${route.stops.length} paradas!`, 'success');
    };

    const handleDeleteRoute = (routeId: string) => {
        geolocationService.deleteRoute(routeId);
        setRoutes(routes.filter(r => r.id !== routeId));
        addToast('Rota excluída', 'success');
    };

    const handleStartRoute = (routeId: string) => {
        geolocationService.updateRouteStatus(routeId, 'IN_PROGRESS');
        setRoutes(routes.map(r => r.id === routeId ? { ...r, status: 'IN_PROGRESS' } : r));
        addToast('Rota iniciada!', 'success');
    };

    const handleCompleteRoute = (routeId: string) => {
        geolocationService.updateRouteStatus(routeId, 'COMPLETED');
        setRoutes(routes.map(r => r.id === routeId ? { ...r, status: 'COMPLETED' } : r));
        addToast('Rota concluída!', 'success');
    };

    const toggleCustomerForRoute = (customer: Customer) => {
        if (selectedCustomersForRoute.find(c => c.id === customer.id)) {
            setSelectedCustomersForRoute(selectedCustomersForRoute.filter(c => c.id !== customer.id));
        } else {
            setSelectedCustomersForRoute([...selectedCustomersForRoute, customer]);
        }
    };

    const getStatusColor = (customer: Customer) => {
        if (customer.status === 'BLOCKED') return '#ef4444';
        if (customer.totalDebt > 0) return '#f97316';
        return '#22c55e';
    };

    const getRiskColor = (rate: number) => {
        if (rate >= 50) return '#ef4444';
        if (rate >= 30) return '#f97316';
        if (rate >= 15) return '#eab308';
        return '#22c55e';
    };

    return (
        <div className="p-4 md:p-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-[#D4AF37] flex items-center gap-3">
                        <MapPin size={32} /> Geolocalização e Rotas
                    </h1>
                    <p className="text-zinc-400 mt-1">
                        Mapa de clientes, análise de inadimplência por região e otimização de rotas de cobrança
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={loadData}>
                        <RefreshCw size={18} /> Atualizar
                    </Button>
                    <Button onClick={() => setIsCreatingRoute(!isCreatingRoute)}>
                        <Plus size={18} /> Nova Rota
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                            <Users size={20} className="text-blue-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-white">{customers.length}</p>
                            <p className="text-xs text-zinc-400">Clientes Mapeados</p>
                        </div>
                    </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-500/20 rounded-lg">
                            <Target size={20} className="text-purple-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-white">{clusters.length}</p>
                            <p className="text-xs text-zinc-400">Bairros</p>
                        </div>
                    </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-500/20 rounded-lg">
                            <AlertTriangle size={20} className="text-orange-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-white">
                                {customers.filter(c => c.totalDebt > 0).length}
                            </p>
                            <p className="text-xs text-zinc-400">Inadimplentes</p>
                        </div>
                    </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-500/20 rounded-lg">
                            <Route size={20} className="text-green-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-white">{routes.length}</p>
                            <p className="text-xs text-zinc-400">Rotas Criadas</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-zinc-800 pb-2">
                {[
                    { id: 'map', label: 'Mapa', icon: MapPin },
                    { id: 'clusters', label: 'Clusters por Bairro', icon: Target },
                    { id: 'routes', label: 'Rotas de Cobrança', icon: Route },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${activeTab === tab.id
                            ? 'bg-[#D4AF37] text-black font-medium'
                            : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                            }`}
                    >
                        <tab.icon size={18} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Route Creation Panel */}
            {isCreatingRoute && (
                <div className="bg-zinc-900 border border-[#D4AF37] rounded-xl p-6 animate-in slide-in-from-top">
                    <h3 className="text-lg font-bold text-[#D4AF37] mb-4 flex items-center gap-2">
                        <Navigation size={20} /> Criar Nova Rota de Cobrança
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                            <label className="block text-sm text-zinc-400 mb-2">Nome da Rota</label>
                            <input
                                type="text"
                                value={routeName}
                                onChange={(e) => setRouteName(e.target.value)}
                                className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                                placeholder="Ex: Rota Boa Viagem - Segunda"
                            />
                        </div>
                        <div className="flex items-end">
                            <p className="text-zinc-400">
                                <span className="text-[#D4AF37] font-bold">{selectedCustomersForRoute.length}</span> clientes selecionados
                            </p>
                        </div>
                        <div className="flex items-end gap-2">
                            <Button onClick={handleCreateRoute} className="flex-1">
                                <CheckCircle size={18} /> Criar Rota Otimizada
                            </Button>
                            <Button variant="outline" onClick={() => {
                                setIsCreatingRoute(false);
                                setSelectedCustomersForRoute([]);
                            }}>
                                Cancelar
                            </Button>
                        </div>
                    </div>
                    <p className="text-xs text-zinc-500">
                        Clique nos clientes no mapa ou na lista abaixo para adicioná-los à rota. O sistema otimizará automaticamente a ordem de visitas.
                    </p>
                </div>
            )}

            {/* Map Tab */}
            {activeTab === 'map' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Map Container */}
                    <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                        <div className="bg-zinc-800 p-4 flex justify-between items-center">
                            <h3 className="text-white font-medium flex items-center gap-2">
                                <MapPin size={18} className="text-[#D4AF37]" /> Mapa de Clientes
                            </h3>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setFilterStatus('all')}
                                    className={`px-3 py-1 rounded-lg text-sm transition-all ${filterStatus === 'all' ? 'bg-[#D4AF37] text-black' : 'bg-zinc-700 text-zinc-300'
                                        }`}
                                >
                                    Todos
                                </button>
                                <button
                                    onClick={() => setFilterStatus('defaulted')}
                                    className={`px-3 py-1 rounded-lg text-sm transition-all ${filterStatus === 'defaulted' ? 'bg-red-500 text-white' : 'bg-zinc-700 text-zinc-300'
                                        }`}
                                >
                                    Inadimplentes
                                </button>
                            </div>
                        </div>

                        {/* Map Placeholder - In production, integrate with Leaflet */}
                        <div
                            ref={mapRef}
                            className="h-[500px] bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center relative overflow-hidden"
                        >
                            {/* Visual Map Representation */}
                            <div className="absolute inset-0 opacity-10">
                                <svg viewBox="0 0 400 300" className="w-full h-full">
                                    {/* Grid lines */}
                                    {[...Array(10)].map((_, i) => (
                                        <React.Fragment key={i}>
                                            <line x1={i * 40} y1="0" x2={i * 40} y2="300" stroke="#D4AF37" strokeWidth="0.5" />
                                            <line x1="0" y1={i * 30} x2="400" y2={i * 30} stroke="#D4AF37" strokeWidth="0.5" />
                                        </React.Fragment>
                                    ))}
                                </svg>
                            </div>

                            {/* Customer Markers */}
                            <div className="absolute inset-8">
                                {filteredCustomers.slice(0, 50).map((customer, index) => {
                                    const x = ((customer.longitude || -34.8770) + 35) * 200;
                                    const y = ((customer.latitude || -8.0476) + 8.2) * 300;
                                    const isSelected = selectedCustomersForRoute.find(c => c.id === customer.id);

                                    return (
                                        <div
                                            key={customer.id}
                                            onClick={() => isCreatingRoute && toggleCustomerForRoute(customer)}
                                            className={`absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all hover:scale-125 ${isCreatingRoute ? 'hover:ring-2 hover:ring-[#D4AF37]' : ''
                                                }`}
                                            style={{
                                                left: `${(index % 10) * 10 + 5}%`,
                                                top: `${Math.floor(index / 10) * 20 + 10}%`,
                                            }}
                                            title={`${customer.name} - ${customer.neighborhood || 'Sem bairro'}`}
                                        >
                                            <div
                                                className={`w-4 h-4 rounded-full shadow-lg ${isSelected ? 'ring-2 ring-[#D4AF37] ring-offset-2 ring-offset-black' : ''}`}
                                                style={{ backgroundColor: getStatusColor(customer) }}
                                            />
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Legend */}
                            <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur-sm rounded-lg p-3 text-xs">
                                <p className="text-zinc-400 mb-2 font-medium">Legenda:</p>
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-3 h-3 rounded-full bg-green-500" />
                                    <span className="text-zinc-300">Adimplente</span>
                                </div>
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-3 h-3 rounded-full bg-orange-500" />
                                    <span className="text-zinc-300">Com Débito</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-red-500" />
                                    <span className="text-zinc-300">Bloqueado</span>
                                </div>
                            </div>

                            {/* Info */}
                            <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-sm rounded-lg p-3 text-xs">
                                <p className="text-[#D4AF37] font-medium">
                                    {filteredCustomers.length} clientes exibidos
                                </p>
                                <p className="text-zinc-400">
                                    Clique para detalhes
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Customer List */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                        <div className="bg-zinc-800 p-4">
                            <h3 className="text-white font-medium flex items-center gap-2">
                                <Users size={18} className="text-[#D4AF37]" /> Lista de Clientes
                            </h3>
                        </div>
                        <div className="max-h-[500px] overflow-y-auto divide-y divide-zinc-800">
                            {filteredCustomers.map(customer => (
                                <div
                                    key={customer.id}
                                    onClick={() => isCreatingRoute && toggleCustomerForRoute(customer)}
                                    className={`p-4 hover:bg-zinc-800/50 transition-all cursor-pointer ${selectedCustomersForRoute.find(c => c.id === customer.id)
                                        ? 'bg-[#D4AF37]/10 border-l-4 border-[#D4AF37]'
                                        : ''
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-3 h-3 rounded-full"
                                            style={{ backgroundColor: getStatusColor(customer) }}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white font-medium truncate">{customer.name}</p>
                                            <p className="text-xs text-zinc-500">{customer.neighborhood || 'Sem bairro'}</p>
                                        </div>
                                        {customer.totalDebt > 0 && (
                                            <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded">
                                                R$ {customer.totalDebt.toLocaleString()}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Clusters Tab */}
            {activeTab === 'clusters' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {clusters.map(cluster => (
                        <div
                            key={cluster.id}
                            onClick={() => setSelectedCluster(selectedCluster?.id === cluster.id ? null : cluster)}
                            className={`bg-zinc-900 border rounded-xl p-6 cursor-pointer transition-all hover:scale-[1.02] ${selectedCluster?.id === cluster.id
                                ? 'border-[#D4AF37] ring-2 ring-[#D4AF37]/20'
                                : 'border-zinc-800 hover:border-zinc-700'
                                }`}
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-white">{cluster.neighborhood}</h3>
                                    <p className="text-sm text-zinc-500">{cluster.city}</p>
                                </div>
                                <div
                                    className="px-3 py-1 rounded-full text-sm font-medium"
                                    style={{
                                        backgroundColor: `${getRiskColor(cluster.defaultRate)}20`,
                                        color: getRiskColor(cluster.defaultRate)
                                    }}
                                >
                                    {cluster.defaultRate}% risco
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-black/30 rounded-lg p-3">
                                    <p className="text-2xl font-bold text-white">{cluster.customerCount}</p>
                                    <p className="text-xs text-zinc-500">Clientes</p>
                                </div>
                                <div className="bg-black/30 rounded-lg p-3">
                                    <p className="text-2xl font-bold text-red-400">
                                        R$ {(cluster.totalDebt / 1000).toFixed(1)}k
                                    </p>
                                    <p className="text-xs text-zinc-500">Dívida Total</p>
                                </div>
                            </div>

                            {/* Risk Bar */}
                            <div className="mt-4">
                                <div className="flex justify-between text-xs text-zinc-500 mb-1">
                                    <span>Risco de Inadimplência</span>
                                    <span>{cluster.defaultRate}%</span>
                                </div>
                                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all"
                                        style={{
                                            width: `${cluster.defaultRate}%`,
                                            backgroundColor: getRiskColor(cluster.defaultRate)
                                        }}
                                    />
                                </div>
                            </div>

                            {selectedCluster?.id === cluster.id && (
                                <div className="mt-4 pt-4 border-t border-zinc-800">
                                    <p className="text-sm text-zinc-400 mb-2">Clientes neste bairro:</p>
                                    <div className="flex flex-wrap gap-1">
                                        {cluster.customers.slice(0, 5).map(c => (
                                            <span key={c.id} className="text-xs bg-zinc-800 text-zinc-300 px-2 py-1 rounded">
                                                {c.name.split(' ')[0]}
                                            </span>
                                        ))}
                                        {cluster.customers.length > 5 && (
                                            <span className="text-xs bg-[#D4AF37]/20 text-[#D4AF37] px-2 py-1 rounded">
                                                +{cluster.customers.length - 5}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Routes Tab */}
            {activeTab === 'routes' && (
                <div className="space-y-4">
                    {routes.length === 0 ? (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
                            <Route size={48} className="text-zinc-600 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-zinc-400 mb-2">Nenhuma rota criada</h3>
                            <p className="text-zinc-500 mb-4">
                                Crie rotas otimizadas para cobrança presencial
                            </p>
                            <Button onClick={() => { setActiveTab('map'); setIsCreatingRoute(true); }}>
                                <Plus size={18} /> Criar Primeira Rota
                            </Button>
                        </div>
                    ) : (
                        routes.map(route => (
                            <div key={route.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                                <div className="bg-zinc-800 p-4 flex flex-wrap items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2 rounded-lg ${route.status === 'COMPLETED' ? 'bg-green-500/20' :
                                            route.status === 'IN_PROGRESS' ? 'bg-yellow-500/20' : 'bg-zinc-700'
                                            }`}>
                                            <Route size={20} className={
                                                route.status === 'COMPLETED' ? 'text-green-400' :
                                                    route.status === 'IN_PROGRESS' ? 'text-yellow-400' : 'text-zinc-400'
                                            } />
                                        </div>
                                        <div>
                                            <h3 className="text-white font-bold">{route.name}</h3>
                                            <p className="text-xs text-zinc-500">
                                                Criada em {new Date(route.date).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6 text-sm">
                                        <div className="text-zinc-400">
                                            <span className="text-white font-bold">{route.stops.length}</span> paradas
                                        </div>
                                        <div className="text-zinc-400">
                                            <span className="text-white font-bold">{route.totalDistance.toFixed(1)}</span> km
                                        </div>
                                        <div className="text-zinc-400">
                                            <span className="text-white font-bold">{route.totalTime}</span> min
                                        </div>

                                        <div className="flex gap-2">
                                            {route.status === 'PLANNED' && (
                                                <Button size="sm" onClick={() => handleStartRoute(route.id)}>
                                                    <Play size={14} /> Iniciar
                                                </Button>
                                            )}
                                            {route.status === 'IN_PROGRESS' && (
                                                <Button size="sm" onClick={() => handleCompleteRoute(route.id)}>
                                                    <CheckCircle size={14} /> Concluir
                                                </Button>
                                            )}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleDeleteRoute(route.id)}
                                                className="text-red-400 border-red-400/50 hover:bg-red-500/10"
                                            >
                                                <Trash2 size={14} />
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                {/* Route Stops */}
                                <div className="p-4">
                                    <div className="flex items-center gap-2 text-sm text-zinc-500 mb-4">
                                        <Clock size={14} />
                                        <span>Ordem otimizada de visitas:</span>
                                    </div>

                                    <div className="space-y-2">
                                        {route.stops.map((stop, index) => (
                                            <div key={stop.customer.id} className="flex items-center gap-4 p-3 bg-black/30 rounded-lg">
                                                <div className="w-8 h-8 rounded-full bg-[#D4AF37] flex items-center justify-center text-black font-bold text-sm">
                                                    {stop.order}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-white font-medium">{stop.customer.name}</p>
                                                    <p className="text-xs text-zinc-500">{stop.customer.neighborhood || 'Sem bairro'}</p>
                                                </div>
                                                <div className="text-right text-sm">
                                                    <p className="text-zinc-400">{stop.distance} km</p>
                                                    <p className="text-xs text-zinc-500">~{stop.estimatedTime} min</p>
                                                </div>
                                                {stop.customer.totalDebt > 0 && (
                                                    <div className="text-right">
                                                        <p className="text-red-400 font-bold">R$ {stop.customer.totalDebt.toLocaleString()}</p>
                                                        <p className="text-xs text-zinc-500">a cobrar</p>
                                                    </div>
                                                )}
                                                {index < route.stops.length - 1 && (
                                                    <ChevronRight size={16} className="text-zinc-600" />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};
