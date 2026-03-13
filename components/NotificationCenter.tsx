
// 🔔 Notification Center Component
// Centro de Notificações com Badge e Dropdown

import React, { useState, useEffect, useRef } from 'react';
import { Bell, X, Check, CheckCheck, Trash2, Settings, ExternalLink } from 'lucide-react';
import { notificationService, Notification } from '../services/notificationService';
import { useNavigate } from 'react-router-dom';

export const NotificationCenter: React.FC = () => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [userRole, setUserRole] = useState<string>('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const user = JSON.parse(localStorage.getItem('tubarao_user') || '{}');
        setUserRole((user.role || '').toUpperCase());

        // Load initial (async)
        const loadNotifications = async () => {
            const data = await notificationService.getAll();
            setNotifications(data);
            const count = await notificationService.getUnreadCount();
            setUnreadCount(count);
        };
        loadNotifications();

        // Subscribe to updates
        const unsubscribe = notificationService.subscribe((updated) => {
            setNotifications(updated);
            setUnreadCount(updated.filter(n => !n.read).length);
        });

        // Request permission on mount
        notificationService.requestBrowserPermission();

        return unsubscribe;
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const resolveActionUrl = (notification: Notification): string | null => {
        if (notification.actionUrl) return notification.actionUrl;

        if (userRole !== 'ADMIN') return null;

        const title = (notification.title || '').toLowerCase();
        const message = (notification.message || '').toLowerCase();
        const text = `${title} ${message}`;

        // Prioridade 1: Mensagens WhatsApp
        if (text.includes('whatsapp') || text.includes('mensagem')) {
            return '/admin/chatbot';
        }

        // Prioridade 2: Outras notificações
        if (text.includes('solicita')) return '/admin/requests';
        if (text.includes('parcela') || text.includes('atraso') || text.includes('venc')) return '/admin/finance-hub';
        if (text.includes('acesso') || text.includes('biometr') || text.includes('antifraude') || text.includes('risco')) return '/admin/security-hub';

        return '/admin';
    };

    const handleNotificationClick = (notification: Notification) => {
        notificationService.markAsRead(notification.id);
        const url = resolveActionUrl(notification);
        if (url) {
            navigate(url);
            setIsOpen(false);
        }
    };

    const getTypeStyles = (type: Notification['type']) => {
        switch (type) {
            case 'success': return 'border-l-green-500 bg-green-900/10';
            case 'warning': return 'border-l-yellow-500 bg-yellow-900/10';
            case 'error': return 'border-l-red-500 bg-red-900/10';
            default: return 'border-l-blue-500 bg-blue-900/10';
        }
    };

    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Agora';
        if (diffMins < 60) return `${diffMins}min`;
        if (diffHours < 24) return `${diffHours}h`;
        if (diffDays < 7) return `${diffDays}d`;
        return date.toLocaleDateString('pt-BR');
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-lg hover:bg-zinc-800 transition-colors group"
                aria-label="Notificações"
            >
                <Bell size={22} className="text-zinc-400 group-hover:text-white transition-colors" />

                {/* Badge */}
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[20px] h-5 flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full px-1 animate-pulse">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="fixed inset-x-0 top-14 mx-2 sm:absolute sm:inset-x-auto sm:left-0 sm:top-full sm:mt-2 sm:mx-0 w-auto sm:w-[420px] lg:w-[480px] max-h-[80vh] bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-[40] animate-in fade-in slide-in-from-top-2 duration-200 flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950">
                        <h3 className="font-bold text-white flex items-center gap-2">
                            <Bell size={18} className="text-[#D4AF37]" />
                            Notificações
                        </h3>
                        <div className="flex items-center gap-2">
                            {unreadCount > 0 && (
                                <button
                                    onClick={async () => {
                                        await notificationService.markAllAsRead();
                                        // Recarregar lista após marcar todas como lidas
                                        const updated = await notificationService.getAll();
                                        setNotifications(updated);
                                        setUnreadCount(0);
                                    }}
                                    className="text-xs text-zinc-400 hover:text-[#D4AF37] flex items-center gap-1 transition-colors"
                                    title="Marcar todas como lidas"
                                >
                                    <CheckCheck size={14} />
                                    Ler todas
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Notifications List */}
                    <div className="flex-1 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center">
                                <Bell size={40} className="mx-auto text-zinc-700 mb-3" />
                                <p className="text-zinc-500 text-sm">Nenhuma notificação</p>
                            </div>
                        ) : (
                            notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={`p-4 border-b border-zinc-800 border-l-4 cursor-pointer hover:bg-zinc-800/50 transition-colors ${getTypeStyles(notification.type)} ${!notification.read ? 'bg-zinc-800/30' : ''}`}
                                    onClick={() => handleNotificationClick(notification)}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className={`text-sm font-semibold ${!notification.read ? 'text-white' : 'text-zinc-400'}`}>
                                                    {notification.title}
                                                </h4>
                                                {!notification.read && (
                                                    <span className="w-2 h-2 rounded-full bg-[#D4AF37] flex-shrink-0"></span>
                                                )}
                                            </div>
                                            <p className="text-sm text-zinc-400 leading-relaxed">{notification.message}</p>
                                            <div className="flex items-center justify-between mt-3">
                                                <span className="text-[10px] text-zinc-600 uppercase">{formatTime(notification.timestamp)}</span>
                                                {resolveActionUrl(notification) && (
                                                    <span className="text-xs text-[#D4AF37] flex items-center gap-1 font-medium">
                                                        Abrir <ExternalLink size={12} />
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                await notificationService.delete(notification.id);
                                                // Recarregar lista após deletar
                                                const updated = await notificationService.getAll();
                                                setNotifications(updated);
                                                setUnreadCount(updated.filter(n => !n.read).length);
                                            }}
                                            className="p-1.5 text-zinc-600 hover:text-red-500 hover:bg-red-900/20 transition-colors rounded-lg"
                                            title="Remover"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    {notifications.length > 0 && (
                        <div className="p-3 border-t border-zinc-800 bg-zinc-950 flex justify-between items-center">
                            <button
                                onClick={async () => {
                                    await notificationService.clearAll();
                                    // Limpar lista localmente
                                    setNotifications([]);
                                    setUnreadCount(0);
                                }}
                                className="text-xs text-zinc-500 hover:text-red-500 flex items-center gap-1 transition-colors"
                            >
                                <Trash2 size={12} />
                                Limpar todas
                            </button>
                            <span className="text-xs text-zinc-600">
                                {notifications.length} notificação(ões)
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// Export a simpler badge-only version for mobile
export const NotificationBadge: React.FC<{ onClick?: () => void }> = ({ onClick }) => {
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        // Load initial (async)
        notificationService.getUnreadCount().then(setUnreadCount);

        const unsubscribe = notificationService.subscribe((updated) => {
            setUnreadCount(updated.filter(n => !n.read).length);
        });
        return unsubscribe;
    }, []);

    return (
        <button onClick={onClick} className="relative p-2">
            <Bell size={24} className="text-zinc-400" />
            {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
                    {unreadCount > 9 ? '9+' : unreadCount}
                </span>
            )}
        </button>
    );
};
