
import React, { useState, useRef } from 'react';
import { Upload, Smartphone, MessageSquare, Check, X, Trash2, Users, ChevronLeft, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '../../components/Button';
import { apiService } from '../../services/apiService';
import { whatsappService } from '../../services/whatsappService';
import { useToast } from '../../components/Toast';
import { useNavigate } from 'react-router-dom';

interface ParsedContact {
    id: string;
    name: string;
    phone: string;
    selected: boolean;
    status: 'pending' | 'importing' | 'success' | 'duplicate' | 'error';
}

// Função para sanitizar telefone BR
const sanitizePhone = (phone: string): string => {
    let clean = phone.replace(/\D/g, '');
    while (clean.startsWith('0')) clean = clean.substring(1);

    if (!clean.startsWith('55')) {
        if (clean.length === 13) clean = clean.slice(-11);
        else if (clean.length === 12) clean = clean.slice(-10);

        if (clean.length >= 10 && clean.length <= 11) clean = '55' + clean;
    }

    // Adicionar 9° dígito se necessário
    if (clean.startsWith('55') && clean.length === 12) {
        const ddd = clean.substring(2, 4);
        const firstDigit = clean[4];
        if (['7', '8', '9'].includes(firstDigit)) {
            clean = '55' + ddd + '9' + clean.substring(4);
        }
    }

    return clean;
};

// Decode Quoted-Printable
const decodeQuotedPrintable = (str: string): string => {
    try {
        let decoded = str.replace(/=\r?\n/g, '');
        decoded = decodeURIComponent(decoded.replace(/=/g, '%'));
        return decoded;
    } catch {
        return str;
    }
};

export const ImportContacts: React.FC = () => {
    const { addToast } = useToast();
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [activeTab, setActiveTab] = useState<'vcf' | 'phone' | 'whatsapp'>('vcf');
    const [contacts, setContacts] = useState<ParsedContact[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
    const [importResult, setImportResult] = useState<{ added: number; duplicates: number; errors: number } | null>(null);

    // ============================================
    // VCF PARSER
    // ============================================
    const parseVCF = (content: string): ParsedContact[] => {
        const cards = content.split('BEGIN:VCARD');
        const parsed: ParsedContact[] = [];
        const seenPhones = new Set<string>();

        for (const card of cards) {
            if (!card.includes('END:VCARD')) continue;

            try {
                // Extract Name
                let name = 'Desconhecido';
                const fnMatch = card.match(/FN(?:;[^:]*)?:(.+)/);
                if (fnMatch) {
                    let rawName = fnMatch[1].trim();
                    if (card.includes('ENCODING=QUOTED-PRINTABLE') && rawName.includes('=')) {
                        rawName = decodeQuotedPrintable(rawName);
                    }
                    name = rawName;
                } else {
                    const nMatch = card.match(/N(?:;[^:]*)?:(.+)/);
                    if (nMatch) name = nMatch[1].replace(/;/g, ' ').trim();
                }

                // Extract Phones
                const telMatches = [...card.matchAll(/TEL(?:;[^:]*)?:(.+)/g)];
                for (const match of telMatches) {
                    const rawPhone = match[1].trim();
                    const sanitized = sanitizePhone(rawPhone);

                    if (sanitized.length >= 12 && sanitized.length <= 13 && !seenPhones.has(sanitized)) {
                        seenPhones.add(sanitized);
                        parsed.push({
                            id: `${sanitized}-${Date.now()}-${Math.random()}`,
                            name: name.substring(0, 50),
                            phone: sanitized,
                            selected: true,
                            status: 'pending'
                        });
                    }
                }
            } catch (err) {
                console.error('Error parsing vCard:', err);
            }
        }

        return parsed;
    };

    const handleVCFUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        const reader = new FileReader();
        reader.onload = async (e) => {
            const content = e.target?.result as string;
            if (content) {
                const parsed = parseVCF(content);
                setContacts(parsed);
                addToast(`${parsed.length} contatos encontrados no arquivo VCF.`, 'success');
            }
            setIsLoading(false);
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    // ============================================
    // CONTACT PICKER API (Mobile Chrome)
    // ============================================
    const handleContactPicker = async () => {
        // @ts-ignore - Contact Picker API
        if (!('contacts' in navigator && 'ContactsManager' in window)) {
            addToast('Contact Picker API não disponível neste navegador. Use Chrome no Android.', 'warning');
            return;
        }

        try {
            setIsLoading(true);
            // @ts-ignore
            const contactsApi = await navigator.contacts.select(['name', 'tel'], { multiple: true });

            const parsed: ParsedContact[] = [];
            const seenPhones = new Set<string>();

            for (const contact of contactsApi) {
                const name = contact.name?.[0] || 'Desconhecido';
                for (const tel of (contact.tel || [])) {
                    const sanitized = sanitizePhone(tel);
                    if (sanitized.length >= 12 && !seenPhones.has(sanitized)) {
                        seenPhones.add(sanitized);
                        parsed.push({
                            id: `${sanitized}-${Date.now()}-${Math.random()}`,
                            name: name.substring(0, 50),
                            phone: sanitized,
                            selected: true,
                            status: 'pending'
                        });
                    }
                }
            }

            setContacts(parsed);
            addToast(`${parsed.length} contatos selecionados do celular.`, 'success');
        } catch (err) {
            console.error('Contact Picker Error:', err);
            addToast('Erro ao acessar contatos ou permissão negada.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    // ============================================
    // WHATSAPP (Evolution API)
    // ============================================
    const handleWhatsAppSync = async () => {
        setIsLoading(true);
        try {
            const whatsappContacts = await whatsappService.fetchContacts();

            if (!whatsappContacts || whatsappContacts.length === 0) {
                addToast('Nenhum contato encontrado na API do WhatsApp. Verifique a conexão.', 'warning');
                setIsLoading(false);
                return;
            }

            console.log('[ImportContacts] Raw WhatsApp contacts sample:', whatsappContacts.slice(0, 3));

            const parsed: ParsedContact[] = [];
            const seenPhones = new Set<string>();

            for (const contact of whatsappContacts) {
                // Ignorar grupos e broadcasts
                const contactId = contact.id || contact.remoteJid || '';
                if (contactId.includes('g.us') || contactId.includes('broadcast')) continue;

                // Extrair nome
                const name = contact.pushName || contact.name || contact.verifiedName || contact.notify || 'WhatsApp';

                // Extrair telefone de múltiplos campos possíveis
                let rawPhone = '';
                if (contact.id) rawPhone = String(contact.id).replace('@s.whatsapp.net', '').replace('@c.us', '');
                else if (contact.remoteJid) rawPhone = String(contact.remoteJid).replace('@s.whatsapp.net', '').replace('@c.us', '');
                else if (contact.phone) rawPhone = String(contact.phone);
                else if (contact.jid) rawPhone = String(contact.jid).replace('@s.whatsapp.net', '').replace('@c.us', '');

                // Limpar para apenas dígitos
                let clean = rawPhone.replace(/\D/g, '');

                // Validar e sanitizar número brasileiro
                // WhatsApp IDs geralmente já vêm com DDI (55)
                if (clean.length < 10 || clean.length > 15) continue; // Número inválido

                // Se não começa com 55 e tem 10-11 dígitos, adicionar
                if (!clean.startsWith('55') && clean.length >= 10 && clean.length <= 11) {
                    clean = '55' + clean;
                }

                // Se começa com 55, garantir formato correto
                if (clean.startsWith('55')) {
                    // Remover zeros após DDD (55 XX 0...) 
                    if (clean.length >= 5 && clean[4] === '0') {
                        clean = clean.substring(0, 4) + clean.substring(5);
                    }

                    // Adicionar 9º dígito se necessário (celular com 8 dígitos)
                    if (clean.length === 12) {
                        const firstDigitAfterDDD = clean[4];
                        if (['6', '7', '8', '9'].includes(firstDigitAfterDDD)) {
                            clean = clean.substring(0, 4) + '9' + clean.substring(4);
                        }
                    }
                }

                // Validar tamanho final (12-13 dígitos para BR)
                if (clean.length >= 12 && clean.length <= 13 && !seenPhones.has(clean)) {
                    seenPhones.add(clean);
                    parsed.push({
                        id: `${clean}-${Date.now()}-${Math.random()}`,
                        name: name.substring(0, 50),
                        phone: clean,
                        selected: true,
                        status: 'pending'
                    });
                }
            }

            setContacts(parsed);
            addToast(`${parsed.length} contatos válidos sincronizados do WhatsApp.`, 'success');
        } catch (err) {
            console.error('WhatsApp Sync Error:', err);
            addToast('Erro ao sincronizar com WhatsApp. Verifique a configuração da API.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    // ============================================
    // SELECTION HANDLERS
    // ============================================
    const toggleSelectAll = () => {
        const allSelected = contacts.every(c => c.selected);
        setContacts(contacts.map(c => ({ ...c, selected: !allSelected })));
    };

    const toggleSelect = (id: string) => {
        setContacts(contacts.map(c => c.id === id ? { ...c, selected: !c.selected } : c));
    };

    const removeContact = (id: string) => {
        setContacts(contacts.filter(c => c.id !== id));
    };

    const clearAll = () => {
        setContacts([]);
        setImportResult(null);
    };

    // ============================================
    // IMPORT TO SUPABASE
    // ============================================
    const handleImport = async () => {
        const selected = contacts.filter(c => c.selected && c.status === 'pending');
        if (selected.length === 0) {
            addToast('Selecione ao menos um contato para importar.', 'warning');
            return;
        }

        setIsImporting(true);
        setImportProgress({ current: 0, total: selected.length });
        setImportResult(null);

        let added = 0;
        let duplicates = 0;
        let errors = 0;

        // Processar em lotes de 50 para mostrar progresso
        const leads = selected.map(c => ({ name: c.name, phone: c.phone }));

        try {
            const result = await apiService.bulkImportLeads(leads);
            added = result.added;
            errors = result.errors;
            duplicates = selected.length - added - errors;

            // Atualizar status visual
            setContacts(prev => prev.map(c => {
                if (!c.selected || c.status !== 'pending') return c;
                return { ...c, status: 'success' };
            }));

        } catch (err) {
            console.error('Import Error:', err);
            errors = selected.length;
        }

        setImportProgress({ current: selected.length, total: selected.length });
        setImportResult({ added, duplicates, errors });
        setIsImporting(false);
        addToast(`Importação finalizada! ${added} adicionados, ${duplicates} duplicados, ${errors} erros.`, added > 0 ? 'success' : 'warning');
    };

    const selectedCount = contacts.filter(c => c.selected).length;
    const pendingCount = contacts.filter(c => c.status === 'pending').length;

    return (
        <div className="p-4 md:p-8 bg-black min-h-screen text-white">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button onClick={() => navigate('/admin/customers')} className="text-zinc-400 hover:text-white transition-colors">
                    <ChevronLeft size={24} />
                </button>
                <div>
                    <h1 className="text-3xl font-bold text-[#D4AF37]">Importar Contatos</h1>
                    <p className="text-zinc-500 text-sm">Adicione novos clientes via arquivo, agenda ou WhatsApp</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                <button
                    onClick={() => { setActiveTab('vcf'); clearAll(); }}
                    className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-all ${activeTab === 'vcf' ? 'bg-[#D4AF37] text-black font-bold' : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:border-zinc-600'}`}
                >
                    <Upload size={20} /> Arquivo VCF
                </button>
                <button
                    onClick={() => { setActiveTab('phone'); clearAll(); }}
                    className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-all ${activeTab === 'phone' ? 'bg-blue-600 text-white font-bold' : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:border-zinc-600'}`}
                >
                    <Smartphone size={20} /> Contatos do Celular
                </button>
                <button
                    onClick={() => { setActiveTab('whatsapp'); clearAll(); }}
                    className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-all ${activeTab === 'whatsapp' ? 'bg-green-600 text-white font-bold' : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:border-zinc-600'}`}
                >
                    <MessageSquare size={20} /> WhatsApp API
                </button>
            </div>

            {/* Content Area */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-6">
                {/* VCF Tab */}
                {activeTab === 'vcf' && contacts.length === 0 && (
                    <div className="text-center py-12">
                        <div className="w-20 h-20 bg-[#D4AF37]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Upload size={40} className="text-[#D4AF37]" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">Upload de Arquivo VCF</h3>
                        <p className="text-zinc-500 mb-6">Exporte os contatos do seu celular como .vcf e faça upload aqui</p>
                        <input
                            type="file"
                            accept=".vcf"
                            ref={fileInputRef}
                            onChange={handleVCFUpload}
                            className="hidden"
                        />
                        <Button onClick={() => fileInputRef.current?.click()} disabled={isLoading}>
                            {isLoading ? <Loader2 size={20} className="animate-spin mr-2" /> : <Upload size={20} className="mr-2" />}
                            Selecionar Arquivo
                        </Button>
                    </div>
                )}

                {/* Phone Tab */}
                {activeTab === 'phone' && contacts.length === 0 && (
                    <div className="text-center py-12">
                        <div className="w-20 h-20 bg-blue-600/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Smartphone size={40} className="text-blue-500" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">Contatos do Celular</h3>
                        <p className="text-zinc-500 mb-2">Acesse diretamente a agenda do seu dispositivo</p>
                        <p className="text-amber-500/80 text-sm mb-6">⚠️ Funciona apenas no Chrome para Android</p>
                        <Button onClick={handleContactPicker} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
                            {isLoading ? <Loader2 size={20} className="animate-spin mr-2" /> : <Users size={20} className="mr-2" />}
                            Abrir Agenda
                        </Button>
                    </div>
                )}

                {/* WhatsApp Tab */}
                {activeTab === 'whatsapp' && contacts.length === 0 && (
                    <div className="text-center py-12">
                        <div className="w-20 h-20 bg-green-600/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <MessageSquare size={40} className="text-green-500" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">Sincronizar WhatsApp</h3>
                        <p className="text-zinc-500 mb-6">Busque contatos da Evolution API configurada em Configurações</p>
                        <Button onClick={handleWhatsAppSync} disabled={isLoading} className="bg-green-600 hover:bg-green-700">
                            {isLoading ? <Loader2 size={20} className="animate-spin mr-2" /> : <MessageSquare size={20} className="mr-2" />}
                            Buscar Contatos
                        </Button>
                    </div>
                )}

                {/* Contacts List */}
                {contacts.length > 0 && (
                    <div>
                        {/* Toolbar */}
                        <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-4 border-b border-zinc-800">
                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={contacts.every(c => c.selected)}
                                        onChange={toggleSelectAll}
                                        className="rounded bg-zinc-800 border-zinc-700 text-[#D4AF37] focus:ring-[#D4AF37]"
                                    />
                                    <span className="text-sm">Selecionar Todos</span>
                                </label>
                                <span className="text-zinc-500 text-sm">{selectedCount} selecionados de {contacts.length}</span>
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={clearAll} variant="secondary" className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700">
                                    <Trash2 size={16} className="mr-1" /> Limpar
                                </Button>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        {isImporting && (
                            <div className="mb-4">
                                <div className="flex justify-between text-sm text-zinc-400 mb-1">
                                    <span>Importando contatos...</span>
                                    <span>{importProgress.current} / {importProgress.total}</span>
                                </div>
                                <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-[#D4AF37] transition-all duration-300"
                                        style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Import Result */}
                        {importResult && (
                            <div className="mb-4 p-4 rounded-xl bg-zinc-800/50 border border-zinc-700">
                                <h4 className="font-bold mb-2">📊 Resultado da Importação:</h4>
                                <div className="flex flex-wrap gap-4 text-sm">
                                    <span className="flex items-center gap-1 text-green-400"><CheckCircle2 size={16} /> {importResult.added} adicionados</span>
                                    <span className="flex items-center gap-1 text-amber-400"><AlertCircle size={16} /> {importResult.duplicates} duplicados</span>
                                    <span className="flex items-center gap-1 text-red-400"><X size={16} /> {importResult.errors} erros</span>
                                </div>
                            </div>
                        )}

                        {/* List */}
                        <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2">
                            {contacts.map(contact => (
                                <div
                                    key={contact.id}
                                    className={`flex items-center justify-between p-3 rounded-xl transition-colors ${contact.selected ? 'bg-zinc-800' : 'bg-zinc-900'} ${contact.status === 'success' ? 'opacity-60' : ''}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            checked={contact.selected}
                                            onChange={() => toggleSelect(contact.id)}
                                            disabled={contact.status !== 'pending'}
                                            className="rounded bg-zinc-800 border-zinc-700 text-[#D4AF37] focus:ring-[#D4AF37]"
                                        />
                                        <div className="w-10 h-10 bg-zinc-700 rounded-full flex items-center justify-center text-[#D4AF37] text-sm font-bold">
                                            {contact.name.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="font-medium">{contact.name}</div>
                                            <div className="text-zinc-500 text-sm">+{contact.phone}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {contact.status === 'success' && <CheckCircle2 size={18} className="text-green-500" />}
                                        {contact.status === 'duplicate' && <AlertCircle size={18} className="text-amber-500" />}
                                        {contact.status === 'error' && <X size={18} className="text-red-500" />}
                                        {contact.status === 'pending' && (
                                            <button onClick={() => removeContact(contact.id)} className="text-zinc-600 hover:text-red-500 transition-colors">
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Action */}
            {contacts.length > 0 && pendingCount > 0 && (
                <div className="flex justify-center">
                    <Button
                        onClick={handleImport}
                        disabled={isImporting || selectedCount === 0}
                        className="px-8 py-3 text-lg"
                    >
                        {isImporting ? (
                            <><Loader2 size={20} className="animate-spin mr-2" /> Importando...</>
                        ) : (
                            <><Users size={20} className="mr-2" /> Importar {selectedCount} Contatos</>
                        )}
                    </Button>
                </div>
            )}
        </div>
    );
};
