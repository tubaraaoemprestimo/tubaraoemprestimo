// 🔧 Admin Service - Gerenciamento completo para o administrador
// Inclui: Blacklist, Auditoria, Permissões, Score, Renegociação, Templates, Documentos

import {
    BlacklistEntry, AuditLog, UserPermission, PermissionLevel, ClientScore,
    RenegotiationProposal, MessageTemplate, MassMessage, ConversationMessage,
    ContractTemplate, Receipt, DischargeDeclaration, FinancialSummary, CalendarEvent,
    Customer, Loan
} from '../types';

// Storage keys
const STORAGE_KEYS = {
    BLACKLIST: 'tubarao_blacklist',
    AUDIT_LOGS: 'tubarao_audit_logs',
    PERMISSIONS: 'tubarao_permissions',
    SCORES: 'tubarao_scores',
    RENEGOTIATIONS: 'tubarao_renegotiations',
    TEMPLATES: 'tubarao_templates',
    MASS_MESSAGES: 'tubarao_mass_messages',
    CONVERSATIONS: 'tubarao_conversations',
    CONTRACTS: 'tubarao_contracts',
    RECEIPTS: 'tubarao_receipts',
    DECLARATIONS: 'tubarao_declarations'
};

// Helper functions
const loadFromStorage = <T>(key: string, defaultValue: T): T => {
    try {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : defaultValue;
    } catch (e) {
        return defaultValue;
    }
};

const saveToStorage = (key: string, data: any) => {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.error(`Error saving ${key}`, e);
    }
};

// ==========================================
// 📛 BLACKLIST MANAGEMENT
// ==========================================
export const blacklistService = {
    getAll: (): BlacklistEntry[] => {
        return loadFromStorage(STORAGE_KEYS.BLACKLIST, []);
    },

    add: (entry: Omit<BlacklistEntry, 'id' | 'addedAt' | 'active'>): BlacklistEntry => {
        const list = loadFromStorage<BlacklistEntry[]>(STORAGE_KEYS.BLACKLIST, []);
        const newEntry: BlacklistEntry = {
            ...entry,
            id: Date.now().toString(),
            addedAt: new Date().toISOString(),
            active: true
        };
        list.push(newEntry);
        saveToStorage(STORAGE_KEYS.BLACKLIST, list);
        auditService.log('CREATE', 'BLACKLIST', newEntry.id, `CPF ${entry.cpf} adicionado à blacklist: ${entry.reason}`);
        return newEntry;
    },

    remove: (id: string): boolean => {
        const list = loadFromStorage<BlacklistEntry[]>(STORAGE_KEYS.BLACKLIST, []);
        const entry = list.find(e => e.id === id);
        const filtered = list.filter(e => e.id !== id);
        saveToStorage(STORAGE_KEYS.BLACKLIST, filtered);
        if (entry) {
            auditService.log('DELETE', 'BLACKLIST', id, `CPF ${entry.cpf} removido da blacklist`);
        }
        return true;
    },

    toggle: (id: string): boolean => {
        const list = loadFromStorage<BlacklistEntry[]>(STORAGE_KEYS.BLACKLIST, []);
        const index = list.findIndex(e => e.id === id);
        if (index >= 0) {
            list[index].active = !list[index].active;
            saveToStorage(STORAGE_KEYS.BLACKLIST, list);
            auditService.log('UPDATE', 'BLACKLIST', id, `Status alterado para ${list[index].active ? 'ativo' : 'inativo'}`);
            return list[index].active;
        }
        return false;
    },

    check: (cpf: string): boolean => {
        const list = loadFromStorage<BlacklistEntry[]>(STORAGE_KEYS.BLACKLIST, []);
        return list.some(e => e.cpf.replace(/\D/g, '') === cpf.replace(/\D/g, '') && e.active);
    }
};

