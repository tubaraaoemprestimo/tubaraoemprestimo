# 🔔 Sistema de Push Notifications - Validação Completa

**Data**: 2026-03-18 12:20
**Status**: ✅ CONFIGURADO E PRONTO PARA TESTE

---

## 📋 Resumo das Correções

### Problema Identificado
- ❌ Notificações push não chegavam nos celulares
- ❌ Chaves VAPID não estavam configuradas no servidor
- ❌ Endpoint `/push/subscriptions` não existia (Firebase esperava, mas backend só tinha `/push/register`)
- ❌ Endpoint `/vapid-key` estava protegido por autenticação (frontend não conseguia acessar)

### Soluções Implementadas

#### 1. ✅ Chaves VAPID Geradas e Configuradas
```bash
# Adicionado ao /home/ubuntu/backend/backend/.env
VAPID_PUBLIC_KEY=BNAi2-1voeaNPXC7eBAPqf4LmhUlbDzjAgc3F-EKCeDel4xBf5WXS5fmokkRD6-xjafB4k0vEHi1Xyi_XQikIPA
VAPID_PRIVATE_KEY=XvwlV0HGjBb_XXR_MPtE0YvYguwJCuSdnOzEs_EQffc
VAPID_SUBJECT=mailto:tubaraao.emprestimo@gmail.com
```

**Validação**:
```bash
curl https://app-api.tubaraoemprestimo.com.br/api/push/vapid-key
# Retorna: {"publicKey":"BNAi2-1voeaNPXC7eBAPqf4LmhUlbDzjAgc3F-EKCeDel4xBf5WXS5fmokkRD6-xjafB4k0vEHi1Xyi_XQikIPA"}
```

#### 2. ✅ Endpoint `/vapid-key` Tornado Público
**Antes**: Endpoint estava após `pushRouter.use(authenticate)` - bloqueado
**Depois**: Movido para ANTES do middleware de autenticação - acessível publicamente

```typescript
// ANTES do authenticate middleware
pushRouter.get('/vapid-key', async (_req: Request, res: Response) => {
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
    if (!vapidPublicKey) {
        res.json({ publicKey: null, message: 'VAPID keys não configuradas' });
        return;
    }
    res.json({ publicKey: vapidPublicKey });
});

// DEPOIS aplica autenticação para outros endpoints
pushRouter.use(authenticate);
```

#### 3. ✅ Endpoint `/push/subscriptions` Criado para Firebase
**Novo endpoint** para registrar tokens FCM (Firebase Cloud Messaging):

```typescript
// POST /api/push/subscriptions - Registrar FCM token (Firebase)
pushRouter.post('/subscriptions', async (req: Request, res: Response) => {
    const { fcm_token, user_email, device_type, device_info } = req.body;

    // Salva FCM token no campo 'endpoint' da tabela push_subscriptions
    // (reutilizando estrutura existente)

    console.log(`[Push] FCM token registrado para user ${userId}`);
    res.json({ success: true, message: 'Token registrado' });
});
```

#### 4. ✅ Dependência `node-cron` Instalada
```bash
npm install node-cron @types/node-cron
```

---

## 🏗️ Arquitetura do Sistema

### Frontend (Firebase Cloud Messaging)
```
App.tsx (linha 468)
  └─> firebasePushService.init()
       └─> Inicializa Firebase
       └─> Registra Service Worker (/firebase-messaging-sw.js)
       └─> Solicita permissão de notificação
       └─> Obtém FCM token
       └─> Salva token via POST /api/push/subscriptions
```

### Backend (Web Push + Firebase)
```
/api/push/vapid-key (público)
  └─> Retorna chave pública VAPID

/api/push/subscriptions (autenticado)
  └─> Registra FCM token do Firebase
  └─> Salva em push_subscriptions.endpoint

/api/push/register (autenticado)
  └─> Registra Web Push nativo (VAPID)
  └─> Salva endpoint, p256dh, auth

/api/push/send (admin only)
  └─> Envia notificação para usuários
  └─> Suporta: "admin", "all", ou array de user IDs
```

### Service Worker
```
/public/firebase-messaging-sw.js
  └─> Recebe notificações em background
  └─> Exibe notificação nativa do sistema
  └─> Redireciona ao clicar (notification.data.url)
```

---

## 🧪 Checklist de Validação

