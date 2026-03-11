# 🎯 SUPORTE MULTIMODAL - GUIA DE TESTE

**Data**: 2026-03-11 16:32 UTC
**Status**: ✅ IMPLEMENTADO E FUNCIONANDO

---

## 🚀 O QUE FOI IMPLEMENTADO

A IA agora processa **áudio, imagens e documentos** enviados no WhatsApp:

### 1. **Áudio** 🎤
- **Tecnologia**: Groq Whisper (whisper-large-v3)
- **Processo**: Áudio → Transcrição → IA responde ao texto
- **Idioma**: Português (configurado)
- **Formato**: Aceita qualquer áudio do WhatsApp (ogg, mp3, m4a)

### 2. **Imagem** 🖼️
- **Tecnologia**: Claude Vision (Anthropic)
- **Processo**: Imagem → Análise visual → IA descreve e responde
- **Formatos**: PNG, JPEG, WebP
- **Uso**: Cliente pode enviar foto de documento, comprovante, etc.

### 3. **Documento/PDF** 📄
- **Tecnologia**: pdf-parse
- **Processo**: PDF → Extração de texto → IA lê e responde
- **Formatos**: PDF, TXT
- **Limite**: 2000 caracteres extraídos

---

## 🧪 COMO TESTAR

### Teste 1: Áudio
1. Abra o WhatsApp conectado à instância Tubarão
2. Grave um áudio dizendo: *"Olá, gostaria de saber como funciona o empréstimo"*
3. Envie o áudio
4. **Resultado esperado**: IA transcreve e responde sobre empréstimos

### Teste 2: Imagem
1. Tire uma foto de um documento (RG, comprovante, etc.)
2. Envie a imagem com legenda: *"O que você vê nesta imagem?"*
3. **Resultado esperado**: IA descreve o que vê na imagem

### Teste 3: Imagem sem legenda
1. Envie apenas uma imagem (sem texto)
2. **Resultado esperado**: IA analisa e descreve automaticamente

### Teste 4: Documento PDF
1. Envie um PDF (contrato, comprovante, etc.)
2. Adicione texto: *"Analise este documento"*
3. **Resultado esperado**: IA extrai texto e responde sobre o conteúdo

### Teste 5: Áudio + Texto
1. Grave áudio: *"Quanto é o juros?"*
2. Adicione legenda: *"Preciso de informações urgentes"*
3. **Resultado esperado**: IA considera áudio transcrito + texto da legenda

---

## 📊 LOGS PARA MONITORAR

Conecte no servidor e monitore em tempo real:

```bash
ssh -i ssh-key-2026-02-12.key ubuntu@136.248.115.113
cd ~/backend/backend
pm2 logs tubarao-backend --lines 0
```

**O que procurar nos logs:**

```
[Webhook] 📎 Processando mídia: audio=true, image=false, doc=false
[Webhook] 🎤 Áudio transcrito: Olá, gostaria de saber...
[Webhook] 🖼️ Imagem processada: A imagem mostra um documento...
[Webhook] 📄 Documento extraído: Contrato de empréstimo...
[Webhook] Chamando IA: provider=groq, keyLen=56
[Webhook] ✅ Resposta IA enviada para 5511999999999 (groq)
```

---

## ⚙️ CONFIGURAÇÃO NECESSÁRIA

### Para Áudio (Whisper):
- ✅ Groq API Key configurada (já está)
- ✅ Provider: groq (já está)

### Para Imagem (Claude Vision):
- ⚠️ **NECESSÁRIO**: Anthropic API Key
- Vá em **Central IA** → Configure `anthropicApiKey`
- Sem essa chave, imagens não serão processadas

### Para Documentos:
- ✅ Nenhuma configuração extra (usa pdf-parse local)

---

## 🔧 CONFIGURAR ANTHROPIC API KEY

1. Acesse: https://console.anthropic.com/settings/keys
2. Crie uma nova API key
3. No painel admin → **Central IA**:
   - Campo: `Anthropic API Key`
   - Cole a chave
   - Salve

**Ou via banco de dados:**
```sql
UPDATE ai_chatbot_config
SET anthropic_api_key = 'sk-ant-api03-...'
WHERE id = 'da361898-294f-4e02-a4ff-664f02cf52d0';
```

---

## 🎯 FLUXO COMPLETO

```
Cliente envia áudio no WhatsApp
    ↓
Evolution API → Webhook Backend
    ↓
Detecta tipo de mídia (áudio)
    ↓
Baixa áudio da Evolution API
    ↓
Envia para Groq Whisper
    ↓
Recebe transcrição: "Olá, gostaria de saber..."
    ↓
Adiciona ao contexto: [ÁUDIO TRANSCRITO]: ...
    ↓
Envia para IA (Groq) com prompt do admin + contexto
    ↓
IA responde considerando o áudio transcrito
    ↓
Resposta enviada via WhatsApp
```

---

## 📝 HISTÓRICO NO BANCO

As mensagens com mídia são salvas assim:

```
Mensagem do usuário: "Preciso de ajuda [ÁUDIO TRANSCRITO]: Olá, gostaria de saber como funciona o empréstimo"
Resposta da IA: "Olá! 🦈 Claro, vou explicar..."
```

---

## ⚠️ LIMITAÇÕES ATUAIS

1. **Vídeo**: Não suportado (apenas áudio extraído)
2. **Imagens**: Requer Anthropic API Key configurada
3. **PDFs grandes**: Limitado a 2000 caracteres
4. **Áudio longo**: Whisper pode demorar ~5-10s

---

## 🐛 TROUBLESHOOTING

### Áudio não transcreve:
- Verifique se Groq API Key está configurada
- Logs devem mostrar: `[Webhook] 🎤 Áudio transcrito: ...`

### Imagem não processa:
- Configure Anthropic API Key
- Logs devem mostrar: `[Webhook] 🖼️ Imagem processada: ...`

### Documento não extrai:
- Verifique se é PDF válido
- Logs devem mostrar: `[Webhook] 📄 Documento extraído: ...`

---

## ✅ STATUS ATUAL

- ✅ Backend rodando (porta 3001)
- ✅ WhatsApp conectado (Evolution API)
- ✅ IA respondendo clientes reais
- ✅ Suporte multimodal implementado
- ⚠️ Anthropic API Key pendente (para imagens)

**Teste agora enviando um áudio no WhatsApp!** 🎤