// ==========================================
// 📋 AUDIT LOG
// ==========================================
export const auditService = {
    log: (
        action: AuditLog['action'],
        entity: string,
        entityId: string | undefined,
        details: string
    ): void => {
        const logs = loadFromStorage<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, []);
        const user = JSON.parse(localStorage.getItem('tubarao_user') || '{}');

        const newLog: AuditLog = {
            id: Date.now().toString(),
            userId: user.id || 'system',
            userName: user.name || 'Sistema',
            action,
            entity,
            entityId,
            details,
            timestamp: new Date().toISOString()
        };

        logs.unshift(newLog); // Add to beginning
        // Keep only last 1000 logs
        const trimmed = logs.slice(0, 1000);
        saveToStorage(STORAGE_KEYS.AUDIT_LOGS, trimmed);
    },

    getAll: (filters?: {
        action?: AuditLog['action'];
        entity?: string;
        startDate?: string;
        endDate?: string;
        limit?: number;
    }): AuditLog[] => {
        let logs = loadFromStorage<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, []);

        if (filters?.action) {
            logs = logs.filter(l => l.action === filters.action);
        }
        if (filters?.entity) {
            logs = logs.filter(l => l.entity === filters.entity);
        }
        if (filters?.startDate) {
            logs = logs.filter(l => l.timestamp >= filters.startDate!);
        }
        if (filters?.endDate) {
            logs = logs.filter(l => l.timestamp <= filters.endDate!);
        }

        return logs.slice(0, filters?.limit || 100);
    },

    clear: (): void => {
        saveToStorage(STORAGE_KEYS.AUDIT_LOGS, []);
    }
};

// ==========================================
// 👥 USER PERMISSIONS
// ==========================================
export const permissionService = {
    getDefaultPermissions: (level: PermissionLevel): UserPermission['permissions'] => {
        const defaults: Record<PermissionLevel, UserPermission['permissions']> = {
            ADMIN: {
                canApproveLoans: true, canRejectLoans: true, canViewReports: true,
                canExportData: true, canManageUsers: true, canManageSettings: true,
                canSendMessages: true, canViewCustomers: true, canEditCustomers: true,
                canViewFinancials: true
            },
            MANAGER: {
                canApproveLoans: true, canRejectLoans: true, canViewReports: true,
                canExportData: true, canManageUsers: false, canManageSettings: false,
                canSendMessages: true, canViewCustomers: true, canEditCustomers: true,
                canViewFinancials: true
            },
            OPERATOR: {
                canApproveLoans: false, canRejectLoans: false, canViewReports: true,
                canExportData: false, canManageUsers: false, canManageSettings: false,
                canSendMessages: true, canViewCustomers: true, canEditCustomers: false,
                canViewFinancials: false
            },
            VIEWER: {
                canApproveLoans: false, canRejectLoans: false, canViewReports: true,
                canExportData: false, canManageUsers: false, canManageSettings: false,
                canSendMessages: false, canViewCustomers: true, canEditCustomers: false,
                canViewFinancials: false
            }
        };
        return defaults[level];
    },

    getUserPermission: (userId: string): UserPermission | null => {
        const permissions = loadFromStorage<UserPermission[]>(STORAGE_KEYS.PERMISSIONS, []);
        return permissions.find(p => p.userId === userId) || null;
    },

    setUserPermission: (permission: UserPermission): void => {
        const permissions = loadFromStorage<UserPermission[]>(STORAGE_KEYS.PERMISSIONS, []);
        const index = permissions.findIndex(p => p.userId === permission.userId);
        if (index >= 0) {
            permissions[index] = permission;
        } else {
            permissions.push(permission);
        }
        saveToStorage(STORAGE_KEYS.PERMISSIONS, permissions);
        auditService.log('UPDATE', 'PERMISSION', permission.userId, `Permissões atualizadas para nível ${permission.level}`);
    },

    hasPermission: (userId: string, permission: keyof UserPermission['permissions']): boolean => {
        const userPerm = permissionService.getUserPermission(userId);
        if (!userPerm) return false;
        return userPerm.permissions[permission];
    }
};

