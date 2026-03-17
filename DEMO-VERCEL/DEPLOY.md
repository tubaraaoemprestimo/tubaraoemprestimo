# 🚀 Deploy no Vercel - Tubarão Empréstimos

## 📦 Arquivos Necessários

Certifique-se de que você tem os seguintes arquivos no diretório:

```
DEMO-VERCEL/
├── index.html          ✅ (40KB, 811 linhas)
├── vercel.json         ✅ (configuração)
├── package.json        ✅ (metadata)
├── README.md           ✅ (documentação)
└── DEPLOY.md           ✅ (este arquivo)
```

---

## 🌐 Deploy via Vercel CLI

### 1. Instalar Vercel CLI (se ainda não tiver)

```bash
npm install -g vercel
```

### 2. Fazer login no Vercel

```bash
vercel login
```

### 3. Deploy do projeto

```bash
cd "J:/AREA DE TRABALHO/Projetos/TUBARÃO EMPRÉSTIMOS LTDA/DEMO-VERCEL"
vercel
```

### 4. Deploy em produção

```bash
vercel --prod
```

---

## 🌐 Deploy via Vercel Dashboard

### Opção 1: Arrastar e Soltar

1. Acesse https://vercel.com/new
2. Arraste a pasta `DEMO-VERCEL` para o upload
3. Clique em "Deploy"
4. Aguarde o deploy finalizar
5. Acesse a URL gerada

### Opção 2: GitHub Integration

1. Crie um repositório no GitHub
2. Faça push dos arquivos:
   ```bash
   git init
   git add .
   git commit -m "Deploy Tubarão Empréstimos"
   git remote add origin https://github.com/seu-usuario/tubarao-demo.git
   git push -u origin main
   ```
3. Conecte o repositório no Vercel Dashboard
4. Configure o projeto:
   - **Framework Preset:** Other
   - **Root Directory:** ./
   - **Build Command:** (deixe vazio)
   - **Output Directory:** ./
5. Clique em "Deploy"

---

## ⚙️ Configuração do vercel.json

O arquivo `vercel.json` já está configurado:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Isso garante que todas as rotas redirecionem para o `index.html` (SPA).

---

## 🔗 URLs Esperadas

Após o deploy, você terá:

- **Preview:** `https://tubarao-demo-xxxxx.vercel.app`
- **Production:** `https://tubarao-emprestimos.vercel.app` (se configurar domínio customizado)

---

## 🧪 Testar Localmente

### Opção 1: Vercel Dev

```bash
vercel dev
```

Acesse: http://localhost:3000

### Opção 2: Python HTTP Server

```bash
cd "J:/AREA DE TRABALHO/Projetos/TUBARÃO EMPRÉSTIMOS LTDA/DEMO-VERCEL"
python -m http.server 8000
```

Acesse: http://localhost:8000

### Opção 3: Live Server (VS Code)

1. Instale a extensão "Live Server"
2. Clique com botão direito em `index.html`
3. Selecione "Open with Live Server"

---

## 🎯 Checklist Pré-Deploy

- [x] Arquivo `index.html` criado (811 linhas)
- [x] Todas as 12 páginas implementadas
- [x] Cores oficiais aplicadas (#D4AF37, #000, etc)
- [x] Responsividade testada
- [x] Credenciais demo funcionando
- [x] Navegação entre páginas OK
- [x] Ícones Lucide renderizando
- [x] LocalStorage persistindo sessão
- [x] `vercel.json` configurado
- [x] `package.json` criado

---

## 🐛 Troubleshooting

### Problema: Página em branco após deploy

**Solução:** Verifique se o `vercel.json` está configurado corretamente com o rewrite.

### Problema: Ícones não aparecem

**Solução:** Certifique-se de que o CDN do Lucide está carregando:
```html
<script src="https://unpkg.com/lucide@latest"></script>
```

### Problema: Estilos não aplicados

**Solução:** Verifique se o Tailwind CSS está carregando:
```html
<script src="https://cdn.tailwindcss.com"></script>
```

### Problema: Login não funciona

**Solução:** Abra o Console do navegador (F12) e verifique erros JavaScript.

---

## 📊 Performance

### Métricas Esperadas

- **First Contentful Paint:** < 1s
- **Time to Interactive:** < 2s
- **Total Bundle Size:** ~40KB (HTML) + CDNs
- **Lighthouse Score:** 90+

### Otimizações Futuras

1. Substituir CDNs por arquivos locais
2. Minificar HTML/CSS/JS
3. Adicionar Service Worker (PWA)
4. Implementar lazy loading de imagens
5. Adicionar cache headers

---

## 🔒 Segurança

### ⚠️ Importante

Este é um **DEMO** com credenciais hardcoded. Para produção:

1. **NUNCA** use credenciais em plain text
2. Implemente autenticação real (JWT, OAuth)
3. Conecte com backend seguro (HTTPS)
4. Adicione rate limiting
5. Implemente CORS adequadamente
6. Use variáveis de ambiente

---

## 🎨 Customização

### Alterar Cores

Edite as classes Tailwind no HTML:

```html
<!-- Cor primária (gold) -->
text-[#D4AF37]  →  text-[#SUA_COR]
bg-[#D4AF37]    →  bg-[#SUA_COR]

<!-- Background -->
bg-black        →  bg-[#SUA_COR]
bg-zinc-950     →  bg-[#SUA_COR]
```

### Adicionar Logo

Substitua o emoji 🦈 por uma imagem:

```html
<img src="/logo.png" alt="Logo" class="w-8 h-8">
```

---

## 📞 Suporte

- **Documentação Vercel:** https://vercel.com/docs
- **Tailwind CSS:** https://tailwindcss.com/docs
- **Lucide Icons:** https://lucide.dev

---

## ✅ Deploy Completo!

Após seguir estes passos, seu sistema estará online e acessível publicamente.

**URL de exemplo:** https://tubarao-emprestimos.vercel.app

**Credenciais demo:**
- Admin: admin@tubarao.com / admin123
- Cliente: cliente@tubarao.com / cliente123

---

**Última atualização:** 16/03/2026 18:17
