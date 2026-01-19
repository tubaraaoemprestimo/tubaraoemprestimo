import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calculator, ShieldCheck, Zap, ArrowRight, DollarSign } from 'lucide-react';
import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';
import { supabaseService } from '../../services/supabaseService';
import { LoanPackage } from '../../types';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const [amount, setAmount] = useState<number>(5000);
  const [installments, setInstallments] = useState<number>(12);
  const [packages, setPackages] = useState<LoanPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<LoanPackage | null>(null);

  useEffect(() => {
    supabaseService.getPackages().then(pkgs => {
      setPackages(pkgs);
      if (pkgs.length > 0) setSelectedPackage(pkgs[0]);
    });
  }, []);

  const calculateMonthly = () => {
    if (!selectedPackage) return 0;
    const rate = selectedPackage.interestRate / 100;
    const total = amount * Math.pow(1 + rate, installments);
    return total / installments;
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0,rgba(212,175,55,0.15),transparent_70%)]"></div>
        
        <div className="container mx-auto px-4 pt-20 pb-12 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-16 flex flex-col items-center">
            
            <div className="mb-8 scale-110">
                <Logo size="lg" />
            </div>

            <h1 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight">
              Crédito <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] to-[#FFF]">Premium</span> para seus Sonhos
            </h1>
            <p className="text-xl text-zinc-400 mb-8">
              Aprovação rápida, taxas competitivas e a segurança que você merece.
            </p>
            <Button onClick={() => document.getElementById('simulator')?.scrollIntoView({ behavior: 'smooth'})}>
              Simular Agora <ArrowRight size={20} />
            </Button>
          </div>

          {/* Simulator Card */}
          <div id="simulator" className="max-w-4xl mx-auto bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-3xl p-8 shadow-2xl shadow-[#D4AF37]/5">
            <div className="grid md:grid-cols-2 gap-12">
              <div className="space-y-8">
                <div>
                  <label className="block text-[#D4AF37] mb-2 font-semibold">Quanto você precisa?</label>
                  <div className="text-4xl font-bold mb-4">R$ {amount.toLocaleString('pt-BR')}</div>
                  <input 
                    type="range" 
                    min="500" 
                    max="50000" 
                    step="500" 
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-[#D4AF37]"
                  />
                  <div className="flex justify-between text-xs text-zinc-500 mt-2">
                    <span>R$ 500</span>
                    <span>R$ 50.000</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[#D4AF37] mb-2 font-semibold">Em quantas vezes?</label>
                  <div className="text-4xl font-bold mb-4">{installments}x</div>
                  <input 
                    type="range" 
                    min="3" 
                    max="48" 
                    step="1" 
                    value={installments}
                    onChange={(e) => setInstallments(Number(e.target.value))}
                    className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-[#D4AF37]"
                  />
                  <div className="flex justify-between text-xs text-zinc-500 mt-2">
                    <span>3x</span>
                    <span>48x</span>
                  </div>
                </div>
              </div>

              <div className="bg-black/50 rounded-2xl p-6 border border-zinc-800 flex flex-col justify-between">
                <div>
                  <h3 className="text-zinc-400 text-sm uppercase tracking-wider mb-4">Resumo da Simulação</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-zinc-300">Pacote Sugerido</span>
                      <span className="text-[#D4AF37] font-medium">{selectedPackage?.name || 'Calculando...'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-300">Taxa Mensal</span>
                      <span className="text-white font-medium">{selectedPackage?.interestRate}% a.m.</span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-8 border-t border-zinc-800">
                  <div className="text-zinc-400 text-sm mb-1">Parcela Estimada</div>
                  <div className="text-4xl font-bold text-white mb-6">
                    R$ {calculateMonthly().toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <Button className="w-full" onClick={() => navigate('/wizard')}>
                    Solicitar Empréstimo
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="container mx-auto px-4 py-20">
        <div className="grid md:grid-cols-3 gap-8">
          <FeatureCard 
            icon={<Zap className="text-[#D4AF37]" size={32} />}
            title="Aprovação Relâmpago"
            desc="Nossa IA analisa seu perfil em segundos para liberar seu crédito."
          />
          <FeatureCard 
            icon={<ShieldCheck className="text-[#D4AF37]" size={32} />}
            title="Segurança Total"
            desc="Seus dados protegidos com criptografia de ponta a ponta e conformidade LGPD."
          />
          <FeatureCard 
            icon={<DollarSign className="text-[#D4AF37]" size={32} />}
            title="Taxas Justas"
            desc="Condições personalizadas baseadas no seu perfil e garantias oferecidas."
          />
        </div>
      </div>
    </div>
  );
};

const FeatureCard = ({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) => (
  <div className="p-8 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-[#D4AF37]/50 transition-all duration-300 group">
    <div className="mb-4 p-3 bg-black rounded-lg w-fit group-hover:scale-110 transition-transform">{icon}</div>
    <h3 className="text-xl font-bold mb-3 text-white">{title}</h3>
    <p className="text-zinc-400 leading-relaxed">{desc}</p>
  </div>
);