/**
 * Open Finance Service
 * Provides credit score consultation, income analysis, and financial health assessment
 */

import { Customer, CreditScore, IncomeAnalysis, OpenFinanceConsent } from '../types';

// Storage keys
const SCORES_KEY = 'tubarao_credit_scores';
const ANALYSES_KEY = 'tubarao_income_analyses';
const CONSENTS_KEY = 'tubarao_of_consents';

// Score classification based on value
const getScoreClassification = (score: number): CreditScore['classification'] => {
    if (score >= 800) return 'A';
    if (score >= 600) return 'B';
    if (score >= 400) return 'C';
    if (score >= 200) return 'D';
    return 'E';
};

// Generate mock credit score based on customer data
const generateMockScore = (customer: Customer): CreditScore => {
    // Calculate factors based on customer data
    const paymentHistory = customer.status === 'ACTIVE'
        ? Math.min(100, 60 + Math.random() * 40)
        : Math.max(0, 40 - Math.random() * 20);

    const debtRatio = customer.totalDebt > 0
        ? Math.max(0, 100 - (customer.totalDebt / 10000) * 100)
        : 80 + Math.random() * 20;

    const creditAge = Math.min(100, (new Date().getTime() - new Date(customer.joinedAt).getTime()) / (365 * 24 * 60 * 60 * 1000) * 20);

    const recentInquiries = 70 + Math.random() * 30;

    // Weighted average
    const score = Math.round(
        (paymentHistory * 0.35 + debtRatio * 0.30 + creditAge * 0.15 + recentInquiries * 0.20) * 10
    );

    // Check for restrictions
    const hasRestriction = customer.status === 'BLOCKED' || customer.totalDebt > 5000;

    return {
        id: `score-${customer.id}-${Date.now()}`,
        customerId: customer.id,
        score: Math.min(1000, Math.max(0, score)),
        classification: getScoreClassification(score),
        source: 'INTERNAL',
        consultedAt: new Date().toISOString(),
        factors: {
            paymentHistory: Math.round(paymentHistory),
            debtRatio: Math.round(debtRatio),
            creditAge: Math.round(creditAge),
            recentInquiries: Math.round(recentInquiries)
        },
        restrictions: hasRestriction ? {
            hasRestriction: true,
            type: customer.status === 'BLOCKED' ? 'Inadimplência' : 'Dívida em Aberto',
            value: customer.totalDebt,
            origin: 'Sistema Interno'
        } : undefined
    };
};

// Simulate Serasa/SPC consultation
const consultExternalScore = async (customer: Customer, source: 'SERASA' | 'SPC'): Promise<CreditScore> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    const baseScore = generateMockScore(customer);

    // Add some variation for external source
    const variation = (Math.random() - 0.5) * 100;
    const externalScore = Math.min(1000, Math.max(0, baseScore.score + variation));

    return {
        ...baseScore,
        id: `${source.toLowerCase()}-${customer.id}-${Date.now()}`,
        score: Math.round(externalScore),
        classification: getScoreClassification(externalScore),
        source,
        restrictions: Math.random() > 0.7 ? {
            hasRestriction: true,
            type: 'Pendência Financeira',
            value: Math.round(Math.random() * 5000),
            origin: source === 'SERASA' ? 'Serasa Experian' : 'SPC Brasil'
        } : undefined
    };
};

// Analyze income and calculate commitment
const analyzeIncome = (customer: Customer, declaredIncome?: number): IncomeAnalysis => {
    const monthlyIncome = declaredIncome || customer.monthlyIncome || 3000;

    // Simulate average balance (mock)
    const averageBalance = monthlyIncome * (0.5 + Math.random() * 0.5);

    // Determine income source based on patterns
    const incomeSource: IncomeAnalysis['incomeSource'] =
        monthlyIncome > 10000 ? 'BUSINESS' :
            monthlyIncome > 5000 ? 'SALARY' :
                'FREELANCE';

    // Determine stability
    const stability: IncomeAnalysis['stability'] =
        incomeSource === 'SALARY' ? 'HIGH' :
            incomeSource === 'BUSINESS' ? 'MEDIUM' :
                'LOW';

    // Calculate current commitment (debt / income ratio)
    const currentCommitment = Math.min(100, (customer.totalDebt / monthlyIncome) * 100);

    // Brazilian regulation: max 30% commitment for new loans
    const maxCommitment = 30;
    const availableCommitment = Math.max(0, maxCommitment - currentCommitment);

    // Calculate max loan amount based on available commitment
    // Assuming 12-month loan
    const maxLoanAmount = (monthlyIncome * (availableCommitment / 100)) * 12;

    // Recommendation
    let recommendation: IncomeAnalysis['recommendation'];
    if (availableCommitment >= 20 && customer.status === 'ACTIVE') {
        recommendation = 'APPROVE';
    } else if (availableCommitment >= 10 && customer.status === 'ACTIVE') {
        recommendation = 'REVIEW';
    } else {
        recommendation = 'DENY';
    }

    return {
        id: `analysis-${customer.id}-${Date.now()}`,
        customerId: customer.id,
        analyzedAt: new Date().toISOString(),
        monthlyIncome,
        averageBalance: Math.round(averageBalance),
        incomeSource,
        stability,
        currentCommitment: Math.round(currentCommitment * 10) / 10,
        availableCommitment: Math.round(availableCommitment * 10) / 10,
        maxLoanAmount: Math.round(maxLoanAmount),
        recommendation
    };
};

