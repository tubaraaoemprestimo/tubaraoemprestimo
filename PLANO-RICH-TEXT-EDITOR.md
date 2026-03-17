# 📋 PLANO: Rich Text Editor + Múltiplos Arquivos no Curso

**Data:** 17/03/2026 14:24
**Objetivo:** Substituir textarea simples por Rich Text Editor e permitir múltiplos arquivos complementares nas aulas

---

## 🎯 PROBLEMA ATUAL

O modal de "Nova Aula" no admin (`CursoAdmin.tsx`) só permite:
- ✅ Título (input text)
- ⚠️ Descrição em texto simples (textarea) — **LIMITADO**
- ✅ Vídeo (.mp4) com upload para Cloudflare R2
- ⚠️ Material único (materialUrl) — **LIMITADO**

**O que falta:**
1. Rich Text Editor para descrição (negrito, itálico, listas, links, tabelas)
2. Múltiplos arquivos complementares (PDFs, planilhas, imagens extras)
3. Renderização HTML no player do aluno (`AcessoCurso.tsx`)
4. Download de múltiplos materiais pelo aluno

---

## 📊 ESTRUTURA ATUAL DO BANCO

```sql
-- Tabela lessons (produção)
id           | text
module_id    | text
title        | text
description  | text                    -- ⚠️ Texto simples
video_url    | text
material_url | text                    -- ⚠️ URL única
order        | integer
duration     | integer
created_at   | timestamp
updated_at   | timestamp
```

---

## 🏗️ ARQUITETURA DA SOLUÇÃO

### Opção 1: Campos Adicionais (ESCOLHIDA)
- `description_html` (TEXT) — HTML rico do editor
- `attachments` (JSONB) — Array de objetos `{ name, url, type, size }`

**Vantagens:**
- ✅ Simples de implementar
- ✅ Mantém `description` para compatibilidade
- ✅ JSONB permite queries e indexação
- ✅ Não precisa de tabela relacional

**Estrutura do JSONB:**
```json
[
  {
    "name": "Apostila Módulo 1.pdf",
    "url": "https://pub-xxx.r2.dev/attachments/uuid.pdf",
    "type": "application/pdf",
    "size": 2048576
  },
  {
    "name": "Planilha Exercícios.xlsx",
    "url": "https://pub-xxx.r2.dev/attachments/uuid.xlsx",
    "type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "size": 512000
  }
]
```

---

## 📝 IMPLEMENTAÇÃO — 3 FASES

### FASE 1: Banco de Dados ✅ PRIORIDADE

**Arquivo:** `backend/migrations/add_lesson_rich_content.sql`

```sql
-- Adicionar campos para rich content
ALTER TABLE lessons
ADD COLUMN IF NOT EXISTS description_html TEXT,
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- Índice para busca em attachments
CREATE INDEX IF NOT EXISTS idx_lessons_attachments
ON lessons USING gin(attachments);

-- Comentários
COMMENT ON COLUMN lessons.description_html IS 'HTML rico do editor TipTap/Quill';
COMMENT ON COLUMN lessons.attachments IS 'Array de objetos {name, url, type, size}';
```

**Executar:**
```bash
ssh -i ssh-key-2026-02-12.key ubuntu@136.248.115.113
cd /home/ubuntu/backend/backend
PGPASSWORD='tubarao123' psql -h localhost -U postgres -d tubarao_db -f migrations/add_lesson_rich_content.sql
```

---

### FASE 2: Backend (Prisma + Rotas) ✅ PRIORIDADE

#### 2.1 Atualizar Prisma Schema

**Arquivo:** `backend/prisma/schema.prisma` (linha ~673)

```prisma
model Lesson {
  id              String         @id @default(uuid())
  moduleId        String         @map("module_id")
  title           String
  description     String?        // Mantém para compatibilidade
  descriptionHtml String?        @map("description_html") // ✨ NOVO
  videoUrl        String?        @map("video_url")
  materialUrl     String?        @map("material_url")
  attachments     Json?          @default("[]") // ✨ NOVO
  order           Int            @default(0)
  duration        Int?
  createdAt       DateTime       @default(now()) @map("created_at")
  updatedAt       DateTime       @updatedAt @map("updated_at")
  module          Module         @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  progress        UserProgress[]

  @@map("lessons")
}
```

#### 2.2 Atualizar Rotas de Aula

**Arquivo:** `backend/src/routes/curso.ts` (procurar `POST /lessons` e `PUT /lessons/:id`)

