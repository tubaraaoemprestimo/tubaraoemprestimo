// 💰 Calculadora de Juros de Atraso
// Funções para calcular o valor atualizado de parcelas em atraso

import { SystemSettings } from '../types';

export interface LateInterestResult {
    originalAmount: number;
    daysLate: number;
    fixedFee: number;
    dailyInterest: number;
    totalInterest: number;
    totalAmount: number;
    breakdown: {
        label: string;
        value: number;
    }[];
}

/**
 * Calcula o valor atualizado de uma parcela em atraso
 * @param originalAmount - Valor original da parcela
 * @param dueDate - Data de vencimento
 * @param settings - Configurações do sistema com taxas de juros
 * @returns Objeto com detalhamento do cálculo
 */
export const calculateLateInterest = (
    originalAmount: number,
    dueDate: string | Date,
    settings: SystemSettings
): LateInterestResult => {
    const dueDateObj = new Date(dueDate);
    const today = new Date();

    // Zerar horas para comparação apenas de datas
    dueDateObj.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    // Calcular dias de atraso
    const diffTime = today.getTime() - dueDateObj.getTime();
    const daysLate = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

    // Se não está atrasado, retorna valores zerados
    if (daysLate <= 0) {
        return {
            originalAmount,
            daysLate: 0,
            fixedFee: 0,
            dailyInterest: 0,
            totalInterest: 0,
            totalAmount: originalAmount,
            breakdown: [
                { label: 'Valor da Parcela', value: originalAmount }
            ]
        };
    }

    // Obter taxas das configurações
    const lateFixedFee = settings.lateFixedFee || 0;
    const lateInterestDaily = settings.lateInterestDaily || 0;
    const lateInterestMonthly = settings.lateInterestMonthly || 0;
    const lateInterestYearly = settings.lateInterestYearly || 0;

    // Calcular juros diário
    // Se não tem juros diário configurado, calcular a partir do mensal ou anual
    let effectiveDailyRate = lateInterestDaily;
    if (effectiveDailyRate === 0 && lateInterestMonthly > 0) {
        effectiveDailyRate = lateInterestMonthly / 30;
    }
    if (effectiveDailyRate === 0 && lateInterestYearly > 0) {
        effectiveDailyRate = lateInterestYearly / 365;
    }

    // Calcular juros proporcional aos dias de atraso
    const dailyInterest = originalAmount * (effectiveDailyRate / 100) * daysLate;

    // Total de juros (multa fixa + juros diários)
    const totalInterest = lateFixedFee + dailyInterest;

    // Valor total a pagar
    const totalAmount = originalAmount + totalInterest;

    // Montar breakdown detalhado
    const breakdown: { label: string; value: number }[] = [
        { label: 'Valor Original', value: originalAmount }
    ];

    if (lateFixedFee > 0) {
        breakdown.push({ label: 'Multa por Atraso', value: lateFixedFee });
    }

    if (dailyInterest > 0) {
        breakdown.push({
            label: `Juros (${daysLate} dias × ${effectiveDailyRate.toFixed(3)}%)`,
            value: dailyInterest
        });
    }

    breakdown.push({ label: 'Total a Pagar', value: totalAmount });

    return {
        originalAmount,
        daysLate,
        fixedFee: lateFixedFee,
        dailyInterest,
        totalInterest,
        totalAmount,
        breakdown
    };
};

/**
 * Calcula quantos dias uma parcela está em atraso
 * @param dueDate - Data de vencimento
 * @returns Número de dias em atraso (0 se não estiver atrasada)
 */
export const getDaysLate = (dueDate: string | Date): number => {
    const dueDateObj = new Date(dueDate);
    const today = new Date();

    dueDateObj.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const diffTime = today.getTime() - dueDateObj.getTime();
    return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
};

/**
 * Formata o valor atualizado para exibição
 * @param result - Resultado do cálculo de juros
 * @returns String formatada com valor e detalhes
 */
export const formatLateAmount = (result: LateInterestResult): string => {
    if (result.daysLate === 0) {
        return `R$ ${result.originalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    }

    return `R$ ${result.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (+R$ ${result.totalInterest.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} juros)`;
};

export default calculateLateInterest;
