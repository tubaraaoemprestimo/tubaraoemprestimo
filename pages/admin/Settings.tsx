import React, { useState, useEffect } from 'react';
import { Save, Plus, Trash2, Edit2, X, Percent, Zap, Smartphone, QrCode, CheckCircle2, RotateCcw, MessageSquare, Clock, Palette, Upload, Image as ImageIcon, Building2, Settings as SettingsIcon, RefreshCw, AlertCircle, Target, TrendingUp, DollarSign, Users } from 'lucide-react';
import { Button } from '../../components/Button';
import { supabaseService } from '../../services/supabaseService';
import { whatsappService } from '../../services/whatsappService';
import { useBrand } from '../../contexts/BrandContext';
import { LoanPackage, SystemSettings, CollectionRule, CollectionRuleType, WhatsappConfig, GoalsSettings } from '../../types';
import { useToast } from '../../components/Toast';

const inputStyle = "w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none transition-colors";

export const Settings: React.FC = () => {
  const { addToast } = useToast();
  const { settings: brandSettings, updateSettings: updateBrand, resetSettings: resetBrand } = useBrand();

  const [activeTab, setActiveTab] = useState<'FINANCIAL' | 'AUTOMATION' | 'INTEGRATION' | 'BRANDING' | 'GOALS'>('FINANCIAL');

  // Financial State
  const [settings, setSettings] = useState<SystemSettings>({ monthlyInterestRate: 0, lateFeeRate: 0 });
  const [packages, setPackages] = useState<LoanPackage[]>([]);
  const [loadingFinancial, setLoadingFinancial] = useState(false);
  const [loadingPkg, setLoadingPkg] = useState(false);
  const [isPkgModalOpen, setIsPkgModalOpen] = useState(false);
  const [currentPkg, setCurrentPkg] = useState<Partial<LoanPackage>>({});

  // Automation State
  const [rules, setRules] = useState<CollectionRule[]>([]);
  const [loadingAutomation, setLoadingAutomation] = useState(false);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [currentRule, setCurrentRule] = useState<Partial<CollectionRule>>({});

  // Integration State
  const [waConfig, setWaConfig] = useState<WhatsappConfig>({ apiUrl: '', apiKey: '', instanceName: '', isConnected: false });
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loadingWa, setLoadingWa] = useState(false);
  const [waStatus, setWaStatus] = useState<'open' | 'close' | 'connecting' | 'unknown'>('unknown');

  // Branding State (Local state to edit before save)
  const [localBrand, setLocalBrand] = useState(brandSettings);

  // Goals State
  const [goals, setGoals] = useState<GoalsSettings | null>(null);
  const [loadingGoals, setLoadingGoals] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  // Sync local brand state when context changes
  useEffect(() => {
    setLocalBrand(brandSettings);
  }, [brandSettings]);

  const loadData = async () => {
    const [settingsData, packagesData, rulesData, waData, goalsData] = await Promise.all([
      supabaseService.getSettings(),
      supabaseService.getPackages(),
      supabaseService.getCollectionRules(),
      whatsappService.getConfig(),
      supabaseService.getGoalsSettings()
    ]);
    setSettings(settingsData);
    setPackages(packagesData);
    setRules(rulesData);
    setWaConfig(waData);
    setGoals(goalsData);

    // Initial status check if data exists
    if (waData.apiUrl && waData.apiKey) {
      checkWaStatus();
    }
  };

  const checkWaStatus = async () => {
    const status = await whatsappService.checkConnectionState();
    setWaStatus(status);
    if (status === 'open') {
      setWaConfig(prev => ({ ...prev, isConnected: true }));
      supabaseService.saveWhatsappConfig({ ...waConfig, isConnected: true });
      setQrCode(null);
    } else {
      setWaConfig(prev => ({ ...prev, isConnected: false }));
    }
    return status;
  };

  // --- Financial Handlers ---
  const handleSaveSettings = async () => {
    setLoadingFinancial(true);
    await supabaseService.updateSettings(settings);
    setLoadingFinancial(false);
    addToast('Taxas atualizadas!', 'success');
  };

  const handleSavePackage = async () => {
    if (!currentPkg.name || !currentPkg.minValue || !currentPkg.maxValue) return;
    setLoadingPkg(true);
    const pkgToSave = {
      ...currentPkg,
      id: currentPkg.id || '',
      interestRate: currentPkg.interestRate || 0,
      minInstallments: currentPkg.minInstallments || 1,
      maxInstallments: currentPkg.maxInstallments || 12,
    } as LoanPackage;

    await supabaseService.savePackage(pkgToSave);
    setLoadingPkg(false);
    setIsPkgModalOpen(false);
    loadData();
  };

  const handleDeletePackage = async (id: string) => {
    if (confirm('Excluir este pacote?')) {
      await supabaseService.deletePackage(id);
      loadData();
    }
  };

  // --- Automation Handlers ---
  const handleSaveRule = async () => {
    if (!currentRule.messageTemplate) return;
    setLoadingAutomation(true);
    const ruleToSave = {
      ...currentRule,
      id: currentRule.id || '',
      daysOffset: currentRule.daysOffset || 0,
      type: currentRule.type || 'WHATSAPP',
      active: currentRule.active ?? true
    } as CollectionRule;

    await supabaseService.saveCollectionRule(ruleToSave);
    setLoadingAutomation(false);
    setIsRuleModalOpen(false);
    loadData();
  };

  const handleDeleteRule = async (id: string) => {
    if (confirm('Excluir esta regra de automação?')) {
      await supabaseService.deleteCollectionRule(id);
      loadData();
    }
  };

  // --- Integration Handlers ---
  const handleSaveWaConfig = async () => {
    setLoadingWa(true);
    await whatsappService.updateConfig(waConfig);
    setLoadingWa(false);
    addToast('Configuração salva! Tente conectar agora.', 'success');
  };

  const handleConnectWa = async () => {
    if (!waConfig.apiUrl || !waConfig.apiKey || !waConfig.instanceName) {
      addToast("Preencha todos os campos da API primeiro.", 'warning');
      return;
    }

    // IMPORTANT: Save config first to ensure service uses latest values
    await whatsappService.updateConfig(waConfig);

    setLoadingWa(true);
    setQrCode(null);

    try {
      const qr = await whatsappService.getQrCode();
      if (qr) {
        setQrCode(qr); // Evolution usually returns full base64 string
        addToast("QR Code gerado! Escaneie com seu WhatsApp.", 'success');
      } else {
        // Se não retornou QR, talvez já esteja conectado
        const status = await checkWaStatus();
        if (status === 'open') {
          addToast("Instância já está conectada!", 'success');
        } else {
          // Could be that the instance exists but is not connected and didn't return QR (e.g. connecting state)
          addToast("Não foi possível obter o QR Code. Verifique o status.", 'warning');
        }
      }
    } catch (e: any) {
      console.error(e);
      addToast(`Erro ao conectar: ${e.message || 'Verifique URL e Chave.'}`, 'error');
    } finally {
      setLoadingWa(false);
    }
  };

  const handleDisconnectWa = async () => {
    if (confirm("Deseja realmente desconectar e apagar a sessão?")) {
      setLoadingWa(true);
      const success = await whatsappService.disconnect();
      if (success) {
        setWaStatus('close');
        setWaConfig(prev => ({ ...prev, isConnected: false }));
        addToast('WhatsApp desconectado.', 'info');
      } else {
        addToast('Erro ao desconectar ou API indisponível.', 'error');
      }
      setLoadingWa(false);
    }
  };

  // --- Branding Handlers ---
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLocalBrand(prev => ({ ...prev, logoUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveBrand = async () => {
    await updateBrand(localBrand);
    addToast("Identidade visual e dados da empresa atualizados!", 'success');
  };

  const handleRestoreBrand = async () => {
    if (confirm("Restaurar para o padrão (Logo.png original)?")) {
      await resetBrand();
      addToast("Marca restaurada para o padrão.", 'info');
    }
  };

  // --- Goals Handlers ---
  const handleSaveGoals = async () => {
    if (!goals) return;
    setLoadingGoals(true);
    await supabaseService.saveGoalsSettings(goals);
    setLoadingGoals(false);
    addToast('Metas e projeções atualizadas!', 'success');
  };

  const updateProjection = (index: number, target: number) => {
    if (!goals) return;
    const newProjections = [...goals.projections];
    newProjections[index] = { ...newProjections[index], target };
    setGoals({ ...goals, projections: newProjections });
  };

  // --- Render Helpers ---

  const renderFinancialTab = () => (
    <div className="grid lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-2">
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Percent size={20} className="text-[#D4AF37]" /> Taxas Globais
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Juros Mensal (%)</label>
              <input type="number" step="0.1" value={settings.monthlyInterestRate} onChange={(e) => setSettings({ ...settings, monthlyInterestRate: Number(e.target.value) })} className={inputStyle} />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Multa Atraso (%)</label>
              <input type="number" step="0.1" value={settings.lateFeeRate} onChange={(e) => setSettings({ ...settings, lateFeeRate: Number(e.target.value) })} className={inputStyle} />
            </div>
            <div className="pt-4">
              <Button onClick={handleSaveSettings} isLoading={loadingFinancial} className="w-full"><Save size={18} /> Salvar Taxas</Button>
            </div>
          </div>
        </div>
      </div>

      <div className="lg:col-span-2">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Pacotes de Empréstimo</h2>
            <Button onClick={() => { setCurrentPkg({}); setIsPkgModalOpen(true); }} size="sm"><Plus size={18} /> Novo</Button>
          </div>
          <div className="grid gap-4">
            {packages.map((pkg) => (
              <div key={pkg.id} className="bg-black border border-zinc-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-[#D4AF37]/50 transition-colors">
                <div>
                  <h3 className="font-bold text-lg text-white">{pkg.name}</h3>
                  <div className="text-sm text-zinc-400 flex flex-wrap gap-4 mt-1">
                    <span>R$ {pkg.minValue.toLocaleString()} - {pkg.maxValue.toLocaleString()}</span>
                    <span className="text-[#D4AF37]">{pkg.interestRate}% a.m.</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => { setCurrentPkg(pkg); setIsPkgModalOpen(true); }} className="px-3"><Edit2 size={16} /></Button>
                  <Button variant="danger" onClick={() => handleDeletePackage(pkg.id)} className="px-3"><Trash2 size={16} /></Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderAutomationTab = () => (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Zap size={20} className="text-[#D4AF37]" /> Régua de Cobrança
          </h2>
          <p className="text-zinc-400 text-sm mt-1">Configure mensagens automáticas via WhatsApp/Email.</p>
        </div>
        <Button onClick={() => { setCurrentRule({ active: true, type: 'WHATSAPP' }); setIsRuleModalOpen(true); }} size="sm">
          <Plus size={18} /> Nova Regra
        </Button>
      </div>

      <div className="space-y-4">
        {rules.map((rule) => {
          const isBefore = rule.daysOffset < 0;
          const isAfter = rule.daysOffset > 0;
          const label = isBefore ? `${Math.abs(rule.daysOffset)} dias Antes` : isAfter ? `${rule.daysOffset} dias Depois` : 'No Vencimento';
          const color = isBefore ? 'text-blue-400' : isAfter ? 'text-red-400' : 'text-yellow-400';

          return (
            <div key={rule.id} className="relative group bg-black border border-zinc-800 rounded-xl p-6 flex flex-col md:flex-row gap-6 hover:border-[#D4AF37]/50 transition-colors">
              <div className="flex items-start gap-4 flex-1">
                <div className="bg-zinc-900 p-3 rounded-lg border border-zinc-800">
                  {rule.type === 'WHATSAPP' ? <MessageSquare size={24} className="text-green-500" /> : <Clock size={24} className="text-blue-500" />}
                </div>
                <div>
                  <div className={`text-sm font-bold uppercase tracking-wider mb-1 ${color}`}>{label}</div>
                  <p className="text-zinc-300 italic">"{rule.messageTemplate}"</p>
                  <div className="mt-2 text-xs text-zinc-500 font-mono bg-zinc-900 px-2 py-1 rounded w-fit">
                    Canal: {rule.type}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 border-l border-zinc-800 pl-6">
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => { setCurrentRule(rule); setIsRuleModalOpen(true); }} className="px-3"><Edit2 size={16} /></Button>
                  <Button variant="danger" onClick={() => handleDeleteRule(rule.id)} className="px-3"><Trash2 size={16} /></Button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );

  const renderIntegrationTab = () => (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex flex-col md:flex-row gap-8">
        <div className="flex-1 space-y-6">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2 mb-2">
              <Smartphone size={20} className="text-green-500" /> WhatsApp (Evolution API)
            </h2>
            <p className="text-zinc-400 text-sm">Insira os dados da sua instância Evolution API v2.</p>
          </div>

          <div className="space-y-4 bg-black p-6 rounded-xl border border-zinc-800">
            <div>
              <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">API URL Base</label>
              <input
                placeholder="https://api.seuservidor.com"
                value={waConfig.apiUrl}
                onChange={e => setWaConfig({ ...waConfig, apiUrl: e.target.value })}
                className={inputStyle}
              />
              <p className="text-[10px] text-zinc-600 mt-1">Não inclua /instance no final.</p>
            </div>
            <div>
              <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Global API Key</label>
              <input
                placeholder="Sua API Key Global"
                type="password"
                value={waConfig.apiKey}
                onChange={e => setWaConfig({ ...waConfig, apiKey: e.target.value })}
                className={inputStyle}
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Nome da Instância</label>
              <input
                placeholder="tubarao"
                value={waConfig.instanceName}
                onChange={e => setWaConfig({ ...waConfig, instanceName: e.target.value })}
                className={inputStyle}
              />
            </div>
            <Button onClick={handleSaveWaConfig} isLoading={loadingWa} variant="secondary" className="w-full">
              Salvar Configurações
            </Button>
          </div>
        </div>

        <div className="w-full md:w-96 flex flex-col items-center justify-center p-6 bg-black rounded-xl border border-zinc-800">

          {/* Status Badge */}
          <div className="mb-6 flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${waStatus === 'open' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className="text-sm font-mono uppercase text-zinc-400">Status: {waStatus}</span>
            <button onClick={checkWaStatus} className="ml-2 p-1 hover:bg-zinc-800 rounded-full text-zinc-500" title="Verificar Agora">
              <RefreshCw size={14} />
            </button>
          </div>

          {/* Connection Logic */}
          {waStatus === 'open' ? (
            <div className="flex flex-col items-center animate-in zoom-in">
              <CheckCircle2 size={64} className="text-green-500 mb-4" />
              <h3 className="text-xl font-bold text-white mb-1">WhatsApp Conectado</h3>
              <p className="text-zinc-500 text-sm text-center mb-6">A automação está ativa e enviando mensagens.</p>

              <Button onClick={handleDisconnectWa} variant="danger" isLoading={loadingWa} className="w-full">
                Desconectar Instância
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center w-full">
              {!qrCode ? (
                <>
                  <QrCode size={48} className="text-zinc-600 mb-4 opacity-50" />
                  <p className="text-zinc-400 text-sm text-center mb-6">Salve as configurações e clique abaixo para gerar o QR Code.</p>
                  <Button onClick={handleConnectWa} isLoading={loadingWa} className="w-full bg-green-600 hover:bg-green-700 border-none text-white">
                    Conectar / Gerar QR
                  </Button>
                </>
              ) : (
                <div className="flex flex-col items-center animate-in fade-in">
                  <div className="bg-white p-2 rounded-lg mb-4">
                    <img src={qrCode} alt="QR Code" className="w-48 h-48 object-contain" />
                  </div>
                  <p className="text-xs text-zinc-500 mb-4 text-center max-w-[200px]">Abra o WhatsApp &gt; Aparelhos Conectados &gt; Conectar Aparelho</p>
                  <div className="flex gap-2 w-full">
                    <Button onClick={checkWaStatus} variant="secondary" className="flex-1">
                      Já Escaniei
                    </Button>
                    <Button onClick={() => setQrCode(null)} variant="outline" className="flex-1">
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderBrandingTab = () => (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 animate-in fade-in slide-in-from-bottom-2 space-y-8">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2 mb-2">
          <Palette size={20} className="text-[#D4AF37]" /> Identidade Visual & Empresa
        </h2>
        <p className="text-zinc-400 text-sm">Personalize o nome, cores, logo e dados legais da sua empresa.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Visual Settings */}
        <div className="space-y-6">
          <h3 className="text-[#D4AF37] font-bold uppercase text-xs tracking-wider">Visual</h3>
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Nome do Sistema</label>
            <input
              value={localBrand.systemName}
              onChange={(e) => setLocalBrand({ ...localBrand, systemName: e.target.value })}
              className={inputStyle}
              placeholder="Ex: Minha Fintech"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Cor Primária</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={localBrand.primaryColor}
                  onChange={(e) => setLocalBrand({ ...localBrand, primaryColor: e.target.value })}
                  className="h-10 w-12 bg-transparent border-0 cursor-pointer"
                />
                <input
                  value={localBrand.primaryColor}
                  onChange={(e) => setLocalBrand({ ...localBrand, primaryColor: e.target.value })}
                  className={inputStyle}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Cor Secundária</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={localBrand.secondaryColor}
                  onChange={(e) => setLocalBrand({ ...localBrand, secondaryColor: e.target.value })}
                  className="h-10 w-12 bg-transparent border-0 cursor-pointer"
                />
                <input
                  value={localBrand.secondaryColor}
                  onChange={(e) => setLocalBrand({ ...localBrand, secondaryColor: e.target.value })}
                  className={inputStyle}
                />
              </div>
            </div>
          </div>

          <div className="bg-black p-6 rounded-xl border border-zinc-800 flex flex-col items-center justify-center">
            <label className="block text-sm text-zinc-400 mb-4 text-center">Logotipo</label>

            <div className="relative group w-48 h-24 flex items-center justify-center border-2 border-dashed border-zinc-700 rounded-lg overflow-hidden bg-zinc-900/50 mb-4">
              <img
                src={localBrand.logoUrl || "/Logo.png"}
                alt="Logo Preview"
                className="w-full h-full object-contain p-2"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (!target.src.endsWith('/Logo.png')) {
                    target.src = "/Logo.png";
                  }
                }}
              />
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <Upload size={24} className="text-white" />
              </div>
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
            </div>

            <div className="flex gap-2">
              {localBrand.logoUrl && (
                <Button size="sm" variant="secondary" onClick={() => setLocalBrand({ ...localBrand, logoUrl: null })}>
                  Remover Customização
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Company Info Settings */}
        <div className="space-y-6">
          <h3 className="text-[#D4AF37] font-bold uppercase text-xs tracking-wider flex items-center gap-2">
            <Building2 size={16} /> Dados da Empresa (Recibos/Contratos)
          </h3>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">Razão Social</label>
            <input
              value={localBrand.companyName}
              onChange={(e) => setLocalBrand({ ...localBrand, companyName: e.target.value })}
              className={inputStyle}
              placeholder="Ex: Minha Empresa Ltda."
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">CNPJ</label>
            <input
              value={localBrand.cnpj}
              onChange={(e) => setLocalBrand({ ...localBrand, cnpj: e.target.value })}
              className={inputStyle}
              placeholder="00.000.000/0001-00"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">Endereço Completo</label>
            <input
              value={localBrand.address}
              onChange={(e) => setLocalBrand({ ...localBrand, address: e.target.value })}
              className={inputStyle}
              placeholder="Rua Exemplo, 123 - Cidade/UF"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">Telefone de Contato</label>
            <input
              value={localBrand.phone}
              onChange={(e) => setLocalBrand({ ...localBrand, phone: e.target.value })}
              className={inputStyle}
              placeholder="(11) 99999-9999"
            />
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-zinc-800 flex justify-end gap-4">
        <Button variant="secondary" onClick={handleRestoreBrand}>
          Restaurar Padrão
        </Button>
        <Button onClick={handleSaveBrand}>
          <Save size={18} className="mr-2" /> Salvar Identidade
        </Button>
      </div>
    </div>
  );

  const renderGoalsTab = () => {
    if (!goals) return <div className="text-zinc-500">Carregando...</div>;

    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
        {/* Monthly Goals */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-[#D4AF37]/20 rounded-xl">
              <Target size={24} className="text-[#D4AF37]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Metas do Mês</h2>
              <p className="text-zinc-400 text-sm">Defina suas metas mensais que aparecerão no Dashboard</p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-black border border-zinc-800 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-[#D4AF37]/20 rounded-lg">
                  <DollarSign size={20} className="text-[#D4AF37]" />
                </div>
                <label className="text-sm text-zinc-400">Meta Volume Emprestado</label>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-zinc-500">R$</span>
                <input
                  type="number"
                  value={goals.monthlyLoanGoal}
                  onChange={(e) => setGoals({ ...goals, monthlyLoanGoal: Number(e.target.value) })}
                  className={inputStyle}
                  step="10000"
                />
              </div>
              <p className="text-xs text-zinc-600 mt-2">Valor total a emprestar no mês</p>
            </div>

            <div className="bg-black border border-zinc-800 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Users size={20} className="text-blue-400" />
                </div>
                <label className="text-sm text-zinc-400">Meta Novos Clientes</label>
              </div>
              <input
                type="number"
                value={goals.monthlyClientGoal}
                onChange={(e) => setGoals({ ...goals, monthlyClientGoal: Number(e.target.value) })}
                className={inputStyle}
              />
              <p className="text-xs text-zinc-600 mt-2">Quantidade de novos clientes</p>
            </div>

            <div className="bg-black border border-zinc-800 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <Percent size={20} className="text-green-400" />
                </div>
                <label className="text-sm text-zinc-400">Meta Taxa de Aprovação</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={goals.monthlyApprovalRateGoal}
                  onChange={(e) => setGoals({ ...goals, monthlyApprovalRateGoal: Number(e.target.value) })}
                  className={inputStyle}
                  min="0"
                  max="100"
                />
                <span className="text-zinc-500">%</span>
              </div>
              <p className="text-xs text-zinc-600 mt-2">Percentual de aprovações</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mt-6">
            <div className="bg-black border border-zinc-800 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <TrendingUp size={20} className="text-purple-400" />
                </div>
                <label className="text-sm text-zinc-400">Crescimento Esperado (%)</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={goals.expectedGrowthRate}
                  onChange={(e) => setGoals({ ...goals, expectedGrowthRate: Number(e.target.value) })}
                  className={inputStyle}
                  step="0.5"
                />
                <span className="text-zinc-500">% ao mês</span>
              </div>
            </div>

            <div className="bg-black border border-zinc-800 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-orange-500/20 rounded-lg">
                  <Target size={20} className="text-orange-400" />
                </div>
                <label className="text-sm text-zinc-400">Período da Meta</label>
              </div>
              <input
                type="text"
                value={goals.goalPeriod}
                onChange={(e) => setGoals({ ...goals, goalPeriod: e.target.value })}
                className={inputStyle}
                placeholder="12/2024"
              />
              <p className="text-xs text-zinc-600 mt-2">Mês/Ano de referência</p>
            </div>
          </div>
        </div>

        {/* Annual Projections */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-purple-500/20 rounded-xl">
              <TrendingUp size={24} className="text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Projeções Anuais</h2>
              <p className="text-zinc-400 text-sm">Configure a projeção de receita para cada mês do ano</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {goals.projections.map((proj, index) => (
              <div key={proj.month} className="bg-black border border-zinc-800 rounded-xl p-4">
                <label className="block text-xs text-zinc-500 mb-2 font-bold uppercase">{proj.month}</label>
                <div className="flex items-center gap-1">
                  <span className="text-zinc-600 text-xs">R$</span>
                  <input
                    type="number"
                    value={proj.target}
                    onChange={(e) => updateProjection(index, Number(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-white text-sm focus:border-[#D4AF37] outline-none"
                    step="5000"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 p-4 bg-black/50 rounded-xl border border-zinc-800">
            <div className="flex justify-between items-center">
              <span className="text-zinc-400 text-sm">Total Projeção Anual:</span>
              <span className="text-[#D4AF37] font-bold text-lg">
                R$ {goals.projections.reduce((acc, p) => acc + p.target, 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSaveGoals} isLoading={loadingGoals} className="px-8">
            <Save size={18} className="mr-2" /> Salvar Metas e Projeções
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-8 bg-black min-h-screen text-white pb-32">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <h1 className="text-3xl font-bold text-[#D4AF37] flex items-center gap-2">
          <SettingsIcon size={32} /> Configurações do Sistema
        </h1>
      </div>

      <div className="flex flex-wrap gap-2 mb-8 bg-zinc-900/50 p-1 rounded-xl w-fit border border-zinc-800">
        {['FINANCIAL', 'GOALS', 'AUTOMATION', 'INTEGRATION', 'BRANDING'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === tab
              ? 'bg-[#D4AF37] text-black shadow-lg'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
          >
            {tab === 'FINANCIAL' ? 'Financeiro' :
              tab === 'GOALS' ? 'Metas' :
                tab === 'AUTOMATION' ? 'Automação' :
                  tab === 'INTEGRATION' ? 'Integrações' : 'Identidade Visual'}
          </button>
        ))}
      </div>

      {activeTab === 'FINANCIAL' && renderFinancialTab()}
      {activeTab === 'GOALS' && renderGoalsTab()}
      {activeTab === 'AUTOMATION' && renderAutomationTab()}
      {activeTab === 'INTEGRATION' && renderIntegrationTab()}
      {activeTab === 'BRANDING' && renderBrandingTab()}

      {/* Modals */}
      {isPkgModalOpen && (
        <Modal title={currentPkg.id ? 'Editar Pacote' : 'Novo Pacote'} onClose={() => setIsPkgModalOpen(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Nome do Pacote</label>
              <input value={currentPkg.name || ''} onChange={e => setCurrentPkg({ ...currentPkg, name: e.target.value })} className={inputStyle} placeholder="Ex: Ouro" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Min (R$)</label>
                <input type="number" value={currentPkg.minValue || ''} onChange={e => setCurrentPkg({ ...currentPkg, minValue: Number(e.target.value) })} className={inputStyle} />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Máx (R$)</label>
                <input type="number" value={currentPkg.maxValue || ''} onChange={e => setCurrentPkg({ ...currentPkg, maxValue: Number(e.target.value) })} className={inputStyle} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Juros (%)</label>
                <input type="number" step="0.1" value={currentPkg.interestRate || ''} onChange={e => setCurrentPkg({ ...currentPkg, interestRate: Number(e.target.value) })} className={inputStyle} />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Parcelas (Max)</label>
                <input type="number" value={currentPkg.maxInstallments || ''} onChange={e => setCurrentPkg({ ...currentPkg, maxInstallments: Number(e.target.value) })} className={inputStyle} />
              </div>
            </div>
            <Button onClick={handleSavePackage} isLoading={loadingPkg} className="w-full mt-2">Salvar Pacote</Button>
          </div>
        </Modal>
      )}

      {isRuleModalOpen && (
        <Modal title={currentRule.id ? 'Editar Regra' : 'Nova Regra'} onClose={() => setIsRuleModalOpen(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Quando enviar?</label>
              <div className="flex gap-2">
                <select
                  value={currentRule.daysOffset}
                  onChange={e => setCurrentRule({ ...currentRule, daysOffset: Number(e.target.value) })}
                  className={inputStyle}
                >
                  <option value={-3}>3 dias antes</option>
                  <option value={-1}>1 dia antes</option>
                  <option value={0}>No dia do vencimento</option>
                  <option value={1}>1 dia de atraso</option>
                  <option value={3}>3 dias de atraso</option>
                  <option value={5}>5 dias de atraso</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-1">Canal de Envio</label>
              <select
                value={currentRule.type}
                onChange={e => setCurrentRule({ ...currentRule, type: e.target.value as CollectionRuleType })}
                className={inputStyle}
              >
                <option value="WHATSAPP">WhatsApp</option>
                <option value="EMAIL">Email</option>
                <option value="SMS">SMS</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-1">Mensagem</label>
              <textarea
                value={currentRule.messageTemplate || ''}
                onChange={e => setCurrentRule({ ...currentRule, messageTemplate: e.target.value })}
                className={`${inputStyle} h-24 resize-none`}
                placeholder="Olá {nome}, sua fatura vence hoje..."
              />
              <p className="text-xs text-zinc-500 mt-1">Variáveis: {'{nome}'}, {'{valor}'}, {'{vencimento}'}, {'{link_pagamento}'}</p>
            </div>

            <Button onClick={handleSaveRule} isLoading={loadingAutomation} className="w-full mt-2">Salvar Regra</Button>
          </div>
        </Modal>
      )}
    </div>
  );
};

const Modal = ({ title, onClose, children }: any) => (
  <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-in zoom-in duration-200">
      <div className="flex justify-between items-center mb-6 border-b border-zinc-800 pb-4">
        <h3 className="text-xl font-bold text-[#D4AF37]">{title}</h3>
        <button onClick={onClose} className="text-zinc-500 hover:text-white"><X /></button>
      </div>
      {children}
    </div>
  </div>
);
