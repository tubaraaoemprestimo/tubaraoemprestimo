import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, QrCode, RefreshCw, MousePointerClick } from 'lucide-react';
import { Button } from '../Button';
import { apiService } from '../../services/apiService';
import { useToast } from '../Toast';

type Status = { enabled: boolean; state?: string; qr?: string | null; pairingCode?: string | null; connected?: string | null };

/** Número do autoatendimento por botões (Whaileys). Separado da Evolution; QR ou código. */
export const WhatsAppButtonsConnect: React.FC = () => {
  const { addToast } = useToast();
  const [st, setSt] = useState<Status | null>(null);
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try { setSt(await apiService.get('/whatsapp-buttons/status')); } catch (e: any) { setSt({ enabled: true, state: 'erro' }); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  // Enquanto aguarda leitura, consulta a cada 15 s (o QR renova sozinho).
  useEffect(() => {
    if (!st?.enabled || st.state === 'open') return;
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, [st?.enabled, st?.state, refresh]);

  const act = async (path: string, body: any = {}) => {
    setBusy(true);
    try { const r = await apiService.post(path, body); setSt(s => ({ ...(s || { enabled: true }), ...r })); if (path.endsWith('disconnect')) await refresh(); }
    catch (e: any) { addToast(e?.message || 'Falha ao falar com o WhatsApp por botões', 'error'); }
    finally { setBusy(false); }
  };
  const genCode = () => {
    const n = phone.replace(/\D/g, '');
    if (!/^55\d{10,11}$/.test(n)) { addToast('Informe o número com 55 + DDD, ex.: 5511999999999', 'warning'); return; }
    act('/whatsapp-buttons/connect', { phone: n });
  };

  if (!st) return null;
  return (
    <>
    {renderMain()}
    {st.enabled && <AdminPhones />}
    </>
  );

  function renderMain() { return (
    <div className="mt-8 border-t border-zinc-800 pt-8">
      <h2 className="text-xl font-bold flex items-center gap-2 mb-2"><MousePointerClick size={20} className="text-green-500" /> WhatsApp por botões (autoatendimento)</h2>
      <p className="text-zinc-400 text-sm mb-6">Número separado, sem IA: o cliente faz pelo WhatsApp tudo o que faz no app, tocando em botões. Use um chip diferente do WhatsApp acima.</p>
      {!st.enabled ? (
        <p className="text-sm text-yellow-400">Ainda não configurado no servidor.</p>
      ) : (
        <div className="bg-black p-6 rounded-xl border border-zinc-800 flex flex-col items-center max-w-md">
          <div className="mb-4 flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${st.state === 'open' ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm font-mono uppercase text-zinc-400">Status: {st.state}</span>
            <button onClick={refresh} className="ml-2 p-1 hover:bg-zinc-800 rounded-full text-zinc-500" aria-label="Atualizar status"><RefreshCw size={14} /></button>
          </div>
          {st.state === 'open' ? (
            <>
              <CheckCircle2 size={48} className="text-green-500 mb-2" />
              <p className="text-zinc-300 text-sm mb-4">Conectado {st.connected ? `(final ${st.connected.slice(-4)})` : ''}</p>
              <Button onClick={() => { if (confirm('Desconectar o WhatsApp por botões? Os clientes deixam de ser atendidos por ele.')) act('/whatsapp-buttons/disconnect'); }} variant="danger" isLoading={busy} className="w-full">Desconectar</Button>
            </>
          ) : (
            <div className="w-full flex flex-col items-center">
              {st.qr ? (
                <div className="bg-white p-2 rounded-lg mb-3"><img src={st.qr} alt="QR Code do WhatsApp por botões" className="w-48 h-48 object-contain" /></div>
              ) : <QrCode size={48} className="text-zinc-600 mb-3 opacity-50" />}
              <Button onClick={() => act('/whatsapp-buttons/connect')} isLoading={busy} className="w-full bg-green-600 hover:bg-green-700 border-none text-white">{st.qr ? 'Gerar novo QR' : 'Conectar / Gerar QR'}</Button>
              <div className="w-full mt-6 pt-6 border-t border-zinc-800">
                <label htmlFor="wab-phone" className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Ou conectar com código</label>
                <input id="wab-phone" inputMode="numeric" autoComplete="off" placeholder="5511999999999 (número do chip)" value={phone} onChange={e => setPhone(e.target.value)}
                  className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none" />
                <Button onClick={genCode} isLoading={busy} variant="secondary" className="w-full mt-2">Gerar código</Button>
                {st.pairingCode && (
                  <div className="mt-4 text-center" aria-live="polite">
                    <p className="font-mono text-3xl tracking-[0.3em] text-white select-all">{st.pairingCode.length === 8 ? `${st.pairingCode.slice(0, 4)}-${st.pairingCode.slice(4)}` : st.pairingCode}</p>
                    <p className="text-xs text-zinc-500 mt-2">No celular: WhatsApp › Dispositivos conectados › Conectar dispositivo › <strong>Conectar com número de telefone</strong>.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  ); }
};

type AdminRow = { phone: string; label: string | null; active: boolean; hasPin: boolean; locked: boolean; user: { name: string; email: string } | null };

/** Números que podem usar o painel pelo WhatsApp de botões (com PIN de 6 dígitos). */
const AdminPhones: React.FC = () => {
  const { addToast } = useToast();
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [phone, setPhone] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { setRows((await apiService.get('/whatsapp-buttons/admins')).items || []); } catch { /* sem acesso */ } }, []);
  useEffect(() => { load(); }, [load]);
  const run = async (fn: () => Promise<any>, ok: string) => { setBusy(true); try { await fn(); addToast(ok, 'success'); await load(); } catch (e: any) { addToast(e?.message || 'Falha', 'error'); } finally { setBusy(false); } };
  const add = () => {
    const n = phone.replace(/\D/g, '');
    if (!/^55\d{10,11}$/.test(n)) { addToast('Use 55 + DDD + número', 'warning'); return; }
    run(() => apiService.post('/whatsapp-buttons/admins', { phone: n, label }), 'Número autorizado. Ele cria o PIN no primeiro acesso.').then(() => { setPhone(''); setLabel(''); });
  };
  return (
    <div className="mt-6 bg-black p-6 rounded-xl border border-zinc-800 max-w-2xl">
      <h3 className="font-bold mb-1">🛠️ Administradores pelo WhatsApp</h3>
      <p className="text-zinc-400 text-sm mb-4">Estes números entram no painel pelo WhatsApp de botões. Na primeira mensagem criam um PIN de 6 dígitos; a sessão expira em 15 min e aprovações pedem o PIN de novo.</p>
      <div className="flex flex-col md:flex-row gap-2 mb-4">
        <input aria-label="Número do administrador" inputMode="numeric" placeholder="5511999999999" value={phone} onChange={e => setPhone(e.target.value)} className="flex-1 bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none" />
        <input aria-label="Nome ou apelido" placeholder="Ex.: Jefferson" value={label} onChange={e => setLabel(e.target.value)} className="flex-1 bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none" />
        <Button onClick={add} isLoading={busy} className="bg-green-600 border-none text-white">Autorizar</Button>
      </div>
      {rows.length === 0 ? <p className="text-sm text-zinc-500">Nenhum número autorizado.</p> : (
        <ul className="divide-y divide-zinc-800">
          {rows.map(r => (
            <li key={r.phone} className="py-3 flex flex-wrap items-center gap-2 justify-between">
              <div className="text-sm">
                <p className="font-mono">{r.phone}</p>
                <p className="text-zinc-500">{r.label || r.user?.name || '-'} · {r.locked ? '🔒 bloqueado' : r.hasPin ? 'PIN criado' : 'aguardando primeiro acesso'}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" isLoading={busy} onClick={() => run(() => apiService.post(`/whatsapp-buttons/admins/${r.phone}/reset-pin`, {}), 'PIN apagado; será criado de novo no próximo acesso.')}>Redefinir PIN</Button>
                <Button size="sm" variant="danger" isLoading={busy} onClick={() => { if (confirm(`Remover o acesso de admin de ${r.phone}?`)) run(() => apiService.delete(`/whatsapp-buttons/admins/${r.phone}`), 'Acesso removido.'); }}>Remover</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
