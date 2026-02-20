// 🎨 Theme Service - Sistema de Paleta de Cores em Tempo Real
// Tubarão Empréstimos

import { api } from './apiClient';

export interface ThemeColors {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    dangerColor: string;
    warningColor: string;
    successColor: string;
    backgroundColor: string;
    cardColor: string;
    textColor: string;
}

const DEFAULT_THEME: ThemeColors = {
    primaryColor: '#D4AF37',
    secondaryColor: '#1a1a1a',
    accentColor: '#10b981',
    dangerColor: '#ef4444',
    warningColor: '#f59e0b',
    successColor: '#22c55e',
    backgroundColor: '#000000',
    cardColor: '#18181b',
    textColor: '#ffffff'
};

const THEME_ID = '00000000-0000-0000-0000-000000000001';

// Aplicar cores ao CSS
const applyThemeToDOM = (theme: ThemeColors): void => {
    const root = document.documentElement;
    root.style.setProperty('--color-primary', theme.primaryColor);
    root.style.setProperty('--color-secondary', theme.secondaryColor);
    root.style.setProperty('--color-accent', theme.accentColor);
    root.style.setProperty('--color-danger', theme.dangerColor);
    root.style.setProperty('--color-warning', theme.warningColor);
    root.style.setProperty('--color-success', theme.successColor);
    root.style.setProperty('--color-background', theme.backgroundColor);
    root.style.setProperty('--color-card', theme.cardColor);
    root.style.setProperty('--color-text', theme.textColor);

    // Salvar no localStorage para cache
    localStorage.setItem('tubarao_theme', JSON.stringify(theme));
};

// Carregar tema do cache local
const loadCachedTheme = (): ThemeColors => {
    try {
        const cached = localStorage.getItem('tubarao_theme');
        return cached ? JSON.parse(cached) : DEFAULT_THEME;
    } catch {
        return DEFAULT_THEME;
    }
};

export const themeService = {
    // Carregar tema do banco de dados
    getTheme: async (): Promise<ThemeColors> => {
        try {
            const { data, error } = await api.get<any>(`/settings/theme?id=${THEME_ID}`);

            if (error || !data) {
                console.log('Using default theme');
                return loadCachedTheme();
            }

            const d = data as any;
            const theme: ThemeColors = {
                primaryColor: d.primary_color || d.primaryColor || DEFAULT_THEME.primaryColor,
                secondaryColor: d.secondary_color || d.secondaryColor || DEFAULT_THEME.secondaryColor,
                accentColor: d.accent_color || d.accentColor || DEFAULT_THEME.accentColor,
                dangerColor: d.danger_color || d.dangerColor || DEFAULT_THEME.dangerColor,
                warningColor: d.warning_color || d.warningColor || DEFAULT_THEME.warningColor,
                successColor: d.success_color || d.successColor || DEFAULT_THEME.successColor,
                backgroundColor: d.background_color || d.backgroundColor || DEFAULT_THEME.backgroundColor,
                cardColor: d.card_color || d.cardColor || DEFAULT_THEME.cardColor,
                textColor: d.text_color || d.textColor || DEFAULT_THEME.textColor
            };

            // Aplicar e cachear
            applyThemeToDOM(theme);
            return theme;
        } catch {
            return loadCachedTheme();
        }
    },

    // Salvar tema (apenas admin)
    saveTheme: async (theme: Partial<ThemeColors>): Promise<boolean> => {
        try {
            const { error } = await api.put('/settings/theme', {
                id: THEME_ID,
                primary_color: theme.primaryColor,
                secondary_color: theme.secondaryColor,
                accent_color: theme.accentColor,
                danger_color: theme.dangerColor,
                warning_color: theme.warningColor,
                success_color: theme.successColor,
                background_color: theme.backgroundColor,
                card_color: theme.cardColor,
                text_color: theme.textColor,
                updated_at: new Date().toISOString()
            });

            if (!error) {
                applyThemeToDOM({ ...DEFAULT_THEME, ...theme });
            }
            return !error;
        } catch {
            return false;
        }
    },

    // Aplicar tema ao DOM
    applyTheme: applyThemeToDOM,

    // Obter tema padrão
    getDefaultTheme: (): ThemeColors => DEFAULT_THEME,

    // Inicializar tema (chamar no App.tsx)
    init: async (): Promise<void> => {
        // Aplicar cache imediatamente
        const cached = loadCachedTheme();
        applyThemeToDOM(cached);

        // Buscar do banco em background
        await themeService.getTheme();
    },

    // Escutar mudanças em tempo real (Polling)
    subscribeToChanges: (callback: (theme: ThemeColors) => void): (() => void) => {
        // Poll every 60 seconds as a replacement for Supabase real-time
        const interval = setInterval(async () => {
            const theme = await themeService.getTheme();
            callback(theme);
        }, 60000);

        return () => {
            clearInterval(interval);
        };
    }
};
