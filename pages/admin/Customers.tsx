

import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Search, UserCheck, UserX, BarChart2, MessageSquare, Send, X, Download, ShieldAlert, ShieldCheck, Sparkles, DollarSign, Percent, Settings, Calendar, RotateCcw, Calculator, Edit2, Trash2, Gift, Upload, UserPlus, Save, Key, Smartphone } from 'lucide-react';
import { apiService } from '../../services/apiService';
import { whatsappService } from '../../services/whatsappService';
import { dataEnrichmentService } from '../../services/dataEnrichmentService';
import { Customer, SystemSettings } from '../../types';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Toast';
import { api } from '../../services/apiClient';

export const Customers: React.FC = () => {
  const { addToast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  // Message Modal State
  const [msgModalOpen, setMsgModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);

  const [preApproveOpen, setPreApproveOpen] = useState(false);
  const [preApproveAmount, setPreApproveAmount] = useState(500);

  // Rates Modal State
  const [ratesModalOpen, setRatesModalOpen] = useState(false);
  const [globalSettings, setGlobalSettings] = useState<SystemSettings | null>(null);
  const [customRates, setCustomRates] = useState({
    useCustomRates: false,
    monthlyInterestRate: 0,
    lateFixedFee: 0,
    lateInterestDaily: 0,
    lateInterestMonthly: 0
  });

  // Installment Offer Modal State
  const [installmentOfferOpen, setInstallmentOfferOpen] = useState(false);
  const [installmentOffer, setInstallmentOffer] = useState({
    amount: 1000,
    installments: 4,
    interestRate: 15,
    installmentValue: 0,
    totalAmount: 0,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 7 dias
  });
  const [isEditingOffer, setIsEditingOffer] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'BLOCKED'>('ALL');
  const [originFilter, setOriginFilter] = useState<'ALL' | 'IMPORTED' | 'ORGANIC'>('ALL');
  const [clientTypeFilter, setClientTypeFilter] = useState<'ALL' | 'NEVER_REQUESTED' | 'ACTIVE_CLIENTS' | 'INACTIVE_CLIENTS' | 'WHATSAPP'>('ALL');

  // History Modal
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyCustomer, setHistoryCustomer] = useState<any>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // WhatsApp Onboarding Modal
  const [onboardingModalOpen, setOnboardingModalOpen] = useState(false);
  const [onboardingPhone, setOnboardingPhone] = useState('');
  const [onboardingLoading, setOnboardingLoading] = useState(false);

  // Edit Customer Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editData, setEditData] = useState({
    name: '', cpf: '', email: '', phone: '',
    address: '', neighborhood: '', city: '', state: '', zipCode: '',
    monthlyIncome: 0
  });

  // Create User Modal
  const [createUserModalOpen, setCreateUserModalOpen] = useState(false);
  const [newUserPassword, setNewUserPassword] = useState('');

  // 1. Definição de Dados Derivados
  const filteredCustomers = customers.filter(c => {
    const matchesText = c.name.toLowerCase().includes(filter.toLowerCase()) ||
      c.cpf.includes(filter) ||
      c.email.toLowerCase().includes(filter.toLowerCase()) ||
      c.phone.includes(filter);

    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;

    const isImported = c.email.includes('@whatsapp.lead');
    const matchesOrigin = originFilter === 'ALL' ||
      (originFilter === 'IMPORTED' && isImported) ||
      (originFilter === 'ORGANIC' && !isImported);

    // "Só Cadastrado" = nunca fez nenhuma solicitação (loanRequestsCount === 0)
    const neverRequested = (c.loanRequestsCount || 0) === 0;
    const isActiveClient = (c.activeLoansCount || 0) > 0;
    const isInactiveClient = (c.loanRequestsCount || 0) > 0 && (c.activeLoansCount || 0) === 0;
    const isWhatsappOnboarding = c.source === 'WHATSAPP_ONBOARDING';
    const matchesClientType = clientTypeFilter === 'ALL' ||
      (clientTypeFilter === 'NEVER_REQUESTED' && neverRequested) ||
      (clientTypeFilter === 'ACTIVE_CLIENTS' && isActiveClient) ||
      (clientTypeFilter === 'INACTIVE_CLIENTS' && isInactiveClient) ||
      (clientTypeFilter === 'WHATSAPP' && isWhatsappOnboarding);

    return matchesText && matchesStatus && matchesOrigin && matchesClientType;
  });

  const neverRequestedCount = customers.filter(c => (c.loanRequestsCount || 0) === 0).length;
  const activeClientsCount = customers.filter(c => (c.activeLoansCount || 0) > 0).length;
  const inactiveClientsCount = customers.filter(c => (c.loanRequestsCount || 0) > 0 && (c.activeLoansCount || 0) === 0).length;
  const whatsappOnboardingCount = customers.filter(c => c.source === 'WHATSAPP_ONBOARDING').length;

  const totalImported = customers.filter(c => c.email.includes('@whatsapp.lead')).length;

  // Selection Logic
  const toggleSelectAll = () => {
    if (selectedIds.length === filteredCustomers.length && filteredCustomers.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredCustomers.map(c => c.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(sid => sid !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Tem certeza que deseja apagar ${selectedIds.length} clientes selecionados? Esta ação é irreversível e apagará empréstimos vinculados.`)) return;

    setLoading(true);
    addToast('Excluindo clientes...', 'info');

    try {
      await apiService.bulkDeleteCustomers(selectedIds);
      addToast(`${selectedIds.length} clientes excluídos.`, 'success');
      setSelectedIds([]);
      loadCustomers();
    } catch (e) {
      console.error(e);
      addToast('Erro ao excluir clientes.', 'error');
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
    loadGlobalSettings();
  }, []);

  const loadCustomers = async () => {
    setLoading(true);
    const data = await apiService.getCustomers();
    setCustomers(data);
    setLoading(false);
  };

  const loadGlobalSettings = async () => {
    const settings = await apiService.getSettings();
    setGlobalSettings(settings);
  };

  const handleToggleStatus = async (cust: Customer) => {
    const newStatus = cust.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE';
    const action = newStatus === 'ACTIVE' ? 'desbloquear' : 'bloquear';

    if (confirm(`Tem certeza que deseja ${action} o cliente ${cust.name}?`)) {
      await apiService.toggleCustomerStatus(cust.id, newStatus);
      addToast(`Cliente ${newStatus === 'ACTIVE' ? 'desbloqueado' : 'bloqueado'} com sucesso.`, 'info');
      loadCustomers();
    }
  };

  const openMessageModal = (cust: Customer) => {
    setSelectedCustomer(cust);
    setMessageText(`Olá ${cust.name.split(' ')[0]}, `);
    setMsgModalOpen(true);
  };

  // Edit Customer
  const openEditModal = (cust: Customer) => {
    setSelectedCustomer(cust);
    setEditData({
      name: cust.name || '',
      cpf: cust.cpf || '',
      email: cust.email || '',
      phone: cust.phone || '',
      address: cust.address || '',
      neighborhood: cust.neighborhood || '',
      city: cust.city || '',
      state: cust.state || '',
      zipCode: cust.zipCode || '',
      monthlyIncome: cust.monthlyIncome || 0
    });
    setEditModalOpen(true);
  };

  const handleEnrichData = async () => {
    if (!editData.cpf) return;

    // Verificar token (simples prompt para MVP)
    if (!dataEnrichmentService.hasToken()) {
      const token = prompt('Para consultar dados reais (Nome, Endereço, Telefones), insira seu Token da API Brasil (ou similar configurada):');
      if (token) {
        dataEnrichmentService.setToken(token);
      } else {
        addToast('É necessário um token de API para consultar dados externos.', 'warning');
        return;
      }
    }

    setSending(true);
    addToast('Consultando bases de dados...', 'info');

    const result = await dataEnrichmentService.searchByCpf(editData.cpf);
    setSending(false);

    if (result.success && result.data) {
      setEditData(prev => ({
        ...prev,
        name: result.data!.name || prev.name,
        address: result.data!.address?.street || prev.address,
        neighborhood: result.data!.address?.neighborhood || prev.neighborhood,
        city: result.data!.address?.city || prev.city,
        state: result.data!.address?.state || prev.state,
        zipCode: result.data!.address?.zipCode || prev.zipCode,
      }));

      // Se tiver telefones e o campo atual estiver vazio ou usuário confirmar
      if (result.data.phones && result.data.phones.length > 0) {
        const foundPhone = result.data.phones[0];
        if (!editData.phone || confirm(`Encontrado telefone ${foundPhone}. Deseja substituir o atual (${editData.phone})?`)) {
          setEditData(prev => ({ ...prev, phone: foundPhone }));
        }
      }

      addToast('Dados preenchidos com sucesso!', 'success');
    } else {
      addToast(result.error || 'Dados não encontrados.', 'error');
      if (result.error?.includes('Token')) {
        localStorage.removeItem('DATA_API_TOKEN');
      }
    }
  };

  const handleSaveCustomer = async () => {
    if (!selectedCustomer) return;
    setSending(true);

    const success = await apiService.updateCustomer(selectedCustomer.id, editData);

    setSending(false);
    setEditModalOpen(false);

    if (success) {
      addToast('Cliente atualizado com sucesso!', 'success');
      loadCustomers();
    } else {
      addToast('Erro ao atualizar cliente.', 'error');
    }
  };

  // Create User from Customer
  const openCreateUserModal = (cust: Customer) => {
    setSelectedCustomer(cust);
    setNewUserPassword('');
    setCreateUserModalOpen(true);
  };

  const handleCreateUser = async () => {
    if (!selectedCustomer || !newUserPassword) {
      addToast('Defina uma senha para o usuário.', 'warning');
      return;
    }

    if (newUserPassword.length < 6) {
      addToast('A senha deve ter pelo menos 6 caracteres.', 'warning');
      return;
    }

    setSending(true);
    const result = await apiService.createUserFromCustomer(selectedCustomer.id, newUserPassword);
    setSending(false);

    if (result.success) {
      addToast('Usuário criado com sucesso! O cliente agora pode fazer login.', 'success');
      setCreateUserModalOpen(false);
    } else {
      addToast(result.error || 'Erro ao criar usuário.', 'error');
    }
  };


  const openPreApproveModal = (cust: Customer) => {
    setSelectedCustomer(cust);
    setPreApproveAmount(cust.preApprovedOffer?.amount || 500);
    setPreApproveOpen(true);
  };

  const openRatesModal = (cust: Customer) => {
    setSelectedCustomer(cust);
    const rates = cust.customRates;
    setCustomRates({
      useCustomRates: !!rates,
      monthlyInterestRate: rates?.monthlyInterestRate || globalSettings?.monthlyInterestRate || 0,
      lateFixedFee: rates?.lateFixedFee || globalSettings?.lateFixedFee || 0,
      lateInterestDaily: rates?.lateInterestDaily || globalSettings?.lateInterestDaily || 0,
      lateInterestMonthly: rates?.lateInterestMonthly || globalSettings?.lateInterestMonthly || 0
    });
    setRatesModalOpen(true);
  };

  const handleSaveRates = async () => {
    if (!selectedCustomer) return;
    setSending(true);

    const ratesToSave = customRates.useCustomRates ? {
      monthlyInterestRate: customRates.monthlyInterestRate,
      lateFixedFee: customRates.lateFixedFee,
      lateInterestDaily: customRates.lateInterestDaily,
      lateInterestMonthly: customRates.lateInterestMonthly
    } : undefined;

    await apiService.updateCustomerRates(selectedCustomer.id, ratesToSave);

    setSending(false);
    setRatesModalOpen(false);
    addToast(`Taxas ${customRates.useCustomRates ? 'personalizadas salvas' : 'resetadas para padrão'}!`, 'success');
    loadCustomers();
  };

  // Funções para Oferta de Parcelamento
  const openInstallmentOfferModal = (cust: Customer, editMode = false) => {
    setSelectedCustomer(cust);
    setIsEditingOffer(editMode);

    // Se cliente tem oferta existente, carregar dados
    if (cust.installmentOffer && editMode) {
      setInstallmentOffer({
        amount: cust.installmentOffer.amount,
        installments: cust.installmentOffer.installments,
        interestRate: cust.installmentOffer.interest_rate || cust.installmentOffer.interestRate,
        installmentValue: cust.installmentOffer.installment_value || cust.installmentOffer.installmentValue,
        totalAmount: cust.installmentOffer.total_amount || cust.installmentOffer.totalAmount,
        expiresAt: cust.installmentOffer.expires_at?.split('T')[0] || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      });
    } else {
      // Nova oferta
      const rate = cust.customRates?.monthlyInterestRate || globalSettings?.monthlyInterestRate || 15;
      setInstallmentOffer({
        amount: 1000,
        installments: 4,
        interestRate: rate,
        installmentValue: 0,
        totalAmount: 0,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      });
    }
    setInstallmentOfferOpen(true);
  };

  const handleDeleteOffer = async (cust: Customer) => {
    if (!confirm(`Remover oferta de parcelamento de ${cust.name}?`)) return;

    await apiService.deleteInstallmentOffer(cust.id);
    addToast('Oferta removida!', 'info');
    loadCustomers();
  };

  const calculateInstallmentOffer = (amount: number, installments: number, rate: number) => {
    // Cálculo com juros compostos simples: Total = Principal * (1 + taxa/100)
    const totalAmount = amount * (1 + rate / 100);
    const installmentValue = totalAmount / installments;
    return { totalAmount, installmentValue };
  };

  // Atualiza cálculos quando valores mudam
  useEffect(() => {
    const { totalAmount, installmentValue } = calculateInstallmentOffer(
      installmentOffer.amount,
      installmentOffer.installments,
      installmentOffer.interestRate
    );
    setInstallmentOffer(prev => ({
      ...prev,
      totalAmount,
      installmentValue
    }));
  }, [installmentOffer.amount, installmentOffer.installments, installmentOffer.interestRate]);

  const handleSendInstallmentOffer = async () => {
    if (!selectedCustomer) return;
    setSending(true);

    try {
      // Salvar oferta no banco
      await apiService.sendInstallmentOffer(selectedCustomer.id, {
        amount: installmentOffer.amount,
        installments: installmentOffer.installments,
        interestRate: installmentOffer.interestRate,
        installmentValue: installmentOffer.installmentValue,
        totalAmount: installmentOffer.totalAmount,
        expiresAt: installmentOffer.expiresAt
      });

      // Enviar WhatsApp (apenas se não for edição)
      if (!isEditingOffer) {
        const expiresDate = new Date(installmentOffer.expiresAt).toLocaleDateString('pt-BR');
        const msg = `Olá ${selectedCustomer.name.split(' ')[0]}! 🦈\n\n` +
          `Temos uma oferta especial para você:\n\n` +
          `💰 *Valor:* R$ ${installmentOffer.amount.toLocaleString('pt-BR')}\n` +
          `📅 *Parcelas:* ${installmentOffer.installments}x de R$ ${installmentOffer.installmentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
          `📊 *Taxa:* ${installmentOffer.interestRate}% a.m.\n` +
          `💵 *Total:* R$ ${installmentOffer.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
          `⏰ *Válido até:* ${expiresDate}\n\n` +
          `Acesse o app para conferir!`;

        whatsappService.sendMessage(selectedCustomer.phone, msg);
      }

      setSending(false);
      setInstallmentOfferOpen(false);
      addToast(isEditingOffer ? 'Oferta atualizada!' : `Oferta de ${installmentOffer.installments}x R$ ${installmentOffer.installmentValue.toFixed(2)} enviada para ${selectedCustomer.name}!`, 'success');
      loadCustomers();
    } catch (error) {
      setSending(false);
      addToast('Erro ao enviar oferta.', 'error');
    }
  };

  const handleSendPreApproval = async () => {
    if (!selectedCustomer || !preApproveAmount) return;
    setSending(true);

    // Save to DB
    await apiService.sendPreApproval(selectedCustomer.id, preApproveAmount);

    // Send WhatsApp (Optional but good UX)
    const msg = `Olá ${selectedCustomer.name.split(' ')[0]}! 🦈\n\nTemos uma ótima notícia: Você possui um Crédito Pré-aprovado de *R$ ${preApproveAmount.toLocaleString('pt-BR')}* disponível agora!\n\nAcesse o app para conferir.`;
    whatsappService.sendMessage(selectedCustomer.phone, msg);

    setSending(false);
    setPreApproveOpen(false);
    addToast(`Oferta de R$ ${preApproveAmount} enviada para ${selectedCustomer.name}!`, 'success');
    loadCustomers();
  };

  const handleSendMessage = async () => {
    if (!selectedCustomer || !messageText) return;
    setSending(true);

    // Attempt to send
    const success = await whatsappService.sendMessage(selectedCustomer.phone, messageText);

    setSending(false);
    if (success) {
      addToast('Mensagem enviada com sucesso!', 'success');
      setMsgModalOpen(false);
    } else {
      addToast('Falha ao enviar. Verifique a conexão na aba Configurações.', 'error');
    }
  };

  const handleExportCSV = () => {
    const headers = ["Nome", "CPF", "Telefone", "Status", "Score", "Divida", "Data Entrada"];
    const rows = customers.map(c => [
      c.name,
      c.cpf,
      c.phone,
      c.status,
      c.internalScore,
      c.totalDebt,
      new Date(c.joinedAt).toLocaleDateString()
    ]);

    let csvContent = "data:text/csv;charset=utf-8,"
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "clientes_tubarao.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const processVCF = async (content: string) => {
    setLoading(true);
    addToast('Processando arquivo VCF...', 'info');

    const cards = content.split('BEGIN:VCARD');
    const leadsToImport: { name: string, phone: string }[] = [];
    let skipped = 0;

    for (const card of cards) {
      if (!card.includes('END:VCARD')) continue;

      try {
        let name = 'Desconhecido';
        const nameMatch = card.match(/FN(?:;.*?)?:(.*)/);

        if (nameMatch) {
          let rawName = nameMatch[1].trim();
          if (card.includes('ENCODING=QUOTED-PRINTABLE') && rawName.includes('=')) {
            try {
              rawName = rawName.replace(/=\r?\n/g, '');
              rawName = decodeURIComponent(rawName.replace(/=/g, '%'));
            } catch (e) { }
          }
          name = rawName;
        } else {
          const nMatch = card.match(/N(?:;.*?)?:(.*)/);
          if (nMatch) name = nMatch[1].replace(/;/g, ' ').trim();
        }

        const telMatches = [...card.matchAll(/TEL(?:;.*?)?:(.*)/g)];
        let foundValid = false;

        for (const match of telMatches) {
          let rawPhone = match[1];
          let clean = rawPhone.replace(/\D/g, '');

          while (clean.startsWith('0')) clean = clean.substring(1);
          if (clean.length >= 10 && clean.length <= 11) clean = '55' + clean;
          if (clean.startsWith('55') && clean.length >= 5 && clean[4] === '0') clean = clean.substring(0, 4) + clean.substring(5);
          if (clean.startsWith('55') && clean.length === 12) {
            if (['7', '8', '9'].includes(clean[4])) clean = clean.substring(0, 4) + '9' + clean.substring(4);
          }

          if (clean.length >= 12) {
            leadsToImport.push({ name, phone: clean });
            foundValid = true;
            break;
          }
        }
        if (!foundValid) skipped++;

      } catch (err) {
        console.error('Error parsing card', err);
      }
    }

    if (leadsToImport.length > 0) {
      addToast(`Importando ${leadsToImport.length} contatos...`, 'info');
      const result = await apiService.bulkImportLeads(leadsToImport);
      addToast(`Importação finalizada! ${result.added} adicionados.`, 'success');
    } else {
      addToast('Nenhum contato válido encontrado.', 'warning');
    }

    setLoading(false);
    loadCustomers();
  };

  const handleImportVCF = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      if (content) await processVCF(content);
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleSyncContacts = async () => {
    if (!confirm('Deseja sincronizar os contatos do WhatsApp conectados à API?')) return;

    addToast('Iniciando sincronização...', 'info');
    setLoading(true);

    try {
      const res = await whatsappService.syncContacts();
      addToast(`Sincronização concluída! ${res.added} novos, ${res.updated} atualizados.`, 'success');
      if (res.added > 0 || res.updated > 0) {
        loadCustomers();
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error(error);
      addToast('Erro ao sincronizar contatos.', 'error');
      setLoading(false);
    }
  };

  const openHistoryModal = async (cust: Customer) => {
    setHistoryCustomer(null);
    setHistoryModalOpen(true);
    setHistoryLoading(true);
    try {
      const data = await apiService.getCustomer(cust.id);
      setHistoryCustomer(data);
    } catch {
      addToast('Erro ao carregar histórico do cliente.', 'error');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleStartOnboarding = async () => {
    const phone = onboardingPhone.replace(/\D/g, '');
    if (phone.length < 10) { addToast('Telefone inválido. Informe DDD + número.', 'error'); return; }
    setOnboardingLoading(true);
    try {
      await apiService.startWhatsappOnboarding(phone);
      addToast('Onboarding iniciado! O cliente receberá a mensagem agora.', 'success');
      setOnboardingModalOpen(false);
      setOnboardingPhone('');
    } catch (e: any) {
      addToast(e.message || 'Erro ao iniciar onboarding.', 'error');
    } finally {
      setOnboardingLoading(false);
    }
  };

  const handleUndoSync = async () => {
    if (!confirm('ATENÇÃO: Deseja apagar TODOS os contatos importados do WhatsApp? Esta ação não pode ser desfeita.')) return;

    setLoading(true);
    try {
      const count = await apiService.deleteWhatsappLeads();
      addToast(`${count} contatos removidos.`, 'success');
      loadCustomers();
    } catch {
      addToast('Erro ao remover contatos.', 'error');
      setLoading(false);
    }
  };

  const formatPhone = (phone: string) => {
    const clean = phone.replace(/\D/g, '');
    if (clean.length === 13) return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
    if (clean.length === 12) return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 8)}-${clean.slice(8)}`;
    return phone;
  };

  return (
    <div className="p-4 md:p-8 bg-black min-h-screen text-white">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#D4AF37]">Gestão de Clientes</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {customers.length} total • {filteredCustomers.length} visíveis • {totalImported} importados
          </p>
          {selectedIds.length > 0 && (
            <div className="mt-2 text-white bg-zinc-800 px-3 py-1 rounded-full text-sm inline-flex items-center gap-2 animate-in fade-in">
              <span className="font-bold text-[#D4AF37]">{selectedIds.length}</span> selecionados
              <button onClick={handleBulkDelete} className="text-red-400 hover:text-red-300 ml-2 font-bold underline flex items-center">
                <Trash2 size={12} className="mr-1" /> Excluir
              </button>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-4 w-full md:w-auto">
          <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
            {/* Filtro por tipo de cliente */}
            <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800">
              <button onClick={() => setClientTypeFilter('ALL')} className={`px-3 py-1 rounded-md text-sm transition-colors ${clientTypeFilter === 'ALL' ? 'bg-[#D4AF37] text-black font-bold' : 'text-zinc-400 hover:text-white'}`}>
                Todos <span className="text-xs opacity-70">({customers.length})</span>
              </button>
              <button onClick={() => setClientTypeFilter('NEVER_REQUESTED')} className={`px-3 py-1 rounded-md text-sm transition-colors ${clientTypeFilter === 'NEVER_REQUESTED' ? 'bg-blue-600 text-white font-bold' : 'text-zinc-400 hover:text-white'}`} title="Nunca solicitou empréstimo — campanhas e ofertas">
                Só Cadastrado <span className="text-xs opacity-70">({neverRequestedCount})</span>
              </button>
              <button onClick={() => setClientTypeFilter('ACTIVE_CLIENTS')} className={`px-3 py-1 rounded-md text-sm transition-colors ${clientTypeFilter === 'ACTIVE_CLIENTS' ? 'bg-green-600 text-white font-bold' : 'text-zinc-400 hover:text-white'}`}>
                Clientes Ativos <span className="text-xs opacity-70">({activeClientsCount})</span>
              </button>
              <button onClick={() => setClientTypeFilter('INACTIVE_CLIENTS')} className={`px-3 py-1 rounded-md text-sm transition-colors ${clientTypeFilter === 'INACTIVE_CLIENTS' ? 'bg-zinc-600 text-white font-bold' : 'text-zinc-400 hover:text-white'}`} title="Já solicitou mas sem contrato ativo">
                Histórico <span className="text-xs opacity-70">({inactiveClientsCount})</span>
              </button>
              <button onClick={() => setClientTypeFilter('WHATSAPP')} className={`px-3 py-1 rounded-md text-sm transition-colors ${clientTypeFilter === 'WHATSAPP' ? 'bg-green-700 text-white font-bold' : 'text-zinc-400 hover:text-white'}`} title="Cadastrados via WhatsApp automatico">
                📱 WhatsApp <span className="text-xs opacity-70">({whatsappOnboardingCount})</span>
              </button>
            </div>
            <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800">
              <button onClick={() => setStatusFilter('ALL')} className={`px-3 py-1 rounded-md text-sm transition-colors ${statusFilter === 'ALL' ? 'bg-[#D4AF37] text-black font-bold' : 'text-zinc-400 hover:text-white'}`}>Todos</button>
              <button onClick={() => setStatusFilter('ACTIVE')} className={`px-3 py-1 rounded-md text-sm transition-colors ${statusFilter === 'ACTIVE' ? 'bg-green-600 text-white font-bold' : 'text-zinc-400 hover:text-white'}`}>Ativos</button>
              <button onClick={() => setStatusFilter('BLOCKED')} className={`px-3 py-1 rounded-md text-sm transition-colors ${statusFilter === 'BLOCKED' ? 'bg-red-600 text-white font-bold' : 'text-zinc-400 hover:text-white'}`}>Bloqueados</button>
            </div>
            <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800">
              <button onClick={() => setOriginFilter('ALL')} className={`px-3 py-1 rounded-md text-sm transition-colors ${originFilter === 'ALL' ? 'bg-blue-600 text-white font-bold' : 'text-zinc-400 hover:text-white'}`}>Tudo</button>
              <button onClick={() => setOriginFilter('IMPORTED')} className={`px-3 py-1 rounded-md text-sm transition-colors ${originFilter === 'IMPORTED' ? 'bg-blue-600/50 text-blue-200 border border-blue-500/50' : 'text-zinc-400 hover:text-white'}`}>Importados</button>
              <button onClick={() => setOriginFilter('ORGANIC')} className={`px-3 py-1 rounded-md text-sm transition-colors ${originFilter === 'ORGANIC' ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-400 hover:text-white'}`}>Site</button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative w-full md:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
              <input
                type="text"
                placeholder="Buscar nome, CPF ou telefone..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full md:w-80 bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-white focus:border-[#D4AF37] outline-none"
              />
            </div>
            <Button onClick={() => setOnboardingModalOpen(true)} variant="secondary" className="w-full md:w-auto bg-green-900/30 text-green-400 border border-green-700 hover:bg-green-900/50" title="Cadastrar cliente antigo via WhatsApp">
              <Smartphone size={18} className="mr-2" /> Cadastrar via WhatsApp
            </Button>
            <Button onClick={() => fileInputRef.current?.click()} variant="secondary" className="w-full md:w-auto bg-blue-900/20 text-blue-500 border border-blue-900/50 hover:bg-blue-900/30">
              <Upload size={18} className="mr-2" /> Importar
            </Button>
            <input type="file" accept=".vcf" ref={fileInputRef} className="hidden" onChange={handleImportVCF} />
            <Button onClick={handleExportCSV} variant="secondary" className="w-full md:w-auto bg-zinc-900 border border-zinc-800 hover:border-[#D4AF37]">
              <Download size={18} className="mr-2" /> CSV
            </Button>
            <Button onClick={handleSyncContacts} variant="secondary" className="w-full md:w-auto bg-green-900/20 text-green-500 border border-green-900/50 hover:bg-green-900/30" title="Sincronizar Whats">
              <RotateCcw size={18} />
            </Button>
            <Button onClick={handleUndoSync} variant="secondary" className="w-full md:w-auto bg-red-900/20 text-red-500 border border-red-900/50 hover:bg-red-900/30" title="Limpar Importados">
              <Trash2 size={18} />
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-zinc-950 text-zinc-400 text-sm uppercase tracking-wider">
              <tr>
                <th className="p-4 w-10">
                  <input
                    type="checkbox"
                    checked={filteredCustomers.length > 0 && selectedIds.length === filteredCustomers.length}
                    onChange={toggleSelectAll}
                    className="rounded bg-zinc-800 border-zinc-700 text-[#D4AF37] focus:ring-[#D4AF37]"
                  />
                </th>
                <th className="p-4">Cliente</th>
                <th className="p-4">Status</th>
                <th className="p-4">Score Interno</th>
                <th className="p-4">Risco Total</th>
                <th className="p-4">Oferta Pré-Aprov.</th>
                <th className="p-4">Desde</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-zinc-500">Carregando carteira de clientes...</td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-zinc-500">Nenhum cliente encontrado.</td>
                </tr>
              ) : (
                filteredCustomers.map((cust) => (
                  <tr key={cust.id} className={`hover:bg-zinc-800/50 transition-colors group ${selectedIds.includes(cust.id) ? 'bg-zinc-800/30' : ''}`}>
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(cust.id)}
                        onChange={() => toggleSelectOne(cust.id)}
                        className="rounded bg-zinc-800 border-zinc-700 text-[#D4AF37] focus:ring-[#D4AF37]"
                      />
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-white flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-[#D4AF37] text-xs">
                          {cust.name.substring(0, 2).toUpperCase()}
                        </div>
                        {cust.name}
                      </div>
                      <div className="text-xs text-zinc-500 pl-10">{cust.cpf} • {formatPhone(cust.phone)}</div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold flex w-fit items-center gap-1 ${cust.status === 'ACTIVE' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
                        }`}>
                        {cust.status === 'ACTIVE' ? <UserCheck size={12} /> : <UserX size={12} />}
                        {cust.status === 'ACTIVE' ? 'Ativo' : 'Bloqueado'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 w-24 h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${cust.internalScore > 700 ? 'bg-green-500' : cust.internalScore > 500 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                            style={{ width: `${cust.internalScore / 10}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-mono">{cust.internalScore}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-white">R$ {(cust.totalDebt ?? 0).toLocaleString()}</div>
                    </td>
                    <td className="p-4">
                      {cust.preApprovedOffer ? (
                        <div className="flex items-center gap-1 text-[#D4AF37] font-bold text-xs bg-[#D4AF37]/10 px-2 py-1 rounded-full w-fit">
                          <Sparkles size={12} /> R$ {cust.preApprovedOffer.amount.toLocaleString()}
                        </div>
                      ) : (
                        <span className="text-zinc-600 text-xs">-</span>
                      )}
                    </td>
                    <td className="p-4 text-zinc-500 text-sm">
                      {new Date(cust.joinedAt).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        {(cust.loanRequestsCount || 0) > 0 && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => openHistoryModal(cust)}
                            title="Ver Histórico Completo"
                            className="text-amber-400 hover:text-amber-300 bg-amber-900/20 border border-amber-700/50"
                          >
                            <BarChart2 size={16} />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openRatesModal(cust)}
                          title="Configurar Taxas"
                          className={cust.customRates ? 'text-purple-400 bg-purple-900/20 border border-purple-700/50' : ''}
                        >
                          <Percent size={16} />
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openPreApproveModal(cust)}
                          title="Enviar Pré-Aprovação"
                          className="text-[#D4AF37] hover:text-[#B5942F]"
                        >
                          <DollarSign size={16} />
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openInstallmentOfferModal(cust)}
                          title="Enviar Oferta de Parcelamento"
                          className="text-emerald-400 hover:text-emerald-300 bg-emerald-900/20 border border-emerald-700/50"
                        >
                          <Calculator size={16} />
                        </Button>
                        {/* Botões de Editar/Excluir oferta se existir */}
                        {cust.installmentOffer && (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => openInstallmentOfferModal(cust, true)}
                              title="Editar Oferta"
                              className="text-blue-400 hover:text-blue-300 bg-blue-900/20 border border-blue-700/50"
                            >
                              <Edit2 size={14} />
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleDeleteOffer(cust)}
                              title="Remover Oferta"
                              className="text-red-400 hover:text-red-300 bg-red-900/20 border border-red-700/50"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openEditModal(cust)}
                          title="Editar Cliente"
                          className="text-cyan-400 hover:text-cyan-300 bg-cyan-900/20 border border-cyan-700/50"
                        >
                          <Edit2 size={14} />
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openCreateUserModal(cust)}
                          title="Criar Acesso para Cliente"
                          className="text-amber-400 hover:text-amber-300 bg-amber-900/20 border border-amber-700/50"
                        >
                          <UserPlus size={14} />
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => openMessageModal(cust)}>
                          <MessageSquare size={16} />
                        </Button>
                        <Button
                          size="sm"
                          variant={cust.status === 'ACTIVE' ? 'danger' : 'secondary'}
                          onClick={() => handleToggleStatus(cust)}
                          title={cust.status === 'ACTIVE' ? 'Bloquear Cliente' : 'Desbloquear Cliente'}
                          className={cust.status === 'ACTIVE' ? 'bg-red-900/20 text-red-500 border border-red-900/50' : 'bg-green-900/20 text-green-500 border border-green-900/50'}
                        >
                          {cust.status === 'ACTIVE' ? <ShieldAlert size={16} /> : <ShieldCheck size={16} />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Message Modal */}
      {msgModalOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6 border-b border-zinc-800 pb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <MessageSquare className="text-green-500" /> WhatsApp
              </h3>
              <button onClick={() => setMsgModalOpen(false)} className="text-zinc-500 hover:text-white"><X /></button>
            </div>

            <div className="space-y-4">
              <div className="text-sm text-zinc-400">
                Enviando para: <span className="text-white font-bold">{selectedCustomer.name}</span> ({selectedCustomer.phone})
              </div>

              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                className="w-full h-32 bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none resize-none"
                placeholder="Digite sua mensagem aqui..."
              />

              <Button onClick={handleSendMessage} isLoading={sending} className="w-full bg-green-600 hover:bg-green-700 text-white border-none shadow-lg shadow-green-900/20">
                <Send size={18} className="mr-2" /> Enviar Mensagem
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Pre-Approval Modal */}
      {preApproveOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6 border-b border-zinc-800 pb-4">
              <h3 className="text-xl font-bold text-[#D4AF37] flex items-center gap-2">
                <Sparkles size={20} /> Crédito Pré-Aprovado
              </h3>
              <button onClick={() => setPreApproveOpen(false)} className="text-zinc-500 hover:text-white"><X /></button>
            </div>

            <p className="text-zinc-400 text-sm mb-6">
              Envie uma notificação para <strong>{selectedCustomer.name}</strong> informando que ele possui um limite pré-aprovado.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-zinc-500 uppercase font-bold mb-2 block">Valor da Oferta (R$)</label>
                <input
                  type="number"
                  value={preApproveAmount}
                  onChange={(e) => setPreApproveAmount(Number(e.target.value))}
                  className="w-full bg-black border border-zinc-700 rounded-xl p-4 text-2xl font-bold text-white text-center focus:border-[#D4AF37] outline-none"
                />
              </div>

              <Button onClick={handleSendPreApproval} isLoading={sending} className="w-full bg-[#D4AF37] text-black hover:bg-[#B5942F]">
                Enviar Oferta Agora
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Rates Modal */}
      {ratesModalOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6 border-b border-zinc-800 pb-4">
              <h3 className="text-xl font-bold text-purple-400 flex items-center gap-2">
                <Percent size={20} /> Taxas Personalizadas
              </h3>
              <button onClick={() => setRatesModalOpen(false)} className="text-zinc-500 hover:text-white"><X /></button>
            </div>

            <p className="text-zinc-400 text-sm mb-4">
              Configure taxas específicas para <strong>{selectedCustomer.name}</strong> que sobrescrevem as taxas globais.
            </p>

            <div className="space-y-4">
              {/* Toggle */}
              <div className="flex items-center justify-between bg-black p-4 rounded-xl border border-zinc-800">
                <div>
                  <p className="text-white font-bold">Usar taxas personalizadas</p>
                  <p className="text-xs text-zinc-500">Se desativado, usa taxa global</p>
                </div>
                <button
                  onClick={() => setCustomRates({ ...customRates, useCustomRates: !customRates.useCustomRates })}
                  className={`w-12 h-6 rounded-full transition-colors ${customRates.useCustomRates ? 'bg-purple-500' : 'bg-zinc-700'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform ${customRates.useCustomRates ? 'translate-x-6' : 'translate-x-1'}`}></div>
                </button>
              </div>

              {customRates.useCustomRates && (
                <div className="space-y-4 animate-in slide-in-from-top-2">
                  <div>
                    <label className="text-xs text-zinc-500 uppercase font-bold mb-2 block">Taxa Mensal Empréstimo (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={customRates.monthlyInterestRate}
                      onChange={(e) => setCustomRates({ ...customRates, monthlyInterestRate: Number(e.target.value) })}
                      className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-zinc-500 uppercase font-bold mb-2 block">Multa Atraso (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={customRates.lateFixedFee}
                        onChange={(e) => setCustomRates({ ...customRates, lateFixedFee: Number(e.target.value) })}
                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500 uppercase font-bold mb-2 block">Juros/Dia (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={customRates.lateInterestDaily}
                        onChange={(e) => setCustomRates({ ...customRates, lateInterestDaily: Number(e.target.value) })}
                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-zinc-500 uppercase font-bold mb-2 block">Juros/Mês (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={customRates.lateInterestMonthly}
                      onChange={(e) => setCustomRates({ ...customRates, lateInterestMonthly: Number(e.target.value) })}
                      className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
                    />
                  </div>
                </div>
              )}

              {!customRates.useCustomRates && (
                <div className="bg-zinc-800/50 p-4 rounded-xl text-center">
                  <p className="text-zinc-400 text-sm">Este cliente usará as taxas globais configuradas no sistema.</p>
                </div>
              )}

              <Button onClick={handleSaveRates} isLoading={sending} className="w-full bg-purple-500 hover:bg-purple-600 text-white">
                Salvar Taxas
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Installment Offer Modal */}
      {installmentOfferOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-5 shadow-2xl animate-in fade-in zoom-in duration-200 my-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 border-b border-zinc-800 pb-3">
              <h3 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
                <Calculator size={18} /> {isEditingOffer ? 'Editar Oferta' : 'Nova Oferta'}
              </h3>
              <button onClick={() => setInstallmentOfferOpen(false)} className="text-zinc-500 hover:text-white"><X /></button>
            </div>

            <p className="text-zinc-400 text-sm mb-4">
              {isEditingOffer ? 'Editando oferta de' : 'Configure uma oferta para'} <strong>{selectedCustomer.name}</strong>.
            </p>

            <div className="space-y-3">
              {/* Valor */}
              <div>
                <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Valor (R$)</label>
                <input
                  type="number"
                  value={installmentOffer.amount}
                  onChange={(e) => setInstallmentOffer(prev => ({ ...prev, amount: Number(e.target.value) }))}
                  className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-lg font-bold text-white text-center focus:border-emerald-500 outline-none"
                />
              </div>

              {/* Parcelas */}
              <div>
                <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Parcelas</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[2, 3, 4, 6, 8, 10, 12, 24].map((num) => (
                    <button
                      key={num}
                      onClick={() => setInstallmentOffer(prev => ({ ...prev, installments: num }))}
                      className={`p-2 rounded-lg border text-sm font-bold transition-all ${installmentOffer.installments === num
                        ? 'border-emerald-500 bg-emerald-900/30 text-emerald-400'
                        : 'border-zinc-700 bg-black text-zinc-400 hover:border-zinc-500'
                        }`}
                    >
                      {num}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Taxa de Juros */}
              <div>
                <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Taxa Mensal (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={installmentOffer.interestRate}
                  onChange={(e) => setInstallmentOffer(prev => ({ ...prev, interestRate: Number(e.target.value) }))}
                  className="w-full bg-black border border-zinc-700 rounded-lg p-2.5 text-white focus:border-emerald-500 outline-none"
                />
              </div>

              {/* Validade */}
              <div>
                <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Válido até</label>
                <input
                  type="date"
                  value={installmentOffer.expiresAt}
                  onChange={(e) => setInstallmentOffer(prev => ({ ...prev, expiresAt: e.target.value }))}
                  className="w-full bg-black border border-zinc-700 rounded-lg p-2.5 text-white focus:border-emerald-500 outline-none"
                />
              </div>

              {/* Resumo do Cálculo */}
              <div className="bg-emerald-900/20 border border-emerald-700/50 rounded-xl p-3">
                <h4 className="text-emerald-400 font-bold text-xs uppercase flex items-center gap-2 mb-2">
                  <Calculator size={14} /> Resumo
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-zinc-500 text-xs">Valor</p>
                    <p className="text-white font-bold">R$ {installmentOffer.amount.toLocaleString('pt-BR')}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs">Taxa</p>
                    <p className="text-white font-bold">{installmentOffer.interestRate}% a.m.</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs">Total</p>
                    <p className="text-white font-bold">R$ {installmentOffer.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs">Parcela</p>
                    <p className="text-emerald-400 font-bold">
                      {installmentOffer.installments}x R$ {installmentOffer.installmentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>

              <Button onClick={handleSendInstallmentOffer} isLoading={sending} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white">
                <Send size={16} className="mr-2" /> {isEditingOffer ? 'Atualizar Oferta' : 'Enviar Oferta'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {editModalOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200 my-8">
            <div className="flex justify-between items-center mb-6 border-b border-zinc-800 pb-4">
              <h3 className="text-xl font-bold text-cyan-400 flex items-center gap-2">
                <Edit2 size={20} /> Editar Cliente
              </h3>
              <button onClick={() => setEditModalOpen(false)} className="text-zinc-500 hover:text-white"><X /></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-2">
              <div>
                <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Nome Completo</label>
                <input
                  value={editData.name}
                  onChange={(e) => setEditData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-black border border-zinc-700 rounded-lg p-2.5 text-white focus:border-cyan-500 outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">CPF</label>
                <div className="flex gap-2">
                  <input
                    value={editData.cpf}
                    onChange={(e) => setEditData(prev => ({ ...prev, cpf: e.target.value }))}
                    className="flex-1 bg-black border border-zinc-700 rounded-lg p-2.5 text-white focus:border-cyan-500 outline-none"
                    placeholder="Apenas números"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="bg-cyan-900/30 text-cyan-400 border border-cyan-700/50"
                    onClick={handleEnrichData}
                    isLoading={sending}
                    title="Buscar dados na Receita/Bureaus"
                  >
                    <Search size={18} />
                  </Button>
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Email</label>
                <input
                  type="email"
                  value={editData.email}
                  onChange={(e) => setEditData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full bg-black border border-zinc-700 rounded-lg p-2.5 text-white focus:border-cyan-500 outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Telefone</label>
                <input
                  value={editData.phone}
                  onChange={(e) => setEditData(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full bg-black border border-zinc-700 rounded-lg p-2.5 text-white focus:border-cyan-500 outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Endereço</label>
                <input
                  value={editData.address}
                  onChange={(e) => setEditData(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full bg-black border border-zinc-700 rounded-lg p-2.5 text-white focus:border-cyan-500 outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Bairro</label>
                <input
                  value={editData.neighborhood}
                  onChange={(e) => setEditData(prev => ({ ...prev, neighborhood: e.target.value }))}
                  className="w-full bg-black border border-zinc-700 rounded-lg p-2.5 text-white focus:border-cyan-500 outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Cidade</label>
                <input
                  value={editData.city}
                  onChange={(e) => setEditData(prev => ({ ...prev, city: e.target.value }))}
                  className="w-full bg-black border border-zinc-700 rounded-lg p-2.5 text-white focus:border-cyan-500 outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Estado</label>
                <input
                  value={editData.state}
                  onChange={(e) => setEditData(prev => ({ ...prev, state: e.target.value }))}
                  maxLength={2}
                  placeholder="SP"
                  className="w-full bg-black border border-zinc-700 rounded-lg p-2.5 text-white focus:border-cyan-500 outline-none uppercase"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">CEP</label>
                <input
                  value={editData.zipCode}
                  onChange={(e) => setEditData(prev => ({ ...prev, zipCode: e.target.value }))}
                  className="w-full bg-black border border-zinc-700 rounded-lg p-2.5 text-white focus:border-cyan-500 outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Renda Mensal</label>
                <input
                  type="number"
                  value={editData.monthlyIncome}
                  onChange={(e) => setEditData(prev => ({ ...prev, monthlyIncome: Number(e.target.value) }))}
                  className="w-full bg-black border border-zinc-700 rounded-lg p-2.5 text-white focus:border-cyan-500 outline-none"
                />
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-zinc-800">
              <Button onClick={handleSaveCustomer} isLoading={sending} className="w-full bg-cyan-600 hover:bg-cyan-700 text-white">
                <Save size={16} className="mr-2" /> Salvar Alterações
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {createUserModalOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6 border-b border-zinc-800 pb-4">
              <h3 className="text-xl font-bold text-amber-400 flex items-center gap-2">
                <UserPlus size={20} /> Criar Acesso
              </h3>
              <button onClick={() => setCreateUserModalOpen(false)} className="text-zinc-500 hover:text-white"><X /></button>
            </div>

            <div className="space-y-4">
              <div className="bg-zinc-800/50 rounded-xl p-4">
                <p className="text-zinc-400 text-sm mb-2">Criando acesso para:</p>
                <p className="text-white font-bold">{selectedCustomer.name}</p>
                <p className="text-zinc-500 text-sm">{selectedCustomer.email}</p>
              </div>

              <div>
                <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">
                  <Key size={12} className="inline mr-1" /> Definir Senha
                </label>
                <input
                  type="password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-amber-500 outline-none"
                />
              </div>

              <div className="bg-amber-900/20 border border-amber-700/50 rounded-xl p-3 text-sm">
                <p className="text-amber-400 font-bold mb-1">⚠️ Importante</p>
                <p className="text-zinc-400">O cliente poderá fazer login com o email cadastrado e essa senha.</p>
              </div>

              <Button onClick={handleCreateUser} isLoading={sending} className="w-full bg-amber-600 hover:bg-amber-700 text-white">
                <UserPlus size={16} className="mr-2" /> Criar Usuário
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyModalOpen && (
        <HistoryModal
          customer={historyCustomer}
          loading={historyLoading}
          onClose={() => setHistoryModalOpen(false)}
        />
      )}
      {/* ===== MODAL: ONBOARDING VIA WHATSAPP ===== */}
      {onboardingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-green-900/30 p-2 rounded-xl">
                  <Smartphone size={24} className="text-green-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Cadastrar Cliente via WhatsApp</h2>
                  <p className="text-xs text-zinc-400">O sistema irá enviar as perguntas automaticamente</p>
                </div>
              </div>
              <button onClick={() => setOnboardingModalOpen(false)} className="text-zinc-500 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 space-y-2 text-sm text-zinc-300">
              <p className="font-bold text-white">Como funciona:</p>
              <ol className="list-decimal list-inside space-y-1 text-zinc-400">
                <li>Você informa o WhatsApp do cliente</li>
                <li>O sistema envia as perguntas automaticamente</li>
                <li>Cliente responde: nome, e-mail, CPF, valor emprestado, juros, pago, devedor e vencimento</li>
                <li>Sistema cria a conta e envia a senha por e-mail</li>
                <li>Cliente acessa o sistema para acompanhar tudo</li>
              </ol>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-zinc-300">WhatsApp do Cliente (com DDD)</label>
              <input
                type="tel"
                value={onboardingPhone}
                onChange={(e) => setOnboardingPhone(e.target.value)}
                placeholder="Ex: 11999999999"
                className="w-full bg-black border border-zinc-700 rounded-xl p-4 text-white text-xl font-bold focus:border-green-500 outline-none"
                onKeyDown={(e) => e.key === 'Enter' && handleStartOnboarding()}
              />
              <p className="text-xs text-zinc-500">Apenas números com DDD. Ex: 11999999999</p>
            </div>

            <div className="flex gap-3">
              <Button onClick={() => setOnboardingModalOpen(false)} variant="secondary" className="flex-1">
                Cancelar
              </Button>
              <button
                onClick={handleStartOnboarding}
                disabled={onboardingLoading}
                className="flex-1 bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 text-white font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {onboardingLoading ? (
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <Smartphone size={18} />
                )}
                {onboardingLoading ? 'Enviando...' : 'Iniciar Cadastro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── HistoryModal ────────────────────────────────────────────────────────────
const DocViewer: React.FC<{ url: string; label: string }> = ({ url, label }) => {
  const [open, setOpen] = React.useState(false);
  const [imgError, setImgError] = React.useState(false);

  const handleOpen = (e: React.MouseEvent) => {
    e.preventDefault();
    setOpen(true);
    setImgError(false);
  };

  const handleClose = () => setOpen(false);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const overlay = open ? ReactDOM.createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.96)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onClick={handleClose}
    >
      <div
        style={{ width: '100%', maxWidth: '900px', maxHeight: '95vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <p style={{ color: '#D4AF37', fontWeight: 700, fontSize: '15px' }}>{label}</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: '12px', background: '#27272a', color: '#d4d4d8', padding: '6px 14px', borderRadius: '8px', textDecoration: 'none', border: '1px solid #3f3f46' }}
              onClick={e => e.stopPropagation()}
            >
              ↗ Abrir original
            </a>
            <button
              onClick={handleClose}
              style={{ fontSize: '12px', background: '#27272a', color: '#a1a1aa', padding: '6px 14px', borderRadius: '8px', border: '1px solid #3f3f46', cursor: 'pointer' }}
            >
              ✕ Fechar
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ background: '#18181b', borderRadius: '12px', overflow: 'hidden', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px', maxHeight: 'calc(95vh - 70px)' }}>
          {!imgError ? (
            <img
              src={url}
              alt={label}
              style={{ maxWidth: '100%', maxHeight: 'calc(95vh - 80px)', objectFit: 'contain', borderRadius: '8px' }}
              onError={() => setImgError(true)}
            />
          ) : (
            <iframe
              src={url}
              style={{ width: '100%', height: 'calc(95vh - 80px)', border: 'none', borderRadius: '8px' }}
              title={label}
            />
          )}
        </div>

        {/* ESC hint */}
        <p style={{ color: '#52525b', fontSize: '11px', textAlign: 'center', marginTop: '8px' }}>Clique fora ou pressione ESC para fechar</p>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-1 text-xs bg-zinc-800 hover:bg-[#D4AF37]/20 hover:text-[#D4AF37] border border-zinc-700 hover:border-[#D4AF37]/40 text-zinc-300 px-3 py-1.5 rounded-lg transition-colors"
      >
        <span>🔍</span> {label}
      </button>
      {overlay}
    </>
  );
};

const Field: React.FC<{ label: string; value?: string | number | null }> = ({ label, value }) => {
  if (!value && value !== 0) return null;
  return (
    <div>
      <p className="text-zinc-500 text-xs">{label}</p>
      <p className="text-white font-semibold text-sm">{value}</p>
    </div>
  );
};

const SectionCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
    <h4 className="text-white font-bold mb-3 text-sm">{title}</h4>
    {children}
  </div>
);

// ── MapPortal ────────────────────────────────────────────────────────────────
const MapPortal: React.FC<{ lat: number; lng: number; label?: string }> = ({ lat, lng, label }) => {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [open]);

  const gmUrl = `https://www.google.com/maps?q=${lat},${lng}&z=16`;
  const embedUrl = `https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed`;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs bg-blue-900/30 hover:bg-blue-800/50 border border-blue-700/40 text-blue-400 px-3 py-1.5 rounded-lg transition-colors font-semibold"
      >
        📍 Ver no Mapa
      </button>
      {open && ReactDOM.createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.96)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={() => setOpen(false)}>
          <div style={{ width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <p style={{ color: '#D4AF37', fontWeight: 700 }}>📍 {label || `${lat.toFixed(6)}, ${lng.toFixed(6)}`}</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <a href={gmUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', background: '#27272a', color: '#d4d4d8', padding: '6px 14px', borderRadius: '8px', textDecoration: 'none', border: '1px solid #3f3f46' }} onClick={e => e.stopPropagation()}>↗ Google Maps</a>
                <button onClick={() => setOpen(false)} style={{ fontSize: '12px', background: '#27272a', color: '#a1a1aa', padding: '6px 14px', borderRadius: '8px', border: '1px solid #3f3f46', cursor: 'pointer' }}>✕ Fechar</button>
              </div>
            </div>
            <div style={{ borderRadius: '12px', overflow: 'hidden', height: '500px' }}>
              <iframe src={embedUrl} width="100%" height="100%" style={{ border: 'none' }} title="Localização" loading="lazy" />
            </div>
            <p style={{ color: '#52525b', fontSize: '11px', textAlign: 'center', marginTop: '8px' }}>Pressione ESC para fechar</p>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

// ── CapivaraPanel ────────────────────────────────────────────────────────────
const CapivaraPanel: React.FC<{ cpf: string }> = ({ cpf }) => {
  const [status, setStatus] = React.useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [data, setData] = React.useState<any>(null);
  const [error, setError] = React.useState('');

  const pull = async () => {
    const clean = cpf.replace(/\D/g, '');
    if (!clean || clean.length !== 11) { setError('CPF inválido'); setStatus('error'); return; }
    // Validar se é CPF real (não começa com REG_ ou letras)
    if (cpf.includes('REG_') || /[a-zA-Z]/.test(cpf)) { setError('CPF inválido (cliente cadastrado sem CPF real)'); setStatus('error'); return; }
    setStatus('loading');
    setError('');
    try {
      const { data: resp, error: err } = await api.post<any>('/trackflow/query', { apiType: 'cpf', queryParams: { cpf: clean } }, { timeout: 90000 } as any);
      if (err || !resp?.success) { setError(err?.error || resp?.error || 'Erro na consulta'); setStatus('error'); return; }
      setData(resp.data);
      setStatus('done');
    } catch (e: any) {
      setError(e.message || 'Erro desconhecido');
      setStatus('error');
    }
  };

  const fmt = (v: any) => v ? String(v) : '—';
  const fmtPhone = (t: string) => t ? t.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3') : '';

  if (status === 'idle') return (
    <button onClick={pull} className="flex items-center gap-2 text-sm bg-gradient-to-r from-[#D4AF37]/20 to-yellow-900/20 hover:from-[#D4AF37]/40 hover:to-yellow-900/40 border border-[#D4AF37]/40 text-[#D4AF37] px-4 py-2 rounded-xl transition-all font-bold">
      🦦 Puxar Capivara (TrackFlow)
    </button>
  );

  if (status === 'loading') return (
    <div className="flex items-center gap-3 bg-zinc-950 border border-zinc-800 rounded-xl p-4">
      <div className="w-5 h-5 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
      <span className="text-zinc-400 text-sm">Consultando TrackFlow... Aguarde</span>
    </div>
  );

  if (status === 'error') return (
    <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-4 flex items-center justify-between">
      <span className="text-red-400 text-sm">❌ {error}</span>
      <button onClick={pull} className="text-xs bg-zinc-800 text-zinc-300 px-3 py-1.5 rounded-lg hover:bg-zinc-700">Tentar novamente</button>
    </div>
  );

  if (status === 'done' && data) {
    const pessoa = data?.data?.consulta || data?.consulta || {};
    const cad = pessoa?.cadastral || {};
    const enderecos: any[] = pessoa?.enderecos || [];
    const telefones: any[] = pessoa?.telefones || [];
    const emails: any[] = pessoa?.emails || [];
    const empregos: any[] = pessoa?.empregos || pessoa?.relacaoEmprego || [];
    const vinculos: any[] = pessoa?.vinculos || [];
    const dividas: any[] = pessoa?.dividas || pessoa?.restricoes || [];
    const protestos: any[] = pessoa?.protestos || [];
    const processos: any[] = pessoa?.processos || [];
    const fotos: any[] = pessoa?.fotos || [];

    const sRow = (label: string, val: any) => val ? (
      <div key={label} className="flex justify-between py-1 border-b border-zinc-800/50 text-sm">
        <span className="text-zinc-500">{label}</span>
        <span className="text-white font-semibold text-right max-w-[60%]">{fmt(val)}</span>
      </div>
    ) : null;

    return (
      <div className="space-y-4 mt-2">
        <div className="flex items-center justify-between">
          <p className="text-[#D4AF37] font-bold flex items-center gap-2">🦦 Capivara TrackFlow <span className="text-xs text-green-400 bg-green-900/30 px-2 py-0.5 rounded-full">✓ Consultado</span></p>
          <button onClick={() => setStatus('idle')} className="text-xs text-zinc-500 hover:text-white">Ocultar</button>
        </div>

        {/* Fotos */}
        {fotos.length > 0 && (
          <div className="bg-black border border-zinc-800 rounded-xl p-4">
            <p className="text-zinc-400 text-xs font-bold uppercase mb-2">📸 Fotos ({fotos.length})</p>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
              {fotos.slice(0, 10).map((f: any, i: number) => (
                <DocViewer key={i} url={f.url || f.foto || f} label={`Foto ${i + 1}`} />
              ))}
            </div>
          </div>
        )}

        {/* Cadastral */}
        <div className="bg-black border border-zinc-800 rounded-xl p-4">
          <p className="text-zinc-400 text-xs font-bold uppercase mb-2">📋 Dados Cadastrais</p>
          <div className="space-y-0.5">
            {sRow('Nome', cad.nome)}
            {sRow('CPF', cad.cpf)}
            {sRow('Data Nasc.', cad.dataNasc)}
            {sRow('Idade', cad.idade ? `${cad.idade} anos` : null)}
            {sRow('Sexo', cad.sexo === 'M' ? 'Masculino' : cad.sexo === 'F' ? 'Feminino' : cad.sexo)}
            {sRow('Naturalidade', cad.naturalidade)}
            {sRow('Mãe', cad.mae?.nome)}
            {sRow('Pai', cad.pai?.nome)}
            {sRow('Renda Est.', cad.renda)}
            {sRow('Escolaridade', cad.escolaridade)}
            {sRow('Classe Social', cad.classeSocial ? `${cad.classeSocial}${cad.subClasseSocial ? ` / ${cad.subClasseSocial}` : ''}` : null)}
            {sRow('RG', cad.rg?.numero)}
          </div>
        </div>

        {/* Endereços */}
        {enderecos.length > 0 && (
          <div className="bg-black border border-zinc-800 rounded-xl p-4">
            <p className="text-zinc-400 text-xs font-bold uppercase mb-2">🏠 Endereços ({enderecos.length})</p>
            <div className="space-y-2">
              {enderecos.slice(0, 5).map((e: any, i: number) => (
                <div key={i} className="bg-zinc-900 rounded-lg p-3 text-sm">
                  <p className="text-white font-semibold">{e.endereco}{e.numero ? `, ${e.numero}` : ''}{e.complemento ? ` — ${e.complemento}` : ''}</p>
                  <p className="text-zinc-400">{e.bairro} · {e.cidade}/{e.uf} · CEP {e.cep}</p>
                  {e.classificacao && <span className={`text-xs px-1.5 py-0.5 rounded mt-1 inline-block font-bold ${e.classificacao === 'A' ? 'bg-green-900/50 text-green-400' : 'bg-zinc-700 text-zinc-400'}`}>{e.classificacao}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Telefones */}
        {telefones.length > 0 && (
          <div className="bg-black border border-zinc-800 rounded-xl p-4">
            <p className="text-zinc-400 text-xs font-bold uppercase mb-2">📞 Telefones ({telefones.length})</p>
            <div className="grid grid-cols-2 gap-2">
              {telefones.slice(0, 10).map((t: any, i: number) => (
                <div key={i} className="bg-zinc-900 rounded-lg p-2 text-sm flex items-center gap-2">
                  {t.fotoWhatsapp && (
                    <img src={t.fotoWhatsapp} alt="WhatsApp" className="w-10 h-10 rounded-full object-cover border border-zinc-700" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  )}
                  <div className="flex-1">
                    <p className="text-white font-semibold">{fmtPhone(t.telefone || t.ddd + t.numero)}</p>
                    <p className="text-zinc-500 text-xs">{t.tipo === 3 ? 'Celular' : t.tipo === 1 ? 'Fixo' : 'Outro'}{t.classificacao ? ` · ${t.classificacao}` : ''}</p>
                  </div>
                  <a href={`https://wa.me/55${(t.telefone || t.ddd + t.numero)?.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300 text-xs">💬</a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* E-mails */}
        {emails.length > 0 && (
          <div className="bg-black border border-zinc-800 rounded-xl p-4">
            <p className="text-zinc-400 text-xs font-bold uppercase mb-2">✉️ E-mails ({emails.length})</p>
            <div className="space-y-1">
              {emails.slice(0, 6).map((e: any, i: number) => (
                <p key={i} className="text-white text-sm bg-zinc-900 rounded-lg px-3 py-2">{e.email || e}</p>
              ))}
            </div>
          </div>
        )}

        {/* Empregos */}
        {empregos.length > 0 && (
          <div className="bg-black border border-zinc-800 rounded-xl p-4">
            <p className="text-zinc-400 text-xs font-bold uppercase mb-2">💼 Empregos ({empregos.length})</p>
            <div className="space-y-2">
              {empregos.slice(0, 5).map((e: any, i: number) => (
                <div key={i} className="bg-zinc-900 rounded-lg p-3 text-sm">
                  <p className="text-white font-semibold">{e.razaoSocial || e.empresa || e.nome}</p>
                  {e.cnpj && <p className="text-zinc-400 text-xs">CNPJ: {e.cnpj}</p>}
                  {e.cargo && <p className="text-zinc-400 text-xs">Cargo: {e.cargo}</p>}
                  {e.salario && <p className="text-[#D4AF37] text-xs font-bold">Salário: R$ {Number(e.salario).toLocaleString('pt-BR')}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dívidas / Restrições */}
        {dividas.length > 0 && (
          <div className="bg-red-950/30 border border-red-800/40 rounded-xl p-4">
            <p className="text-red-400 text-xs font-bold uppercase mb-2">⚠️ Restrições / Dívidas ({dividas.length})</p>
            <div className="space-y-1">
              {dividas.slice(0, 5).map((d: any, i: number) => (
                <div key={i} className="bg-black rounded-lg p-3 text-sm">
                  <p className="text-white font-semibold">{d.credor || d.empresa || d.nome || 'Restrição'}</p>
                  {d.valor && <p className="text-red-400 font-bold">R$ {Number(d.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>}
                  {d.dataOcorrencia && <p className="text-zinc-500 text-xs">{d.dataOcorrencia}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Vínculos */}
        {vinculos.length > 0 && (
          <div className="bg-black border border-zinc-800 rounded-xl p-4">
            <p className="text-zinc-400 text-xs font-bold uppercase mb-2">🔗 Vínculos ({vinculos.length})</p>
            <div className="space-y-1">
              {vinculos.slice(0, 5).map((v: any, i: number) => (
                <div key={i} className="bg-zinc-900 rounded-lg p-2 text-sm">
                  <p className="text-white">{v.nome || v.razaoSocial}</p>
                  {v.cpf && <p className="text-zinc-500 text-xs">CPF: {v.cpf}</p>}
                  {v.tipo && <p className="text-zinc-500 text-xs">{v.tipo}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {protestos.length > 0 && (
          <div className="bg-red-950/20 border border-red-800/40 rounded-xl p-4">
            <p className="text-red-400 text-xs font-bold uppercase mb-2">🚨 Protestos ({protestos.length})</p>
            {protestos.slice(0, 3).map((p: any, i: number) => (
              <div key={i} className="bg-black rounded-lg p-2 text-sm mb-1">
                <p className="text-white">{p.cartorio || p.nome}</p>
                {p.valor && <p className="text-red-400 font-bold">R$ {Number(p.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>}
              </div>
            ))}
          </div>
        )}

        {processos.length > 0 && (
          <div className="bg-orange-950/20 border border-orange-800/40 rounded-xl p-4">
            <p className="text-orange-400 text-xs font-bold uppercase mb-2">⚖️ Processos ({processos.length})</p>
            {processos.slice(0, 3).map((p: any, i: number) => (
              <div key={i} className="bg-black rounded-lg p-2 text-sm mb-1">
                <p className="text-white">{p.numero || p.processo || 'Processo'}</p>
                {p.vara && <p className="text-zinc-400 text-xs">{p.vara}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
};

const HistoryModal: React.FC<{ customer: any; loading: boolean; onClose: () => void }> = ({ customer, loading, onClose }) => {
  const fmt = (v: number) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '-';

  const statusColor = (s: string) => {
    if (['APPROVED', 'PENDING_ACCEPTANCE', 'ACTIVE'].includes(s)) return 'bg-green-900/30 text-green-400';
    if (['REJECTED', 'CANCELLED'].includes(s)) return 'bg-red-900/30 text-red-400';
    if (s === 'PENDING') return 'bg-yellow-900/30 text-yellow-400';
    if (s === 'PAUSED') return 'bg-zinc-700 text-zinc-300';
    return 'bg-blue-900/30 text-blue-400';
  };

  const getUrl = (v: string | string[] | null | undefined) => {
    if (!v) return null;
    return Array.isArray(v) ? v[0] : v;
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-4xl shadow-2xl my-4">
        <div className="sticky top-0 bg-zinc-900 flex justify-between items-center p-6 border-b border-zinc-800 z-10 rounded-t-2xl">
          <h3 className="text-xl font-bold text-[#D4AF37] flex items-center gap-2">
            <BarChart2 size={20} /> Histórico Completo
            {customer && <span className="text-zinc-400 font-normal text-base ml-2">— {customer.name}</span>}
          </h3>
          <div className="flex items-center gap-3">
            {customer?.cpf && <CapivaraPanel cpf={customer.cpf} />}
            <button onClick={onClose} className="text-zinc-500 hover:text-white p-1"><X /></button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {loading ? (
            <div className="text-center text-zinc-500 py-16">Carregando histórico...</div>
          ) : !customer ? (
            <div className="text-center text-zinc-500 py-16">Nenhum dado encontrado.</div>
          ) : (
            <>
              {/* ── Dados Pessoais ── */}
              <SectionCard title="👤 Dados Pessoais">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <Field label="Nome" value={customer.name} />
                  <Field label="CPF" value={customer.cpf} />
                  <Field label="Telefone" value={customer.phone} />
                  <Field label="E-mail" value={customer.email} />
                  <Field label="Data de Nascimento" value={customer.birthDate} />
                  {customer.instagram && (
                    <div>
                      <p className="text-zinc-500 text-xs">Instagram</p>
                      <a
                        href={`https://instagram.com/${customer.instagram.replace(/^@/, '')}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-pink-400 hover:text-pink-300 font-semibold text-sm flex items-center gap-1"
                      >
                        📸 @{customer.instagram.replace(/^@/, '')}
                      </a>
                    </div>
                  )}
                  <Field label="Renda Mensal" value={customer.monthlyIncome ? fmt(customer.monthlyIncome) : null} />
                  <Field label="Score Interno" value={customer.internalScore} />
                  <Field label="Status" value={customer.status} />
                </div>
              </SectionCard>

              {/* ── Endereço ── */}
              {(customer.address || customer.city) && (
                <SectionCard title="🏠 Endereço">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    <Field label="Endereço" value={customer.address} />
                    <Field label="Bairro" value={customer.neighborhood} />
                    <Field label="Cidade / UF" value={customer.city ? `${customer.city}/${customer.state}` : null} />
                    <Field label="CEP" value={customer.zipCode} />
                  </div>
                </SectionCard>
              )}

              {/* ── Contratos ── */}
              {customer.loans && customer.loans.length > 0 && (
                <div>
                  <h4 className="text-white font-bold mb-3">📋 Contratos ({customer.loans.length})</h4>
                  <div className="space-y-3">
                    {customer.loans.map((loan: any) => (
                      <div key={loan.id} className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${statusColor(loan.status)}`}>{loan.status}</span>
                          <span className="text-zinc-500 text-xs">{fmtDate(loan.startDate || loan.createdAt)}</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm mb-3">
                          <Field label="Valor" value={fmt(loan.amount)} />
                          <Field label="Restante" value={fmt(loan.remainingAmount)} />
                          <Field label="Parcelas" value={loan.installments?.length} />
                          <Field label="Taxa Mensal" value={loan.monthlyRate ? `${loan.monthlyRate}%` : null} />
                        </div>
                        {loan.installments && loan.installments.length > 0 && (
                          <div>
                            <p className="text-zinc-500 text-xs mb-2">Parcelas</p>
                            <div className="space-y-1 max-h-48 overflow-y-auto">
                              {loan.installments.map((inst: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between bg-black rounded-lg p-2 text-xs">
                                  <span className="text-zinc-400">Parc. {inst.installmentNumber || idx + 1} — {fmtDate(inst.dueDate)}</span>
                                  <span className="text-white">{fmt(inst.amount)}</span>
                                  <span className={`px-2 py-0.5 rounded font-bold ${inst.status === 'PAID' ? 'bg-green-900/50 text-green-400' : inst.status === 'CANCELLED' ? 'bg-zinc-700 text-zinc-400' : 'bg-yellow-900/50 text-yellow-400'}`}>{inst.status}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Solicitações ── */}
              {customer.loanRequests && customer.loanRequests.length > 0 && (
                <div>
                  <h4 className="text-white font-bold mb-3">📝 Solicitações ({customer.loanRequests.length})</h4>
                  <div className="space-y-4">
                    {customer.loanRequests.map((req: any) => (
                      <div key={req.id} className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-4">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${statusColor(req.status)}`}>{req.status}</span>
                          <span className="text-zinc-500 text-xs">{fmtDate(req.createdAt)}</span>
                        </div>

                        {/* Dados da Solicitação */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                          <Field label="Valor Solicitado" value={fmt(req.amount)} />
                          <Field label="Valor Aprovado" value={req.approvedAmount ? fmt(req.approvedAmount) : null} />
                          <Field label="Parcelas" value={req.installments} />
                          <Field label="Tipo de Perfil" value={req.profileType} />
                          <Field label="Vencimento Preferido" value={req.preferredDueDay ? `Dia ${req.preferredDueDay}` : null} />
                          <Field label="Renda Mensal" value={req.monthlyIncome ? fmt(req.monthlyIncome) : null} />
                        </div>

                        {/* Endereço da solicitação */}
                        {(req.address || req.city) && (
                          <div>
                            <p className="text-zinc-500 text-xs mb-1 font-semibold uppercase">Endereço</p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                              <Field label="Endereço" value={req.address} />
                              <Field label="Bairro" value={req.neighborhood} />
                              <Field label="Cidade / UF" value={req.city ? `${req.city}/${req.state}` : null} />
                              <Field label="CEP" value={req.zipCode} />
                            </div>
                          </div>
                        )}

                        {/* Dados de Emprego */}
                        {(req.companyName || req.companyProfession) && (
                          <div>
                            <p className="text-zinc-500 text-xs mb-1 font-semibold uppercase">Emprego</p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                              <Field label="Empresa" value={req.companyName} />
                              <Field label="Profissão" value={req.companyProfession} />
                              <Field label="Renda na Empresa" value={req.companyIncome ? fmt(req.companyIncome) : null} />
                              <Field label="Trabalha Desde" value={req.companyWorkSince} />
                              <Field label="Dia de Pagamento" value={req.companyPaymentDay ? `Dia ${req.companyPaymentDay}` : null} />
                            </div>
                          </div>
                        )}

                        {/* Dados Bancários / PIX */}
                        {(req.pixKey || req.bankName) && (
                          <div>
                            <p className="text-zinc-500 text-xs mb-1 font-semibold uppercase">Dados Bancários / PIX</p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                              <Field label="Chave PIX" value={req.pixKey} />
                              <Field label="Tipo de Chave" value={req.pixKeyType} />
                              <Field label="Banco" value={req.bankName} />
                              <Field label="Agência" value={req.bankAgency} />
                              <Field label="Conta" value={req.bankAccount} />
                              <Field label="Tipo de Conta" value={req.bankAccountType} />
                            </div>
                          </div>
                        )}

                        {/* Contatos de Referência */}
                        {(req.fatherPhone || req.motherPhone || req.spousePhone) && (
                          <div>
                            <p className="text-zinc-500 text-xs mb-1 font-semibold uppercase">Contatos de Referência</p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                              <Field label="Pai / Responsável" value={req.fatherPhone ? `${req.fatherPhone}${req.fatherPhoneRelationship ? ` (${req.fatherPhoneRelationship})` : ''}` : null} />
                              <Field label="Mãe / Responsável" value={req.motherPhone ? `${req.motherPhone}${req.motherPhoneRelationship ? ` (${req.motherPhoneRelationship})` : ''}` : null} />
                              <Field label="Cônjuge" value={req.spousePhone ? `${req.spousePhone}${req.spousePhoneRelationship ? ` (${req.spousePhoneRelationship})` : ''}` : null} />
                            </div>
                          </div>
                        )}

                        {/* Documentos */}
                        {(req.selfieUrl || req.idCardUrl || req.idCardBackUrl || req.proofOfAddressUrl || req.proofIncomeUrl || req.workCardUrl || req.vehicleUrl || req.videoSelfieUrl || req.videoHouseUrl || req.videoVehicleUrl || req.supplementalDocUrl || req.signatureUrl) && (
                          <div>
                            <p className="text-zinc-500 text-xs mb-2 font-semibold uppercase">Documentos</p>
                            <div className="flex flex-wrap gap-2">
                              {req.selfieUrl && <DocViewer url={getUrl(req.selfieUrl)!} label="📷 Selfie" />}
                              {req.idCardUrl && <DocViewer url={getUrl(req.idCardUrl)!} label="🪪 RG/CNH Frente" />}
                              {req.idCardBackUrl && <DocViewer url={getUrl(req.idCardBackUrl)!} label="🪪 RG/CNH Verso" />}
                              {req.proofOfAddressUrl && <DocViewer url={getUrl(req.proofOfAddressUrl)!} label="🏠 Comp. Endereço" />}
                              {req.proofIncomeUrl && <DocViewer url={getUrl(req.proofIncomeUrl)!} label="💼 Comp. Renda" />}
                              {req.workCardUrl && <DocViewer url={getUrl(req.workCardUrl)!} label="📄 Carteira de Trabalho" />}
                              {req.vehicleUrl && <DocViewer url={getUrl(req.vehicleUrl)!} label="🚗 Veículo" />}
                              {req.videoSelfieUrl && <DocViewer url={getUrl(req.videoSelfieUrl)!} label="🎥 Vídeo Selfie" />}
                              {req.videoHouseUrl && <DocViewer url={getUrl(req.videoHouseUrl)!} label="🏠 Vídeo Residência" />}
                              {req.videoVehicleUrl && <DocViewer url={getUrl(req.videoVehicleUrl)!} label="🚗 Vídeo Veículo" />}
                              {req.supplementalDocUrl && <DocViewer url={getUrl(req.supplementalDocUrl)!} label="📎 Doc. Suplementar" />}
                              {req.signatureUrl && <DocViewer url={getUrl(req.signatureUrl)!} label="✍️ Assinatura" />}
                              {req.contractPdfUrl && <a href={req.contractPdfUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs bg-zinc-800 hover:bg-blue-900/30 hover:text-blue-400 border border-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg transition-colors">📑 Contrato PDF</a>}
                            </div>
                          </div>
                        )}

                        {/* Observações / Dados Extras (JSON parseado) */}
                        {req.supplementalDescription && (() => {
                          let parsed: any = null;
                          try { parsed = JSON.parse(req.supplementalDescription); } catch { /* plain text */ }

                          if (!parsed) return (
                            <div>
                              <p className="text-zinc-500 text-xs mb-1 font-semibold uppercase">Observações</p>
                              <p className="text-zinc-300 text-sm bg-black rounded-lg p-3">{req.supplementalDescription}</p>
                            </div>
                          );

                          return (
                            <div className="space-y-3">
                              <p className="text-zinc-500 text-xs font-semibold uppercase">Dados Adicionais</p>

                              {/* Endereço (do JSON) */}
                              {(parsed.address || parsed.cep) && (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                                  {parsed.address && <div className="col-span-2"><p className="text-zinc-500 text-xs">Endereço</p><p className="text-white font-semibold">{parsed.address}{parsed.number ? `, nº ${parsed.number}` : ''}</p></div>}
                                  {parsed.cep && <Field label="CEP" value={parsed.cep} />}
                                </div>
                              )}

                              {/* Endereço da empresa */}
                              {parsed.companyAddress && (
                                <div>
                                  <p className="text-zinc-500 text-xs mb-1">Endereço da Empresa</p>
                                  <p className="text-white text-sm">{parsed.companyAddress.street}, {parsed.companyAddress.number} — {parsed.companyAddress.neighborhood}, {parsed.companyAddress.city}/{parsed.companyAddress.state} — CEP {parsed.companyAddress.cep}</p>
                                </div>
                              )}

                              {/* Contatos de confiança */}
                              {(parsed.contactTrust1Name || parsed.contactTrust2Name) && (
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  {parsed.contactTrust1Name && <Field label={`Contato Confiança 1 (${parsed.contactTrust1Relationship || ''})`} value={parsed.contactTrust1Name} />}
                                  {parsed.contactTrust2Name && <Field label={`Contato Confiança 2 (${parsed.contactTrust2Relationship || ''})`} value={parsed.contactTrust2Name} />}
                                </div>
                              )}

                              {/* Outros campos */}
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                                {parsed.instagram && (
                                  <div>
                                    <p className="text-zinc-500 text-xs">Instagram</p>
                                    <a href={`https://instagram.com/${parsed.instagram.replace(/^@/, '')}`} target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:text-pink-300 font-semibold text-sm flex items-center gap-1">
                                      📸 @{parsed.instagram.replace(/^@/, '')}
                                    </a>
                                  </div>
                                )}
                                {parsed.occupation && <Field label="Ocupação" value={parsed.occupation} />}
                                {parsed.accountHolderCpf && <Field label="CPF do Titular da Conta" value={parsed.accountHolderCpf} />}
                              </div>

                              {/* Localização com mapa */}
                              {parsed.location?.latitude && parsed.location?.longitude && (
                                <div className="flex items-center gap-3">
                                  <div>
                                    <p className="text-zinc-500 text-xs">Localização GPS</p>
                                    <p className="text-zinc-300 text-sm">{parsed.location.latitude.toFixed(6)}, {parsed.location.longitude.toFixed(6)}</p>
                                  </div>
                                  <MapPortal lat={parsed.location.latitude} lng={parsed.location.longitude} label={parsed.address || 'Localização capturada'} />
                                </div>
                              )}

                              {/* Fotos da casa */}
                              {parsed.housePhotos && parsed.housePhotos.length > 0 && (
                                <div>
                                  <p className="text-zinc-500 text-xs mb-2">Fotos da Residência</p>
                                  <div className="flex flex-wrap gap-2">
                                    {parsed.housePhotos.map((url: string, i: number) => (
                                      <DocViewer key={i} url={url} label={`🏠 Foto Residência ${i + 1}`} />
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Conta de água/luz em nome */}
                              {parsed.billInName && parsed.billInName.length > 0 && (
                                <div>
                                  <p className="text-zinc-500 text-xs mb-2">Conta em Nome (água/luz)</p>
                                  <div className="flex flex-wrap gap-2">
                                    {parsed.billInName.map((url: string, i: number) => (
                                      <DocViewer key={i} url={url} label={`📄 Conta em Nome ${i + 1}`} />
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