// Create Open Finance consent
const createConsent = (customerId: string, scope: OpenFinanceConsent['scope']): OpenFinanceConsent => {
    const consent: OpenFinanceConsent = {
        id: `consent-${customerId}-${Date.now()}`,
        customerId,
        grantedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
        scope,
        status: 'ACTIVE'
    };

    saveConsent(consent);
    return consent;
};

// Storage operations
const getScores = (customerId?: string): CreditScore[] => {
    const data = localStorage.getItem(SCORES_KEY);
    const scores: CreditScore[] = data ? JSON.parse(data) : [];
    return customerId ? scores.filter(s => s.customerId === customerId) : scores;
};

const saveScore = (score: CreditScore): void => {
    const scores = getScores();
    scores.push(score);
    localStorage.setItem(SCORES_KEY, JSON.stringify(scores));
};

const getAnalyses = (customerId?: string): IncomeAnalysis[] => {
    const data = localStorage.getItem(ANALYSES_KEY);
    const analyses: IncomeAnalysis[] = data ? JSON.parse(data) : [];
    return customerId ? analyses.filter(a => a.customerId === customerId) : analyses;
};

const saveAnalysis = (analysis: IncomeAnalysis): void => {
    const analyses = getAnalyses();
    analyses.push(analysis);
    localStorage.setItem(ANALYSES_KEY, JSON.stringify(analyses));
};

const getConsents = (customerId?: string): OpenFinanceConsent[] => {
    const data = localStorage.getItem(CONSENTS_KEY);
    const consents: OpenFinanceConsent[] = data ? JSON.parse(data) : [];
    return customerId ? consents.filter(c => c.customerId === customerId) : consents;
};

const saveConsent = (consent: OpenFinanceConsent): void => {
    const consents = getConsents();
    const existingIndex = consents.findIndex(c => c.id === consent.id);
    if (existingIndex >= 0) {
        consents[existingIndex] = consent;
    } else {
        consents.push(consent);
    }
    localStorage.setItem(CONSENTS_KEY, JSON.stringify(consents));
};

const revokeConsent = (consentId: string): void => {
    const consents = getConsents();
    const consent = consents.find(c => c.id === consentId);
    if (consent) {
        consent.status = 'REVOKED';
        saveConsent(consent);
    }
};

// Full credit analysis
const performFullAnalysis = async (customer: Customer): Promise<{
    internalScore: CreditScore;
    serasaScore: CreditScore;
    incomeAnalysis: IncomeAnalysis;
    overallRecommendation: 'APPROVE' | 'REVIEW' | 'DENY';
    suggestedLimit: number;
}> => {
    // Get internal score
    const internalScore = generateMockScore(customer);
    saveScore(internalScore);

    // Consult Serasa
    const serasaScore = await consultExternalScore(customer, 'SERASA');
    saveScore(serasaScore);

    // Analyze income
    const incomeAnalysis = analyzeIncome(customer);
    saveAnalysis(incomeAnalysis);

    // Calculate overall recommendation
    const avgScore = (internalScore.score + serasaScore.score) / 2;
    let overallRecommendation: 'APPROVE' | 'REVIEW' | 'DENY';

    if (avgScore >= 600 && incomeAnalysis.recommendation === 'APPROVE' && !serasaScore.restrictions?.hasRestriction) {
        overallRecommendation = 'APPROVE';
    } else if (avgScore >= 400 && incomeAnalysis.recommendation !== 'DENY') {
        overallRecommendation = 'REVIEW';
    } else {
        overallRecommendation = 'DENY';
    }

    // Suggested limit based on score and income
    const scoreFactor = avgScore / 1000;
    const suggestedLimit = Math.round(incomeAnalysis.maxLoanAmount * scoreFactor);

    return {
        internalScore,
        serasaScore,
        incomeAnalysis,
        overallRecommendation,
        suggestedLimit
    };
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
    generateMockScore,
    consultExternalScore,
    analyzeIncome,
    createConsent,
    getScores,
    saveScore,
    getAnalyses,
    saveAnalysis,
    getConsents,
    revokeConsent,
    performFullAnalysis,
    getClassificationColor,
    getRecommendationColor,
    getScoreClassification
};
