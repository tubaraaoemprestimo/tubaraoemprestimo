import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Store, Car, Bike, CreditCard, Smartphone, CircleDollarSign, ChevronRight, Loader2, type LucideIcon } from 'lucide-react';
import { phoneFinancingService, type CatalogService } from '../services/phoneFinancingService';

const ICONS: Record<string, LucideIcon> = { Briefcase, Store, Car, Bike, CreditCard, Smartphone };

interface Props {
    /** Se informado, é chamado em vez de navegar para applicationRoute. */
    onSelect?: (code: string) => void;
    className?: string;
}

export const ServiceCatalogGrid: React.FC<Props> = ({ onSelect, className = '' }) => {
    const navigate = useNavigate();
    const [services, setServices] = useState<CatalogService[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let alive = true;
        phoneFinancingService.getCatalog('client')
            .then(list => alive && setServices([...list].filter(s => s.visible !== false).sort((a, b) => a.sortOrder - b.sortOrder)))
            .catch(e => alive && setError(e.message || 'Não foi possível carregar os serviços.'));
        return () => { alive = false; };
    }, []);

    if (error) return <p role="alert" className="text-sm text-red-400 px-4">{error}</p>;
    if (!services) {
        return (
            <div className="flex items-center gap-2 text-zinc-400 text-sm px-4 py-6" role="status">
                <Loader2 className="animate-spin" size={18} /> Carregando serviços...
            </div>
        );
    }

    const open = (s: CatalogService) => {
        if (!s.available) return;
        if (onSelect) onSelect(s.code);
        else navigate(s.applicationRoute);
    };

    return (
        <ul className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 ${className}`}>
            {services.map(s => {
                const Icon = ICONS[s.icon] || CircleDollarSign;
                const isPhone = s.code === 'FINANCIAMENTO_CELULAR';
                return (
                    <li key={s.code}>
                        <button
                            type="button"
                            onClick={() => open(s)}
                            disabled={!s.available}
                            aria-label={`${s.label}${s.available ? '' : ' — em breve'}`}
                            className={`w-full h-full text-left flex items-start gap-3 p-4 rounded-2xl border bg-[#1a1a1a] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
                                s.available ? 'border-zinc-800 hover:border-[#D4AF37]/60' : 'border-zinc-900 opacity-60 cursor-not-allowed'
                            } ${isPhone && s.available ? 'border-[#D4AF37]/40' : ''}`}
                        >
                            <span className="shrink-0 p-2.5 rounded-xl bg-zinc-900 text-[#D4AF37]" aria-hidden="true"><Icon size={22} /></span>
                            <span className="flex-1 min-w-0">
                                <span className="flex flex-wrap items-center gap-2">
                                    <span className="font-bold text-white">{s.label}</span>
                                    {s.available && (s.isNew || isPhone) && (
                                        <span className="text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded-full bg-[#D4AF37] text-black">Novidade</span>
                                    )}
                                    {!s.available && (
                                        <span className="text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">Em breve</span>
                                    )}
                                </span>
                                <span className="block text-sm text-zinc-400 mt-1">{s.description}</span>
                            </span>
                            {s.available && <ChevronRight size={18} className="shrink-0 text-zinc-500 mt-1" aria-hidden="true" />}
                        </button>
                    </li>
                );
            })}
        </ul>
    );
};
