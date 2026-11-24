import React from 'react';

/**
 * Bloco "Acesso rápido" da ficha do cliente: o que o operador de cobrança procura
 * primeiro (contato, referências, Instagram, endereço, fotos e vídeos), reunido de
 * todas as solicitações. Só exibe o que existe no cadastro; não calcula nada.
 */

type Doc = { url: string; label: string };
type Contact = { label: string; phone: string };

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

/** Extrai, sem duplicar, contatos/documentos de todas as solicitações (mais recente primeiro). */
export function collectQuickAccess(customer: any) {
  const reqs: any[] = [...(customer?.loanRequests || [])].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const photos: Doc[] = [];
  const videos: Doc[] = [];
  const contacts: Contact[] = [];
  const seen = new Set<string>();
  const addDoc = (list: Doc[], url: string | null, label: string) => {
    if (!url || seen.has(url)) return;
    seen.add(url); list.push({ url, label });
  };
  const addContact = (label: string, phone?: string | null) => {
    const d = digits(phone);
    if (d.length < 10 || seen.has(`tel:${d}`)) return;
    seen.add(`tel:${d}`); contacts.push({ label, phone: phone! });
  };
  let instagram = instaHandle(customer?.instagram);
  let address: string | null = null;

  for (const r of reqs) {
    const extra = parseJson(r.supplementalDescription) || {};
    addDoc(photos, first(r.selfieUrl), 'Selfie');
    addDoc(photos, first(r.idCardUrl), 'Documento (frente)');
    addDoc(photos, first(r.idCardBackUrl), 'Documento (verso)');
    all(extra.cnh).forEach((u, i) => addDoc(photos, u, `CNH ${i + 1}`));
    all(extra.housePhotos).forEach((u, i) => addDoc(photos, u, `Foto da casa ${i + 1}`));
    addDoc(photos, first(r.proofOfAddressUrl), 'Comprovante de endereço');
    addDoc(videos, first(r.videoHouseUrl), 'Vídeo da casa');
    addDoc(videos, first(r.videoSelfieUrl), 'Vídeo selfie');
    addDoc(videos, first(r.videoVehicleUrl), 'Vídeo do veículo');

    addContact(`${r.reference1Name || 'Referência 1'}${r.fatherPhoneRelationship ? ` (${r.fatherPhoneRelationship})` : ''}`, r.reference1Phone || r.fatherPhone);
    addContact(`${r.reference2Name || 'Referência 2'}${r.motherPhoneRelationship ? ` (${r.motherPhoneRelationship})` : ''}`, r.reference2Phone || r.motherPhone);
    addContact(`Cônjuge${r.spousePhoneRelationship ? ` (${r.spousePhoneRelationship})` : ''}`, r.spousePhone);

    if (!instagram) instagram = instaHandle(r.instagram || extra.instagram);
    if (!address) {
      const street = extra.address ? `${extra.address}${extra.number ? `, nº ${extra.number}` : ''}` : r.address;
      const parts = [street, r.neighborhood, r.city && `${r.city}/${r.state || ''}`, r.zipCode || extra.cep].filter(Boolean);
      if (parts.length) address = parts.join(' · ');
    }
  }
  if (!address) {
    const c = customer || {};
    const parts = [c.address, c.neighborhood, c.city && `${c.city}/${c.state || ''}`, c.zipCode].filter(Boolean);
    if (parts.length) address = parts.join(' · ');
  }
  return { photos, videos, contacts, instagram: instagram || null, address };
}

const isVideo = (url: string) => /\.(mp4|mov|webm|m4v|3gp)(\?|$)/i.test(url);

export const CustomerQuickAccess: React.FC<{ customer: any; renderDoc: (url: string, label: string) => React.ReactNode }> = ({ customer, renderDoc }) => {
  const q = collectQuickAccess(customer);
  const wa = waLink(customer?.phone);
  const copy = (text: string) => { navigator.clipboard?.writeText(text).catch(() => {}); };
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
      </div>

      {q.address && (
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <p className="text-zinc-500 text-xs">Endereço</p>
            <p className="text-white text-sm font-semibold">{q.address}</p>
          </div>
          <button type="button" onClick={() => copy(q.address!)} className="min-h-[44px] px-3 rounded-lg bg-zinc-800 text-xs text-zinc-200 hover:bg-zinc-700">Copiar</button>
          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q.address)}`} target="_blank" rel="noopener noreferrer" className="min-h-[44px] inline-flex items-center px-3 rounded-lg bg-zinc-800 text-xs text-zinc-200 hover:bg-zinc-700">Mapa</a>
        </div>
      )}

      <div>
        <p className="text-zinc-500 text-xs mb-2">Contatos de referência</p>
        {q.contacts.length === 0 ? <p className="text-zinc-600 text-sm">Nenhum contato de referência no cadastro.</p> : (
          <ul className="space-y-2">
            {q.contacts.map(c => (
              <li key={c.phone} className="flex items-center justify-between gap-2 bg-black rounded-lg p-2">
                <div className="min-w-0">
                  <p className="text-sm text-white font-semibold truncate">{c.label}</p>
                  <p className="text-xs text-zinc-400">{c.phone}</p>
                </div>
                {waLink(c.phone) && (
                  <a href={waLink(c.phone)!} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp de ${c.label}`} className="min-h-[44px] inline-flex items-center px-3 rounded-lg bg-green-700 text-xs font-bold text-white">WhatsApp</a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="text-zinc-500 text-xs mb-2">Fotos e documentos</p>
        {q.photos.length === 0 ? <p className="text-zinc-600 text-sm">Nenhuma foto enviada.</p> : (
          <div className="flex flex-wrap gap-2">{q.photos.map(d => <React.Fragment key={d.url}>{renderDoc(d.url, d.label)}</React.Fragment>)}</div>
        )}
      </div>

      <div>
        <p className="text-zinc-500 text-xs mb-2">Vídeos</p>
        {q.videos.length === 0 ? <p className="text-zinc-600 text-sm">Nenhum vídeo enviado.</p> : (
          <div className="grid gap-3 sm:grid-cols-2">
            {q.videos.map(v => (
              <div key={v.url}>
                <p className="text-xs text-zinc-300 mb-1">{v.label}</p>
                {isVideo(v.url)
                  ? <video src={v.url} controls playsInline preload="metadata" className="w-full max-h-72 rounded-lg bg-black" />
                  : renderDoc(v.url, v.label)}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