### Backend ✅
- [x] Chaves VAPID configuradas no .env
- [x] Endpoint `/vapid-key` acessível publicamente
- [x] Endpoint `/push/subscriptions` criado
- [x] Backend compilado e deployado
- [x] PM2 reiniciado (restart #364)
- [x] Logs sem erros

### Frontend ✅
- [x] `firebasePushService.ts` implementado
- [x] `PushPermissionBanner.tsx` implementado
- [x] `firebase-messaging-sw.js` no /public
- [x] Firebase config correto (projeto: tubarao-emprestimo)
- [x] App.tsx inicializa push service

### Banco de Dados ✅
- [x] Tabela `push_subscriptions` existe
- [x] Campos: id, userId, endpoint, p256dh, auth, userAgent, createdAt

---

## 📱 Como Testar

### 1. Teste no Celular (Recomendado)
1. Acesse https://www.tubaraoemprestimo.com.br no celular
2. Faça login como cliente ou admin
3. Aguarde 3 segundos - banner de notificação deve aparecer
4. Clique em "Ativar"
5. Permita notificações no navegador
6. Verifique no console do navegador:
   ```
   [FCM] Firebase initialized
   [FCM] Service worker registered
   [FCM] Token obtained: ...
   [FCM] Token saved to database
   ```

### 2. Verificar Token no Banco
```sql
SELECT * FROM push_subscriptions ORDER BY created_at DESC LIMIT 5;
```

### 3. Enviar Notificação de Teste (Admin)
```bash
# Via API (precisa de token admin)
curl -X POST https://app-api.tubaraoemprestimo.com.br/api/push/send \
  -H "Authorization: Bearer SEU_TOKEN_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "all",
    "title": "Teste de Notificação",
    "body": "Se você recebeu isso, o sistema está funcionando!",
    "data": {
      "link": "/client/dashboard"
    }
  }'
```

### 4. Testar Notificação Real
- Admin aprova uma solicitação → Cliente recebe notificação
- Cliente aceita contraproposta → Admin recebe notificação
- Parcela vence → Cliente recebe notificação

---

## 🔍 Troubleshooting

### Notificação não chega no celular

**1. Verificar permissão do navegador**
```javascript
// No console do navegador
console.log(Notification.permission); // Deve ser "granted"
```

**2. Verificar se token foi salvo**
```sql
SELECT * FROM push_subscriptions WHERE user_id = 'SEU_USER_ID';
```

**3. Verificar logs do backend**
```bash
ssh ubuntu@136.248.115.113
pm2 logs tubarao-backend --lines 50 | grep -i "push\|fcm"
```

**4. Verificar Service Worker**
```javascript
// No console do navegador
navigator.serviceWorker.getRegistrations().then(regs => console.log(regs));
```

### Erro "Token não fornecido" ao acessar /vapid-key
- ✅ CORRIGIDO - Endpoint agora é público

### Erro "Cannot find module 'node-cron'"
- ✅ CORRIGIDO - Dependência instalada

---

## 📊 Logs de Deploy

```
2026-03-18 12:15 - Chaves VAPID geradas
2026-03-18 12:16 - Chaves adicionadas ao .env do servidor
2026-03-18 12:17 - Endpoint /vapid-key tornado público
2026-03-18 12:18 - Endpoint /push/subscriptions criado
2026-03-18 12:19 - Backend compilado e deployado
2026-03-18 12:20 - PM2 restart #364 - Backend online
```

---

## 🎯 Próximos Passos

1. **Testar no celular real** - Validar recebimento de notificações
2. **Testar cenários reais**:
   - Aprovação de empréstimo
   - Aceite de contraproposta
   - Vencimento de parcela
3. **Monitorar logs** - Verificar se tokens estão sendo salvos
4. **Ajustar mensagens** - Personalizar títulos e textos das notificações

---

## 📝 Notas Importantes

- **Firebase vs Web Push**: Sistema usa Firebase Cloud Messaging (FCM), não Web Push nativo
- **VAPID keys**: Configuradas mas não usadas pelo Firebase (Firebase tem suas próprias keys)
- **Service Worker**: Arquivo `firebase-messaging-sw.js` deve estar em `/public`
- **Permissões**: Usuário precisa aceitar notificações no navegador
- **iOS Safari**: Notificações push só funcionam em iOS 16.4+ e apenas em PWA instalado

---

**Status Final**: ✅ Sistema configurado e pronto para teste em produção
