import React from 'react';

/**
 * Bloco "Acesso rápido" da ficha do cliente: contato direto com o TITULAR e
 * documentos de identificação, reunidos de todas as solicitações. Só exibe o
 * que existe no cadastro; não calcula nada.
 *
 * Fora daqui de propósito (24/11/2026), até avaliação jurídica e de privacidade
 * (CDC art. 42, LGPD): endereço/mapa, fotos e vídeo da residência, contatos de
 * referência e familiares.
 */

type Doc = { url: string; label: string };

const first = (v: unknown): string | null => {
  if (!v) return null;
  if (Array.isArray(v)) return typeof v[0] === 'string' ? v[0] : null;
  return typeof v === 'string' ? v : null;
};
const all = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x) : typeof v === 'string' && v ? [v] : []);
const digits = (s?: string | null) => (s || '').replace(/\D/g, '');
export const waLink = (phone?: string | null) => {
  const d = digits(phone);
  return d.length >= 10 ? `https://wa.me/${d.startsWith('55') ? d : `55${d}`}` : null;
};
const parseJson = (s: unknown): any => {
  if (typeof s !== 'string') return null;
  try { return JSON.parse(s); } catch { return null; }
};
const instaHandle = (s?: string | null) => (s || '').trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/.*$/, '');

/** Documentos de identificação e Instagram do titular, sem duplicar (solicitação mais recente primeiro). */
export function collectQuickAccess(customer: any) {
  const reqs: any[] = [...(customer?.loanRequests || [])].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const docs: Doc[] = [];
  const seen = new Set<string>();
  const addDoc = (url: string | null, label: string) => {
    if (!url || seen.has(url)) return;
    seen.add(url); docs.push({ url, label });
  };
  let instagram = instaHandle(customer?.instagram);

  for (const r of reqs) {
    const extra = parseJson(r.supplementalDescription) || {};
    addDoc(first(r.selfieUrl), 'Selfie');
    addDoc(first(r.idCardUrl), 'Documento (frente)');
    addDoc(first(r.idCardBackUrl), 'Documento (verso)');
    all(extra.cnh).forEach((u, i) => addDoc(u, `CNH ${i + 1}`));
    addDoc(first(r.videoSelfieUrl), 'Vídeo selfie');
    if (!instagram) instagram = instaHandle(r.instagram || extra.instagram);
  }
  return { docs, instagram: instagram || null };
}

export const CustomerQuickAccess: React.FC<{ customer: any; renderDoc: (url: string, label: string) => React.ReactNode }> = ({ customer, renderDoc }) => {
  const q = collectQuickAccess(customer);
  const wa = waLink(customer?.phone);
  return (
    <section aria-label="Acesso rápido" className="bg-zinc-950 border border-[#D4AF37]/40 rounded-xl p-4 space-y-4">
      <h4 className="text-[#D4AF37] font-bold text-sm">Acesso rápido</h4>

      <div className="flex flex-wrap gap-2">
        {wa && (
          <a href={wa} target="_blank" rel="noopener noreferrer" className="min-h-[44px] inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 text-sm font-bold text-white hover:bg-green-700">
            WhatsApp {customer.phone}
          </a>
        )}
        {q.instagram && (
          <a href={`https://instagram.com/${q.instagram}`} target="_blank" rel="noopener noreferrer" className="min-h-[44px] inline-flex items-center gap-2 rounded-lg bg-pink-700 px-4 text-sm font-bold text-white hover:bg-pink-800">
            Instagram @{q.instagram}
          </a>
        )}
        {!wa && !q.instagram && <p className="text-zinc-600 text-sm">Nenhum contato do titular no cadastro.</p>}
      </div>

      <div>
        <p className="text-zinc-500 text-xs mb-2">Documentos de identificação</p>
        {q.docs.length === 0 ? <p className="text-zinc-600 text-sm">Nenhum documento enviado.</p> : (
          <div className="flex flex-wrap gap-2">{q.docs.map(d => <React.Fragment key={d.url}>{renderDoc(d.url, d.label)}</React.Fragment>)}</div>
        )}
      </div>
    </section>
  );
};
