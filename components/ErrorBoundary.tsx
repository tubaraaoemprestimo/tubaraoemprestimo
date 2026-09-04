import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  message?: string;
}

/**
 * Rede de segurança para exceptions durante o render.
 *
 * Sem um ErrorBoundary, qualquer erro não tratado na árvore React desmonta a
 * aplicação inteira e o cliente vê uma tela branca — no wizard de empréstimo
 * isso significava perder as 7 etapas já preenchidas sem nenhuma explicação.
 *
 * Aqui o erro vira uma tela legível com a opção de recarregar. O rascunho de
 * texto do wizard fica no localStorage, então o recarregamento devolve o que
 * o cliente tinha digitado (anexos precisam ser reselecionados).
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Erro não tratado:', error, info?.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <AlertTriangle size={48} className="text-[#D4AF37] mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">
            Algo deu errado nesta tela
          </h1>
          <p className="text-sm text-zinc-400 mb-6">
            Não se preocupe: os dados que você digitou foram guardados. Recarregue
            para continuar de onde parou.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 bg-[#D4AF37] text-black font-bold px-6 py-3 rounded-lg hover:brightness-110 transition"
          >
            <RefreshCw size={18} /> Recarregar
          </button>
          {this.state.message && (
            <p className="text-[11px] text-zinc-600 mt-6 break-words">
              {this.state.message}
            </p>
          )}
        </div>
      </div>
    );
  }
}
