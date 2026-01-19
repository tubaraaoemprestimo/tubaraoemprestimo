

import React, { useState, useEffect } from 'react';
import { Search, UserCheck, UserX, BarChart2, MessageSquare, Send, X, Download, ShieldAlert, ShieldCheck, Sparkles, DollarSign, Percent, Settings, Calendar, RotateCcw, Calculator, Edit2, Trash2, Gift } from 'lucide-react';
import { supabaseService } from '../../services/supabaseService';
import { whatsappService } from '../../services/whatsappService';
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

  useEffect(() => {
    loadCustomers();
    loadGlobalSettings();
  }, []);

  const loadCustomers = async () => {
    setLoading(true);
    const data = await supabaseService.getCustomers();
    setCustomers(data);
    setLoading(false);
  };

  const loadGlobalSettings = async () => {
    const settings = await supabaseService.getSettings();
    setGlobalSettings(settings);
  };

  const handleToggleStatus = async (cust: Customer) => {
    const newStatus = cust.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE';
    const action = newStatus === 'ACTIVE' ? 'desbloquear' : 'bloquear';

    if (confirm(`Tem certeza que deseja ${action} o cliente ${cust.name}?`)) {
      await supabaseService.toggleCustomerStatus(cust.id, newStatus);
      addToast(`Cliente ${newStatus === 'ACTIVE' ? 'desbloqueado' : 'bloqueado'} com sucesso.`, 'info');
      loadCustomers();
    }
  };

  const openMessageModal = (cust: Customer) => {
    setSelectedCustomer(cust);
    setMessageText(`Olá ${cust.name.split(' ')[0]}, `);
    setMsgModalOpen(true);
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

    await supabaseService.updateCustomerRates(selectedCustomer.id, ratesToSave);

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

    await supabaseService.deleteInstallmentOffer(cust.id);
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
      await supabaseService.sendInstallmentOffer(selectedCustomer.id, {
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
    await supabaseService.sendPreApproval(selectedCustomer.id, preApproveAmount);

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

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(filter.toLowerCase()) ||
    c.cpf.includes(filter) ||
    c.email.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 bg-black min-h-screen text-white">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <h1 className="text-3xl font-bold text-[#D4AF37]">Gestão de Clientes</h1>
        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
          <div className="relative w-full md:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
            <input
              type="text"
              placeholder="Buscar por nome ou CPF..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full md:w-80 bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-white focus:border-[#D4AF37] outline-none"
            />
          </div>
          <Button onClick={handleExportCSV} variant="secondary" className="w-full md:w-auto bg-zinc-900 border border-zinc-800 hover:border-[#D4AF37]">
            <Download size={18} className="mr-2" /> Exportar CSV
          </Button>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-zinc-950 text-zinc-400 text-sm uppercase tracking-wider">
              <tr>
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
                  <tr key={cust.id} className="hover:bg-zinc-800/50 transition-colors group">
                    <td className="p-4">
                      <div className="font-bold text-white flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-[#D4AF37] text-xs">
                          {cust.name.substring(0, 2).toUpperCase()}
                        </div>
                        {cust.name}
                      </div>
                      <div className="text-xs text-zinc-500 pl-10">{cust.cpf} • {cust.phone}</div>
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
    </div>
  );
};