```typescript
// POST /curso/lessons — Criar aula
router.post('/lessons', requireAdmin, async (req, res) => {
  const {
    moduleId,
    title,
    description,
    descriptionHtml,  // ✨ NOVO
    videoUrl,
    materialUrl,
    attachments,      // ✨ NOVO
    order,
    duration
  } = req.body;

  const lesson = await prisma.lesson.create({
    data: {
      moduleId,
      title,
      description,
      descriptionHtml,  // ✨ NOVO
      videoUrl,
      materialUrl,
      attachments: attachments || [], // ✨ NOVO
      order: order ?? 0,
      duration
    }
  });

  res.json(lesson);
});

// PUT /curso/lessons/:id — Atualizar aula
router.put('/lessons/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const {
    title,
    description,
    descriptionHtml,  // ✨ NOVO
    videoUrl,
    materialUrl,
    attachments,      // ✨ NOVO
    order,
    duration
  } = req.body;

  const lesson = await prisma.lesson.update({
    where: { id },
    data: {
      title,
      description,
      descriptionHtml,  // ✨ NOVO
      videoUrl,
      materialUrl,
      attachments,      // ✨ NOVO
      order,
      duration
    }
  });

  res.json(lesson);
});
```

---

### FASE 3: Frontend (Admin + Aluno) ✅ PRIORIDADE

#### 3.1 Instalar Dependências

```bash
cd "J:\AREA DE TRABALHO\Projetos\TUBARÃO EMPRÉSTIMOS LTDA"
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-table @tiptap/extension-table-row @tiptap/extension-table-cell @tiptap/extension-table-header
```

**Alternativa (mais leve):** React Quill
```bash
npm install react-quill
```

#### 3.2 Atualizar Interface TypeScript

**Arquivo:** `services/cursoService.ts` (linha 7-17)

```typescript
export interface Lesson {
  id: string;
  moduleId: string;
  title: string;
  description?: string;
  descriptionHtml?: string;        // ✨ NOVO
  videoUrl?: string;
  materialUrl?: string;
  attachments?: Array<{            // ✨ NOVO
    name: string;
    url: string;
    type: string;
    size: number;
  }>;
  order: number;
  duration?: number;
  progress?: { isCompleted: boolean; completedAt?: string }[];
}
```

#### 3.3 Criar Componente Rich Text Editor

**Arquivo:** `components/RichTextEditor.tsx` (CRIAR)

```typescript
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { Bold, Italic, List, ListOrdered, Link as LinkIcon, Table as TableIcon } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  if (!editor) return null;

  return (
    <div className="border border-zinc-700 rounded-xl overflow-hidden bg-zinc-800">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b border-zinc-700 bg-zinc-900">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-2 rounded hover:bg-zinc-700 ${editor.isActive('bold') ? 'bg-zinc-700 text-[#D4AF37]' : 'text-zinc-400'}`}
        >
          <Bold size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-2 rounded hover:bg-zinc-700 ${editor.isActive('italic') ? 'bg-zinc-700 text-[#D4AF37]' : 'text-zinc-400'}`}
        >
          <Italic size={16} />
        </button>
        <div className="w-px h-6 bg-zinc-700 mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-2 rounded hover:bg-zinc-700 ${editor.isActive('bulletList') ? 'bg-zinc-700 text-[#D4AF37]' : 'text-zinc-400'}`}
        >
          <List size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-2 rounded hover:bg-zinc-700 ${editor.isActive('orderedList') ? 'bg-zinc-700 text-[#D4AF37]' : 'text-zinc-400'}`}
        >
          <ListOrdered size={16} />
        </button>
        <div className="w-px h-6 bg-zinc-700 mx-1" />
        <button
          type="button"
          onClick={() => {
            const url = window.prompt('URL:');
            if (url) editor.chain().focus().setLink({ href: url }).run();
          }}
          className={`p-2 rounded hover:bg-zinc-700 ${editor.isActive('link') ? 'bg-zinc-700 text-[#D4AF37]' : 'text-zinc-400'}`}
        >
          <LinkIcon size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3 }).run()}
          className="p-2 rounded hover:bg-zinc-700 text-zinc-400"
        >
          <TableIcon size={16} />
        </button>
      </div>

      {/* Editor */}
      <EditorContent
        editor={editor}
        className="prose prose-invert max-w-none p-4 min-h-[200px] text-sm focus:outline-none"
      />
    </div>
  );
}
```

