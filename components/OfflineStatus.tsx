// 📡 Componente de Status Offline
// Mostra banner quando o usuário está sem internet

import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';

export const OfflineStatus: React.FC = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [showBanner, setShowBanner] = useState(false);
    const [showReconnected, setShowReconnected] = useState(false);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            setShowReconnected(true);
            setShowBanner(true);

            // Esconde o banner após 3 segundos
            setTimeout(() => {
                setShowBanner(false);
                setShowReconnected(false);
            }, 3000);
        };

        const handleOffline = () => {
            setIsOnline(false);
            setShowBanner(true);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Mostra banner se já estiver offline ao carregar
        if (!navigator.onLine) {
            setShowBanner(true);
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    if (!showBanner) return null;

    return (
        <div className={`fixed top-0 left-0 right-0 z-[200] animate-in slide-in-from-top duration-300 ${isOnline ? 'bg-green-600' : 'bg-red-600'
            }`}>
            <div className="flex items-center justify-center gap-2 py-2 px-4 text-white text-sm font-medium">
                {isOnline ? (
                    <>
                        <Wifi size={16} />
                        <span>Conexão restaurada!</span>
                    </>
                ) : (
                    <>
                        <WifiOff size={16} />
                        <span>Você está offline. Algumas funcionalidades podem não funcionar.</span>
                        <button
                            onClick={() => window.location.reload()}
                            className="ml-2 p-1 hover:bg-white/20 rounded"
                        >
                            <RefreshCw size={14} />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

// Hook para verificar status de conexão
export const useOnlineStatus = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return isOnline;
};

// Hook para detectar se é PWA instalado
export const useIsPWA = () => {
    const [isPWA, setIsPWA] = useState(false);

    useEffect(() => {
        // Verifica se está em modo standalone (instalado)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
        const isIOS = (window.navigator as any).standalone === true;

        setIsPWA(isStandalone || isIOS);
    }, []);

    return isPWA;
};

export default OfflineStatus;
