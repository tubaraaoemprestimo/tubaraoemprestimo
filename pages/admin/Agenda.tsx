// 📅 Agenda de Recebimentos - Calendário visual com parcelas
import React, { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, DollarSign, AlertTriangle, CheckCircle, Clock, User, Filter } from 'lucide-react';
import { supabaseService } from '../../services/supabaseService';
import { calendarService } from '../../services/adminService';
import { CalendarEvent, Customer, Loan } from '../../types';

export const AgendaPage: React.FC = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loans, setLoans] = useState<Loan[]>([]);
    const [viewMode, setViewMode] = useState<'month' | 'week' | 'list'>('month');
    const [filter, setFilter] = useState<'all' | 'pending' | 'overdue' | 'paid'>('all');

    useEffect(() => {
        loadData();
    }, [currentDate]);

    const loadData = async () => {
        const [customersData, loansData] = await Promise.all([
            supabaseService.getCustomers(),
            supabaseService.getClientLoans()
        ]);
        setCustomers(customersData);
        setLoans(loansData);

        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

        const monthEvents = calendarService.getEvents(
            startOfMonth.toISOString(),
            endOfMonth.toISOString(),
            loansData,
            customersData
        );
        setEvents(monthEvents);
    };

    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

    const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

    const getEventsForDay = (day: number) => {
        const dateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toISOString().split('T')[0];
        return events.filter(e => e.date.startsWith(dateStr));
    };

    const filteredEvents = events.filter(e => {
        if (filter === 'all') return true;
        if (filter === 'pending') return e.status === 'PENDING';
        if (filter === 'overdue') return e.status === 'OVERDUE';
        if (filter === 'paid') return e.status === 'PAID';
        return true;
    });

    const totalPending = events.filter(e => e.status === 'PENDING').reduce((a, e) => a + (e.amount || 0), 0);
    const totalOverdue = events.filter(e => e.status === 'OVERDUE').reduce((a, e) => a + (e.amount || 0), 0);
    const totalPaid = events.filter(e => e.status === 'PAID').reduce((a, e) => a + (e.amount || 0), 0);

    return (
        <div className="p-4 md:p-8 bg-black min-h-screen text-white pb-32">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <h1 className="text-3xl font-bold text-[#D4AF37] flex items-center gap-2">
                    <Calendar size={32} /> Agenda de Recebimentos
                </h1>
                <div className="flex gap-2">
                    {(['month', 'week', 'list'] as const).map(mode => (
                        <button
                            key={mode}
                            onClick={() => setViewMode(mode)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === mode ? 'bg-[#D4AF37] text-black' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                }`}
                        >
                            {mode === 'month' ? 'Mês' : mode === 'week' ? 'Semana' : 'Lista'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-2">
                        <Clock className="text-yellow-400" size={24} />
                        <span className="text-zinc-400">A Vencer</span>
                    </div>
                    <p className="text-2xl font-bold text-white">R$ {totalPending.toLocaleString()}</p>
                    <p className="text-sm text-zinc-500">{events.filter(e => e.status === 'PENDING').length} parcelas</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-2">
                        <AlertTriangle className="text-red-400" size={24} />
                        <span className="text-zinc-400">Em Atraso</span>
                    </div>
                    <p className="text-2xl font-bold text-red-400">R$ {totalOverdue.toLocaleString()}</p>
                    <p className="text-sm text-zinc-500">{events.filter(e => e.status === 'OVERDUE').length} parcelas</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-2">
                        <CheckCircle className="text-green-400" size={24} />
                        <span className="text-zinc-400">Recebido</span>
                    </div>
                    <p className="text-2xl font-bold text-green-400">R$ {totalPaid.toLocaleString()}</p>
                    <p className="text-sm text-zinc-500">{events.filter(e => e.status === 'PAID').length} parcelas</p>
                </div>
            </div>

            {/* Calendar Header */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                    <button onClick={prevMonth} className="p-2 hover:bg-zinc-800 rounded-lg">
                        <ChevronLeft size={24} />
                    </button>
                    <h2 className="text-xl font-bold">
                        {currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                    </h2>
                    <button onClick={nextMonth} className="p-2 hover:bg-zinc-800 rounded-lg">
                        <ChevronRight size={24} />
                    </button>
                </div>

                {/* Filter */}
                <div className="flex gap-2 p-4 border-b border-zinc-800">
                    <Filter size={20} className="text-zinc-500" />
                    {(['all', 'pending', 'overdue', 'paid'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${filter === f ? 'bg-[#D4AF37] text-black' : 'bg-zinc-800 text-zinc-400'
                                }`}
                        >
                            {f === 'all' ? 'Todos' : f === 'pending' ? 'A Vencer' : f === 'overdue' ? 'Atrasados' : 'Pagos'}
                        </button>
                    ))}
                </div>

                {viewMode === 'month' && (
                    <>
                        {/* Weekday Headers */}
                        <div className="grid grid-cols-7 bg-zinc-800">
                            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                                <div key={day} className="p-2 text-center text-sm font-bold text-zinc-400">
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Calendar Grid */}
                        <div className="grid grid-cols-7">
                            {/* Empty cells for days before the first */}
                            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                                <div key={`empty-${i}`} className="min-h-[100px] border-t border-r border-zinc-800 bg-zinc-900/50" />
                            ))}

                            {/* Days of the month */}
                            {Array.from({ length: daysInMonth }).map((_, i) => {
                                const day = i + 1;
                                const dayEvents = getEventsForDay(day);
                                const isToday = new Date().getDate() === day &&
                                    new Date().getMonth() === currentDate.getMonth() &&
                                    new Date().getFullYear() === currentDate.getFullYear();

                                return (
                                    <div
                                        key={day}
                                        className={`min-h-[100px] border-t border-r border-zinc-800 p-1 ${isToday ? 'bg-[#D4AF37]/10' : ''
                                            }`}
                                    >
                                        <div className={`text-sm font-bold mb-1 ${isToday ? 'text-[#D4AF37]' : 'text-zinc-400'}`}>
                                            {day}
                                        </div>
                                        <div className="space-y-1">
                                            {dayEvents.slice(0, 3).map(event => (
                                                <div
                                                    key={event.id}
                                                    className={`text-[10px] p-1 rounded truncate ${event.status === 'PAID' ? 'bg-green-900/50 text-green-400' :
                                                            event.status === 'OVERDUE' ? 'bg-red-900/50 text-red-400' :
                                                                'bg-yellow-900/50 text-yellow-400'
                                                        }`}
                                                    title={`${event.customerName} - R$ ${event.amount?.toLocaleString()}`}
                                                >
                                                    R$ {(event.amount || 0) >= 1000 ? `${((event.amount || 0) / 1000).toFixed(0)}K` : event.amount}
                                                </div>
                                            ))}
                                            {dayEvents.length > 3 && (
                                                <div className="text-[10px] text-zinc-500 text-center">
                                                    +{dayEvents.length - 3} mais
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}

                {viewMode === 'list' && (
                    <div className="divide-y divide-zinc-800 max-h-[500px] overflow-y-auto">
                        {filteredEvents.length === 0 ? (
                            <div className="p-8 text-center text-zinc-500">Nenhum evento encontrado</div>
                        ) : (
                            filteredEvents.map(event => (
                                <div key={event.id} className="p-4 hover:bg-zinc-800/50 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2 rounded-lg ${event.status === 'PAID' ? 'bg-green-900/50' :
                                                event.status === 'OVERDUE' ? 'bg-red-900/50' :
                                                    'bg-yellow-900/50'
                                            }`}>
                                            {event.status === 'PAID' ? <CheckCircle className="text-green-400" size={20} /> :
                                                event.status === 'OVERDUE' ? <AlertTriangle className="text-red-400" size={20} /> :
                                                    <Clock className="text-yellow-400" size={20} />}
                                        </div>
                                        <div>
                                            <p className="font-bold text-white">{event.customerName}</p>
                                            <p className="text-sm text-zinc-400">
                                                {new Date(event.date).toLocaleDateString('pt-BR')}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`font-bold text-lg ${event.status === 'PAID' ? 'text-green-400' :
                                                event.status === 'OVERDUE' ? 'text-red-400' :
                                                    'text-yellow-400'
                                            }`}>
                                            R$ {event.amount?.toLocaleString()}
                                        </p>
                                        <p className="text-xs text-zinc-500 uppercase">{event.status}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