#### 3.4 Atualizar Modal de Aula (Admin)

**Arquivo:** `pages/admin/CursoAdmin.tsx` (linha 100-278)

**Mudanças:**
1. Substituir textarea por `<RichTextEditor />`
2. Adicionar dropzone para múltiplos arquivos
3. Upload de attachments para R2
4. Salvar array de attachments no banco

```typescript
import { RichTextEditor } from '../../components/RichTextEditor';

// Dentro do LessonModal:
const [descHtml, setDescHtml] = useState(editLesson?.descriptionHtml ?? '');
const [attachments, setAttachments] = useState<Array<{name: string; url: string; type: string; size: number}>>(
  editLesson?.attachments ?? []
);
const [uploadingAttachments, setUploadingAttachments] = useState(false);

// Substituir textarea (linha 162-173) por:
<div className="space-y-2">
  <label className="text-xs text-zinc-400 font-medium">Descrição da Aula</label>
  <RichTextEditor
    value={descHtml}
    onChange={setDescHtml}
    placeholder="O que o aluno vai aprender nesta aula…"
  />
</div>

// Adicionar após o vídeo (linha 230):
<div className="space-y-2">
  <label className="text-xs text-zinc-400 font-medium">Materiais Complementares</label>
  <input
    ref={attachmentRef}
    type="file"
    multiple
    accept=".pdf,.xlsx,.xls,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png"
    className="hidden"
    onChange={handleAttachmentSelect}
  />
  <button
    type="button"
    onClick={() => attachmentRef.current?.click()}
    disabled={uploadingAttachments}
    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 border border-dashed border-zinc-600 hover:border-[#D4AF37]/60 rounded-xl text-sm text-zinc-400 hover:text-white transition-all disabled:opacity-50"
  >
    <Upload size={16} />
    Adicionar PDFs, planilhas, imagens…
  </button>

  {/* Lista de attachments */}
  {attachments.length > 0 && (
    <div className="space-y-2">
      {attachments.map((att, idx) => (
        <div key={idx} className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2">
          <FileText size={14} className="text-[#D4AF37]" />
          <span className="text-xs text-white flex-1 truncate">{att.name}</span>
          <span className="text-[10px] text-zinc-500">{(att.size / 1024).toFixed(0)} KB</span>
          <button
            type="button"
            onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
            className="text-red-400 hover:text-red-300"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )}
</div>
```

#### 3.5 Atualizar Player do Aluno

**Arquivo:** `pages/client/AcessoCurso.tsx` (linha 625-633)

**Substituir:**
```typescript
{lesson.description && (
  <p className="text-zinc-400 text-sm leading-relaxed">{lesson.description}</p>
)}
```

**Por:**
```typescript
{lesson.descriptionHtml ? (
  <div
    className="prose prose-invert prose-sm max-w-none text-zinc-400 leading-relaxed"
    dangerouslySetInnerHTML={{ __html: lesson.descriptionHtml }}
  />
) : lesson.description ? (
  <p className="text-zinc-400 text-sm leading-relaxed">{lesson.description}</p>
) : null}

{/* Materiais complementares */}
{lesson.attachments && lesson.attachments.length > 0 && (
  <div className="mt-4 space-y-2">
    <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Materiais Complementares</h4>
    <div className="grid gap-2">
      {lesson.attachments.map((att, idx) => (
        <a
          key={idx}
          href={att.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 hover:border-[#D4AF37]/40 rounded-xl px-4 py-3 transition-all group"
        >
          <FileText size={18} className="text-[#D4AF37] group-hover:scale-110 transition-transform" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{att.name}</p>
            <p className="text-[10px] text-zinc-500">{(att.size / 1024).toFixed(0)} KB</p>
          </div>
          <Download size={14} className="text-zinc-600 group-hover:text-[#D4AF37]" />
        </a>
      ))}
    </div>
  </div>
)}
```

---

## 🚀 ORDEM DE EXECUÇÃO

### 1️⃣ FASE 1 — Banco de Dados (5 min)
```bash
# Criar migration
cd "J:\AREA DE TRABALHO\Projetos\TUBARÃO EMPRÉSTIMOS LTDA\backend"
mkdir -p migrations
# Criar arquivo add_lesson_rich_content.sql com o SQL acima

# Executar no servidor
ssh -i ../ssh-key-2026-02-12.key ubuntu@136.248.115.113
cd /home/ubuntu/backend/backend
PGPASSWORD='tubarao123' psql -h localhost -U postgres -d tubarao_db -f migrations/add_lesson_rich_content.sql

# Verificar
PGPASSWORD='tubarao123' psql -h localhost -U postgres -d tubarao_db -c "\d lessons"
```

