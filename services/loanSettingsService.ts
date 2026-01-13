/**
 * Serviço de Configurações de Empréstimo
 * Busca todas as taxas e configurações do banco de dados
 */

import { supabase } from './supabaseClient';

export interface LoanSettings {
    // Taxas de juros
    interestRateMonthly: number;    // Taxa mensal (%)
    interestRateDaily: number;      // Taxa diária (calculada)
    interestRateYearly: number;     // Taxa anual (calculada)

    // Multas por atraso
    lateFeeDaily: number;           // Juros diário por atraso (%)
    lateFeeMonthly: number;         // Juros mensal por atraso (%)
    lateFeeFixed: number;           // Multa fixa por atraso (R$)

    // Limites
    minLoanAmount: number;          // Valor mínimo
    maxLoanNoGuarantee: number;     // Valor máximo SEM garantia
    maxLoanAmount: number;          // Valor máximo COM garantia
    defaultInstallments: number;    // Parcelas padrão

    // Pacotes
    loanPackages: number[];         // Valores disponíveis

    // Outros
    releaseTimeHours: number;       // Prazo de liberação
}

// Cache das configurações
let cachedSettings: LoanSettings | null = null;
let cacheTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

export const loanSettingsService = {
    /**
     * Busca todas as configurações do banco
     */
    async getSettings(): Promise<LoanSettings> {
        // Verificar cache
        if (cachedSettings && Date.now() - cacheTime < CACHE_DURATION) {
            return cachedSettings;
        }

        try {
            const { data, error } = await supabase
                .from('system_settings')
                .select('key, value');

            if (error) {
                console.error('Erro ao buscar configurações:', error);
                return this.getDefaultSettings();
            }

            const settingsMap: Record<string, string> = {};
            data?.forEach(item => {
                settingsMap[item.key] = item.value;
            });

            const interestRateMonthly = parseFloat(settingsMap['interest_rate_monthly'] || '30');

            const settings: LoanSettings = {
                // Taxas
                interestRateMonthly,
                interestRateDaily: interestRateMonthly / 30,
                interestRateYearly: interestRateMonthly * 12,

                // Multas por atraso
                lateFeeDaily: parseFloat(settingsMap['late_fee_daily'] || '0.5'),
                lateFeeMonthly: parseFloat(settingsMap['late_fee_monthly'] || '15'),
                lateFeeFixed: parseFloat(settingsMap['late_fee_fixed'] || '50'),

                // Limites
                minLoanAmount: parseFloat(settingsMap['min_loan_amount'] || '300'),
                maxLoanNoGuarantee: parseFloat(settingsMap['max_loan_no_guarantee'] || '3000'),
                maxLoanAmount: parseFloat(settingsMap['max_loan_amount'] || '10000'),
                defaultInstallments: parseInt(settingsMap['default_installments'] || '4'),

                // Pacotes
                loanPackages: JSON.parse(settingsMap['loan_packages'] || '[500, 1000, 1500, 2000, 2500, 3000]'),

                // Outros
                releaseTimeHours: parseInt(settingsMap['release_time_hours'] || '72'),
            };

            // Salvar no cache
            cachedSettings = settings;
            cacheTime = Date.now();

            return settings;
        } catch (e) {
            console.error('Erro ao buscar configurações:', e);
            return this.getDefaultSettings();
        }
    },

    /**
     * Configurações padrão (fallback)
     */
    getDefaultSettings(): LoanSettings {
        return {
            interestRateMonthly: 30,
            interestRateDaily: 1,
            interestRateYearly: 360,
            lateFeeDaily: 0.5,
            lateFeeMonthly: 15,
            lateFeeFixed: 50,
            minLoanAmount: 300,
            maxLoanNoGuarantee: 3000,
            maxLoanAmount: 10000,
            defaultInstallments: 4,
            loanPackages: [500, 1000, 1500, 2000, 2500, 3000],
            releaseTimeHours: 72,
        };
    },

    /**
     * Calcula o valor da parcela
     */
    calculateInstallment(amount: number, installments: number, interestRate: number): number {
        const totalWithInterest = amount * (1 + interestRate / 100);
        return totalWithInterest / installments;
    },

    /**
     * Calcula o total a pagar
     */
    calculateTotal(amount: number, interestRate: number): number {
        return amount * (1 + interestRate / 100);
    },

    /**
     * Limpa o cache
     */
    clearCache(): void {
        cachedSettings = null;
        cacheTime = 0;
    },
};

export default loanSettingsService;
