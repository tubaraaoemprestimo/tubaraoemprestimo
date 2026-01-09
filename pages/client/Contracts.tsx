import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Calendar, DollarSign, CheckCircle2, Clock, AlertCircle, QrCode, FileText } from 'lucide-react';
import { Button } from '../../components/Button';
import { PixModal } from '../../components/PixModal';
import { ReceiptModal } from '../../components/ReceiptModal'; // Import Receipt
import { supabaseService } from '../../services/supabaseService';
import { Loan, Installment } from '../../types';
import { useToast } from '../../components/Toast';

export const Contracts: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  
  // Modals
  const [paymentModalData, setPaymentModalData] = useState<{amount: number, pixCode: string, installmentId: string} | null>(null);
  const [receiptData, setReceiptData] = useState<{amount: number, date: string, description: string, id: string} | null>(null);

  useEffect(() => {
    loadContracts();
  }, []);

  const loadContracts = async () => {
    const data = await supabaseService.getClientLoans();
    setLoans(data);
    if(data.length > 0 && !selectedLoanId) setSelectedLoanId(data[0].id);
    setLoading(false);
  };

  const handlePay = (inst: Installment) => {
     setPaymentModalData({
        amount: inst.amount,
        pixCode: inst.pixCode || `00020126330014BR.GOV.BCB.PIX0114+5511999999999520400005303986540${inst.amount}5802BR5913Tubarao Loans6008Sao Paulo62070503***6304`,
        installmentId: inst.id
     });
  };

  const handleUploadProof = async (fileStr: string) => {
      if (!selectedLoanId || !paymentModalData) return;
      
      const success = await supabaseService.uploadPaymentProof(selectedLoanId, paymentModalData.installmentId, fileStr);
      if (success) {
          addToast("Comprovante enviado com sucesso! Parcela quitada.", 'success');
          // Reload to reflect changes
          setLoading(true);
          const data = await supabaseService.getClientLoans();
          setLoans(data);
          setLoading(false);
      } else {
          addToast("Erro ao enviar comprovante.", 'error');
      }
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
                         <div key={inst.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex items-center justify-between group hover:border-[#D4AF37]/30 transition-colors">
                            <div className="flex items-center gap-4">
                               <div className="w-10 h-10 rounded-full bg-black border border-zinc-800 flex items-center justify-center font-bold text-zinc-500 text-sm">
                                  {idx + 1}
                               </div>
                               <div>
                                  <div className="font-bold text-white">R$ {inst.amount.toLocaleString()}</div>
                                  <div className="text-xs text-zinc-500 flex items-center gap-1">
                                     <Calendar size={12}/> {new Date(inst.dueDate).toLocaleDateString()}
                                  </div>
                               </div>
                            </div>
                            
                            <div>
                               {inst.status === 'PAID' ? (
                                  <div className="flex flex-col items-end gap-2">
                                     <span className="text-green-500 flex items-center gap-1 text-sm font-bold"><CheckCircle2 size={16}/> Pago</span>
                                     <button onClick={() => handleViewReceipt(inst)} className="text-[#D4AF37] text-xs underline hover:text-white flex items-center gap-1">
                                        <FileText size={10} /> Comprovante
                                     </button>
                                  </div>
                               ) : inst.status === 'LATE' ? (
                                  <div className="flex flex-col items-end gap-2">
                                     <span className="text-red-500 flex items-center gap-1 text-xs font-bold"><AlertCircle size={14}/> Atrasado</span>
                                     <Button size="sm" variant="danger" onClick={() => handlePay(inst)} className="h-8 text-xs">
                                        Pagar
                                     </Button>
                                  </div>
                               ) : (
                                  <div className="flex flex-col items-end gap-2">
                                     <span className="text-yellow-500 flex items-center gap-1 text-xs font-bold"><Clock size={14}/> Aberto</span>
                                     <Button size="sm" variant="primary" onClick={() => handlePay(inst)} className="h-8 text-xs bg-shark">
                                        <QrCode size={14} className="mr-1"/> Pagar
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
            pixCode={paymentModalData.pixCode} 
            onClose={() => setPaymentModalData(null)}
            onUploadProof={handleUploadProof}
         />
      )}

      {/* Receipt Modal */}
      {receiptData && (
          <ReceiptModal data={receiptData} onClose={() => setReceiptData(null)} />
      )}
    </div>
  );
};