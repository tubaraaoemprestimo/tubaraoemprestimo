

import React, { useState, useEffect, useRef } from 'react';
import { Search, UserCheck, UserX, BarChart2, MessageSquare, Send, X, Download, ShieldAlert, ShieldCheck, Sparkles, DollarSign, Percent, Settings, Calendar, RotateCcw, Calculator, Edit2, Trash2, Gift, Upload, UserPlus, Save, Key } from 'lucide-react';
import { apiService } from '../../services/apiService';
import { whatsappService } from '../../services/whatsappService';
import { dataEnrichmentService } from '../../services/dataEnrichmentService';
import { Customer, SystemSettings } from '../../types';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Toast';

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
  const [clientTypeFilter, setClientTypeFilter] = useState<'ALL' | 'LEADS' | 'ACTIVE_CLIENTS' | 'INACTIVE_CLIENTS'>('ALL');

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

    const isLead = (c.activeLoansCount || 0) === 0 && (c.totalDebt || 0) === 0;
    const isActiveClient = (c.activeLoansCount || 0) > 0;
    const isInactiveClient = (c.activeLoansCount || 0) === 0 && (c.totalDebt || 0) > 0;
    const matchesClientType = clientTypeFilter === 'ALL' ||
      (clientTypeFilter === 'LEADS' && isLead) ||
      (clientTypeFilter === 'ACTIVE_CLIENTS' && isActiveClient) ||
      (clientTypeFilter === 'INACTIVE_CLIENTS' && isInactiveClient);

    return matchesText && matchesStatus && matchesOrigin && matchesClientType;
  });

  const leadsCount = customers.filter(c => (c.activeLoansCount || 0) === 0 && (c.totalDebt || 0) === 0).length;
  const activeClientsCount = customers.filter(c => (c.activeLoansCount || 0) > 0).length;
  const inactiveClientsCount = customers.filter(c => (c.activeLoansCount || 0) === 0 && (c.totalDebt || 0) > 0).length;

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
              <button onClick={() => setClientTypeFilter('LEADS')} className={`px-3 py-1 rounded-md text-sm transition-colors ${clientTypeFilter === 'LEADS' ? 'bg-blue-600 text-white font-bold' : 'text-zinc-400 hover:text-white'}`}>
                Leads <span className="text-xs opacity-70">({leadsCount})</span>
              </button>
              <button onClick={() => setClientTypeFilter('ACTIVE_CLIENTS')} className={`px-3 py-1 rounded-md text-sm transition-colors ${clientTypeFilter === 'ACTIVE_CLIENTS' ? 'bg-green-600 text-white font-bold' : 'text-zinc-400 hover:text-white'}`}>
                Clientes Ativos <span className="text-xs opacity-70">({activeClientsCount})</span>
              </button>
              <button onClick={() => setClientTypeFilter('INACTIVE_CLIENTS')} className={`px-3 py-1 rounded-md text-sm transition-colors ${clientTypeFilter === 'INACTIVE_CLIENTS' ? 'bg-zinc-600 text-white font-bold' : 'text-zinc-400 hover:text-white'}`}>
                Quitados <span className="text-xs opacity-70">({inactiveClientsCount})</span>
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
                      <div className="font-bold text-white">R$ {cust.totalDebt.toLocaleString()}</div>
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
    </div>
  );
};
