// 🔔 Push Notification Permission Component
// Solicita permissão e registra o dispositivo para push

import React, { useState, useEffect } from 'react';
import { Bell, BellOff, X, Smartphone, CheckCircle2 } from 'lucide-react';
import { firebasePushService } from '../services/firebasePushService';
import { Button } from './Button';

interface PushPermissionBannerProps {
    onClose?: () => void;
}

export const PushPermissionBanner: React.FC<PushPermissionBannerProps> = ({ onClose }) => {
    const [visible, setVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const [granted, setGranted] = useState(false);

    useEffect(() => {
        // Check if should show banner
        const checkPermission = async () => {
            const permission = firebasePushService.getPermissionStatus();

            // Don't show if already granted, denied, or unsupported
            if (permission === 'granted') {
                // Already granted, try to get token
                await firebasePushService.requestPermissionAndGetToken();
                return;
            }

            if (permission === 'denied' || permission === 'unsupported') {
                return;
            }

            // Show banner after 3 seconds if permission is 'default'
            const dismissed = localStorage.getItem('push_banner_dismissed');
            if (!dismissed) {
                setTimeout(() => setVisible(true), 3000);
            }
        };

        checkPermission();
    }, []);

    const handleAllow = async () => {
        setLoading(true);

        try {
            const token = await firebasePushService.requestPermissionAndGetToken();

            if (token) {
                setGranted(true);
                setTimeout(() => {
                    setVisible(false);
                    onClose?.();
                }, 2000);
            } else {
                // Permission denied or error
                handleDismiss();
            }
        } catch (error) {
            console.error('Push permission error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDismiss = () => {
        localStorage.setItem('push_banner_dismissed', 'true');
        setVisible(false);
        onClose?.();
    };

    if (!visible) return null;

    return (
        <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-in slide-in-from-bottom duration-300">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-2xl">
                {granted ? (
                    // Success state
                    <div className="flex items-center gap-3 text-green-400">
                        <CheckCircle2 size={24} />
                        <div>
                            <p className="font-bold">Notificações Ativadas!</p>
                            <p className="text-sm text-zinc-400">Você receberá alertas importantes.</p>
                        </div>
                    </div>
                ) : (
                    // Request state
                    <>
                        <div className="flex items-start gap-3 mb-4">
                            <div className="p-2 bg-[#D4AF37]/20 rounded-lg shrink-0">
                                <Smartphone size={24} className="text-[#D4AF37]" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-white text-sm">Ativar Notificações?</h3>
                                <p className="text-xs text-zinc-400 mt-1">
                                    Receba alertas de pagamentos, aprovações e novidades diretamente no seu celular.
                                </p>
                            </div>
                            <button
                                onClick={handleDismiss}
                                className="p-1 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="flex gap-2">
                            <Button
                                onClick={handleDismiss}
                                variant="secondary"
                                size="sm"
                                className="flex-1"
                            >
                                <BellOff size={16} className="mr-1" />
                                Agora Não
                            </Button>
                            <Button
                                onClick={handleAllow}
                                size="sm"
                                className="flex-1 bg-[#D4AF37] text-black hover:bg-[#B89930]"
                                isLoading={loading}
                            >
                                <Bell size={16} className="mr-1" />
                                Ativar
                            </Button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

// Hook para usar push notifications
export const usePushNotifications = () => {
    const [isSupported, setIsSupported] = useState(false);
    const [permission, setPermission] = useState<'granted' | 'denied' | 'default' | 'unsupported'>('default');
    const [token, setToken] = useState<string | null>(null);

    useEffect(() => {
        const supported = firebasePushService.isSupported();
        setIsSupported(supported);

        if (supported) {
            setPermission(firebasePushService.getPermissionStatus());
        }
    }, []);

    const requestPermission = async () => {
        const newToken = await firebasePushService.requestPermissionAndGetToken();
        if (newToken) {
            setToken(newToken);
            setPermission('granted');
        }
        return newToken;
    };

    return {
        isSupported,
        permission,
        token,
        requestPermission
    };
};

export default PushPermissionBanner;
