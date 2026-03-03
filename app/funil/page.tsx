import { Suspense } from 'react';
import type { Metadata } from 'next';
import { FunnelManager } from './FunnelManager';

// ---------------------------------------------------------------
// Metadata SEO — bloqueia indexação da página do funil
// (funil de vendas não deve ser indexado pelo Google)
// ---------------------------------------------------------------
export const metadata: Metadata = {
  title:  'Método Tubarão — Acesso Exclusivo',
  description: 'Sistema completo para construir um negócio de empréstimos do zero.',
  robots: { index: false, follow: false },
};

// ---------------------------------------------------------------
// /funil — Server Component wrapper
//
// O FunnelManager é um Client Component que:
//  - Lê ?step= e ?sid= via useSearchParams (precisa de Suspense)
//  - Gerencia o estado da SPA com useState
//  - Faz tracking via fetch para /api/funil/track
// ---------------------------------------------------------------
export default function FunilPage() {
  return (
    // Suspense obrigatório para useSearchParams no App Router
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <FunnelManager />
    </Suspense>
  );
}
