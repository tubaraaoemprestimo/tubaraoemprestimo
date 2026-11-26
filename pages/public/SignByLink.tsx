import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Camera, MapPin, PenLine, AlertTriangle } from 'lucide-react';
import { SignaturePad } from '../../components/SignaturePad';
import { Button } from '../../components/Button';
import { getApiBaseUrl } from '../../services/runtimeConfig';

const API = getApiBaseUrl().replace(/\/+$/, '');

/** Reduz a foto para no máximo 1280px (JPEG 0,8): envio rápido pelo 4G. */
async function shrink(file: File): Promise<string> {
  const img = await createImageBitmap(file);
  const k = Math.min(1, 1280 / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.8);
}

/** Assinatura do pedido feito pelo WhatsApp: assinatura + foto + localização. Link de uso único. */
export const SignByLink: React.FC = () => {
  const { token = '' } = useParams();
  const [info, setInfo] = useState<{ name: string | null; service: string | null } | null>(null);
  const [error, setError] = useState('');
  const [signature, setSignature] = useState('');
  const [photo, setPhoto] = useState('');
  const [loc, setLoc] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [locErr, setLocErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`${API}/sign/${encodeURIComponent(token)}`).then(async r => {
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setError(j.error || 'Link inválido'); else setInfo(j);
    }).catch(() => setError('Sem conexão. Tente de novo.'));
  }, [token]);

  const askLocation = () => {
    setLocErr('');
    if (!navigator.geolocation) { setLocErr('Seu aparelho não permite localização.'); return; }
    navigator.geolocation.getCurrentPosition(
      p => setLoc({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => setLocErr('Precisamos da localização para registrar onde você assinou. Permita o acesso e toque de novo.'),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  };
  useEffect(() => { if (info) askLocation(); }, [info]);

  const submit = async () => {
    if (!signature || !photo || !loc) return;
    setBusy(true); setError('');
    try {
      const r = await fetch(`${API}/sign/${encodeURIComponent(token)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ signature, photo, ...loc }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setError(j.error || 'Não foi possível enviar.'); else setDone(true);
    } catch { setError('Sem conexão. Tente de novo.'); }
    finally { setBusy(false); }
  };

  const shell = (children: React.ReactNode) => (
    <main className="min-h-dvh bg-black text-white px-4 py-8 flex justify-center">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-2xl font-bold text-[#D4AF37] text-center">🦈 Tubarão Empréstimos</h1>
        {children}
      </div>
    </main>
  );

  if (done) return shell(
    <div className="text-center space-y-3">
      <CheckCircle2 size={64} className="mx-auto text-green-500" />
      <h2 className="text-xl font-bold">Assinatura registrada!</h2>
      <p className="text-zinc-400">Pode voltar ao WhatsApp para concluir sua solicitação.</p>
    </div>
  );
  if (error && !info) return shell(
    <div className="text-center space-y-3" role="alert"><AlertTriangle size={48} className="mx-auto text-yellow-500" /><p>{error}</p></div>
  );
  if (!info) return shell(<p className="text-center text-zinc-400">Carregando…</p>);

  return shell(
    <>
      <div className="text-center">
        <p className="text-zinc-300">{info.name ? `${info.name}, ` : ''}falta só assinar{info.service ? <> sua solicitação de <strong>{info.service}</strong></> : ''}.</p>
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold flex items-center gap-2"><MapPin size={18} className={loc ? 'text-green-500' : 'text-zinc-500'} /> 1. Localização</h2>
        {loc ? <p className="text-sm text-green-400">Localização registrada (precisão de {Math.round(loc.accuracy)} m).</p>
          : <><p className="text-sm text-zinc-400">{locErr || 'Permita o acesso à localização para registrar onde você assinou.'}</p>
             <Button onClick={askLocation} variant="secondary" className="w-full">Permitir localização</Button></>}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold flex items-center gap-2"><PenLine size={18} className={signature ? 'text-green-500' : 'text-zinc-500'} /> 2. Assinatura</h2>
        <SignaturePad onSign={setSignature} />
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold flex items-center gap-2"><Camera size={18} className={photo ? 'text-green-500' : 'text-zinc-500'} /> 3. Foto do seu rosto</h2>
        <input ref={fileRef} type="file" accept="image/*" capture="user" className="hidden" aria-label="Tirar foto"
          onChange={async e => { const f = e.target.files?.[0]; if (f) setPhoto(await shrink(f).catch(() => '')); }} />
        {photo && <img src={photo} alt="Sua foto" className="w-40 h-40 object-cover rounded-xl mx-auto" />}
        <Button onClick={() => fileRef.current?.click()} variant="secondary" className="w-full">{photo ? 'Tirar outra foto' : 'Tirar foto'}</Button>
      </section>

      {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
      <Button onClick={submit} isLoading={busy} disabled={!signature || !photo || !loc} className="w-full bg-[#D4AF37] text-black border-none">Confirmar assinatura</Button>
      <p className="text-xs text-zinc-500 text-center">Ao confirmar, você assina eletronicamente sua solicitação. Registramos data, hora, localização e foto como prova.</p>
    </>
  );
};
