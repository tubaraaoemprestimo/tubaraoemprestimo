/**
 * Serviço de Configurações de Empréstimo
 * Busca todas as taxas e configurações do banco via apiService
 */

import { apiService } from './apiService';
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
     * Busca configurações do banco via apiService
     */
    async getSettings(): Promise<LoanSettings> {
        // Cache
        if (cachedSettings && Date.now() - cacheTime < CACHE_DURATION) {
            return cachedSettings;
        }

        try {
            // Buscar settings do apiService
            const dbSettings: SystemSettings = await apiService.getSettings();

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
                defaultInstallments: 1,

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
            defaultInstallments: 1,
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
     * Conta dias úteis (segunda a sábado, excluindo domingos)
     * Usado para perfis AUTONOMO que não pagam juros no domingo
     */
    countBusinessDays(startDate: Date, endDate: Date): number {
        let count = 0;
        const current = new Date(startDate);
        current.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(0, 0, 0, 0);

        while (current < end) {
            const dayOfWeek = current.getDay(); // 0 = Domingo
            if (dayOfWeek !== 0) { // Pula domingos
                count++;
            }
            current.setDate(current.getDate() + 1);
        }
        return count;
    },

    /**
     * Conta todos os dias entre duas datas (incluindo domingos)
     */
    countTotalDays(startDate: Date, endDate: Date): number {
        const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    },

    /**
     * Calcula juros diários acumulados com regra de domingo
     * - AUTONOMO: juros cobrados apenas de segunda a sábado (6 dias/semana)
     * - Outros perfis: juros cobrados todos os dias (7 dias/semana)
     * 
     * @param amount - Valor base do empréstimo
     * @param dailyRate - Taxa diária de juros (%)
     * @param startDate - Data de início (liberação ou último pagamento)
     * @param endDate - Data final (today ou data de pagamento)
     * @param profileType - Tipo do perfil do cliente
     * @returns Objeto com dias cobrados, juros total e detalhamento
     */
    calculateDailyInterest(
        amount: number,
        dailyRate: number,
        startDate: Date,
        endDate: Date,
        profileType?: string
    ): { chargedDays: number; totalDays: number; interest: number; skippedSundays: number } {
        const totalDays = this.countTotalDays(startDate, endDate);
        const isAutonomo = profileType === 'AUTONOMO';

        let chargedDays: number;
        let skippedSundays = 0;

        if (isAutonomo) {
            // Autônomo/Comércio: não cobra juros no domingo
            chargedDays = this.countBusinessDays(startDate, endDate);
            skippedSundays = totalDays - chargedDays;
        } else {
            // Demais perfis: cobra todos os dias
            chargedDays = totalDays;
        }

        const interest = amount * (dailyRate / 100) * chargedDays;

        return {
            chargedDays,
            totalDays,
            interest: Math.round(interest * 100) / 100, // Arredonda para 2 casas
            skippedSundays
        };
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
