import React, { useState, useEffect } from 'react';
import { Gift, Trophy, Star, Calendar, CheckCircle, Clock, ArrowUpRight, TrendingUp, Users, Coins } from 'lucide-react';
import { apiService } from '../../services/apiService';
import { referralService } from '../../services/referralService';
import { useToast } from '../../components/Toast';
import { Button } from '../../components/Button';

export const ReferralsPage: React.FC = () => {
  const { addToast } = useToast();
  const [myCode, setMyCode] = useState<string | null>(null);
  const [points, setPoints] = useState<any>(null);
  const [usages, setUsages] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const user = apiService.auth.getUser();
      if (!user) {
        addToast('Faça login para ver suas indicações', 'warning');
        return;
      }

      // Buscar ou criar código de indicação
      const code = await referralService.getOrCreateCode(user.id, user.name || 'Cliente');
      setMyCode(code.code);

      // Buscar pontos
      const pts = await referralService.getCustomerPoints(user.id);
      setPoints(pts);

      // Busvar histórico de usages (via admin endpoint, pode precisar de role)
      try {
        const allUsages = await referralService.getAllUsages();
        const myUsages = allUsages.filter(u => u.referrerId === user.id);
        setUsages(myUsages);
      } catch (e) {
        console.log('Não foi possível carregar usages (sem permissão admin)');
      }

      // Histórico de transações de pontos
      const hx = await referralService.getPointsHistory(user.id);
      setHistory(hx);
    } catch (e) {
      console.error('Error loading referrals data:', e);
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    if (myCode) {
      navigator.clipboard.writeText(myCode);
      addToast('Código copiado para a área de transferência!', 'success');
    }
  };

  const shareCode = () => {
    if (!myCode) return;
    const text = `Olá! Use meu código de indicação ${myCode} no Tubarão Empréstimos e ganhe recompensas!`;
    if (navigator.share) {
      navigator.share({
        title: 'Indicação Tubarão Empréstimos',
        text,
        url: 'https://tubaraoemprestimo.com.br'
      });
    } else {
      copyCode();
    }
  };

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
        <h1 className="text-2xl font-bold mb-2">🎁 Indicação & Recompensas</h1>
        <p className="text-zinc-400 text-sm">Indique amigos e ganhe pontos e dinheiro!</p>
      </div>

      <div className="max-w-xl mx-auto px-4 py-6 space-y-6">

        {/* Meu Código */}
        <div className="bg-gradient-to-r from-emerald-900/30 to-zinc-900 border border-emerald-700/50 rounded-2xl p-6 text-center">
          <Trophy className="mx-auto text-emerald-400 mb-3" size={48} />
          <h2 className="font-bold text-lg mb-2">Seu Código de Indicação</h2>
          {myCode ? (
            <>
              <div className="bg-black rounded-xl p-4 mb-4 border border-emerald-800">
                <span className="text-3xl font-mono font-bold text-emerald-400 tracking-wider">{myCode}</span>
              </div>
              <div className="flex gap-3">
                <Button onClick={copyCode} variant="secondary" className="flex-1">
                  📋 Copiar
                </Button>
                <Button onClick={shareCode} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                  <Share2 size={18} className="mr-2" />
                  Compartilhar
                </Button>
              </div>
            </>
          ) : (
            <p className="text-zinc-400">Carregando código...</p>
          )}

          <div className="mt-4 text-xs text-zinc-500 space-y-1">
            <p>• Quando alguém usar seu código e fizer uma solicitação aprovada, você ganha pontos!</p>
            <p>• Pontos podem ser trocados por descontos ou dinheiro.</p>
          </div>
        </div>

        {/* Pontuação */}
        {points && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Coins className="text-[#D4AF37]" />
              Seus Pontos
            </h3>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-black/50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-[#D4AF37]">{points.totalPoints || 0}</div>
                <div className="text-xs text-zinc-500">Total</div>
              </div>
              <div className="bg-black/50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-emerald-400">{points.availablePoints || 0}</div>
                <div className="text-xs text-zinc-500">Disponível</div>
              </div>
              <div className="bg-black/50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-blue-400">{points.usedPoints || 0}</div>
                <div className="text-xs text-zinc-500">Resgatado</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-xl p-4">
                <Users className="text-emerald-400 mb-2" size={24} />
                <div className="text-2xl font-bold">{points.referredCount || 0}</div>
                <div className="text-xs text-zinc-400">Indicados</div>
              </div>
              <div className="bg-blue-900/20 border border-blue-700/30 rounded-xl p-4">
                <CheckCircle className="text-blue-400 mb-2" size={24} />
                <div className="text-2xl font-bold">{points.approvedReferrals || 0}</div>
                <div className="text-xs text-zinc-400">Aprovados</div>
              </div>
            </div>
          </div>
        )}

        {/* Histórico de Indicações */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Clock className="text-zinc-400" />
            Histórico de Indicações
          </h3>
          {usages.length > 0 ? (
            <div className="space-y-3">
              {usages.map((usage) => (
                <div key={usage.id} className="bg-black/50 rounded-xl p-4 border border-zinc-800">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-bold">{usage.referredName}</p>
                      <p className="text-xs text-zinc-500">{new Date(usage.createdAt).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      usage.status === 'VALIDATED' ? 'bg-green-900/50 text-green-400' :
                      usage.status === 'PENDING' ? 'bg-yellow-900/50 text-yellow-400' :
                      'bg-red-900/50 text-red-400'
                    }`}>
                      {usage.status === 'VALIDATED' ? '✅ Aprovado' :
                       usage.status === 'PENDING' ? '⏳ Pendente' : '❌ Rejeitado'}
                    </span>
                  </div>
                  {usage.status === 'VALIDATED' && (
                    <div className="text-emerald-400 text-sm font-bold">
                      + R$ {usage.rewardAmount?.toFixed(2)} de recompensa
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-zinc-500">
              <Users className="mx-auto mb-3 opacity-50" size={48} />
              <p>Você ainda não tem indicações.</p>
              <p className="text-sm">Compartilhe seu código e comece a ganhar!</p>
            </div>
          )}
        </div>

        {/* Histórico de Pontos */}
        {history.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <TrendingUp className="text-[#D4AF37]" />
              Histórico de Pontos
            </h3>
            <div className="space-y-2">
              {history.slice(0, 10).map((tx) => (
                <div key={tx.id} className="flex justify-between items-center py-2 border-b border-zinc-800 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{tx.reason}</p>
                    <p className="text-xs text-zinc-500">{new Date(tx.createdAt).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <span className={`font-bold ${tx.points > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {tx.points > 0 ? '+' : ''}{tx.points}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Regras */}
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
                <p className="font-bold text-white">Eles fazem uma solicitação</p>
                <p className="text-zinc-400">Quando usarem seu código e a solicitação for aprovada, você ganha.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-900/50 flex items-center justify-center shrink-0 text-emerald-400 font-bold">3</div>
              <div>
                <p className="font-bold text-white">Receba recompensas</p>
                <p className="text-zinc-400">Pontos, descontos ou dinheiro direto na sua conta.</p>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-emerald-900/20 border border-emerald-700/30 rounded-xl">
            <p className="text-sm text-emerald-200">
              <strong>🎯 Regras atuais:</strong><br />
              • Qualquer indicação aprovada: <strong>100 pontos</strong><br />
              • Empréstimo ≥ R$ 5.000: <strong>R$ 50 de bônus</strong><br />
              • Empréstimo ≥ R$ 10.000: <strong>R$ 100 de bônus</strong>
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};
