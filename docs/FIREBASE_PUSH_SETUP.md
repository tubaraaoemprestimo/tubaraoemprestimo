# 🔥 Configuração Firebase Push Notifications

## Passo 1: Criar Projeto no Firebase

1. Acesse https://console.firebase.google.com
2. Clique em "Adicionar projeto"
3. Nome: `tubarao-emprestimos`
4. Desativar Google Analytics (opcional)
5. Criar projeto

## Passo 2: Adicionar App Web

1. No projeto criado, clique no ícone **Web** (</>)
2. Registre o app com nome: `Tubarão Empréstimos Web`
3. **NÃO** ative Firebase Hosting
4. Copie as credenciais:

```javascript
const firebaseConfig = {
    apiKey: "AIzaSyB...",
    authDomain: "tubarao-emprestimos.firebaseapp.com",
    projectId: "tubarao-emprestimos",
    storageBucket: "tubarao-emprestimos.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc123"
};
```

## Passo 3: Obter Credenciais

### VAPID Key (para Web Push)
1. Vá em **Project Settings** (engrenagem)
2. Aba **Cloud Messaging**
3. Seção **Configuração da Web**
4. Gere um **par de chaves de push da Web**
5. Copie a **Chave pública** (VAPID Key)

### Server Key (para enviar do servidor)
1. Na mesma aba **Cloud Messaging**
2. Seção **API Cloud Messaging (legada)**
3. Se estiver desabilitada, clique nos 3 pontinhos e ative
4. Copie a **Chave do servidor**

## Passo 4: Atualizar os Arquivos

### 1. `services/firebasePushService.ts`
Substitua as configurações:
```typescript
const FIREBASE_CONFIG = {
    apiKey: "SUA_API_KEY",
    authDomain: "tubarao-emprestimos.firebaseapp.com",
    projectId: "tubarao-emprestimos",
    storageBucket: "tubarao-emprestimos.appspot.com",
    messagingSenderId: "SEU_SENDER_ID",
    appId: "SEU_APP_ID",
    vapidKey: "SUA_VAPID_KEY"
};
```

### 2. `public/firebase-messaging-sw.js`
Substitua as mesmas configurações (sem vapidKey):
```javascript
const firebaseConfig = {
    apiKey: "SUA_API_KEY",
    authDomain: "tubarao-emprestimos.firebaseapp.com",
    projectId: "tubarao-emprestimos",
    storageBucket: "tubarao-emprestimos.appspot.com",
    messagingSenderId: "SEU_SENDER_ID",
    appId: "SEU_APP_ID"
};
```

## Passo 5: Configurar Supabase Secrets

No Dashboard do Supabase:
1. Vá em **Project Settings** > **Edge Functions** > **Secrets**
2. Adicione:
   - `FIREBASE_SERVER_KEY` = Chave do servidor (do passo 3)

## Passo 6: Deploy da Edge Function

```bash
supabase functions deploy send-push
```

Ou pelo Dashboard:
1. Edge Functions > + New function
2. Nome: `send-push`
3. Cole o código de `supabase/functions/send-push/index.ts`

## Passo 7: Testar

### Testar Token (Console do navegador):
```javascript
await window.firebasePushService?.requestPermissionAndGetToken()
```

### Testar Envio (após obter token):
```javascript
await window.firebasePushService?.sendPush({
    to: 'seu@email.com',
    title: 'Teste Push',
    body: 'Notificação de teste!'
})
```

## Checklist Final

- [ ] Projeto Firebase criado
- [ ] App Web registrado
- [ ] VAPID Key gerada
- [ ] Server Key obtida
- [ ] `firebasePushService.ts` atualizado
- [ ] `firebase-messaging-sw.js` atualizado
- [ ] Secret `FIREBASE_SERVER_KEY` configurado no Supabase
- [ ] Edge Function `send-push` deployada
- [ ] SQL `push_notifications.sql` executado no Supabase
- [ ] Testado com sucesso!

## Troubleshooting

### Push não chega?
1. Verifique se permitiu notificações no navegador
2. Abra DevTools > Application > Service Workers
3. Confirme que `firebase-messaging-sw.js` está registrado
4. Verifique se o token foi salvo na tabela `push_subscriptions`

### Erro de permissão?
- No celular, certifique-se de que o PWA foi instalado
- Alguns navegadores bloqueiam push em localhost (use HTTPS)

### Token inválido?
- Tokens expiram após algum tempo sem uso
- O sistema limpa automaticamente tokens inválidos
