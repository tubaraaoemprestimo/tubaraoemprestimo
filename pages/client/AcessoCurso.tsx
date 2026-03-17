/**
 * AcessoCurso — Área do Aluno Premium (Micro-LMS)
 * Rota: /acesso
 *
 * UI: Dark-mode estilo Netflix/streaming premium.
 * Lógica: cursoService real (API) + fallback para mock data visual durante dev.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown, ChevronRight, CheckCircle2, ShieldCheck,
  Lock, BookOpen, Download, ArrowLeft, Menu, X, Trophy,
  Zap, Clock, Play, SkipForward,
  GraduationCap, Award, Flame, Target, Medal, Star, Printer, FileText
} from 'lucide-react';
import { cursoService, PlayerData, Lesson, Module } from '../../services/cursoService';
import { api } from '../../services/apiClient';

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatDuration(seconds?: number): string {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ─── MOCK DATA (renderiza visualmente enquanto a API não retorna) ──────────────

const MOCK_DATA: PlayerData = {
  course: {
    id: 'mock-course',
    title: 'Método Tubarão',
    description: 'O sistema completo para construir um negócio de empréstimos.',
    modules: [
      {
        id: 'mod-1', courseId: 'mock-course', title: 'Módulo 1 — Fundamentos do Negócio', description: '', order: 0,
        lessons: [
          { id: 'l-1', moduleId: 'mod-1', title: 'Apresentação do Método Tubarão', description: 'Visão geral de tudo o que você vai aprender e o potencial de mercado.', videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4', order: 0, duration: 540, progress: [] },
          { id: 'l-2', moduleId: 'mod-1', title: 'A Mentalidade do Tubarão', description: 'Como pensar como um operador de crédito de sucesso.', videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4', order: 1, duration: 720, progress: [] },
          { id: 'l-3', moduleId: 'mod-1', title: 'Legislação e Compliance Básico', description: 'O que você pode e não pode fazer. Proteja seu negócio desde o início.', videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4', order: 2, duration: 900, progress: [] },
        ],
      },
      {
        id: 'mod-2', courseId: 'mock-course', title: 'Módulo 2 — Captação de Clientes', description: '', order: 1,
        lessons: [
          { id: 'l-4', moduleId: 'mod-2', title: 'Onde Estão Seus Clientes Ideais', description: 'Identificação e segmentação do público de maior valor.', videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4', order: 0, duration: 810, progress: [] },
          { id: 'l-5', moduleId: 'mod-2', title: 'Scripts de Abordagem que Convertem', description: 'Frases e técnicas testadas para fechar mais negócios.', videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4', order: 1, duration: 1080, progress: [] },
          { id: 'l-6', moduleId: 'mod-2', title: 'Tráfego Pago para Crédito (Meta e Google)', description: 'Campanhas de anúncios otimizadas para o seu nicho.', videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4', order: 2, duration: 1320, progress: [] },
        ],
      },
      {
        id: 'mod-3', courseId: 'mock-course', title: 'Módulo 3 — Análise e Concessão', description: '', order: 2,
        lessons: [
          { id: 'l-7', moduleId: 'mod-3', title: 'Analisando o Perfil de Crédito', description: 'Como avaliar risco e definir limites seguros.', videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4', order: 0, duration: 960, progress: [] },
          { id: 'l-8', moduleId: 'mod-3', title: 'Contratos que Protegem Você', description: 'Cláusulas essenciais e modelos prontos para download.', videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4', order: 1, duration: 1140, materialUrl: '#', progress: [] },
          { id: 'l-9', moduleId: 'mod-3', title: 'Sistema de Cobrança Eficaz', description: 'Régua de cobrança e como recuperar inadimplentes.', videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4', order: 2, duration: 870, progress: [] },
        ],
      },
      {
        id: 'mod-4', courseId: 'mock-course', title: 'Módulo 4 — Escala e Automação', description: '', order: 3,
        lessons: [
          { id: 'l-10', moduleId: 'mod-4', title: 'Automatizando o Atendimento com IA', description: 'Chatbots e fluxos que trabalham por você 24h.', videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4', order: 0, duration: 1020, progress: [] },
          { id: 'l-11', moduleId: 'mod-4', title: 'Construindo uma Equipe Comercial', description: 'Como recrutar, treinar e remunerar seus agentes.', videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4', order: 1, duration: 1200, progress: [] },
        ],
      },
    ],
  },
  stats: { totalLessons: 11, completedLessons: 0, progressPercent: 0 },
};

// ─── Tela de Sem Acesso ───────────────────────────────────────────────────────

function NoAccess({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-screen bg-zinc-900 flex flex-col items-center justify-center p-6 text-center">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-yellow-500/5 rounded-full blur-3xl" />
      </div>
      <div className="relative z-10 max-w-md mx-auto">
        <div className="w-24 h-24 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center mx-auto mb-6 shadow-2xl">
          <Lock size={40} className="text-zinc-600" />
        </div>
        <h1 className="text-3xl font-black text-white mb-3">Acesso Restrito</h1>
        <p className="text-zinc-400 leading-relaxed mb-8">
          Você ainda não tem acesso ao <span className="text-yellow-500 font-bold">Método Tubarão</span>. Adquira o curso para desbloquear todo o conteúdo premium.
        </p>
        <button
          onClick={() => window.location.href = '/#/funil'}
          className="w-full px-8 py-4 bg-yellow-500 hover:bg-yellow-400 text-black font-black text-lg rounded-2xl transition-all active:scale-95 shadow-lg shadow-yellow-500/25 mb-4"
        >
          🦈 Quero o Método Tubarão
        </button>
        <button onClick={onBack} className="text-zinc-500 text-sm hover:text-zinc-300 transition-colors">
          ← Voltar ao Dashboard
        </button>
      </div>
    </div>
  );
}

// ─── Loading Premium ──────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-zinc-900 flex flex-col items-center justify-center gap-6">
      <div className="relative">
        <div className="w-16 h-16 border-2 border-zinc-700 rounded-full" />
        <div className="absolute inset-0 w-16 h-16 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
      </div>
      <div className="text-center">
        <p className="text-white font-bold">Carregando seu conteúdo</p>
        <p className="text-zinc-500 text-sm mt-1">Preparando o Método Tubarão…</p>
      </div>
    </div>
  );
}

// ─── Barra de Progresso Global ────────────────────────────────────────────────

function GlobalProgressBar({ pct, completed, total }: { pct: number; completed: number; total: number }) {
  const getMotivationalText = () => {
    if (pct === 0) return 'Comece sua jornada agora!';
    if (pct < 25) return 'Ótimo começo! Continue assim!';
    if (pct < 50) return 'Você está no caminho certo!';
    if (pct < 75) return 'Mais da metade! Incrível!';
    if (pct < 100) return 'Quase lá! Você consegue!';
    return '🏆 Parabéns! Curso concluído!';
  };

  return (
    <div className="bg-zinc-900/80 backdrop-blur border-b border-zinc-800 px-4 py-3">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Flame size={14} className="text-yellow-500" />
            <span className="text-xs font-bold text-yellow-500">Progresso do Tubarão</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-400">{completed}/{total} aulas</span>
            <span className="text-sm font-black text-white">{pct}%</span>
          </div>
        </div>
        <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden shadow-[0_0_8px_rgba(234,179,8,0.15)]">
          <div
            className="h-full bg-gradient-to-r from-yellow-600 via-yellow-500 to-yellow-400 rounded-full transition-all duration-700 ease-out relative shadow-[0_0_10px_rgba(234,179,8,0.4)]"
            style={{ width: `${Math.max(pct, 2)}%` }}
          >
            {pct > 5 && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
            )}
          </div>
        </div>
        {pct > 0 && (
          <p className="text-[10px] text-zinc-500 mt-1">{getMotivationalText()}</p>
        )}
      </div>
    </div>
  );
}

// ─── Item de Aula na Sidebar ──────────────────────────────────────────────────

function LessonItem({
  lesson, isActive, isCompleted, index, onClick,
}: {
  lesson: Lesson;
  isActive: boolean;
  isCompleted: boolean;
  index: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all group relative
        ${isActive
          ? 'bg-yellow-500/10 border-l-[3px] border-yellow-500'
          : 'hover:bg-zinc-800/60 border-l-[3px] border-transparent'
        }`}
    >
      <div className="shrink-0 w-5 h-5 flex items-center justify-center">
        {isCompleted ? (
          <CheckCircle2 size={18} className="text-yellow-500" />
        ) : isActive ? (
          <div className="w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center">
            <Play size={9} className="text-black fill-black ml-0.5" />
          </div>
        ) : (
          <div className="w-5 h-5 rounded-full border border-zinc-600 flex items-center justify-center">
            <span className="text-[9px] text-zinc-500 font-bold">{index + 1}</span>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-semibold leading-snug line-clamp-2
          ${isActive ? 'text-yellow-400' : isCompleted ? 'text-zinc-400' : 'text-zinc-300 group-hover:text-white'}`}>
          {lesson.title}
        </p>
        {lesson.duration && (
          <div className="flex items-center gap-1 mt-0.5">
            <Clock size={9} className="text-zinc-600" />
            <p className="text-[10px] text-zinc-600">{formatDuration(lesson.duration)}</p>
          </div>
        )}
      </div>
      {isActive && (
        <div className="shrink-0 w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
      )}
    </button>
  );
}

// ─── Módulo Accordion ─────────────────────────────────────────────────────────

function ModuleAccordion({
  module, completedIds, activeLesson, moduleIndex, onSelectLesson,
}: {
  module: Module;
  completedIds: Set<string>;
  activeLesson: Lesson | null;
  moduleIndex: number;
  onSelectLesson: (l: Lesson) => void;
}) {
  const isActiveModule = module.lessons.some(l => l.id === activeLesson?.id);
  const [open, setOpen] = useState(isActiveModule);

  const completedCount = module.lessons.filter(l => completedIds.has(l.id)).length;
  const allDone = completedCount === module.lessons.length;

  return (
    <div className="border-b border-zinc-800/60 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-4 hover:bg-zinc-800/40 transition-all group"
      >
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-black transition-colors
          ${allDone ? 'bg-yellow-500 text-black' : isActiveModule ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/40' : 'bg-zinc-800 text-zinc-500'}`}>
          {allDone ? <CheckCircle2 size={14} /> : moduleIndex + 1}
        </div>
        <div className="flex-1 text-left">
          <p className={`text-xs font-bold leading-snug ${isActiveModule ? 'text-white' : 'text-zinc-300 group-hover:text-white'} transition-colors`}>
            {module.title}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-yellow-500/60 rounded-full transition-all"
                style={{ width: `${(completedCount / module.lessons.length) * 100}%` }}
              />
            </div>
            <span className="text-[10px] text-zinc-600 shrink-0">
              {completedCount}/{module.lessons.length}
            </span>
          </div>
        </div>
        {open
          ? <ChevronDown size={14} className="text-zinc-500 shrink-0 transition-transform" />
          : <ChevronRight size={14} className="text-zinc-600 shrink-0 transition-transform" />}
      </button>
      {open && (
        <div className="bg-zinc-900/50">
          {module.lessons.map((lesson, idx) => (
            <LessonItem
              key={lesson.id}
              lesson={lesson}
              index={idx}
              isActive={activeLesson?.id === lesson.id}
              isCompleted={completedIds.has(lesson.id)}
              onClick={() => onSelectLesson(lesson)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Certificado (Template) ───────────────────────────────────────────────────

function CertificateTemplate({ studentName, courseTitle, completionDate }: {
  studentName: string;
  courseTitle: string;
  completionDate: string;
}) {
  return (
    <div
      id="certificate-template"
      className="relative w-full bg-zinc-950 border-[6px] border-double border-yellow-500 rounded-2xl p-10 text-center overflow-hidden"
      style={{ minHeight: 420 }}
    >
      {/* Corner ornaments */}
      <div className="absolute top-4 left-4 w-10 h-10 border-t-2 border-l-2 border-yellow-500/60 rounded-tl-lg" />
      <div className="absolute top-4 right-4 w-10 h-10 border-t-2 border-r-2 border-yellow-500/60 rounded-tr-lg" />
      <div className="absolute bottom-4 left-4 w-10 h-10 border-b-2 border-l-2 border-yellow-500/60 rounded-bl-lg" />
      <div className="absolute bottom-4 right-4 w-10 h-10 border-b-2 border-r-2 border-yellow-500/60 rounded-br-lg" />

      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-yellow-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-4">
        {/* Trophy icon */}
        <div className="w-16 h-16 rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center mb-2">
          <Trophy size={32} className="text-yellow-500" />
        </div>

        {/* Title */}
        <div>
          <p className="text-yellow-500/70 text-xs font-bold uppercase tracking-[0.3em] mb-1">Tubarão Empréstimos</p>
          <h1 className="text-3xl md:text-4xl font-black text-yellow-400 tracking-wide uppercase">
            Certificado de Conclusão
          </h1>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 w-full max-w-sm">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent to-yellow-500/50" />
          <Star size={12} className="text-yellow-500" />
          <div className="flex-1 h-px bg-gradient-to-l from-transparent to-yellow-500/50" />
        </div>

        {/* Body */}
        <div className="space-y-2">
          <p className="text-zinc-400 text-sm">Certificamos que</p>
          <p className="text-2xl md:text-3xl font-black text-white">{studentName}</p>
          <p className="text-zinc-400 text-sm">concluiu com êxito o curso</p>
          <p className="text-xl font-black text-yellow-400">🦈 {courseTitle}</p>
          <p className="text-zinc-500 text-xs mt-2">
            dominando as estratégias completas do sistema de empréstimos de alta performance
          </p>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 w-full max-w-sm">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent to-yellow-500/50" />
          <Medal size={12} className="text-yellow-500" />
          <div className="flex-1 h-px bg-gradient-to-l from-transparent to-yellow-500/50" />
        </div>

        {/* Date + seal */}
        <div className="flex items-center justify-between w-full max-w-md mt-2">
          <div className="text-center">
            <p className="text-zinc-600 text-[10px] uppercase tracking-widest">Data de Conclusão</p>
            <p className="text-zinc-300 text-sm font-bold">{completionDate}</p>
          </div>
          <div className="w-16 h-16 rounded-full border-2 border-yellow-500/50 bg-yellow-500/5 flex flex-col items-center justify-center">
            <Award size={18} className="text-yellow-500 mb-0.5" />
            <p className="text-[8px] text-yellow-500 font-black uppercase leading-tight text-center">Tubarão<br />Cert.</p>
          </div>
          <div className="text-center">
            <p className="text-zinc-600 text-[10px] uppercase tracking-widest">Certificado por</p>
            <p className="text-zinc-300 text-sm font-bold">Tubarão Empréstimos</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Modal de Certificado ─────────────────────────────────────────────────────

