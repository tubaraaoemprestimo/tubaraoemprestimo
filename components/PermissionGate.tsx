/**
 * 🔒 Permission Gate — localização e notificações obrigatórias para o cliente.
 *
 * Um passo por vez, sem travar:
 * - Botão "Permitir" chama o aviso do celular; sem resposta em 20 s volta ao botão.
 * - Recusou: mostra como liberar no aparelho certo (iPhone / Android / Samsung, app ou navegador)
 *   e confere sozinho a cada 3 s e quando o cliente volta dos Ajustes — continua assim que liberar.
 * - GPS desligado não é tratado como "recusou": pede para ligar e tentar de novo.
 * - Sempre há "Sair e voltar ao login".
 * - iPhone sem o app instalado não tem notificação: guia de instalação, sem prender o cliente.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, Bell, Shield, XCircle, Loader2, AlertTriangle, Lock, Share2 } from 'lucide-react';

interface PermissionGateProps {
    children: React.ReactNode;
    requirePermissions?: boolean;
}

// ──────────────────────────────────────────────────────────────────────────────
// Guia visual de instalação no iOS — passo a passo simples para leigos
// ──────────────────────────────────────────────────────────────────────────────
const IOSInstallGuide: React.FC<{ onDone: () => void }> = ({ onDone }) => {
    const [step, setStep] = useState(0);

    const steps = [
        {
            emoji: '📲',
            title: 'Instalar o App',
            desc: 'Para receber notificações no iPhone, você precisa adicionar este site à sua tela de início. É rápido e fácil!',
            action: 'Vamos lá →',
        },
        {
            emoji: '⬆️',
            title: 'Toque em Compartilhar',
            desc: (
                <span>
                    Na barra inferior do Safari, toque no ícone{' '}
                    <span className="inline-flex items-center gap-1 bg-zinc-700 px-2 py-0.5 rounded text-white font-bold text-xs">
                        <Share2 size={12} /> Compartilhar
                    </span>{' '}
                    (quadrado com seta para cima).
                </span>
            ),
            action: 'Próximo →',
        },
        {
            emoji: '➕',
            title: 'Adicionar à Tela de Início',
            desc: (
                <span>
                    Role a lista para baixo e toque em{' '}
                    <span className="bg-zinc-700 px-2 py-0.5 rounded text-white font-bold text-xs">
                        Adicionar à Tela de Início
                    </span>
                    . Depois toque em <strong className="text-white">Adicionar</strong> no canto superior direito.
                </span>
            ),
            action: 'Próximo →',
        },
        {
            emoji: '🏠',
            title: 'Abra pela Tela de Início',
            desc: 'Pronto! Agora abra o aplicativo Tubarão pelo ícone que apareceu na sua tela de início. As notificações funcionarão automaticamente.',
            action: 'Já abri! Continuar',
        },
    ];

    const current = steps[step];
    const isLast = step === steps.length - 1;

    return (
        <div className="fixed inset-0 bg-black/95 z-[9999] flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                {/* Logo */}
                <div className="text-center mb-6">
                    <div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-br from-[#D4AF37] to-[#B8860B] rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(212,175,55,0.3)]">
                        <Shield size={30} className="text-black" />
                    </div>
                    <p className="text-zinc-500 text-xs uppercase tracking-widest">Tubarão Empréstimos</p>
                </div>

                {/* Step indicator */}
                <div className="flex items-center justify-center gap-2 mb-6">
                    {steps.map((_, i) => (
                        <div
                            key={i}
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                                i === step ? 'w-8 bg-[#D4AF37]' : i < step ? 'w-4 bg-green-500' : 'w-4 bg-zinc-700'
                            }`}
                        />
                    ))}
                </div>

                {/* Card do passo atual */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 mb-4 text-center">
                    <div className="text-6xl mb-4">{current.emoji}</div>
                    <h2 className="text-white font-bold text-xl mb-3">{current.title}</h2>
                    <p className="text-zinc-400 text-sm leading-relaxed">
                        {typeof current.desc === 'string' ? current.desc : current.desc}
                    </p>
                </div>

                {/* Botão de ação */}
                <button
                    onClick={() => {
                        if (isLast) {
                            onDone();
                        } else {
                            setStep(s => s + 1);
                        }
                    }}
                    className="w-full py-4 bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black font-bold text-base rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-[0_4px_20px_rgba(212,175,55,0.3)]"
                >
                    {current.action}
                </button>

                {/* Skip apenas nos passos intermediários */}
                {!isLast && (
                    <button
                        onClick={onDone}
                        className="w-full mt-3 py-2 text-zinc-600 text-xs hover:text-zinc-400"
                    >
                        Pular por agora
                    </button>
                )}
            </div>
        </div>
    );
};

// ──────────────────────────────────────────────────────────────────────────────
// PermissionGate principal
// ──────────────────────────────────────────────────────────────────────────────
type Perm = 'checking' | 'prompt' | 'asking' | 'granted' | 'denied' | 'unavailable';

export function platform() {
    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    return { ios, android: /Android/i.test(ua), samsung: /SamsungBrowser/i.test(ua), standalone };
}

async function readLocation(): Promise<Perm> {
    if (!('geolocation' in navigator)) return 'unavailable';
    try {
        const r = await navigator.permissions?.query({ name: 'geolocation' as PermissionName });
        if (r?.state === 'granted') return 'granted';
        if (r?.state === 'denied') return 'denied';
    } catch { /* Safari antigo não informa: tratamos como "perguntar" */ }
    return 'prompt';
}

function readNotification(): Perm {
    if (!('Notification' in window)) return 'unavailable';
    if (Notification.permission === 'granted') return 'granted';
    return Notification.permission === 'denied' ? 'denied' : 'prompt';
}

/** Passo a passo para liberar o que foi recusado, conforme o aparelho. */
export function enableSteps(what: 'location' | 'notification', p = platform()): string[] {
    const item = what === 'location' ? 'Localização' : 'Notificações';
    const back = 'Volte para cá — a tela continua sozinha';
    if (p.ios) {
        if (!p.standalone) return ['Toque em "aA" na barra de endereço do Safari', 'Toque em "Ajustes do Site"', `Em ${item}, escolha "Permitir"`, back];
        return what === 'location'
            ? ['Abra os Ajustes do iPhone', 'Privacidade e Segurança → Serviços de Localização', 'Ative e, em "Sites do Safari", escolha "Durante o Uso"', back]
            : ['Abra os Ajustes do iPhone', 'Toque em Notificações e procure "Tubarão"', 'Ative "Permitir Notificações"', back];
    }
    if (p.samsung) return ['Toque no cadeado 🔒 ao lado do endereço', 'Toque em "Permissões"', `Ative ${item}`, back];
    if (p.android) {
        return p.standalone
            ? ['Toque e segure o ícone do app Tubarão', 'Toque em "Informações do app" → Permissões', `Permita ${item}`, back]
            : ['Toque no ícone ⓘ ou 🔒 ao lado do endereço', 'Toque em "Permissões"', `Ative ${item}`, back];
    }
    return ['Clique no cadeado 🔒 ao lado do endereço', `Em ${item}, escolha "Permitir"`, 'Clique em "Já liberei — continuar"'];
}

export const PermissionGate: React.FC<PermissionGateProps> = ({ children, requirePermissions = true }) => {
    const IS_DEMO = import.meta.env.VITE_DEMO_MODE === 'true';
    const [loc, setLoc] = useState<Perm>('checking');
    const [notif, setNotif] = useState<Perm>('checking');
    const [showIOSGuide, setShowIOSGuide] = useState(false);
    const [hint, setHint] = useState<string | null>(null);

    // Confere o estado real; não interrompe um aviso do celular que está aberto ("asking").
    const refresh = useCallback(async () => {
        const l = await readLocation();
        setLoc(prev => (prev === 'asking' ? prev : l));
        setNotif(prev => (prev === 'asking' ? prev : readNotification()));
    }, []);

    useEffect(() => {
        if (IS_DEMO || !requirePermissions) return;
        refresh();
        // Ao voltar dos Ajustes ou de outro app, confere de novo sem precisar fechar a tela.
        const onBack = () => { if (document.visibilityState === 'visible') refresh(); };
        document.addEventListener('visibilitychange', onBack);
        window.addEventListener('focus', onBack);
        const timer = window.setInterval(refresh, 3000);
        let status: PermissionStatus | null = null;
        navigator.permissions?.query({ name: 'geolocation' as PermissionName })
            .then(s => { status = s; s.onchange = () => { refresh(); }; })
            .catch(() => { /* Safari antigo */ });
        return () => {
            document.removeEventListener('visibilitychange', onBack);
            window.removeEventListener('focus', onBack);
            window.clearInterval(timer);
            if (status) status.onchange = null;
        };
    }, [IS_DEMO, requirePermissions, refresh]);

    const askLocation = useCallback(() => {
        setHint(null);
        setLoc('asking');
        let answered = false;
        // Aviso ignorado ou fechado: volta para o botão em vez de girar para sempre.
        const giveUp = window.setTimeout(() => {
            if (answered) return;
            setLoc(prev => (prev === 'asking' ? 'prompt' : prev));
            setHint('Não recebemos a resposta. Toque em Permitir de novo e escolha "Permitir" no aviso do celular.');
        }, 20000);
        navigator.geolocation.getCurrentPosition(
            () => { answered = true; window.clearTimeout(giveUp); setLoc('granted'); },
            (err) => {
                answered = true;
                window.clearTimeout(giveUp);
                if (err.code === 1) { setLoc('denied'); return; }
                // GPS desligado ou sem sinal: não é recusa. Se a permissão já existe, segue.
                readLocation().then(state => {
                    if (state === 'granted') { setLoc('granted'); return; }
                    setLoc('prompt');
                    setHint(err.code === 3
                        ? 'O GPS demorou para responder. Confira se a Localização do celular está ligada e toque em Permitir de novo.'
                        : 'Ligue a Localização (GPS) do celular e toque em Permitir de novo.');
                });
            },
            { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 }
        );
    }, []);

    const askNotification = useCallback(async () => {
        setHint(null);
        setNotif('asking');
        try {
            const r = await Notification.requestPermission();
            setNotif(r === 'granted' ? 'granted' : r === 'denied' ? 'denied' : 'prompt');
            if (r === 'default') setHint('O aviso foi fechado sem resposta. Toque em Permitir de novo e escolha "Permitir".');
        } catch {
            setNotif(readNotification());
        }
    }, []);

    const logout = async () => {
        try {
            const { apiService } = await import('../services/apiService');
            await apiService.auth.signOut();
        } catch { /* ok */ }
        window.location.hash = '#/login';
    };

    if (IS_DEMO || !requirePermissions) return <>{children}</>;
    if (showIOSGuide) return <IOSInstallGuide onDone={() => { setShowIOSGuide(false); refresh(); }} />;

    const p = platform();
    const notifOk = notif === 'granted' || notif === 'unavailable';
    const locOk = loc === 'granted' || loc === 'unavailable';
    if (locOk && notifOk) return <>{children}</>;
    if (loc === 'checking' || notif === 'checking') {
        return (
            <div className="fixed inset-0 bg-black flex items-center justify-center z-[9999]">
                <Loader2 size={36} className="text-[#D4AF37] animate-spin" />
            </div>
        );
    }

    // Um passo por vez: primeiro localização, depois notificações.
    const step: 'location' | 'notification' = !locOk ? 'location' : 'notification';
    const status = step === 'location' ? loc : notif;
    const Icon = step === 'location' ? MapPin : Bell;
    const denied = status === 'denied';
    const title = denied
        ? (step === 'location' ? 'Localização bloqueada' : 'Notificações bloqueadas')
        : (step === 'location' ? 'Permita a localização' : 'Permita as notificações');
    const why = step === 'location'
        ? 'Para proteger sua conta contra fraudes, confirmamos de onde vem o acesso. Para continuar é necessário permitir.'
        : 'Avisamos por aqui sobre aprovação, vencimento e pagamento das parcelas. Para continuar é necessário permitir.';
    const ask = step === 'location' ? askLocation : askNotification;
    const label = step === 'location' ? 'localização' : 'notificações';

    return (
        <div className="fixed inset-0 bg-black z-[9999] overflow-y-auto">
            <div className="min-h-full flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    <div className="flex items-center justify-center gap-2 mb-6" aria-label={`Passo ${step === 'location' ? 1 : 2} de 2`}>
                        <div className={`h-1.5 w-10 rounded-full ${locOk ? 'bg-green-500' : 'bg-[#D4AF37]'}`} />
                        <div className={`h-1.5 w-10 rounded-full ${notifOk ? 'bg-green-500' : step === 'notification' ? 'bg-[#D4AF37]' : 'bg-zinc-700'}`} />
                    </div>

                    <div className="text-center mb-6">
                        <div className={`w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center border ${denied ? 'bg-red-500/15 border-red-500/30' : 'bg-[#D4AF37]/15 border-[#D4AF37]/30'}`}>
                            {denied ? <XCircle size={36} className="text-red-400" /> : <Icon size={36} className="text-[#D4AF37]" />}
                        </div>
                        <p className="text-zinc-500 text-xs uppercase tracking-widest mb-1">Passo {step === 'location' ? 1 : 2} de 2</p>
                        <h1 className="text-2xl font-bold text-white mb-2">{title}</h1>
                        <p className="text-zinc-400 text-sm leading-relaxed">{why}</p>
                    </div>

                    {hint && (
                        <div role="alert" className="flex items-start gap-2 text-yellow-300 text-sm bg-yellow-900/15 p-3 rounded-xl border border-yellow-700/40 mb-4">
                            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" /> {hint}
                        </div>
                    )}

                    {denied ? (
                        <div className="bg-zinc-900 border border-red-500/30 rounded-2xl p-5">
                            <p className="text-red-300 text-sm font-bold flex items-center gap-2">
                                <Lock size={16} /> Você tocou em "Não permitir". Para liberar:
                            </p>
                            <ol className="mt-4 space-y-2">
                                {enableSteps(step, p).map((s, i) => (
                                    <li key={i} className="flex gap-3 items-start text-sm text-zinc-300">
                                        <span className="w-6 h-6 rounded-full bg-[#D4AF37]/20 text-[#D4AF37] text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                                        <span className="pt-0.5">{s}</span>
                                    </li>
                                ))}
                            </ol>
                            <div className="mt-4 flex items-center justify-center gap-2 text-zinc-500 text-xs">
                                <Loader2 size={12} className="animate-spin" /> Conferindo automaticamente...
                            </div>
                            <button onClick={() => window.location.reload()} className="mt-4 w-full py-3 bg-[#D4AF37] text-black rounded-xl font-bold text-sm active:scale-[0.98]">
                                Já liberei — continuar
                            </button>
                        </div>
                    ) : step === 'notification' && p.ios && !p.standalone ? (
                        <div className="bg-zinc-900 border border-yellow-500/30 rounded-2xl p-5 text-center">
                            <p className="text-zinc-300 text-sm">
                                No iPhone, as notificações funcionam com o app <strong className="text-white">instalado na tela de início</strong>.
                            </p>
                            <button onClick={() => setShowIOSGuide(true)} className="mt-4 w-full py-3 bg-[#D4AF37] text-black rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                                <Share2 size={16} /> Ver como instalar
                            </button>
                        </div>
                    ) : (
                        <>
                            <button onClick={ask} disabled={status === 'asking'}
                                className="w-full py-4 bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black rounded-2xl font-bold text-base flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-70">
                                {status === 'asking'
                                    ? <><Loader2 size={18} className="animate-spin" /> Responda o aviso do celular...</>
                                    : <><Icon size={18} /> Permitir {label}</>}
                            </button>
                            <p className="text-zinc-500 text-xs text-center mt-3">
                                Vai aparecer um aviso do celular: toque em <strong className="text-zinc-300">Permitir</strong>.
                            </p>
                        </>
                    )}

                    <div className="mt-6 flex items-start gap-3 bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                        <Shield size={16} className="text-[#D4AF37] flex-shrink-0 mt-0.5" />
                        <p className="text-zinc-500 text-xs leading-relaxed">
                            Usamos só para a segurança da sua conta e avisos do seu empréstimo. Não compartilhamos com terceiros.
                        </p>
                    </div>

                    <button onClick={logout} className="w-full text-zinc-500 hover:text-white text-sm py-4 mt-2">
                        Sair e voltar ao login
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PermissionGate;
