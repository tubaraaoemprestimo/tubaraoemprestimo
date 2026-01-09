

import React, { useState, useEffect } from 'react';
import { Search, UserCheck, UserX, BarChart2, MessageSquare, Send, X, Download, ShieldAlert, ShieldCheck, Sparkles, DollarSign } from 'lucide-react';
import { supabaseService } from '../../services/supabaseService';
import { whatsappService } from '../../services/whatsappService';
import { Customer } from '../../types';
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

  // Pre-approval Modal State
  const [preApproveOpen, setPreApproveOpen] = useState(false);
  const [preApproveAmount, setPreApproveAmount] = useState(500);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setLoading(true);
    const data = await supabaseService.getCustomers();
    setCustomers(data);
    setLoading(false);
  };

  const handleToggleStatus = async (cust: Customer) => {
      const newStatus = cust.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE';
      const action = newStatus === 'ACTIVE' ? 'desbloquear' : 'bloquear';
      
      if(confirm(`Tem certeza que deseja ${action} o cliente ${cust.name}?`)) {
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
                <Download size={18} className="mr-2"/> Exportar CSV
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
                          {cust.name.substring(0,2).toUpperCase()}
                        </div>
                        {cust.name}
                      </div>
                      <div className="text-xs text-zinc-500 pl-10">{cust.cpf} • {cust.phone}</div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold flex w-fit items-center gap-1 ${
                        cust.status === 'ACTIVE' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
                      }`}>
                        {cust.status === 'ACTIVE' ? <UserCheck size={12}/> : <UserX size={12}/>}
                        {cust.status === 'ACTIVE' ? 'Ativo' : 'Bloqueado'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 w-24 h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              cust.internalScore > 700 ? 'bg-green-500' : cust.internalScore > 500 ? 'bg-yellow-500' : 'bg-red-500'
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
                              onClick={() => openPreApproveModal(cust)} 
                              title="Enviar Pré-Aprovação"
                              className="text-[#D4AF37] hover:text-[#B5942F]"
                           >
                              <DollarSign size={16} />
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
    </div>
  );
};
