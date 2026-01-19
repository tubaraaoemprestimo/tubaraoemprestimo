// 🎨 Theme Service - Sistema de Paleta de Cores em Tempo Real
// Tubarão Empréstimos

import { supabase } from './supabaseClient';

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
            const { data, error } = await supabase
                .from('theme_settings')
                .select('*')
                .eq('id', THEME_ID)
                .single();

            if (error || !data) {
                console.log('Using default theme');
                return loadCachedTheme();
            }

            const theme: ThemeColors = {
                primaryColor: data.primary_color || DEFAULT_THEME.primaryColor,
                secondaryColor: data.secondary_color || DEFAULT_THEME.secondaryColor,
                accentColor: data.accent_color || DEFAULT_THEME.accentColor,
                dangerColor: data.danger_color || DEFAULT_THEME.dangerColor,
                warningColor: data.warning_color || DEFAULT_THEME.warningColor,
                successColor: data.success_color || DEFAULT_THEME.successColor,
                backgroundColor: data.background_color || DEFAULT_THEME.backgroundColor,
                cardColor: data.card_color || DEFAULT_THEME.cardColor,
                textColor: data.text_color || DEFAULT_THEME.textColor
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
            const { error } = await supabase
                .from('theme_settings')
                .upsert({
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

    // Escutar mudanças em tempo real
    subscribeToChanges: (callback: (theme: ThemeColors) => void): (() => void) => {
        const channel = supabase
            .channel('theme-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'theme_settings' },
                async (payload) => {
                    console.log('Theme changed:', payload);
                    const theme = await themeService.getTheme();
                    callback(theme);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }
};
