# 🧪 TESTE IMEDIATO - Funil de Vendas

**Execute AGORA para validar que tudo funciona!**

---

## ⚡ TESTE RÁPIDO (2 minutos)

### 1️⃣ Abrir Terminal
```bash
cd "/d/Projetos/TUBARÃO EMPRESTIMOS"
```

### 2️⃣ Iniciar Servidor
```bash
npm run dev
```

Aguarde aparecer:
```
  VITE v4.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

### 3️⃣ Testar Cada Página

Abra o navegador e acesse:

#### ETAPA 1 - Pré-Lançamento
```
http://localhost:5173/#/funil/pre-lancamento
```
**Deve mostrar:**
- ✅ Contador regressivo funcionando
- ✅ Preço R$ 497 (ou R$ 697 se expirado)
- ✅ Botão "GARANTIR MINHA VAGA AGORA"
- ✅ Grid de 6 benefícios

#### ETAPA 2 - Pós-Compra
```
http://localhost:5173/#/funil/pos-compra
```
**Deve mostrar:**
- ✅ Mensagem "Parabéns! Você Está Dentro"
- ✅ 2 cards de produtos (Limpa Nome R$ 297, Financiamento Moto R$ 497)
- ✅ Botão "Não, obrigado"

#### ETAPA 3 - Mentoria Online
```
http://localhost:5173/#/funil/mentoria-online
```
**Deve mostrar:**
- ✅ Preço R$ 997
- ✅ Grid de 6 benefícios
- ✅ 3 depoimentos
- ✅ Botão "Não, quero continuar sem a mentoria"

#### ETAPA 4 - Mentoria Presencial
```
http://localhost:5173/#/funil/mentoria-presencial
```
**Deve mostrar:**
- ✅ Preço R$ 5.997
- ✅ Botão "APLICAR PARA MENTORIA PRESENCIAL"
- ✅ Ao clicar, abre modal com formulário
- ✅ Formulário tem 6 campos

#### FINAL - Obrigado
```
http://localhost:5173/#/funil/obrigado-final
```
**Deve mostrar:**
- ✅ Mensagem "Obrigado! Sua Aplicação Foi Enviada"
- ✅ 3 próximos passos numerados
- ✅ 3 cards de preparação

---

## ✅ CHECKLIST DE VALIDAÇÃO

### Visual
- [ ] Todas as páginas carregam sem erro
- [ ] Design está bonito (preto com dourado)
- [ ] Textos estão legíveis
- [ ] Botões estão visíveis

### Funcionalidade
- [ ] Contador regressivo está rodando (ETAPA 1)
- [ ] Botões de CTA funcionam
- [ ] Navegação entre páginas funciona
- [ ] Modal do formulário abre (ETAPA 4)

### Responsividade
- [ ] Abrir DevTools (F12)
- [ ] Toggle device toolbar (Ctrl+Shift+M)
- [ ] Testar em iPhone SE (375px)
- [ ] Testar em iPad (768px)
- [ ] Tudo deve estar responsivo

---

## 🧪 TESTE DO FORMULÁRIO

### 1. Acessar ETAPA 4
```
http://localhost:5173/#/funil/mentoria-presencial
```

### 2. Clicar em "APLICAR PARA MENTORIA PRESENCIAL"

### 3. Preencher Formulário
- **Nome:** Teste Silva
- **WhatsApp:** (11) 99999-9999 (deve aplicar máscara automática)
- **Cidade:** São Paulo/SP
- **Capital:** Selecionar qualquer opção
- **Experiência:** Selecionar qualquer opção
- **Objetivo:** "Quero construir um negócio de 6 dígitos por mês com o método tubarão" (mínimo 20 caracteres)

### 4. Clicar em "ENVIAR APLICAÇÃO"

**Resultado esperado:**
- ⚠️ Erro: "Erro ao enviar aplicação" (normal, API ainda não existe)
- ✅ Validação funcionando
- ✅ Máscara de WhatsApp funcionando

---

## 🎨 TESTE VISUAL

### Cores Esperadas
- **Background:** Preto (#000000)
- **Cards:** Zinc escuro (#18181b)
- **Destaques:** Dourado (#D4AF37)
- **Botões CTA:** Gradiente dourado

### Animações
- ✅ Fade-in ao carregar
- ✅ Hover nos botões (scale 105%)
- ✅ Transições suaves

---

## 📱 TESTE MOBILE

### iPhone (375px)
```
F12 → Toggle Device Toolbar → iPhone SE
```
- [ ] Texto legível
- [ ] Botões clicáveis
- [ ] Formulário usável
- [ ] Scroll funciona

### iPad (768px)
```
F12 → Toggle Device Toolbar → iPad
```
- [ ] Layout em 2 colunas (benefícios)
- [ ] Espaçamento adequado
- [ ] Vídeo responsivo

---

## ⚠️ PROBLEMAS COMUNS

### Erro: "Cannot GET /funil/pre-lancamento"
**Solução:** Use `/#/` no lugar de `/`:
```
http://localhost:5173/#/funil/pre-lancamento
```

### Vídeos não carregam
**Normal:** Os vídeos ainda não foram feitos upload.
Você verá um fundo preto com controles.

### Formulário dá erro ao enviar
**Normal:** A API backend ainda não foi criada.
O importante é que a validação funcione.

---

## ✅ RESULTADO ESPERADO

Se tudo estiver OK, você deve conseguir:
1. ✅ Navegar por todas as 5 páginas
2. ✅ Ver o contador regressivo funcionando
3. ✅ Abrir o modal do formulário
4. ✅ Preencher o formulário com máscara
5. ✅ Ver as validações funcionando

---

## 🎉 SUCESSO!

Se todos os testes passaram:
- ✅ **Funil está 100% funcional**
- ✅ **Pronto para fazer push**
- ✅ **Pronto para próxima etapa (backend)**

---

## 📋 PRÓXIMOS PASSOS

Após validar que tudo funciona:

1. **Push para GitHub** (via GitHub Desktop)
2. **Criar API backend** (ver FUNIL_README.md)
3. **Configurar URLs Asaas** (4 links)
4. **Upload vídeos** (5 arquivos MP4)
5. **Deploy produção**

---

**Tempo de teste:** 2-5 minutos
**Data:** 2026-02-23 12:23
**Status:** Pronto para testar!