function CertificateModal({ studentName, courseTitle, onClose }: {
  studentName: string;
  courseTitle: string;
  onClose: () => void;
}) {
  const completionDate = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-2xl animate-in zoom-in-95 duration-300">
        {/* Modal header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trophy size={20} className="text-yellow-500" />
            <span className="text-white font-black">Seu Certificado</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-sm font-bold rounded-xl transition-all"
            >
              <Printer size={14} />
              Imprimir / Salvar PDF
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Certificate */}
        <CertificateTemplate
          studentName={studentName}
          courseTitle={courseTitle}
          completionDate={completionDate}
        />

        <p className="text-center text-zinc-600 text-xs mt-3">
          Use "Imprimir / Salvar PDF" para baixar seu certificado em PDF
        </p>
      </div>
    </div>
  );
}

// ─── Sidebar (Desktop) / Drawer (Mobile) ─────────────────────────────────────

function Sidebar({
  playerData, completedIds, activeLesson, onSelectLesson, stats,
  mobileOpen, onClose, onOpenCertificate,
}: {
  playerData: PlayerData;
  completedIds: Set<string>;
  activeLesson: Lesson | null;
  onSelectLesson: (l: Lesson) => void;
  stats: PlayerData['stats'];
  mobileOpen: boolean;
  onClose: () => void;
  onOpenCertificate: () => void;
}) {
  const isComplete = stats.progressPercent === 100;

  return (
    <>
      {mobileOpen && (
        <div
          className="xl:hidden fixed inset-0 z-30 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <aside className={`
        w-80 bg-zinc-900 border-r border-zinc-800 flex flex-col
        fixed inset-y-0 right-0 z-40 xl:static xl:inset-auto xl:z-auto
        transition-transform duration-300 ease-in-out
        ${mobileOpen ? 'translate-x-0' : 'translate-x-full xl:translate-x-0'}
      `}>
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                <BookOpen size={14} className="text-yellow-500" />
              </div>
              <span className="text-sm font-bold text-white">Conteúdo do Curso</span>
            </div>
            <button
              onClick={onClose}
              className="xl:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-800 transition-colors"
            >
              <X size={16} className="text-zinc-400" />
            </button>
          </div>

          {/* Mini progress */}
          <div className="bg-zinc-800 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <Trophy size={12} className="text-yellow-500" />
              <span className="text-[10px] font-bold text-yellow-500 uppercase tracking-wide">Seu Progresso</span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-black text-white">{stats.progressPercent}%</span>
              <span className="text-xs text-zinc-500 mb-1">concluído</span>
            </div>
            <div className="mt-2 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(stats.progressPercent, 2)}%` }}
              />
            </div>
            <p className="text-[10px] text-zinc-600 mt-1.5">
              {stats.completedLessons} de {stats.totalLessons} aulas concluídas
            </p>
          </div>
        </div>

        {/* Module list */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-zinc-900 scrollbar-thumb-zinc-800">
          {playerData.course.modules.map((mod, idx) => (
            <ModuleAccordion
              key={mod.id}
              module={mod}
              completedIds={completedIds}
              activeLesson={activeLesson}
              moduleIndex={idx}
              onSelectLesson={(l) => { onSelectLesson(l); onClose(); }}
            />
          ))}
        </div>

        {/* Footer — certificado ou prompt */}
        <div className="p-4 border-t border-zinc-800 shrink-0">
          {isComplete ? (
            <button
              onClick={onOpenCertificate}
              className="w-full flex items-center justify-center gap-2 p-3.5 bg-gradient-to-r from-yellow-600 to-yellow-400 hover:from-yellow-500 hover:to-yellow-300 text-black font-black text-sm rounded-2xl transition-all active:scale-95 shadow-lg shadow-yellow-500/30 animate-pulse"
            >
              <Trophy size={18} />
              🏆 Emitir Certificado Tubarão
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-zinc-800/50 rounded-xl p-3">
              <GraduationCap size={16} className="text-yellow-500 shrink-0" />
              <p className="text-[10px] text-zinc-400 leading-relaxed">
                Complete todas as aulas para receber seu <span className="text-yellow-500 font-bold">Certificado Tubarão</span>
              </p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

// ─── Player Principal ─────────────────────────────────────────────────────────

function VideoPlayer({
  lesson,
  isCompleted,
  onComplete,
  onNext,
  hasNext,
}: {
  lesson: Lesson;
  isCompleted: boolean;
  onComplete: () => void;
  onNext?: () => void;
  hasNext: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [marking, setMarking] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);

  useEffect(() => {
    videoRef.current?.load();
    setVideoEnded(false);
  }, [lesson.id]);

  const handleMark = async () => {
    if (marking) return;
    setMarking(true);
    try {
      await cursoService.markLesson(lesson.id, !isCompleted);
      onComplete();
    } finally {
      setMarking(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Video Player */}
      <div className="relative w-full bg-black shadow-[0_0_30px_rgba(234,179,8,0.12)]">
        {lesson.videoUrl ? (
          <>
            <div className="aspect-video relative overflow-hidden">
              <video
                ref={videoRef}
                key={lesson.id}
                className="w-full h-full object-contain"
                controls
                controlsList="nodownload"
                preload="metadata"
                playsInline
                onContextMenu={e => e.preventDefault()}
                onEnded={() => setVideoEnded(true)}
              >
                <source src={lesson.videoUrl} type="video/mp4" />
                Seu navegador não suporta vídeo HTML5.
              </video>

              {videoEnded && !isCompleted && (
                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-4 animate-in fade-in duration-300">
                  <CheckCircle2 size={48} className="text-yellow-500" />
                  <p className="text-white font-bold text-lg text-center px-4">
                    Aula finalizada! Marque como concluída.
                  </p>
                  <button
                    onClick={handleMark}
                    disabled={marking}
                    className="px-6 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-xl transition-all active:scale-95 disabled:opacity-60"
                  >
                    {marking ? 'Salvando…' : '✅ Marcar como Concluída'}
                  </button>
                </div>
              )}
            </div>

            {isCompleted && (
              <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-yellow-500 text-black text-xs font-black px-3 py-1.5 rounded-full shadow-lg">
                <CheckCircle2 size={12} />
                Concluída
              </div>
            )}
          </>
        ) : (
          <div className="aspect-video flex flex-col items-center justify-center gap-4 text-zinc-600 bg-zinc-950">
            <div className="w-20 h-20 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <Lock size={32} />
            </div>
            <p className="text-sm font-medium">Vídeo em breve</p>
          </div>
        )}
      </div>

      {/* Lesson Details */}
      <div className="p-4 md:p-6 max-w-4xl mx-auto">

        <div className="mb-5">
          <h1 className="text-xl md:text-2xl font-black text-white leading-tight mb-2">
            {lesson.title}
          </h1>
          {lesson.descriptionHtml ? (
            <div
              className="prose prose-invert prose-sm max-w-none text-zinc-400 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: lesson.descriptionHtml }}
            />
          ) : lesson.description ? (
            <p className="text-zinc-400 text-sm leading-relaxed">{lesson.description}</p>
          ) : null}
          {lesson.duration && (
            <div className="flex items-center gap-1.5 mt-2">
              <Clock size={12} className="text-zinc-600" />
              <span className="text-xs text-zinc-600">{formatDuration(lesson.duration)} de duração</span>
            </div>
          )}

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
                    <FileText size={18} className="text-[#D4AF37] group-hover:scale-110 transition-transform shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{att.name}</p>
                      <p className="text-[10px] text-zinc-500">{(att.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <Download size={14} className="text-zinc-600 group-hover:text-[#D4AF37] transition-colors" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* Primary: Mark as completed */}
          <button
            onClick={handleMark}
            disabled={marking}
            className={`flex-1 flex items-center justify-center gap-2.5 px-5 py-4 rounded-2xl font-black text-base transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed shadow-lg
              ${isCompleted
                ? 'bg-zinc-800 border border-yellow-500/40 text-yellow-500 shadow-yellow-500/10'
                : 'bg-yellow-500 hover:bg-yellow-400 text-black shadow-yellow-500/30'
              }`}
          >
            <ShieldCheck size={22} className={isCompleted ? 'text-yellow-500' : 'text-black'} />
            {marking ? 'Salvando…' : isCompleted ? 'Aula Concluída ✓' : 'Marcar como Concluída'}
          </button>

          {lesson.materialUrl && (
            <a
              href={lesson.materialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-5 py-4 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 font-bold text-sm rounded-2xl transition-all active:scale-[0.98]"
            >
              <Download size={16} />
              📄 Baixar Material
            </a>
          )}

          {hasNext && isCompleted && onNext && (
            <button
              onClick={onNext}
              className="flex items-center justify-center gap-2 px-5 py-4 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 font-bold text-sm rounded-2xl transition-all active:scale-[0.98]"
            >
              <SkipForward size={16} />
              Próxima Aula
            </button>
          )}
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
            <Zap size={18} className="text-yellow-500 mx-auto mb-1" />
            <p className="text-[10px] text-zinc-500 font-medium">Método</p>
            <p className="text-xs font-bold text-white">Tubarão</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
            <Target size={18} className="text-yellow-500 mx-auto mb-1" />
            <p className="text-[10px] text-zinc-500 font-medium">Foco</p>
            <p className="text-xs font-bold text-white">Resultado</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
            <Award size={18} className="text-yellow-500 mx-auto mb-1" />
            <p className="text-[10px] text-zinc-500 font-medium">Nível</p>
            <p className="text-xs font-bold text-white">Premium</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export const AcessoCurso: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [playerData, setPlayerData] = useState<PlayerData | null>(null);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState({ totalLessons: 0, completedLessons: 0, progressPercent: 0 });
  const [studentName, setStudentName] = useState('Aluno');
  const [showCertificate, setShowCertificate] = useState(false);

  useEffect(() => {
    (async () => {
      // Busca nome do usuário
      try {
        const { data: me } = await api.get('/auth/me');
        const name = (me as any)?.user?.name || (me as any)?.name || 'Aluno';
        setStudentName(name);
      } catch {}

      try {
        const data = await cursoService.getPlayer();
        setPlayerData(data);
        setStats(data.stats);

        const ids = new Set<string>();
        data.course.modules.forEach(m =>
          m.lessons.forEach(l => {
            if (l.progress?.[0]?.isCompleted) ids.add(l.id);
          })
        );
        setCompletedIds(ids);

        const allLessons = data.course.modules.flatMap(m => m.lessons);
        const firstPending = allLessons.find(l => !ids.has(l.id)) ?? allLessons[0];
        if (firstPending) setActiveLesson(firstPending);

        setHasAccess(true);
      } catch (err: any) {
        if (err?.response?.status === 403) {
          setPlayerData(MOCK_DATA);
          setStats(MOCK_DATA.stats);
          const allLessons = MOCK_DATA.course.modules.flatMap(m => m.lessons);
          setActiveLesson(allLessons[0]);
          setHasAccess(false);
        } else {
          navigate('/login');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const allLessons = playerData?.course.modules.flatMap(m => m.lessons) ?? [];

  const handleLessonComplete = useCallback(() => {
    if (!activeLesson) return;
    setCompletedIds(prev => {
      const next = new Set(prev);
      const wasCompleted = next.has(activeLesson.id);
      wasCompleted ? next.delete(activeLesson.id) : next.add(activeLesson.id);

      const completed = wasCompleted ? stats.completedLessons - 1 : stats.completedLessons + 1;
      const pct = stats.totalLessons > 0 ? Math.round((completed / stats.totalLessons) * 100) : 0;
      setStats(s => ({ ...s, completedLessons: completed, progressPercent: pct }));

      return next;
    });
  }, [activeLesson, stats]);

  const handleSelectLesson = (lesson: Lesson) => {
    setActiveLesson(lesson);
    setSidebarOpen(false);
  };

  const handleNextLesson = () => {
    if (!activeLesson) return;
    const idx = allLessons.findIndex(l => l.id === activeLesson.id);
    if (idx < allLessons.length - 1) setActiveLesson(allLessons[idx + 1]);
  };

  const currentLessonIndex = allLessons.findIndex(l => l.id === activeLesson?.id);
  const hasNext = currentLessonIndex < allLessons.length - 1;
  const courseTitle = playerData?.course.title ?? 'Método Tubarão';

  if (loading) return <LoadingScreen />;

  if (!hasAccess) {
    return <NoAccess onBack={() => navigate('/client/dashboard')} />;
  }

  return (
    <div className="min-h-screen bg-zinc-900 flex flex-col">

      {/* Topbar */}
      <header className="sticky top-0 z-30 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 shrink-0">
        <div className="px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate('/client/dashboard')}
            className="p-2 hover:bg-zinc-800 rounded-xl transition-all"
          >
            <ArrowLeft size={18} className="text-zinc-400" />
          </button>

          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span className="text-base">🦈</span>
            <div className="min-w-0">
              <p className="text-sm font-black text-white truncate">Método Tubarão</p>
              {activeLesson && (
                <p className="text-[10px] text-zinc-500 truncate">{activeLesson.title}</p>
              )}
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 bg-zinc-800 px-3 py-1.5 rounded-xl">
            <Play size={10} className="text-yellow-500 fill-yellow-500" />
            <span className="text-xs font-bold text-white">
              {currentLessonIndex + 1}/{allLessons.length}
            </span>
          </div>

          {/* Botão certificado no header (mobile, quando 100%) */}
          {stats.progressPercent === 100 && (
            <button
              onClick={() => setShowCertificate(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-black rounded-xl transition-all animate-pulse"
            >
              <Trophy size={14} />
              <span className="hidden sm:inline">Certificado</span>
            </button>
          )}

          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="xl:hidden flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-all"
          >
            <Menu size={15} className="text-zinc-400" />
            <span className="text-xs text-zinc-400 font-medium hidden sm:inline">Aulas</span>
          </button>
        </div>

        <GlobalProgressBar
          pct={stats.progressPercent}
          completed={stats.completedLessons}
          total={stats.totalLessons}
        />
      </header>

      {/* Body: Player + Sidebar */}
      <div className="flex flex-1 overflow-hidden">

        <main className="flex-1 overflow-y-auto bg-zinc-950 xl:bg-zinc-900">
          {activeLesson ? (
            <VideoPlayer
              lesson={activeLesson}
              isCompleted={completedIds.has(activeLesson.id)}
              onComplete={handleLessonComplete}
              onNext={handleNextLesson}
              hasNext={hasNext}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-64 gap-4 text-zinc-700">
              <BookOpen size={48} />
              <p className="text-sm">Selecione uma aula para começar</p>
            </div>
          )}
        </main>

        {playerData && (
          <Sidebar
            playerData={playerData}
            completedIds={completedIds}
            activeLesson={activeLesson}
            onSelectLesson={handleSelectLesson}
            stats={stats}
            mobileOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            onOpenCertificate={() => setShowCertificate(true)}
          />
        )}
      </div>

      {/* Modal Certificado */}
      {showCertificate && (
        <CertificateModal
          studentName={studentName}
          courseTitle={courseTitle}
          onClose={() => setShowCertificate(false)}
        />
      )}
    </div>
  );
};
