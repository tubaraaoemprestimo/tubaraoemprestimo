# 🔐 Análise e Melhorias - Autenticação Biométrica

**Projeto:** Tubarão Empréstimos
**Data:** 2026-02-23
**Status:** Sistema já implementado com WebAuthn

---

## ✅ O que já está implementado

### 1. **Tecnologia Base**
- ✅ **WebAuthn API** (W3C Standard)
- ✅ Suporte a Face ID, Touch ID, Windows Hello, Android Fingerprint
- ✅ Credenciais armazenadas no backend (`webauthn_credentials` table)
- ✅ Referência local em `localStorage` (`biometric_credential`)

### 2. **Fluxo de Registro**
- ✅ Auto-registro após primeiro login com senha
- ✅ Registro manual via botão de biometria no login
- ✅ Detecção de dispositivo (mobile vs desktop)
- ✅ Exclusão de credenciais duplicadas

### 3. **Fluxo de Autenticação**
- ✅ `BiometricAccessGate` - desafia usuário CLIENT ao acessar app
- ✅ Botão de login biométrico na tela de login
- ✅ Autenticação específica por usuário (`authenticateForUser`)
- ✅ Logs de antifraud para todos os eventos biométricos

### 4. **Armazenamento Seguro**
- ✅ Tokens JWT em `localStorage` (`tubarao_auth`)
- ✅ Credenciais biométricas em `localStorage` (`bio_auth_{userId}`)
  - Email + senha em base64 (para re-login após biometria)
- ✅ Sessão biométrica em `sessionStorage` (`biometric_verified_{userId}`)
- ✅ Referência de credencial WebAuthn em `localStorage` (`biometric_credential`)

### 5. **Fallback**
- ✅ Desktop: pula biometria automaticamente (evita Windows Hello indesejado)
- ✅ Mobile sem biometria: permite continuar sem bloquear
- ✅ Falha na autenticação: botões "Tentar novamente" e "Continuar sem biometria"
- ✅ Erro de registro: permite acesso sem biometria

### 6. **UX/UI**
- ✅ Botão visual "Entrar com Biometria" no login (ícone Fingerprint)
- ✅ Animação de scanning durante autenticação
- ✅ Tela de validação no `BiometricAccessGate`
- ✅ Mensagens de erro claras e específicas

---

## 🔧 Melhorias Propostas

### **1. Armazenamento Mais Seguro (Crítico)**

**Problema atual:**
- Senha armazenada em `localStorage` como base64 (`btoa(password)`)
- Base64 **NÃO é criptografia** - é facilmente reversível
- Qualquer script malicioso pode ler `localStorage`

**Solução:**
- Usar **Web Crypto API** para criptografar a senha com chave derivada do dispositivo
- Ou melhor: **não armazenar senha** - usar refresh token de longa duração
- Backend deve emitir um `biometric_refresh_token` específico após login biométrico bem-sucedido

**Implementação:**
```typescript
// Opção 1: Criptografar senha com Web Crypto API
async function encryptPassword(password: string, userId: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);

  // Derivar chave do userId + device fingerprint
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(userId + navigator.userAgent),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: encoder.encode('tubarao'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);

  return JSON.stringify({
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(encrypted))
  });
}

// Opção 2 (MELHOR): Backend emite token específico para biometria
// POST /auth/biometric-token após login bem-sucedido
// Retorna: { biometricToken: "long-lived-refresh-token" }
// Armazenar: localStorage.setItem(`bio_token_${userId}`, biometricToken)
// Login biométrico: POST /auth/biometric-login { credentialId, biometricToken }
```

---

### **2. Melhorar Fallback para PIN do Dispositivo**

**Problema atual:**
- Se biometria falhar, só oferece "Continuar sem biometria" ou "Voltar para login"
- Não tenta usar o PIN/senha do dispositivo como fallback nativo

**Solução:**
- WebAuthn já suporta `userVerification: 'preferred'` (tenta biometria, fallback para PIN)
- Atualmente usa `'required'` - forçar biometria ou falhar
- Mudar para `'preferred'` permite que o SO decida o fallback

**Implementação:**
```typescript
// Em biometricService.ts, linha 336
authenticatorSelection: {
  authenticatorAttachment: 'platform',
  userVerification: 'preferred', // ← era 'required'
  residentKey: 'preferred',
}
```

---

### **3. Adicionar Indicador Visual de Biometria Ativa**

**Problema atual:**
- Usuário não sabe se biometria está ativa até tentar acessar o app
- Não há indicador no perfil/configurações

**Solução:**
- Adicionar badge "🔐 Biometria Ativa" na tela de perfil
- Botão para desativar/reativar biometria
- Mostrar dispositivos cadastrados (nome + data)

**Implementação:**
```tsx
// Em pages/client/Profile.tsx
<div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
  <div className="flex items-center justify-between mb-2">
    <div className="flex items-center gap-2">
      <Fingerprint size={20} className="text-[#D4AF37]" />
      <span className="font-bold">Autenticação Biométrica</span>
    </div>
    {hasBiometric && (
      <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">Ativa</span>
    )}
  </div>
  <p className="text-zinc-400 text-sm mb-3">
    Use Face ID ou impressão digital para acessar o app com segurança.
  </p>
  {hasBiometric ? (
    <button onClick={handleRemoveBiometric} className="text-red-400 text-sm">
      Desativar biometria
    </button>
  ) : (
    <button onClick={handleRegisterBiometric} className="text-[#D4AF37] text-sm">
      Ativar biometria
    </button>
  )}
</div>
```

---

### **4. Melhorar Mensagens de Erro (UX)**

**Problema atual:**
- Mensagens técnicas: "Credencial biométrica não encontrada"
- Usuário leigo não entende

