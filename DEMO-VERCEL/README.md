# 🦈 Tubarão Empréstimos - Demo Sistema Real

Réplica perfeita do sistema Tubarão Empréstimos em produção para fins de demonstração e marketing.

## ✨ Características

- ✅ **Design idêntico** ao sistema real (Tailwind CSS)
- ✅ **Cores oficiais**: Preto (#000000), Dourado (#D4AF37), Vermelho (#FF0000)
- ✅ **Responsivo**: Mobile-first, tablets e desktops
- ✅ **Sidebar navegável** (desktop) e Bottom Nav (mobile)
- ✅ **Portal do Cliente** completo
- ✅ **Painel Admin** completo
- ✅ **Modal de aprovação** com checkbox de quitação
- ✅ **Dados mockados** realistas

---

## 🚀 Deploy no Vercel

### Opção 1: Deploy Direto (Mais Rápido)

1. Acesse https://vercel.com
2. Clique em "Add New Project"
3. Clique em "Import Third-Party Git Repository"
4. Cole o caminho: `J:\AREA DE TRABALHO\Projetos\TUBARÃO EMPRÉSTIMOS LTDA\DEMO-VERCEL`
5. Ou faça upload manual da pasta
6. Deploy automático!

### Opção 2: Via GitHub

```bash
cd "J:\AREA DE TRABALHO\Projetos\TUBARÃO EMPRÉSTIMOS LTDA\DEMO-VERCEL"
git init
git add .
git commit -m "feat: demo sistema Tubarão Empréstimos"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/tubarao-demo.git
git push -u origin main
```

Depois importe no Vercel:
- Framework: Other
- Build Command: (vazio)
- Output Directory: (vazio)

---

## 🔐 Contas Demo

### Cliente
- **Email**: `joao@email.com`
- **Senha**: `senha123`
- **Acesso**: Portal do cliente com 2 contratos ativos

### Administrador
- **Email**: `admin@tubarao.com`
- **Senha**: `admin123`
- **Acesso**: Painel administrativo completo

---

## 📱 Funcionalidades

### Portal do Cliente
- ✅ Dashboard com KPIs (contratos ativos, valor total, saldo devedor)
- ✅ Tabela de empréstimos ativos
- ✅ Navegação sidebar (desktop) e bottom nav (mobile)
- ✅ Visualização de contratos
- ✅ Acesso a documentos
- ✅ Perfil do usuário

### Painel Administrativo
- ✅ Dashboard com métricas gerais (47 contratos, R$ 284.500 carteira, 156 clientes)
- ✅ Comprovantes pendentes de aprovação
- ✅ Modal de aprovação com checkbox "Quitação Total"
- ✅ Solicitações recentes em análise
- ✅ Sidebar completa com navegação
- ✅ Gestão de clientes e contratos

---

## 🎨 Design System

### Cores
```css
Preto:    #000000  (Background principal)
Dourado:  #D4AF37  (Destaques, botões, títulos)
Vermelho: #FF0000  (Marca Tubarão)
Verde:    #4CAF50  (Status positivo)
Amarelo:  #FFC107  (Pendente)
Azul:     #2196F3  (Ações)
Cinza:    #18181b  (Cards e containers)
```

### Tipografia
- **Fonte**: Inter (system-ui fallback)
- **Títulos**: Bold, Gold
- **Corpo**: Regular, White
- **Labels**: Small, Zinc-400

### Componentes
- **Cards**: `bg-zinc-950 border border-zinc-800 rounded-lg`
- **Botões**: `bg-gold text-black font-bold rounded-lg hover:bg-yellow-500`
- **Tabelas**: Hover effect, zebra striping
- **Badges**: Status coloridos com background opacity

---

## 📊 Dados Mock

### Cliente João Silva
- 2 contratos ativos
- R$ 15.000 valor total emprestado
- R$ 8.450 saldo devedor
- Próximo vencimento: 20/03 (Parcela 4/12 - R$ 850)

### Admin Dashboard
- 47 contratos ativos
- R$ 284.500 em carteira
- 156 clientes cadastrados
- 8 comprovantes pendentes de aprovação
- 2 solicitações em análise

---

## 🛠️ Tecnologias

- **HTML5**: Estrutura semântica
- **Tailwind CSS**: Framework CSS via CDN
- **JavaScript Vanilla**: Lógica e interatividade
- **Responsive Design**: Mobile-first approach
- **Hash Routing**: Navegação SPA

---

## ⚠️ Importante

Este é um **DEMO ESTÁTICO** para demonstração:
- ❌ Não há backend real
- ❌ Não há banco de dados
- ❌ Não há persistência de dados
- ❌ Não há envio de emails
- ❌ Não há integração com APIs

✅ **Ideal para**:
- Apresentações comerciais
- Demonstrações para investidores
- Marketing e captação de clientes
- Validação de UX/UI
- Testes de conceito

---

## 🔗 Sistema Real

- **Produção**: https://tubaraoemprestimo.com.br
- **WhatsApp**: [Link do WhatsApp Business]
- **Instagram**: @tubaraoemprestimos

---

## 📞 Contato

**BM SOLUCTION MARKETING LTDA**
CNPJ: 57.241.795/0001-47

---

## 📝 Changelog

### v1.0.0 (16/03/2026)
- ✅ Réplica perfeita do sistema real
- ✅ Design idêntico com Tailwind CSS
- ✅ Portal cliente completo
- ✅ Painel admin completo
- ✅ Responsivo mobile/desktop
- ✅ Modal de aprovação com quitação

---

*Demo criado em Março 2026 - Réplica fiel do sistema em produção*
