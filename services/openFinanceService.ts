/**
 * Open Finance Service - Real API Integration
 * Credit score consultation, income analysis, and financial health assessment
 */

import { api } from './apiClient';
import { Customer, CreditScore, IncomeAnalysis, OpenFinanceConsent } from '../types';

// Score classification based on value
const getScoreClassification = (score: number): CreditScore['classification'] => {
    if (score >= 800) return 'A';
    if (score >= 600) return 'B';
    if (score >= 400) return 'C';
    if (score >= 200) return 'D';
    return 'E';
};

// Consult credit score via API
const consultScore = async (customerId: string, source: 'INTERNAL' | 'SERASA' | 'SPC' = 'INTERNAL'): Promise<CreditScore> => {
    const { data, error } = await api.post<CreditScore>(`/open-finance/score/${customerId}`, { source });
    if (error || !data) throw new Error('Erro ao consultar score');
    return data;
};

// Get score history via API
const getScores = async (customerId?: string): Promise<CreditScore[]> => {
    if (!customerId) return [];
    const { data, error } = await api.get<CreditScore[]>(`/open-finance/scores/${customerId}`);
    if (error || !data) return [];
    return data;
};

// Analyze income via API
const analyzeIncome = async (customerId: string, declaredIncome?: number): Promise<IncomeAnalysis> => {
    const { data, error } = await api.post<IncomeAnalysis>(`/open-finance/income-analysis/${customerId}`, { declaredIncome });
    if (error || !data) throw new Error('Erro ao analisar renda');
    return data;
};

// Get analysis history via API
const getAnalyses = async (customerId?: string): Promise<IncomeAnalysis[]> => {
    if (!customerId) return [];
    const { data, error } = await api.get<IncomeAnalysis[]>(`/open-finance/analyses/${customerId}`);
    if (error || !data) return [];
    return data;
};

// Create consent via API
const createConsent = async (customerId: string, scope: OpenFinanceConsent['scope']): Promise<OpenFinanceConsent> => {
    const { data, error } = await api.post<OpenFinanceConsent>('/open-finance/consent', { customerId, scope });
    if (error || !data) throw new Error('Erro ao criar consentimento');
    return data;
};

// Get consents via API
const getConsents = async (customerId?: string): Promise<OpenFinanceConsent[]> => {
    if (!customerId) return [];
    const { data, error } = await api.get<OpenFinanceConsent[]>(`/open-finance/consents/${customerId}`);
    if (error || !data) return [];
    return data;
};

// Revoke consent via API
const revokeConsent = async (consentId: string): Promise<void> => {
    const { error } = await api.put(`/open-finance/consent/${consentId}/revoke`, {});
    if (error) throw new Error('Erro ao revogar consentimento');
};

// Full credit analysis via API
const performFullAnalysis = async (customer: Customer, declaredIncome?: number): Promise<{
    internalScore: CreditScore;
    serasaScore: CreditScore;
    incomeAnalysis: IncomeAnalysis;
    overallRecommendation: 'APPROVE' | 'REVIEW' | 'DENY';
    suggestedLimit: number;
}> => {
    const { data, error } = await api.post<any>(`/open-finance/full-analysis/${customer.id}`, { declaredIncome });
    if (error || !data) throw new Error('Erro ao realizar análise completa');
    return data;
};

// Get classification color
const getClassificationColor = (classification: CreditScore['classification']): string => {
    switch (classification) {
        case 'A': return '#22c55e';
        case 'B': return '#84cc16';
        case 'C': return '#eab308';
        case 'D': return '#f97316';
        case 'E': return '#ef4444';
        default: return '#6b7280';
    }
};

// Get recommendation color
const getRecommendationColor = (recommendation: IncomeAnalysis['recommendation']): string => {
    switch (recommendation) {
        case 'APPROVE': return '#22c55e';
        case 'REVIEW': return '#eab308';
        case 'DENY': return '#ef4444';
        default: return '#6b7280';
    }
};

export const openFinanceService = {
    consultScore,
    getScores,
    analyzeIncome,
    getAnalyses,
    createConsent,
    getConsents,
    revokeConsent,
    performFullAnalysis,
    getClassificationColor,
    getRecommendationColor,
    getScoreClassification,
    // Legacy compatibility
    generateMockScore: (customer: Customer) => consultScore(customer.id, 'INTERNAL'),
    consultExternalScore: (customer: Customer, source: 'SERASA' | 'SPC') => consultScore(customer.id, source),
    saveScore: () => { /* no-op: saved via API */ },
    saveAnalysis: () => { /* no-op: saved via API */ },
};