// ==========================================
// ⭐ CLIENT SCORE
// ==========================================
export const scoreService = {
    calculate: (customer: Customer, loans: Loan[]): ClientScore => {
        const customerLoans = loans;
        let onTimePayments = 0;
        let latePayments = 0;
        let totalDelayDays = 0;
        let paidInstallments = 0;

        customerLoans.forEach(loan => {
            loan.installments.forEach(inst => {
                if (inst.status === 'PAID') {
                    paidInstallments++;
                    if (inst.paidAt) {
                        const dueDate = new Date(inst.dueDate);
                        const paidDate = new Date(inst.paidAt);
                        const delayDays = Math.floor((paidDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
                        if (delayDays <= 0) {
                            onTimePayments++;
                        } else {
                            latePayments++;
                            totalDelayDays += delayDays;
                        }
                    }
                } else if (inst.status === 'LATE') {
                    latePayments++;
                }
            });
        });

        const avgDelay = latePayments > 0 ? totalDelayDays / latePayments : 0;
        const relationshipMonths = Math.floor(
            (Date.now() - new Date(customer.joinedAt).getTime()) / (1000 * 60 * 60 * 24 * 30)
        );

        // Score calculation (0-1000)
        let score = 500; // Base score

        // Payment history weight (40%)
        const paymentRatio = paidInstallments > 0 ? onTimePayments / paidInstallments : 0;
        score += paymentRatio * 200;

        // Late payments penalty (20%)
        score -= Math.min(latePayments * 10, 100);

        // Average delay penalty (15%)
        score -= Math.min(avgDelay * 5, 75);

        // Relationship bonus (15%)
        score += Math.min(relationshipMonths * 3, 75);

        // Active loans consideration (10%)
        if (customer.activeLoansCount > 0 && customer.activeLoansCount <= 2) {
            score += 25;
        } else if (customer.activeLoansCount > 2) {
            score -= 25;
        }

        score = Math.max(0, Math.min(1000, Math.round(score)));

        const level: ClientScore['level'] =
            score >= 800 ? 'EXCELLENT' :
                score >= 600 ? 'GOOD' :
                    score >= 400 ? 'REGULAR' :
                        score >= 200 ? 'BAD' : 'CRITICAL';

        const suggestedLimit =
            level === 'EXCELLENT' ? 50000 :
                level === 'GOOD' ? 30000 :
                    level === 'REGULAR' ? 15000 :
                        level === 'BAD' ? 5000 : 0;

        const clientScore: ClientScore = {
            customerId: customer.id,
            score,
            level,
            factors: {
                paymentHistory: paidInstallments,
                onTimePayments,
                latePayments,
                averageDelayDays: Math.round(avgDelay),
                totalLoans: customerLoans.length,
                activeLoans: customer.activeLoansCount,
                defaultedLoans: customerLoans.filter(l => l.status === 'DEFAULTED').length,
                relationshipMonths
            },
            suggestedLimit,
            lastUpdate: new Date().toISOString()
        };

        // Save score
        const scores = loadFromStorage<ClientScore[]>(STORAGE_KEYS.SCORES, []);
        const index = scores.findIndex(s => s.customerId === customer.id);
        if (index >= 0) {
            scores[index] = clientScore;
        } else {
            scores.push(clientScore);
        }
        saveToStorage(STORAGE_KEYS.SCORES, scores);

        return clientScore;
    },

    getScore: (customerId: string): ClientScore | null => {
        const scores = loadFromStorage<ClientScore[]>(STORAGE_KEYS.SCORES, []);
        return scores.find(s => s.customerId === customerId) || null;
    },

    getAllScores: (): ClientScore[] => {
        return loadFromStorage<ClientScore[]>(STORAGE_KEYS.SCORES, []);
    }
};

// ==========================================
// 💰 RENEGOTIATION
// ==========================================
export const renegotiationService = {
    calculateProposal: (
        customer: Customer,
        loan: Loan,
        discountPercent: number,
        newInstallments: number,
        interestRate: number
    ): RenegotiationProposal => {
        const today = new Date();
        const oldestOverdue = loan.installments
            .filter(i => i.status === 'OPEN' || i.status === 'LATE')
            .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];

        const daysOverdue = oldestOverdue
            ? Math.max(0, Math.floor((today.getTime() - new Date(oldestOverdue.dueDate).getTime()) / (1000 * 60 * 60 * 24)))
            : 0;

        const discount = loan.remainingAmount * (discountPercent / 100);
        const newAmount = loan.remainingAmount - discount;
        const newInstallmentValue = newAmount / newInstallments;

        const proposal: RenegotiationProposal = {
            id: Date.now().toString(),
            customerId: customer.id,
            customerName: customer.name,
            originalLoanId: loan.id,
            originalAmount: loan.amount,
            remainingAmount: loan.remainingAmount,
            daysOverdue,
            proposal: {
                newAmount,
                discount,
                discountPercent,
                newInstallments,
                newInstallmentValue,
                interestRate
            },
            status: 'PENDING',
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
        };

        return proposal;
    },

    save: (proposal: RenegotiationProposal): void => {
        const proposals = loadFromStorage<RenegotiationProposal[]>(STORAGE_KEYS.RENEGOTIATIONS, []);
        proposals.push(proposal);
        saveToStorage(STORAGE_KEYS.RENEGOTIATIONS, proposals);
        auditService.log('CREATE', 'RENEGOTIATION', proposal.id, `Proposta de renegociação criada para ${proposal.customerName}`);
    },

    getAll: (): RenegotiationProposal[] => {
        return loadFromStorage<RenegotiationProposal[]>(STORAGE_KEYS.RENEGOTIATIONS, []);
    },

    updateStatus: (id: string, status: RenegotiationProposal['status']): void => {
        const proposals = loadFromStorage<RenegotiationProposal[]>(STORAGE_KEYS.RENEGOTIATIONS, []);
        const index = proposals.findIndex(p => p.id === id);
        if (index >= 0) {
            proposals[index].status = status;
            if (status === 'ACCEPTED') {
                proposals[index].acceptedAt = new Date().toISOString();
            }
            saveToStorage(STORAGE_KEYS.RENEGOTIATIONS, proposals);
            auditService.log('UPDATE', 'RENEGOTIATION', id, `Status alterado para ${status}`);
        }
    }
};

// ==========================================
// 📝 MESSAGE TEMPLATES
// ==========================================
export const templateService = {
    getAll: (): MessageTemplate[] => {
        return loadFromStorage<MessageTemplate[]>(STORAGE_KEYS.TEMPLATES, getDefaultTemplates());
    },

    save: (template: Omit<MessageTemplate, 'id' | 'createdAt' | 'variables'>): MessageTemplate => {
        const templates = loadFromStorage<MessageTemplate[]>(STORAGE_KEYS.TEMPLATES, []);
        const variables = extractVariables(template.content);

        const newTemplate: MessageTemplate = {
            ...template,
            id: Date.now().toString(),
            variables,
            createdAt: new Date().toISOString()
        };

        templates.push(newTemplate);
        saveToStorage(STORAGE_KEYS.TEMPLATES, templates);
        auditService.log('CREATE', 'TEMPLATE', newTemplate.id, `Template "${template.name}" criado`);
        return newTemplate;
    },

    update: (id: string, data: Partial<MessageTemplate>): void => {
        const templates = loadFromStorage<MessageTemplate[]>(STORAGE_KEYS.TEMPLATES, []);
        const index = templates.findIndex(t => t.id === id);
        if (index >= 0) {
            templates[index] = { ...templates[index], ...data };
            if (data.content) {
                templates[index].variables = extractVariables(data.content);
            }
            saveToStorage(STORAGE_KEYS.TEMPLATES, templates);
            auditService.log('UPDATE', 'TEMPLATE', id, `Template atualizado`);
        }
    },

    delete: (id: string): void => {
        const templates = loadFromStorage<MessageTemplate[]>(STORAGE_KEYS.TEMPLATES, []);
        saveToStorage(STORAGE_KEYS.TEMPLATES, templates.filter(t => t.id !== id));
        auditService.log('DELETE', 'TEMPLATE', id, `Template removido`);
    }
};

function extractVariables(content: string): string[] {
    const matches = content.match(/\{[^}]+\}/g);
    return matches ? [...new Set(matches)] : [];
}