**Solução:**
- Mensagens mais amigáveis e acionáveis

**Implementação:**
```typescript
// Mapeamento de erros amigáveis
const FRIENDLY_ERRORS = {
  'NotAllowedError': 'Você cancelou a autenticação. Tente novamente ou use sua senha.',
  'InvalidStateError': 'Sua biometria já está cadastrada neste dispositivo.',
  'NotSupportedError': 'Seu navegador não suporta biometria. Use Chrome ou Safari.',
  'credential_not_found': 'Biometria não cadastrada. Faça login com senha para ativar.',
  'platform_unavailable': 'Configure Face ID ou impressão digital nas configurações do seu celular primeiro.',
};
```

---

### **5. Adicionar Timeout e Retry Automático**

**Problema atual:**
- Se biometria travar (iOS às vezes trava), usuário fica preso
- Sem timeout definido

**Solução:**
- Timeout de 30s na autenticação
- Após 3 falhas consecutivas, pular biometria automaticamente

**Implementação:**
```typescript
// Em BiometricAccessGate.tsx
const MAX_RETRIES = 3;
const TIMEOUT_MS = 30000;

let retryCount = 0;

const authWithTimeout = Promise.race([
  biometricService.authenticateForUser(user.id),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error('TIMEOUT')), TIMEOUT_MS)
  )
]);

try {
  const result = await authWithTimeout;
  // ...
} catch (err) {
  retryCount++;
  if (retryCount >= MAX_RETRIES || err.message === 'TIMEOUT') {
    // Pular biometria e permitir acesso
    sessionStorage.setItem(skipKey, new Date().toISOString());
    setVerifying(false);
    return;
  }
  // Tentar novamente
}
```

---

### **6. Suporte a Múltiplos Dispositivos**

**Problema atual:**
- Sistema já suporta múltiplas credenciais por usuário
- Mas não há UI para gerenciar dispositivos cadastrados

**Solução:**
- Tela de "Dispositivos Confiáveis" no perfil
- Listar todos os dispositivos com biometria cadastrada
- Permitir remover dispositivos específicos

**Implementação:**
```tsx
// Nova página: pages/client/TrustedDevices.tsx
<div className="space-y-3">
  {devices.map(device => (
    <div key={device.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-bold">{device.device_name}</p>
          <p className="text-xs text-zinc-500">
            Cadastrado em {new Date(device.created_at).toLocaleDateString()}
          </p>
          <p className="text-xs text-zinc-500">
            Último uso: {new Date(device.last_used_at).toLocaleDateString()}
          </p>
        </div>
        <button onClick={() => removeDevice(device.id)} className="text-red-400">
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  ))}
</div>
```

---

### **7. Adicionar Biometria para Ações Sensíveis**

**Problema atual:**
- Biometria só é usada no login/acesso ao app
- Ações sensíveis (transferências, mudança de senha) não pedem reautenticação

**Solução:**
- Criar `useBiometricConfirm()` hook
- Pedir biometria antes de ações críticas

**Implementação:**
```typescript
// hooks/useBiometricConfirm.ts
export function useBiometricConfirm() {
  const confirm = async (action: string): Promise<boolean> => {
    const user = apiService.auth.getUser();
    if (!user) return false;

    const result = await biometricService.authenticateForUser(user.id);

    if (result.success) {
      await antifraudService.logRiskEvent('BIOMETRIC_CONFIRM', user.id, { action });
      return true;
    }

    return false;
  };

  return { confirm };
}

// Uso em componente:
const { confirm } = useBiometricConfirm();

const handleWithdraw = async () => {
  const authorized = await confirm('WITHDRAW_FUNDS');
  if (!authorized) {
    toast.error('Autenticação biométrica necessária');
    return;
  }
  // Prosseguir com saque
};
```

---

## 📊 Comparação: Antes vs Depois das Melhorias

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Armazenamento de senha** | Base64 em localStorage (inseguro) | Criptografado com Web Crypto ou token específico |
| **Fallback** | Só "Continuar sem biometria" | PIN do dispositivo automático (`userVerification: preferred`) |
| **Indicador visual** | Nenhum | Badge "Biometria Ativa" no perfil |
| **Mensagens de erro** | Técnicas | Amigáveis e acionáveis |
| **Timeout** | Nenhum (pode travar) | 30s + retry automático |
| **Gestão de dispositivos** | Nenhuma UI | Tela "Dispositivos Confiáveis" |
| **Reautenticação** | Só no login | Ações sensíveis pedem biometria |

---

## 🚀 Priorização de Implementação

### **Fase 1 - Crítico (Segurança)**
1. ✅ Substituir base64 por criptografia ou token específico
2. ✅ Adicionar timeout e retry automático
3. ✅ Melhorar fallback (`userVerification: preferred`)

### **Fase 2 - UX**
4. ✅ Mensagens de erro amigáveis
5. ✅ Indicador visual de biometria ativa no perfil
6. ✅ Botão para ativar/desativar biometria

### **Fase 3 - Avançado**
7. ✅ Tela de dispositivos confiáveis
8. ✅ Biometria para ações sensíveis (hook `useBiometricConfirm`)

---

## 📝 Conclusão

O sistema de autenticação biométrica do Tubarão Empréstimos **já está funcional e bem implementado** com WebAuthn. As melhorias propostas focam em:

1. **Segurança** - Criptografar credenciais armazenadas
2. **UX** - Mensagens claras, indicadores visuais, gestão de dispositivos
3. **Confiabilidade** - Timeout, retry, fallback automático

**Próximo passo:** Implementar as melhorias da Fase 1 (críticas de segurança) primeiro.
