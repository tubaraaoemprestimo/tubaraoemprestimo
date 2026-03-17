import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { Bold, Italic, List, ListOrdered, Link as LinkIcon } from 'lucide-react';

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
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none',
      },
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
          className={`p-2 rounded hover:bg-zinc-700 transition-colors ${
            editor.isActive('bold') ? 'bg-zinc-700 text-[#D4AF37]' : 'text-zinc-400'
          }`}
          title="Negrito"
        >
          <Bold size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-2 rounded hover:bg-zinc-700 transition-colors ${
            editor.isActive('italic') ? 'bg-zinc-700 text-[#D4AF37]' : 'text-zinc-400'
          }`}
          title="Itálico"
        >
          <Italic size={16} />
        </button>
        <div className="w-px h-6 bg-zinc-700 mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-2 rounded hover:bg-zinc-700 transition-colors ${
            editor.isActive('bulletList') ? 'bg-zinc-700 text-[#D4AF37]' : 'text-zinc-400'
          }`}
          title="Lista com marcadores"
        >
          <List size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-2 rounded hover:bg-zinc-700 transition-colors ${
            editor.isActive('orderedList') ? 'bg-zinc-700 text-[#D4AF37]' : 'text-zinc-400'
          }`}
          title="Lista numerada"
        >
          <ListOrdered size={16} />
        </button>
        <div className="w-px h-6 bg-zinc-700 mx-1" />
        <button
          type="button"
          onClick={() => {
            const url = window.prompt('URL do link:');
            if (url) {
              editor.chain().focus().setLink({ href: url }).run();
            }
          }}
          className={`p-2 rounded hover:bg-zinc-700 transition-colors ${
            editor.isActive('link') ? 'bg-zinc-700 text-[#D4AF37]' : 'text-zinc-400'
          }`}
          title="Inserir link"
        >
          <LinkIcon size={16} />
        </button>
      </div>

      {/* Editor */}
      <EditorContent
        editor={editor}
        className="p-4 min-h-[200px] text-sm text-white"
        placeholder={placeholder}
      />
    </div>
  );
}