function getDefaultTemplates(): MessageTemplate[] {
    return [
        { id: '1', name: 'Boas-vindas', category: 'WELCOME', content: 'Olá {nome}! Bem-vindo ao Tubarão Empréstimos. Seu cadastro foi realizado com sucesso!', variables: ['{nome}'], isActive: true, createdAt: new Date().toISOString() },
        { id: '2', name: 'Lembrete de Vencimento', category: 'REMINDER', content: 'Olá {nome}! Sua parcela de R$ {valor} vence em {vencimento}. Não esqueça de pagar!', variables: ['{nome}', '{valor}', '{vencimento}'], isActive: true, createdAt: new Date().toISOString() },
        { id: '3', name: 'Cobrança', category: 'COLLECTION', content: 'Olá {nome}! Identificamos uma parcela em atraso de R$ {valor}. Entre em contato para regularizar.', variables: ['{nome}', '{valor}'], isActive: true, createdAt: new Date().toISOString() },
        { id: '4', name: 'Aprovação', category: 'APPROVAL', content: 'Parabéns {nome}! Seu empréstimo de R$ {valor} foi APROVADO! O valor será liberado em breve.', variables: ['{nome}', '{valor}'], isActive: true, createdAt: new Date().toISOString() },
        { id: '5', name: 'Pagamento Confirmado', category: 'PAYMENT', content: 'Olá {nome}! Confirmamos o recebimento de R$ {valor}. Obrigado pela pontualidade!', variables: ['{nome}', '{valor}'], isActive: true, createdAt: new Date().toISOString() }
    ];
}

