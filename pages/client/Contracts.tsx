import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Calendar, DollarSign, CheckCircle2, Clock, AlertCircle, QrCode, FileText, TrendingUp, X, Banknote, CreditCard, Copy, Mail, Loader2, Info } from 'lucide-react';
import { Button } from '../../components/Button';
import { PixModal } from '../../components/PixModal';
import { ReceiptModal } from '../../components/ReceiptModal';
import { apiService } from '../../services/apiService';
import { Loan, Installment, SystemSettings } from '../../types';
import { useToast } from '../../components/Toast';
import { calculateLateInterest, getDaysLate } from '../../utils/lateInterest';

interface PaymentResult {
   type: string;
   amount: number;
   description: string;
   originalAmount: number;
   remainingAmount: number;
   interestAmount: number;
   interestRate: number;
   pixKey: string;
   pixKeyType: string;
   pixReceiver: string;
   contractId: string;
}

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

   // Payment type modal
   const [isPaymentChoiceOpen, setIsPaymentChoiceOpen] = useState(false);
   const [paymentGenerating, setPaymentGenerating] = useState(false);
   const [generatedPayment, setGeneratedPayment] = useState<PaymentResult | null>(null);
   const [pixCopied, setPixCopied] = useState(false);

   useEffect(() => {
      loadContracts();
      loadSettings();
   }, []);

   const loadContracts = async () => {
      const data = await apiService.getClientLoans() as Loan[];
      setLoans(data);
      if (data.length > 0 && !selectedLoanId) setSelectedLoanId(data[0].id);
      setLoading(false);
   };

   const loadSettings = async () => {
      const data = await apiService.getSettings();
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
         description: `Pagamento de Juros`,
         id: inst.id
      });
   };

   // Gerar pagamento (juros ou total)
   const handleGeneratePayment = async (type: 'interest_only' | 'full') => {
      if (!selectedLoanId) return;
      setPaymentGenerating(true);
      try {
         const result = await apiService.generatePayment(selectedLoanId, type);
         setGeneratedPayment(result.payment);
         setIsPaymentChoiceOpen(false);
         addToast(
            type === 'interest_only'
               ? 'Cobrança de juros gerada! Verifique seu email.'
               : 'Cobrança de quitação total gerada! Verifique seu email.',
            'success'
         );
      } catch (err: any) {
         addToast(err.message || 'Erro ao gerar cobrança', 'error');
      } finally {
         setPaymentGenerating(false);
      }
   };

   const handleCopyPix = (pixKey: string) => {
      navigator.clipboard.writeText(pixKey);
      setPixCopied(true);
      addToast('Chave PIX copiada!', 'info');
      setTimeout(() => setPixCopied(false), 3000);
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
                              {selectedLoan.status === 'PAID' ? (
                                 <div className="px-3 py-1 bg-zinc-800 border border-zinc-600 text-zinc-300 rounded-full text-xs font-bold">
                                    QUITADO ✓
                                 </div>
                              ) : (
                                 <div className="px-3 py-1 bg-green-900/30 border border-green-800 text-green-400 rounded-full text-xs font-bold">
                                    ATIVO
                                 </div>
                              )}
                           </div>

                           <div className="grid grid-cols-2 gap-4 mb-6">
                              <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-900">
                                 <p className="text-zinc-500 text-xs mb-1">Restante</p>
                                 <p className="text-xl font-bold text-[#D4AF37]">R$ {selectedLoan.remainingAmount.toLocaleString()}</p>
                              </div>
                              <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-900">
                                 <p className="text-zinc-500 text-xs mb-1">Cobranças</p>
                                 <p className="text-xl font-bold text-white">{selectedLoan.installmentsCount}</p>
                              </div>
                           </div>

                           {/* ===== BOTÕES DE PAGAMENTO: só para contratos ATIVOS ===== */}
                           {selectedLoan.status !== 'PAID' && (
                              <div className="grid grid-cols-2 gap-3">
                                 <button
                                    onClick={() => setIsPaymentChoiceOpen(true)}
                                    className="flex items-center justify-center gap-2 p-3.5 bg-gradient-to-r from-amber-900/40 to-amber-800/20 border border-amber-600/50 rounded-2xl text-amber-400 font-bold text-sm hover:border-amber-400 hover:from-amber-900/60 transition-all active:scale-95"
                                 >
                                    <Banknote size={18} />
                                    <span>Pagar Juros</span>
                                 </button>
                                 <button
                                    onClick={() => {
                                       setIsPaymentChoiceOpen(false);
                                       handleGeneratePayment('full');
                                    }}
                                    className="flex items-center justify-center gap-2 p-3.5 bg-gradient-to-r from-green-900/40 to-green-800/20 border border-green-600/50 rounded-2xl text-green-400 font-bold text-sm hover:border-green-400 hover:from-green-900/60 transition-all active:scale-95"
                                 >
                                    <CreditCard size={18} />
                                    <span>Quitar Tudo</span>
                                 </button>
                              </div>
                           )}
                           {selectedLoan.status === 'PAID' && (
                              <div className="flex items-center justify-center gap-2 p-3.5 bg-zinc-950 border border-zinc-700 rounded-2xl text-zinc-400 text-sm">
                                 <CheckCircle2 size={16} className="text-green-500" />
                                 <span>Empréstimo quitado — nenhuma cobrança pendente</span>
                              </div>
                           )}
                        </div>

                        <h3 className="font-bold text-lg mb-4 pl-2 text-white">Cobranças</h3>
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

         {/* ===== MODAL: Escolha Tipo de Pagamento ===== */}
         {isPaymentChoiceOpen && selectedLoan && (
            <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
               <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-300">
                  <div className="flex justify-between items-center mb-6">
                     <h3 className="text-xl font-bold text-[#D4AF37] flex items-center gap-2">
                        <Banknote size={22} /> Tipo de Pagamento
                     </h3>
                     <button onClick={() => setIsPaymentChoiceOpen(false)} className="text-zinc-500 hover:text-white transition-colors">
                        <X size={24} />
                     </button>
                  </div>

                  <div className="bg-black/50 border border-zinc-800 rounded-2xl p-4 mb-6">
                     <div className="flex justify-between items-center mb-2">
                        <span className="text-zinc-500 text-xs uppercase">Contrato #{selectedLoan.id.slice(-4)}</span>
                        <span className={`text-xs font-bold ${selectedLoan.status === 'PAID' ? 'text-zinc-400' : 'text-green-400'}`}>
                           {selectedLoan.status === 'PAID' ? 'QUITADO' : 'ATIVO'}
                        </span>
                     </div>
                     <div className="grid grid-cols-2 gap-4 mt-3">
                        <div>
                           <p className="text-zinc-500 text-[10px] uppercase">Emprestado</p>
                           <p className="text-white font-bold">R$ {selectedLoan.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div>
                           <p className="text-zinc-500 text-[10px] uppercase">Saldo Devedor</p>
                           <p className="text-[#D4AF37] font-bold">R$ {selectedLoan.remainingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                     </div>
                  </div>

                  <p className="text-zinc-400 text-sm mb-4 flex items-center gap-2">
                     <Info size={14} className="text-[#D4AF37] shrink-0" />
                     Escolha como deseja realizar o pagamento:
                  </p>

                  <div className="space-y-3">
                     {/* Pagar Só Juros */}
                     <button
                        onClick={() => handleGeneratePayment('interest_only')}
                        disabled={paymentGenerating}
                        className="w-full text-left p-5 rounded-2xl border border-amber-600/30 bg-gradient-to-r from-amber-900/20 to-amber-900/5 hover:border-amber-400 hover:from-amber-900/40 transition-all group disabled:opacity-50"
                     >
                        <div className="flex items-center gap-3 mb-2">
                           <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                              <Banknote size={20} className="text-amber-400" />
                           </div>
                           <div>
                              <h4 className="font-bold text-white group-hover:text-amber-300 transition-colors">Pagar Somente Juros</h4>
                              <p className="text-xs text-zinc-500">Juros mensal sobre o valor emprestado</p>
                           </div>
                        </div>
                        <p className="text-xs text-zinc-400 mt-2 pl-[52px]">
                           Você quita apenas os juros do mês atual, mantendo o valor principal para o próximo ciclo.
                        </p>
                     </button>

                     {/* Quitar Tudo */}
                     <button
                        onClick={() => handleGeneratePayment('full')}
                        disabled={paymentGenerating}
                        className="w-full text-left p-5 rounded-2xl border border-green-600/30 bg-gradient-to-r from-green-900/20 to-green-900/5 hover:border-green-400 hover:from-green-900/40 transition-all group disabled:opacity-50"
                     >
                        <div className="flex items-center gap-3 mb-2">
                           <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                              <CreditCard size={20} className="text-green-400" />
                           </div>
                           <div>
                              <h4 className="font-bold text-white group-hover:text-green-300 transition-colors">Quitação Total</h4>
                              <p className="text-xs text-zinc-500">Saldo devedor + juros do mês</p>
                           </div>
                        </div>
                        <p className="text-xs text-zinc-400 mt-2 pl-[52px]">
                           Quite toda a sua dívida de uma vez: valor restante + juros proporcionais.
                        </p>
                     </button>
                  </div>

                  {paymentGenerating && (
                     <div className="flex items-center justify-center gap-2 mt-6 text-[#D4AF37]">
                        <Loader2 size={18} className="animate-spin" />
                        <span className="text-sm font-bold">Gerando cobrança...</span>
                     </div>
                  )}
               </div>
            </div>
         )}

         {/* ===== MODAL: Cobrança Gerada (PIX + Detalhes) ===== */}
         {generatedPayment && (
            <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
               <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
                  {/* Header */}
                  <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 p-5 rounded-t-3xl z-10">
                     <div className="flex justify-between items-center">
                        <h3 className="text-xl font-bold text-[#D4AF37] flex items-center gap-2">
                           {generatedPayment.type === 'interest_only' ? (
                              <><Banknote size={22} /> Pagamento de Juros</>
                           ) : (
                              <><CreditCard size={22} /> Quitação Total</>
                           )}
                        </h3>
                        <button onClick={() => setGeneratedPayment(null)} className="text-zinc-500 hover:text-white transition-colors">
                           <X size={24} />
                        </button>
                     </div>
                  </div>

                  <div className="p-5 space-y-5">
                     {/* Resumo do Valor */}
                     <div className="bg-gradient-to-br from-[#D4AF37]/10 to-transparent border border-[#D4AF37]/30 rounded-2xl p-5 text-center">
                        <p className="text-zinc-400 text-xs uppercase tracking-wider mb-2">Valor a Pagar</p>
                        <p className="text-4xl font-extrabold text-[#D4AF37] mb-1">
                           R$ {generatedPayment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-zinc-500">{generatedPayment.description}</p>
                     </div>

                     {/* Detalhamento */}
                     <div className="bg-black/50 border border-zinc-800 rounded-2xl p-4 space-y-3">
                        <div className="flex justify-between text-sm">
                           <span className="text-zinc-500">Contrato</span>
                           <span className="text-white font-bold">#{generatedPayment.contractId}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                           <span className="text-zinc-500">Valor Emprestado</span>
                           <span className="text-white">R$ {generatedPayment.originalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                           <span className="text-zinc-500">Saldo Devedor</span>
                           <span className="text-white">R$ {generatedPayment.remainingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="border-t border-zinc-800 pt-3 flex justify-between text-sm">
                           <span className="text-zinc-500">Juros ({generatedPayment.interestRate}% a.m.)</span>
                           <span className="text-amber-400 font-bold">R$ {generatedPayment.interestAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        {generatedPayment.type === 'full' && (
                           <div className="border-t border-zinc-800 pt-3 flex justify-between text-sm">
                              <span className="text-zinc-500 font-bold">Total (Saldo + Juros)</span>
                              <span className="text-green-400 font-bold">R$ {generatedPayment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                           </div>
                        )}
                     </div>

                     {/* PIX Box */}
                     <div className="bg-gradient-to-br from-[#1a1a00] to-black border-2 border-[#D4AF37]/50 rounded-2xl p-5">
                        <div className="text-center mb-4">
                           <div className="inline-flex items-center gap-2 bg-[#D4AF37]/20 px-3 py-1 rounded-full mb-3">
                              <QrCode size={14} className="text-[#D4AF37]" />
                              <span className="text-xs font-bold text-[#D4AF37] uppercase tracking-wide">Pague via PIX</span>
                           </div>
                           <p className="text-zinc-400 text-xs">Copie a chave e faça o pagamento</p>
                        </div>

                        <div className="bg-black/50 rounded-xl p-4 mb-4">
                           <p className="text-zinc-500 text-[10px] uppercase mb-1">Chave PIX ({generatedPayment.pixKeyType})</p>
                           <p className="text-white font-bold text-lg break-all">{generatedPayment.pixKey}</p>
                           <p className="text-zinc-500 text-xs mt-1">{generatedPayment.pixReceiver}</p>
                        </div>

                        <button
                           onClick={() => handleCopyPix(generatedPayment.pixKey)}
                           className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all active:scale-95 ${pixCopied
                              ? 'bg-green-600 text-white'
                              : 'bg-[#D4AF37] hover:bg-[#FDB931] text-black'
                              }`}
                        >
                           {pixCopied ? (
                              <><CheckCircle2 size={18} /> Copiado!</>
                           ) : (
                              <><Copy size={18} /> Copiar Chave PIX</>
                           )}
                        </button>
                     </div>

                     {/* Email Sent Info */}
                     <div className="flex items-center gap-3 bg-blue-900/20 border border-blue-800/40 rounded-xl p-3">
                        <Mail size={18} className="text-blue-400 shrink-0" />
                        <p className="text-xs text-zinc-400">
                           Os detalhes desta cobrança foram enviados para seu <strong className="text-white">email cadastrado</strong>. Após o pagamento, envie o comprovante pelo app.
                        </p>
                     </div>

                     <Button onClick={() => setGeneratedPayment(null)} variant="secondary" className="w-full">
                        Fechar
                     </Button>
                  </div>
               </div>
            </div>
         )}
      </div>
   );
};