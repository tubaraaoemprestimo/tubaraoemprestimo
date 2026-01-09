import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ArrowUpRight, ArrowDownLeft, FileText, Download } from 'lucide-react';
import { supabaseService } from '../../services/supabaseService';
import { Transaction } from '../../types';
import { Skeleton } from '../../components/Skeleton';
import { Button } from '../../components/Button';

export const Statement: React.FC = () => {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabaseService.getTransactions().then(data => {
      setTransactions(data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="min-h-screen bg-black text-white p-6 pb-24 font-sans">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center justify-between mb-8">
           <div className="flex items-center gap-4">
               <button onClick={() => navigate('/client/dashboard')} className="p-2 hover:bg-zinc-900 rounded-full text-zinc-400 hover:text-white transition-colors">
                  <ChevronLeft size={24} />
               </button>
               <h1 className="text-2xl font-bold text-[#D4AF37]">Extrato</h1>
           </div>
           <Button size="sm" variant="secondary" className="h-10 w-10 p-0 rounded-full bg-zinc-900 border-zinc-800">
             <Download size={18} />
           </Button>
        </div>

        <div className="space-y-4 animate-in slide-in-from-bottom-4">
          {loading ? (
             <>
               <Skeleton className="h-20 w-full" />
               <Skeleton className="h-20 w-full" />
               <Skeleton className="h-20 w-full" />
             </>
          ) : transactions.length === 0 ? (
             <div className="text-center py-12 text-zinc-500">
               <FileText size={48} className="mx-auto mb-4 opacity-50" />
               <p>Nenhuma movimentação encontrada.</p>
             </div>
          ) : (
             transactions.map((tx) => (
                <div key={tx.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between hover:border-[#D4AF37]/30 transition-colors">
                   <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center border ${
                        tx.type === 'IN' 
                           ? 'bg-green-900/20 border-green-800 text-green-500' 
                           : 'bg-red-900/20 border-red-800 text-red-500'
                      }`}>
                         {tx.type === 'IN' ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                      </div>
                      <div>
                         <p className="font-bold text-white text-sm">{tx.description}</p>
                         <p className="text-xs text-zinc-500">{new Date(tx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                   </div>
                   <div className={`font-mono font-bold ${tx.type === 'IN' ? 'text-green-500' : 'text-white'}`}>
                      {tx.type === 'IN' ? '+' : '-'} R$ {tx.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                   </div>
                </div>
             ))
          )}
        </div>
      </div>
    </div>
  );
};