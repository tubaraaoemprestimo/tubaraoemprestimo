import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Calendar, DollarSign, CheckCircle2, Clock, AlertCircle, QrCode, FileText, TrendingUp } from 'lucide-react';
import { Button } from '../../components/Button';
import { PixModal } from '../../components/PixModal';
import { ReceiptModal } from '../../components/ReceiptModal';
import { supabaseService } from '../../services/supabaseService';
import { Loan, Installment, SystemSettings } from '../../types';
import { useToast } from '../../components/Toast';
import { calculateLateInterest, getDaysLate } from '../../utils/lateInterest';

export const Contracts: React.FC = () => {
   const navigate = useNavigate();
   const { addToast } = useToast();
   const [loans, setLoans] = useState<Loan[]>([]);
   const [loading, setLoading] = useState(true);
   const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
   const [settings, setSettings] = useState<SystemSettings | null>(null);

   // Modals
   const [paymentModalData, setPaymentModalData] = useState<{ amount: number, installmentId: string, loanId: string } | null>(null);
   const [receiptData, setReceiptData] = useState<{ amount: number, date: string, description: string, id: string } | null>(null);

   useEffect(() => {
      loadContracts();
      loadSettings();
   }, []);

   const loadContracts = async () => {
      const data = await supabaseService.getClientLoans();
      setLoans(data);
      if (data.length > 0 && !selectedLoanId) setSelectedLoanId(data[0].id);
      setLoading(false);
   };

   const loadSettings = async () => {
      const data = await supabaseService.getSettings();
      setSettings(data);
   };

   // Calcula valor com juros de atraso
   const getInstallmentAmount = (inst: Installment) => {
      if (inst.status !== 'LATE' || !settings) return inst.amount;
      const result = calculateLateInterest(inst.amount, inst.dueDate, settings);
      return result.totalAmount;
   };

   const handlePay = (inst: Installment) => {
      if (!selectedLoanId) return;
      const amountToPay = getInstallmentAmount(inst);
      setPaymentModalData({
         amount: amountToPay,
         installmentId: inst.id,
         loanId: selectedLoanId
      });
   };

   const handlePaymentSubmitted = async () => {
      addToast("Comprovante enviado! Aguarde confirmação do administrador.", 'success');
      // Reload to reflect changes
      setLoading(true);
      await loadContracts();
      setLoading(false);
   };

   const handleViewReceipt = (inst: Installment) => {
      setReceiptData({
         amount: inst.amount,
         date: inst.paidAt || new Date().toISOString(),
         description: `Pagamento Parcela`,
         id: inst.id
      });
   };

   const selectedLoan = loans.find(l => l.id === selectedLoanId);

   return (
      <div className="min-h-screen bg-black text-white p-6 pb-24">
         <div className="max-w-xl mx-auto">
            <div className="flex items-center gap-4 mb-8">
               <button onClick={() => navigate('/client/dashboard')} className="p-2 hover:bg-zinc-900 rounded-full text-zinc-400 hover:text-white transition-colors">
                  <ChevronLeft size={24} />
               </button>
               <h1 className="text-2xl font-bold text-[#D4AF37]">Meus Contratos</h1>
            </div>

            {loading ? (
               <div className="text-center text-zinc-500 py-12">Carregando carteira...</div>
            ) : loans.length === 0 ? (
               <div className="text-center py-12 bg-zinc-900 border border-zinc-800 rounded-2xl">
                  <p className="text-zinc-400 mb-4">Você não possui empréstimos ativos.</p>
                  <Button onClick={() => navigate('/wizard')}>Simular Agora</Button>
               </div>
            ) : (
               <div className="space-y-6">
                  {/* Loan Selector (if multiple) */}
                  {loans.length > 1 && (
                     <div className="flex gap-2 overflow-x-auto pb-2">
                        {loans.map(loan => (
                           <button
                              key={loan.id}
                              onClick={() => setSelectedLoanId(loan.id)}
                              className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${selectedLoanId === loan.id ? 'bg-[#D4AF37] text-black' : 'bg-zinc-900 text-zinc-500 hover:text-white'}`}
                           >
                              Contrato #{loan.id.slice(-4)}
                           </button>
                        ))}
                     </div>
                  )}

                  {/* Selected Loan Details */}
                  {selectedLoan && (
                     <div className="animate-in fade-in slide-in-from-bottom-4">
                        <div className="bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 rounded-3xl p-6 mb-6 shadow-2xl">
                           <div className="flex justify-between items-start mb-6">
                              <div>
                                 <p className="text-zinc-500 text-xs uppercase tracking-widest mb-1">Valor Total</p>
                                 <h2 className="text-3xl font-bold text-white">R$ {selectedLoan.amount.toLocaleString()}</h2>
                              </div>
                              <div className="px-3 py-1 bg-green-900/30 border border-green-800 text-green-400 rounded-full text-xs font-bold">
                                 ATIVO
                              </div>
                           </div>

                           <div className="grid grid-cols-2 gap-4">
                              <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-900">
                                 <p className="text-zinc-500 text-xs mb-1">Restante</p>
                                 <p className="text-xl font-bold text-[#D4AF37]">R$ {selectedLoan.remainingAmount.toLocaleString()}</p>
                              </div>
                              <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-900">
                                 <p className="text-zinc-500 text-xs mb-1">Parcelas</p>
                                 <p className="text-xl font-bold text-white">{selectedLoan.installmentsCount}</p>
                              </div>
                           </div>
                        </div>

                        <h3 className="font-bold text-lg mb-4 pl-2 text-white">Parcelas</h3>
                        <div className="space-y-3">
                           {selectedLoan.installments.map((inst, idx) => (
                              <div key={inst.id} className={`bg-zinc-900 border rounded-2xl p-5 flex items-center justify-between group hover:border-[#D4AF37]/30 transition-colors ${inst.status === 'LATE' ? 'border-red-800/50' : 'border-zinc-800'}`}>
                                 <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full border flex items-center justify-center font-bold text-sm ${inst.status === 'LATE' ? 'bg-red-900/20 border-red-800 text-red-400' : 'bg-black border-zinc-800 text-zinc-500'}`}>
                                       {idx + 1}
                                    </div>
                                    <div>
                                       {inst.status === 'LATE' && settings ? (
                                          <>
                                             <div className="font-bold text-red-400">
                                                R$ {getInstallmentAmount(inst).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                             </div>
                                             <div className="text-xs text-zinc-500 line-through">
                                                R$ {inst.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                             </div>
                                             <div className="text-xs text-red-400 flex items-center gap-1 mt-1">
                                                <TrendingUp size={10} /> +{getDaysLate(inst.dueDate)} dias de juros
                                             </div>
                                          </>
                                       ) : (
                                          <div className="font-bold text-white">
                                             R$ {inst.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                          </div>
                                       )}
                                       <div className="text-xs text-zinc-500 flex items-center gap-1">
                                          <Calendar size={12} /> {new Date(inst.dueDate).toLocaleDateString()}
                                       </div>
                                    </div>
                                 </div>

                                 <div>
                                    {inst.status === 'PAID' ? (
                                       <div className="flex flex-col items-end gap-2">
                                          <span className="text-green-500 flex items-center gap-1 text-sm font-bold"><CheckCircle2 size={16} /> Pago</span>
                                          <button onClick={() => handleViewReceipt(inst)} className="text-[#D4AF37] text-xs underline hover:text-white flex items-center gap-1">
                                             <FileText size={10} /> Comprovante
                                          </button>
                                       </div>
                                    ) : inst.status === 'LATE' ? (
                                       <div className="flex flex-col items-end gap-2">
                                          <span className="text-red-500 flex items-center gap-1 text-xs font-bold"><AlertCircle size={14} /> Atrasado</span>
                                          <Button size="sm" variant="danger" onClick={() => handlePay(inst)} className="h-8 text-xs">
                                             Pagar R$ {getInstallmentAmount(inst).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                          </Button>
                                       </div>
                                    ) : (
                                       <div className="flex flex-col items-end gap-2">
                                          <span className="text-yellow-500 flex items-center gap-1 text-xs font-bold"><Clock size={14} /> Aberto</span>
                                          <Button size="sm" variant="primary" onClick={() => handlePay(inst)} className="h-8 text-xs bg-shark">
                                             <QrCode size={14} className="mr-1" /> Pagar
                                          </Button>
                                       </div>
                                    )}
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>
                  )}
               </div>
            )}
         </div>

         {/* Payment Modal */}
         {paymentModalData && (
            <PixModal
               amount={paymentModalData.amount}
               installmentId={paymentModalData.installmentId}
               loanId={paymentModalData.loanId}
               onClose={() => setPaymentModalData(null)}
               onPaymentSubmitted={handlePaymentSubmitted}
            />
         )}

         {/* Receipt Modal */}
         {receiptData && (
            <ReceiptModal data={receiptData} onClose={() => setReceiptData(null)} />
         )}
      </div>
   );
};