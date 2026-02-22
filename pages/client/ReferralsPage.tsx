import React, { useState, useEffect } from 'react';
import { Gift, Trophy, Star, CheckCircle, Clock, TrendingUp, Users, Coins, Share2, Copy } from 'lucide-react';
import { referralService, MyReferralsData } from '../../services/referralService';
import { useToast } from '../../components/Toast';
import { Button } from '../../components/Button';

export const ReferralsPage: React.FC = () => {
  const { addToast } = useToast();
  const [data, setData] = useState<MyReferralsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await referralService.getMyReferrals();
      setData(result);
    } catch (e) {
      console.error('Error loading referrals data:', e);
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    if (data?.referralCode) {
      navigator.clipboard.writeText(data.referralCode);
      addToast('Codigo copiado!', 'success');
    }
  };

  const shareCode = async () => {
    if (!data?.referralCode) return;
    const shared = await referralService.shareCode(data.referralCode);
    if (shared) addToast('Compartilhado com sucesso!', 'success');
  };

  const rules = referralService.getRewardRules();
  const approvedCount = data?.referrals.filter(r => r.status === 'APPROVED').length || 0;
  const pendingCount = data?.referrals.filter(r => r.status === 'PENDING').length || 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D4AF37]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-900/50 to-black border-b border-emerald-900/30 p-6">
        <h1 className="text-2xl font-bold mb-2">Indicacao & Recompensas</h1>
        <p className="text-zinc-400 text-sm">Indique amigos e ganhe pontos e dinheiro!</p>
      </div>

      <div className="max-w-xl mx-auto px-4 py-6 space-y-6">

        {/* Meu Codigo */}
        <div className="bg-gradient-to-r from-emerald-900/30 to-zinc-900 border border-emerald-700/50 rounded-2xl p-6 text-center">
          <Trophy className="mx-auto text-emerald-400 mb-3" size={48} />
          <h2 className="font-bold text-lg mb-2">Seu Codigo de Indicacao</h2>
          {data?.referralCode ? (
            <>
              <div className="bg-black rounded-xl p-4 mb-4 border border-emerald-800">
                <span className="text-3xl font-mono font-bold text-emerald-400 tracking-wider">{data.referralCode}</span>
              </div>
              <div className="flex gap-3">
                <Button onClick={copyCode} variant="secondary" className="flex-1">
                  <Copy size={16} className="mr-2" /> Copiar
                </Button>
                <Button onClick={shareCode} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                  <Share2 size={16} className="mr-2" /> Compartilhar
                </Button>
              </div>
            </>
          ) : (
            <p className="text-zinc-400">Seu codigo sera gerado automaticamente.</p>
          )}

          <div className="mt-4 text-xs text-zinc-500 space-y-1">
            <p>Quando alguem usar seu codigo e a solicitacao for aprovada, voce ganha pontos!</p>
            <p>Pontos podem ser trocados por descontos ou dinheiro.</p>
          </div>
        </div>

        {/* Pontuacao */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Coins className="text-[#D4AF37]" />
            Seus Pontos
          </h3>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-black/50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-[#D4AF37]">{data?.points || 0}</div>
              <div className="text-xs text-zinc-500">Total</div>
            </div>
            <div className="bg-black/50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-emerald-400">R$ {(data?.totalBonus || 0).toFixed(0)}</div>
              <div className="text-xs text-zinc-500">Bonus</div>
            </div>
            <div className="bg-black/50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-blue-400">{data?.referrals.length || 0}</div>
              <div className="text-xs text-zinc-500">Indicados</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-xl p-4">
              <Users className="text-emerald-400 mb-2" size={24} />
              <div className="text-2xl font-bold">{approvedCount}</div>
              <div className="text-xs text-zinc-400">Aprovados</div>
            </div>
            <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-4">
              <Clock className="text-yellow-400 mb-2" size={24} />
              <div className="text-2xl font-bold">{pendingCount}</div>
              <div className="text-xs text-zinc-400">Pendentes</div>
            </div>
          </div>
        </div>

        {/* Historico de Indicacoes */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <TrendingUp className="text-zinc-400" />
            Historico de Indicacoes
          </h3>
          {(data?.referrals.length || 0) > 0 ? (
            <div className="space-y-3">
              {data!.referrals.map((ref) => (
                <div key={ref.id} className="bg-black/50 rounded-xl p-4 border border-zinc-800">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-bold">{ref.referred_name}</p>
                      <p className="text-xs text-zinc-500">{new Date(ref.created_at).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${ref.status === 'APPROVED' ? 'bg-green-900/50 text-green-400' :
                        ref.status === 'PENDING' ? 'bg-yellow-900/50 text-yellow-400' :
                          'bg-red-900/50 text-red-400'
                      }`}>
                      {ref.status === 'APPROVED' ? 'Aprovado' :
                        ref.status === 'PENDING' ? 'Pendente' : 'Rejeitado'}
                    </span>
                  </div>
                  {ref.status === 'APPROVED' && (
                    <div className="flex gap-4 text-sm">
                      <span className="text-emerald-400 font-bold">+{ref.points_awarded} pts</span>
                      {ref.bonus_amount > 0 && (
                        <span className="text-[#D4AF37] font-bold">+R$ {ref.bonus_amount.toFixed(2)}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-zinc-500">
              <Users className="mx-auto mb-3 opacity-50" size={48} />
              <p>Voce ainda nao tem indicacoes.</p>
              <p className="text-sm">Compartilhe seu codigo e comece a ganhar!</p>
            </div>
          )}
        </div>

        {/* Regras Detalhadas */}
        <div className="bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 rounded-2xl p-6">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Gift className="text-[#D4AF37]" />
            Como Funciona
          </h3>
          <div className="space-y-4 text-sm">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-900/50 flex items-center justify-center shrink-0 text-emerald-400 font-bold">1</div>
              <div>
                <p className="font-bold text-white">Compartilhe seu código</p>
                <p className="text-zinc-400">Envie para amigos, família ou redes sociais.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-900/50 flex items-center justify-center shrink-0 text-emerald-400 font-bold">2</div>
              <div>
                <p className="font-bold text-white">Eles se cadastram com seu código</p>
                <p className="text-zinc-400">Na hora do cadastro, basta informar seu código.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-900/50 flex items-center justify-center shrink-0 text-emerald-400 font-bold">3</div>
              <div>
                <p className="font-bold text-white">Receba recompensas</p>
                <p className="text-zinc-400">Pontos e bônus quando o empréstimo for aprovado.</p>
              </div>
            </div>
          </div>

          {/* Card de Regras Detalhadas */}
          <div className="mt-6 space-y-3">
            <div className="p-4 bg-emerald-900/20 border border-emerald-700/30 rounded-xl space-y-2">
              <p className="text-sm font-bold text-emerald-300">🎯 Pontuação:</p>
              <ul className="text-sm text-zinc-300 space-y-1.5 list-none">
                <li className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                  Indicação aprovada: <strong className="text-emerald-400">100 pontos</strong>
                </li>
                <li className="flex items-center gap-2">
                  <Star size={14} className="text-[#D4AF37] shrink-0" />
                  Contrato acima de R$ 5.000: <strong className="text-[#D4AF37]">+ R$ 50</strong> (em pontos)
                </li>
                <li className="flex items-center gap-2">
                  <Trophy size={14} className="text-yellow-400 shrink-0" />
                  Contrato acima de R$ 10.000: <strong className="text-yellow-400">+ R$ 100</strong> (em pontos)
                </li>
              </ul>
            </div>

            <div className="p-4 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-xl space-y-2">
              <p className="text-sm font-bold text-[#D4AF37]">💰 Conversão:</p>
              <ul className="text-sm text-zinc-300 space-y-1.5 list-none">
                <li className="flex items-center gap-2">
                  <Coins size={14} className="text-[#D4AF37] shrink-0" />
                  100 pontos = <strong className="text-white">R$ 20,00</strong>
                </li>
                <li className="flex items-center gap-2">
                  <TrendingUp size={14} className="text-[#D4AF37] shrink-0" />
                  Saque mínimo: <strong className="text-white">500 pontos (R$ 100)</strong>
                </li>
              </ul>
            </div>

            <div className="p-3 bg-red-900/20 border border-red-700/30 rounded-xl">
              <p className="text-xs text-red-300">
                <strong>⚠️ Atenção:</strong> A recompensa só é validada após o pagamento do <strong>1º pagamento</strong> do indicado. Indicações reprovadas ou inadimplentes não geram pontos.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