### 2️⃣ FASE 2 — Backend (10 min)
```bash
# Atualizar Prisma schema
# Editar backend/prisma/schema.prisma

# Gerar cliente Prisma
cd backend
npx prisma generate

# Atualizar rotas (backend/src/routes/curso.ts)
# Adicionar descriptionHtml e attachments nos endpoints

# Testar localmente
npm run dev
```

### 3️⃣ FASE 3 — Frontend (20 min)
```bash
# Instalar TipTap
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-table @tiptap/extension-table-row @tiptap/extension-table-cell @tiptap/extension-table-header

# Criar componente RichTextEditor.tsx
# Atualizar cursoService.ts (interface Lesson)
# Atualizar CursoAdmin.tsx (modal de aula)
# Atualizar AcessoCurso.tsx (player do aluno)

# Testar localmente
npm run dev
```

### 4️⃣ DEPLOY (10 min)
```bash
# Commit e push
git add .
git commit -m "feat: rich text editor + múltiplos arquivos nas aulas

- Adiciona campos description_html e attachments na tabela lessons
- Implementa TipTap editor no modal de aula (admin)
- Permite upload de múltiplos PDFs, planilhas e imagens
- Renderiza HTML rico no player do aluno
- Exibe materiais complementares para download

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"

git push origin main

# Deploy backend
ssh -i ssh-key-2026-02-12.key ubuntu@136.248.115.113
cd /home/ubuntu/backend/backend
git pull origin main
npm install
npx prisma generate
pm2 restart tubarao-backend

# Deploy frontend (se necessário)
# npm run build && deploy para hosting
```

---

## ✅ CHECKLIST DE VALIDAÇÃO

### Backend
- [ ] Migration executada com sucesso
- [ ] Campos `description_html` e `attachments` existem na tabela
- [ ] Prisma schema atualizado e gerado
- [ ] Rotas POST/PUT aceitam novos campos
- [ ] GET retorna `descriptionHtml` e `attachments`

### Frontend Admin
- [ ] Rich Text Editor renderiza corretamente
- [ ] Toolbar funciona (negrito, itálico, listas, links, tabelas)
- [ ] Upload de múltiplos arquivos funciona
- [ ] Arquivos aparecem na lista antes de salvar
- [ ] Salvar aula envia `descriptionHtml` e `attachments`
- [ ] Editar aula carrega conteúdo HTML e attachments

### Frontend Aluno
- [ ] HTML rico renderiza corretamente (sem quebrar layout)
- [ ] Links funcionam
- [ ] Tabelas aparecem formatadas
- [ ] Materiais complementares aparecem abaixo da descrição
- [ ] Download de arquivos funciona
- [ ] Layout responsivo (mobile)

---

## 🎨 ESTILO DO EDITOR (Prose)

Adicionar ao `tailwind.config.js`:

```javascript
module.exports = {
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
```

Instalar:
```bash
npm install -D @tailwindcss/typography
```

---

## 📊 ESTIMATIVA DE TEMPO

| Fase | Tempo | Complexidade |
|------|-------|--------------|
| FASE 1 — Banco | 5 min | Baixa |
| FASE 2 — Backend | 10 min | Baixa |
| FASE 3 — Frontend | 20 min | Média |
| Deploy + Testes | 10 min | Baixa |
| **TOTAL** | **45 min** | **Média** |

---

## 🚨 RISCOS E MITIGAÇÕES

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| XSS via HTML injection | Média | Alto | Sanitizar HTML com DOMPurify |
| Upload de arquivos maliciosos | Baixa | Médio | Validar MIME type no backend |
| Quebra de layout com HTML | Baixa | Baixo | Usar prose classes do Tailwind |
| Perda de dados ao migrar | Baixa | Alto | Manter campo `description` original |

---

## 📝 NOTAS FINAIS

- **Compatibilidade:** Campo `description` mantido para backward compatibility
- **Sanitização:** Considerar adicionar DOMPurify para sanitizar HTML antes de renderizar
- **Performance:** JSONB permite queries eficientes em attachments
- **Escalabilidade:** Se attachments crescer muito, migrar para tabela relacional

---

**Desenvolvedor:** Claude Code
**Data:** 17/03/2026 14:24
**Status:** PRONTO PARA EXECUÇÃO
