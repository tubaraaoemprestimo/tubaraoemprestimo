/**
 * Serviço de Configurações de Empréstimo
 * Busca todas as taxas e configurações do banco via supabaseService
 */

import { supabaseService } from './supabaseService';
import { SystemSettings } from '../types';

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
    minLoanAmount: number;
    maxLoanNoGuarantee: number;
    maxLoanAmount: number;
    defaultInstallments: number;

    // Pacotes
    loanPackages: number[];

    // Outros
    releaseTimeHours: number;
}

// Cache
let cachedSettings: LoanSettings | null = null;
let cacheTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

export const loanSettingsService = {
    /**
     * Busca configurações do banco via supabaseService
     */
    async getSettings(): Promise<LoanSettings> {
        // Cache
        if (cachedSettings && Date.now() - cacheTime < CACHE_DURATION) {
            return cachedSettings;
        }

        try {
            // Buscar settings do supabaseService
            const dbSettings: SystemSettings = await supabaseService.getSettings();

            // Taxa mensal vem do banco
            const interestRateMonthly = dbSettings.monthlyInterestRate || 30;

            const settings: LoanSettings = {
                // Taxas - vindas do banco
                interestRateMonthly,
                interestRateDaily: dbSettings.lateInterestDaily || (interestRateMonthly / 30),
                interestRateYearly: dbSettings.lateInterestYearly || (interestRateMonthly * 12),

                // Multas por atraso - vindas do banco
                lateFeeDaily: dbSettings.lateInterestDaily || 0.5,
                lateFeeMonthly: dbSettings.lateInterestMonthly || 15,
                lateFeeFixed: dbSettings.lateFixedFee || 50,

                // Limites (podem ser expandidos no futuro)
                minLoanAmount: 300,
                maxLoanNoGuarantee: 3000,
                maxLoanAmount: 10000,
                defaultInstallments: 4,

                // Pacotes
                loanPackages: [500, 1000, 1500, 2000, 2500, 3000],

                // Outros
                releaseTimeHours: 72,
            };

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
     * Calcula parcela
     */
    calculateInstallment(amount: number, installments: number, interestRate: number): number {
        const totalWithInterest = amount * (1 + interestRate / 100);
        return totalWithInterest / installments;
    },

    /**
     * Calcula total
     */
    calculateTotal(amount: number, interestRate: number): number {
        return amount * (1 + interestRate / 100);
    },

    /**
     * Limpa cache
     */
    clearCache(): void {
        cachedSettings = null;
        cacheTime = 0;
    },
};

export default loanSettingsService;
