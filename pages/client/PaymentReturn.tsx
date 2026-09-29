import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock, Loader2, XCircle, AlertTriangle } from 'lucide-react';
import { Button } from '../../components/Button';
import { apiService, OnlineCharge } from '../../services/apiService';

/**
 * Retorno do checkout da InfinitePay.
 *
 * Chegar aqui NÃO significa que o pagamento foi aprovado: a página só exibe o
 * status que o servidor confirmou (webhook + consulta oficial). Os parâmetros
 * da URL servem apenas de dica para o servidor consultar a InfinitePay.
 */

// ponytail: consulta a cada 5s por até 2 min; o servidor só vai à InfinitePay
// a cada 20s. Suficiente para Pix/cartão; depois disso o cliente acompanha em Contratos.
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 2 * 60 * 1000;

const FINAL_STATUSES: OnlineCharge['status'][] = ['PAID', 'FAILED', 'CANCELLED', 'EXPIRED', 'NEEDS_REVIEW'];

export const PaymentReturn: React.FC = () => {
   const navigate = useNavigate();
   const [params] = useSearchParams();
   const chargeId = params.get('charge') || params.get('order_nsu') || '';
   const hints = {
      transactionNsu: params.get('transaction_nsu') || undefined,
      slug: params.get('slug') || undefined,
   };

   const [charge, setCharge] = useState<OnlineCharge | null>(null);
   const [error, setError] = useState<string | null>(null);
   const [timedOut, setTimedOut] = useState(false);
   const startedAt = useRef(Date.now());

   useEffect(() => {
      if (!chargeId) {
         setError('Não identificamos o pagamento. Confira o status em Contratos.');
         return;
      }

      let cancelled = false;
      let timer: ReturnType<typeof setTimeout>;

      const poll = async () => {
         try {
            const current = await apiService.getOnlineCharge(chargeId, hints);
            if (cancelled) return;
            setCharge(current);
            setError(null);
            if (FINAL_STATUSES.includes(current.status)) return;
         } catch (err: any) {
            if (cancelled) return;
            setError(err.message || 'Não foi possível consultar o pagamento.');
         }
         if (Date.now() - startedAt.current >= POLL_TIMEOUT_MS) {
            setTimedOut(true);
            return;
         }
         timer = setTimeout(poll, POLL_INTERVAL_MS);
      };

      poll();
      return () => {
         cancelled = true;
         clearTimeout(timer);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [chargeId]);

   const amount = charge ? `R$ ${charge.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '';
   const method = charge?.paymentMethod === 'pix' ? 'Pix' : charge?.paymentMethod === 'credit_card' ? 'Cartão de crédito' : null;

   let icon = <Loader2 size={56} className="text-[#D4AF37] animate-spin mx-auto" />;
   let title = 'Estamos confirmando seu pagamento...';
   let message = 'Isso leva alguns instantes. Não é preciso enviar comprovante.';

   if (charge?.status === 'PAID') {
      icon = <CheckCircle2 size={56} className="text-green-500 mx-auto" />;
      title = 'Pagamento confirmado';
      message = `Recebemos ${amount}${method ? ` via ${method}` : ''}. Seu contrato já foi atualizado.`;
   } else if (charge?.status === 'NEEDS_REVIEW') {
      icon = <Clock size={56} className="text-amber-400 mx-auto" />;
      title = 'Pagamento recebido';
      message = 'Recebemos seu pagamento e nossa equipe está conferindo a baixa. Você será avisado.';
   } else if (charge && ['FAILED', 'CANCELLED', 'EXPIRED'].includes(charge.status)) {
      icon = <XCircle size={56} className="text-red-500 mx-auto" />;
      title = 'Não foi possível confirmar este pagamento';
      message = 'Se você concluiu o pagamento, ele será identificado automaticamente. Caso contrário, gere um novo em Contratos.';
   } else if (timedOut) {
      icon = <Clock size={56} className="text-amber-400 mx-auto" />;
      title = 'Pagamento ainda não confirmado';
      message = 'Aguarde alguns instantes. Assim que a confirmação chegar, o status é atualizado em Contratos.';
   } else if (error && !charge) {
      icon = <AlertTriangle size={56} className="text-amber-400 mx-auto" />;
      title = 'Não conseguimos consultar agora';
      message = error;
   }

   return (
      <div className="min-h-screen bg-black text-white p-6 flex items-center justify-center">
         <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-8 text-center space-y-5">
            {icon}
            <h1 className="text-xl font-bold text-[#D4AF37]">{title}</h1>
            <p className="text-sm text-zinc-400">{message}</p>
            {charge && charge.status !== 'PAID' && (
               <p className="text-xs text-zinc-600">{charge.description} · {amount}</p>
            )}
            <Button onClick={() => navigate('/client/contracts')} className="w-full">
               Ver meus contratos
            </Button>
         </div>
      </div>
   );
};

export default PaymentReturn;