// ==========================================
// 📤 MASS MESSAGING
// ==========================================
export const massMessageService = {
    create: (templateId: string | null, message: string, recipientIds: string[]): MassMessage => {
        const massMessage: MassMessage = {
            id: Date.now().toString(),
            templateId: templateId || undefined,
            message,
            recipients: recipientIds,
            sentCount: 0,
            failedCount: 0,
            status: 'PENDING',
            createdAt: new Date().toISOString()
        };

        const messages = loadFromStorage<MassMessage[]>(STORAGE_KEYS.MASS_MESSAGES, []);
        messages.push(massMessage);
        saveToStorage(STORAGE_KEYS.MASS_MESSAGES, messages);
        auditService.log('CREATE', 'MASS_MESSAGE', massMessage.id, `Disparo em massa criado para ${recipientIds.length} destinatários`);

        return massMessage;
    },

    getAll: (): MassMessage[] => {
        return loadFromStorage<MassMessage[]>(STORAGE_KEYS.MASS_MESSAGES, []);
    },

    updateProgress: (id: string, sentCount: number, failedCount: number, status: MassMessage['status']): void => {
        const messages = loadFromStorage<MassMessage[]>(STORAGE_KEYS.MASS_MESSAGES, []);
        const index = messages.findIndex(m => m.id === id);
        if (index >= 0) {
            messages[index].sentCount = sentCount;
            messages[index].failedCount = failedCount;
            messages[index].status = status;
            if (status === 'COMPLETED' || status === 'FAILED') {
                messages[index].completedAt = new Date().toISOString();
            }
            saveToStorage(STORAGE_KEYS.MASS_MESSAGES, messages);
        }
    }
};

