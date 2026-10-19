// Peças visuais compartilhadas do módulo Financiamento de Celulares / MDM.
import React from 'react';
import { Loader2, AlertCircle } from 'lucide-react';

export const inputCls =
    'w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-[#D4AF37] focus-visible:ring-2 focus-visible:ring-[#D4AF37]/40 disabled:opacity-50';

export const cardCls = 'bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-4';

export const Field: React.FC<{ id: string; label: string; error?: string | null; hint?: string; children: React.ReactNode }> = ({ id, label, error, hint, children }) => (
    <div className="space-y-1">
        <label htmlFor={id} className="block text-sm font-medium text-zinc-300">{label}</label>
        {children}
        {hint && !error && <p className="text-xs text-zinc-500">{hint}</p>}
        {error && <p id={`${id}-error`} role="alert" className="text-xs text-red-400">{error}</p>}
    </div>
);

export const ErrorBox: React.FC<{ message: string | null | undefined; onRetry?: () => void }> = ({ message, onRetry }) =>
    message ? (
        <div role="alert" className="flex items-start gap-2 p-3 rounded-xl border border-red-500/40 bg-red-950/30 text-sm text-red-200">
            <AlertCircle size={18} className="shrink-0 mt-0.5" aria-hidden="true" />
            <span className="flex-1">{message}</span>
            {onRetry && <button type="button" onClick={onRetry} className="underline font-semibold">Tentar novamente</button>}
        </div>
    ) : null;

export const Loading: React.FC<{ label?: string }> = ({ label = 'Carregando...' }) => (
    <div role="status" className="flex items-center justify-center gap-2 py-10 text-zinc-400 text-sm">
        <Loader2 size={18} className="animate-spin" aria-hidden="true" /> {label}
    </div>
);

const TONE: Record<string, string> = {
    green: 'bg-green-500/15 text-green-300 border-green-500/30',
    red: 'bg-red-500/15 text-red-300 border-red-500/30',
    yellow: 'bg-yellow-500/15 text-yellow-200 border-yellow-500/30',
    blue: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    zinc: 'bg-zinc-800 text-zinc-300 border-zinc-700',
};

const STATUS_TONE: Record<string, keyof typeof TONE> = {
    approved: 'green', active: 'green', paid: 'green', PAID: 'green', acknowledged: 'green', generated: 'green', delivered: 'green', paid_off: 'green',
    rejected: 'red', cancelled: 'red', failed: 'red', FAILED: 'red', overdue: 'red', expired: 'red',
    under_review: 'yellow', awaiting_documents: 'yellow', contract_pending: 'yellow', awaiting_down_payment: 'yellow', requested: 'yellow', legal_template_pending: 'yellow', pending: 'yellow', PENDING: 'yellow',
    submitted: 'blue', ready_for_handover: 'blue', queued: 'blue', dispatched: 'blue', authorized: 'blue',
};

export const Badge: React.FC<{ status?: string | null; children: React.ReactNode }> = ({ status, children }) => (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold ${TONE[STATUS_TONE[status || ''] || 'zinc']}`}>{children}</span>
);

export const Row: React.FC<{ label: string; value: React.ReactNode; strong?: boolean }> = ({ label, value, strong }) => (
    <div className="flex justify-between gap-3 py-1.5 text-sm">
        <span className="text-zinc-400">{label}</span>
        <span className={`text-right ${strong ? 'font-bold text-[#D4AF37]' : 'text-white'}`}>{value}</span>
    </div>
);