// ==========================================
// 💬 CONVERSATION HISTORY
// ==========================================
export const conversationService = {
    add: (message: Omit<ConversationMessage, 'id' | 'timestamp'>): void => {
        const conversations = loadFromStorage<ConversationMessage[]>(STORAGE_KEYS.CONVERSATIONS, []);
        const newMessage: ConversationMessage = {
            ...message,
            id: Date.now().toString(),
            timestamp: new Date().toISOString()
        };
        conversations.push(newMessage);
        saveToStorage(STORAGE_KEYS.CONVERSATIONS, conversations);
    },

    getByCustomer: (customerId: string): ConversationMessage[] => {
        const conversations = loadFromStorage<ConversationMessage[]>(STORAGE_KEYS.CONVERSATIONS, []);
        return conversations.filter(c => c.customerId === customerId).sort((a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
    },

    getAll: (): ConversationMessage[] => {
        return loadFromStorage<ConversationMessage[]>(STORAGE_KEYS.CONVERSATIONS, []);
    }
};

// ==========================================
// 📄 DOCUMENT GENERATION
// ==========================================
export const documentService = {
    generateReceipt: (data: Omit<Receipt, 'id' | 'generatedAt'>): Receipt => {
        const receipt: Receipt = {
            ...data,
            id: Date.now().toString(),
            generatedAt: new Date().toISOString()
        };

        const receipts = loadFromStorage<Receipt[]>(STORAGE_KEYS.RECEIPTS, []);
        receipts.push(receipt);
        saveToStorage(STORAGE_KEYS.RECEIPTS, receipts);
        auditService.log('CREATE', 'RECEIPT', receipt.id, `Recibo gerado para ${receipt.customerName}`);

        return receipt;
    },

    generateDischarge: (data: Omit<DischargeDeclaration, 'id' | 'generatedAt'>): DischargeDeclaration => {
        const declaration: DischargeDeclaration = {
            ...data,
            id: Date.now().toString(),
            generatedAt: new Date().toISOString()
        };

        const declarations = loadFromStorage<DischargeDeclaration[]>(STORAGE_KEYS.DECLARATIONS, []);
        declarations.push(declaration);
        saveToStorage(STORAGE_KEYS.DECLARATIONS, declarations);
        auditService.log('CREATE', 'DISCHARGE', declaration.id, `Declaração de quitação gerada para ${declaration.customerName}`);

        return declaration;
    },

    getReceipts: (customerId?: string): Receipt[] => {
        const receipts = loadFromStorage<Receipt[]>(STORAGE_KEYS.RECEIPTS, []);
        return customerId ? receipts.filter(r => r.customerId === customerId) : receipts;
    },

    getDeclarations: (customerId?: string): DischargeDeclaration[] => {
        const declarations = loadFromStorage<DischargeDeclaration[]>(STORAGE_KEYS.DECLARATIONS, []);
        return customerId ? declarations.filter(d => d.customerId === customerId) : declarations;
    },

    // Generate PDF HTML for receipt
    receiptToHTML: (receipt: Receipt, brandSettings: any): string => {
        return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; }
          .header { text-align: center; border-bottom: 2px solid #D4AF37; padding-bottom: 20px; }
          .logo { max-width: 200px; }
          .title { color: #D4AF37; font-size: 24px; margin: 20px 0; }
          .content { margin: 30px 0; }
          .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
          .label { color: #666; }
          .value { font-weight: bold; }
          .amount { font-size: 32px; color: #22C55E; text-align: center; margin: 30px 0; }
          .footer { text-align: center; color: #999; font-size: 12px; margin-top: 40px; }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="${brandSettings?.logoUrl || '/Logo.png'}" class="logo" alt="Logo" />
          <h1 class="title">RECIBO DE PAGAMENTO</h1>
        </div>
        <div class="content">
          <div class="row"><span class="label">Recibo Nº:</span><span class="value">${receipt.id}</span></div>
          <div class="row"><span class="label">Cliente:</span><span class="value">${receipt.customerName}</span></div>
          <div class="row"><span class="label">Data do Pagamento:</span><span class="value">${new Date(receipt.paymentDate).toLocaleDateString('pt-BR')}</span></div>
          <div class="row"><span class="label">Forma de Pagamento:</span><span class="value">${receipt.paymentMethod}</span></div>
          <div class="amount">R$ ${receipt.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
        </div>
        <div class="footer">
          <p>${brandSettings?.companyName || 'Tubarão Empréstimos'}</p>
          <p>CNPJ: ${brandSettings?.cnpj || '00.000.000/0001-00'}</p>
          <p>Documento gerado em ${new Date().toLocaleString('pt-BR')}</p>
        </div>
      </body>
      </html>
    `;
    },

    // Generate PDF HTML for discharge declaration
    dischargeToHTML: (declaration: DischargeDeclaration, brandSettings: any): string => {
        return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; }
          .header { text-align: center; border-bottom: 2px solid #D4AF37; padding-bottom: 20px; }
          .logo { max-width: 200px; }
          .title { color: #22C55E; font-size: 28px; margin: 20px 0; }
          .content { margin: 30px 0; line-height: 1.8; }
          .highlight { background: #f0fdf4; padding: 20px; border-radius: 10px; margin: 20px 0; }
          .signature { margin-top: 60px; text-align: center; }
          .signature-line { border-top: 1px solid #000; width: 300px; margin: 0 auto; padding-top: 10px; }
          .footer { text-align: center; color: #999; font-size: 12px; margin-top: 40px; }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="${brandSettings?.logoUrl || '/Logo.png'}" class="logo" alt="Logo" />
          <h1 class="title">DECLARAÇÃO DE QUITAÇÃO</h1>
        </div>
        <div class="content">
          <p>Declaramos para os devidos fins que <strong>${declaration.customerName}</strong>, 
          portador(a) do CPF nº <strong>${declaration.cpf}</strong>, quitou integralmente o 
          contrato de empréstimo junto a esta instituição.</p>
          
          <div class="highlight">
            <p><strong>Valor Original:</strong> R$ ${declaration.originalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            <p><strong>Total Pago:</strong> R$ ${declaration.totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            <p><strong>Período:</strong> ${new Date(declaration.startDate).toLocaleDateString('pt-BR')} a ${new Date(declaration.endDate).toLocaleDateString('pt-BR')}</p>
          </div>
          
          <p>Nada mais sendo devido, emitimos a presente declaração de quitação para que produza os 
          efeitos legais cabíveis.</p>
        </div>
        <div class="signature">
          <div class="signature-line">${brandSettings?.companyName || 'Tubarão Empréstimos'}</div>
        </div>
        <div class="footer">
          <p>CNPJ: ${brandSettings?.cnpj || '00.000.000/0001-00'}</p>
          <p>${brandSettings?.address || ''}</p>
          <p>Documento gerado em ${new Date().toLocaleString('pt-BR')}</p>
        </div>
      </body>
      </html>
    `;
    }
};

// ==========================================
// 📅 CALENDAR / AGENDA
// ==========================================
export const calendarService = {
    getEvents: (startDate: string, endDate: string, loans: Loan[], customers: Customer[]): CalendarEvent[] => {
        const events: CalendarEvent[] = [];
        const start = new Date(startDate);
        const end = new Date(endDate);
        const today = new Date();

        loans.forEach(loan => {
            const customer = customers.find(c => c.id === loan.id.split('_')[0]);

            loan.installments.forEach(inst => {
                const dueDate = new Date(inst.dueDate);
                if (dueDate >= start && dueDate <= end) {
                    const status: CalendarEvent['status'] =
                        inst.status === 'PAID' ? 'PAID' :
                            dueDate < today ? 'OVERDUE' : 'PENDING';

                    events.push({
                        id: inst.id,
                        type: 'INSTALLMENT',
                        title: `Parcela - ${customer?.name || 'Cliente'}`,
                        date: inst.dueDate,
                        customerId: customer?.id,
                        customerName: customer?.name,
                        amount: inst.amount,
                        status,
                        loanId: loan.id
                    });
                }
            });
        });

        return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    },

    getUpcomingEvents: (days: number, loans: Loan[], customers: Customer[]): CalendarEvent[] => {
        const start = new Date().toISOString();
        const end = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
        return calendarService.getEvents(start, end, loans, customers);
    },

    getOverdueEvents: (loans: Loan[], customers: Customer[]): CalendarEvent[] => {
        const events: CalendarEvent[] = [];
        const today = new Date();

        loans.forEach(loan => {
            const customer = customers.find(c => c.id === loan.id.split('_')[0]);

            loan.installments
                .filter(inst => inst.status !== 'PAID' && new Date(inst.dueDate) < today)
                .forEach(inst => {
                    events.push({
                        id: inst.id,
                        type: 'INSTALLMENT',
                        title: `Parcela Atrasada - ${customer?.name || 'Cliente'}`,
                        date: inst.dueDate,
                        customerId: customer?.id,
                        customerName: customer?.name,
                        amount: inst.amount,
                        status: 'OVERDUE',
                        loanId: loan.id
                    });
                });
        });

        return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }
};

// ==========================================
// 📊 FINANCIAL SUMMARY
// ==========================================
export const financialService = {
    getSummary: (loans: Loan[], period: 'month' | 'year' = 'month'): FinancialSummary => {
        const now = new Date();
        const startOfPeriod = period === 'month'
            ? new Date(now.getFullYear(), now.getMonth(), 1)
            : new Date(now.getFullYear(), 0, 1);

        let loansDisbursed = 0;
        let paymentsReceived = 0;
        let defaultedAmount = 0;

        loans.forEach(loan => {
            const loanStart = new Date(loan.startDate);
            if (loanStart >= startOfPeriod) {
                loansDisbursed += loan.amount;
            }

            loan.installments.forEach(inst => {
                if (inst.status === 'PAID' && inst.paidAt) {
                    const paidDate = new Date(inst.paidAt);
                    if (paidDate >= startOfPeriod) {
                        paymentsReceived += inst.amount;
                    }
                }
                if (inst.status === 'LATE' || (inst.status === 'OPEN' && new Date(inst.dueDate) < now)) {
                    defaultedAmount += inst.amount;
                }
            });
        });

        // Simplified DRE
        const revenue = paymentsReceived;
        const expenses = loansDisbursed * 0.1; // Simple estimate: 10% operational cost
        const profit = revenue - expenses;

        // Cash flow (simplified - last 7 days)
        const cashFlow: FinancialSummary['cashFlow'] = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const dateStr = date.toISOString().split('T')[0];

            let inflow = 0;
            let outflow = 0;

            loans.forEach(loan => {
                if (loan.startDate.startsWith(dateStr)) {
                    outflow += loan.amount;
                }
                loan.installments.forEach(inst => {
                    if (inst.paidAt?.startsWith(dateStr)) {
                        inflow += inst.amount;
                    }
                });
            });

            cashFlow.push({
                date: dateStr,
                inflow,
                outflow,
                balance: inflow - outflow
            });
        }

        return {
            period: period === 'month'
                ? now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
                : now.getFullYear().toString(),
            revenue,
            expenses,
            profit,
            loansDisbursed,
            paymentsReceived,
            defaultedAmount,
            cashFlow
        };
    },

    getRanking: (customers: Customer[], type: 'best' | 'worst' = 'best', limit: number = 10): Customer[] => {
        const sorted = [...customers].sort((a, b) => {
            const scoreA = a.internalScore || 500;
            const scoreB = b.internalScore || 500;
            return type === 'best' ? scoreB - scoreA : scoreA - scoreB;
        });
        return sorted.slice(0, limit);
    }
};

// Export all services
export const adminService = {
    blacklist: blacklistService,
    audit: auditService,
    permissions: permissionService,
    score: scoreService,
    renegotiation: renegotiationService,
    templates: templateService,
    massMessage: massMessageService,
    conversation: conversationService,
    documents: documentService,
    calendar: calendarService,
    financial: financialService
};
