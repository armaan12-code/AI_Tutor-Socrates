import { useState, useRef, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, MessageCircle, Trash2, GraduationCap,
  FolderOpen, Folder, ChevronRight, ChevronDown,
  LogOut, FolderPlus, Pencil, Check, X, LogIn, Sparkles, Home
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';
import type { ChatSession, Project } from '../types';

interface SidebarProps {
  sessions: ChatSession[];
  projects: Project[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
  onNewProject: (name: string) => void;
  onDeleteProject: (id: string) => void;
  onRenameProject: (id: string, name: string) => void;
  onMoveSession: (sessionId: string, projectId: string | null) => void;
  onGoHome: () => void;
  isOpen: boolean;
  onClose: () => void;
}

interface ProjectFolderProps {
  project: Project;
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onDelete: () => void;
  onRename: (name: string) => void;
  onDrop: (sessionId: string) => void;
}

function ProjectFolder({
  project, sessions, currentSessionId,
  onSelectSession, onDeleteSession, onDelete, onRename, onDrop
}: ProjectFolderProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(project.name);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (isRenaming) inputRef.current?.focus(); }, [isRenaming]);

  const submitRename = () => {
    if (newName.trim()) onRename(newName.trim());
    setIsRenaming(false);
  };

  return (
    <div
      className={cn(
        'rounded-xl transition-all duration-200',
        isDragOver && 'bg-amber-50 ring-1 ring-amber-200'
      )}
      onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={e => {
        e.preventDefault(); setIsDragOver(false);
        const sessionId = e.dataTransfer.getData('sessionId');
        if (sessionId) onDrop(sessionId);
      }}
    >
      {/* Folder header */}
      <div className="flex items-center gap-1 px-2 py-1.5 group rounded-xl hover:bg-white/70 transition-all duration-150">
        <button
          onClick={() => setIsExpanded(v => !v)}
          className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
        >
          <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ type: 'spring', stiffness: 400, damping: 28 }}>
            <ChevronRight className="w-3.5 h-3.5 text-stone-400 shrink-0" />
          </motion.div>
          <motion.div animate={{ scale: isDragOver ? 1.15 : 1 }} transition={{ type: 'spring', stiffness: 400 }}>
            {isExpanded
              ? <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
              : <Folder className="w-4 h-4 text-amber-500 shrink-0" />
            }
          </motion.div>
          {isRenaming ? (
            <input
              ref={inputRef} value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') setIsRenaming(false); }}
              onBlur={submitRename}
              className="flex-1 min-w-0 text-xs font-medium bg-white border-b border-stone-400 outline-none py-0.5 rounded px-1"
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span className="text-xs font-medium text-stone-700 truncate">{project.name}</span>
          )}
          <span className="text-[10px] text-stone-400 shrink-0 ml-auto">({sessions.length})</span>
        </button>

        {!isRenaming && (
          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <motion.button
              whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.88 }}
              onClick={() => setIsRenaming(true)}
              className="p-1 hover:bg-stone-200 rounded text-stone-400 hover:text-stone-600 transition-colors"
            >
              <Pencil className="w-3 h-3" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.88 }}
              onClick={onDelete}
              className="p-1 hover:bg-red-50 rounded text-stone-400 hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </motion.button>
          </div>
        )}
        {isRenaming && (
          <div className="flex items-center gap-0.5">
            <button onClick={submitRename} className="p-1 hover:bg-green-50 rounded text-green-600"><Check className="w-3 h-3" /></button>
            <button onClick={() => setIsRenaming(false)} className="p-1 hover:bg-red-50 rounded text-red-500"><X className="w-3 h-3" /></button>
          </div>
        )}
      </div>

      {/* Sessions inside folder */}
      <AnimatePresence initial={false}>
        {isExpanded && sessions.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="overflow-hidden pl-5"
          >
            {sessions.map(s => (
              <SessionItem
                key={s.id}
                session={s}
                isActive={s.id === currentSessionId}
                onSelect={() => onSelectSession(s.id)}
                onDelete={() => onDeleteSession(s.id)}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const SessionItem = memo(function SessionItem({
  session, isActive, onSelect, onDelete
}: { session: ChatSession; isActive: boolean; onSelect: () => void; onDelete: () => void }) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        'flex items-start gap-2 p-2 rounded-xl cursor-pointer group transition-all duration-150',
        isActive
          ? 'bg-white shadow-sm border border-stone-200'
          : 'hover:bg-stone-100 border border-transparent'
      )}
      draggable
      onDragStart={(e: React.DragEvent<HTMLDivElement>) => {
        e.dataTransfer.setData('sessionId', session.id);
      }}
    >
      <MessageCircle className={cn('w-3.5 h-3.5 mt-0.5 shrink-0 transition-colors', isActive ? 'text-stone-900' : 'text-stone-400')} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate text-stone-800">{session.title}</div>
        <div className="text-[10px] text-stone-400 mt-0.5">{new Date(session.updatedAt).toLocaleDateString()}</div>
      </div>
      <button
        onClick={e => { e.stopPropagation(); onDelete(); }}
        className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 rounded text-stone-400 shrink-0 transition-all"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
});

// ─── Main Sidebar ─────────────────────────────────────────────────────────────

export default memo(function Sidebar({
  sessions, projects, currentSessionId,
  onSelectSession, onNewChat, onDeleteSession,
  onNewProject, onDeleteProject, onRenameProject, onMoveSession,
  onGoHome, isOpen, onClose
}: SidebarProps) {
  const { user, logout, openAuth } = useAuth();
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const newProjectRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (isAddingProject) newProjectRef.current?.focus(); }, [isAddingProject]);

  const submitNewProject = () => {
    if (newProjectName.trim()) onNewProject(newProjectName.trim());
    setNewProjectName('');
    setIsAddingProject(false);
  };

  const ungrouped = sessions.filter(s => !s.projectId);
  const grouped = projects.map(p => ({
    project: p,
    sessions: sessions.filter(s => s.projectId === p.id),
  }));

  const initials = user?.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() ?? '';

  return (
    <>
      {/* Backdrop (mobile only) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 bg-black/25 backdrop-blur-sm z-30 lg:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* Sidebar panel */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full bg-stone-50 border-stone-200 flex flex-col z-40 transition-all duration-300 ease-in-out",
          isOpen
            ? "translate-x-0 w-72 opacity-100 border-r"
            : "-translate-x-full lg:translate-x-0 lg:w-0 lg:border-r-0 lg:opacity-0",
          "lg:relative lg:z-auto overflow-hidden"
        )}
      >
        <div className="w-72 h-full flex flex-col shrink-0">
          <div className="flex items-center justify-between px-4 py-4 border-b border-stone-100">
          {/* Clickable logo → home */}
          <motion.button
            onClick={() => { onGoHome(); onClose(); }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="flex items-center gap-2.5 rounded-xl px-1 py-0.5 -mx-1 hover:bg-stone-100 transition-colors"
            title="Go to Home"
          >
            <div className="w-8 h-8 bg-stone-900 rounded-lg flex items-center justify-center shadow-sm shrink-0">
              <GraduationCap className="text-white w-4 h-4" />
            </div>
            <h1 className="font-serif text-lg font-semibold tracking-tight text-stone-900">Socrates</h1>
          </motion.button>

          <motion.button
            onClick={onNewChat}
            whileHover={{ scale: 1.12, backgroundColor: '#e7e5e4' }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="p-2 rounded-xl text-stone-600 transition-colors"
            title="New Chat"
          >
            <Plus className="w-4.5 h-4.5" />
          </motion.button>
        </div>

        {/* ── Scrollable Content ─────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 custom-scrollbar">

          {/* Projects section (logged-in only) */}
          {user && (
            <div>
              <div className="flex items-center justify-between px-2 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Projects</span>
                <motion.button
                  onClick={() => setIsAddingProject(true)}
                  whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.85 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                  className="p-1 hover:bg-stone-200 rounded-lg transition-colors"
                  title="New Project"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-stone-400" />
                </motion.button>
              </div>

              {/* New project input */}
              <AnimatePresence>
                {isAddingProject && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    className="mb-2 overflow-hidden"
                  >
                    <div className="flex items-center gap-2 px-2 py-1.5 bg-white border border-stone-200 rounded-xl shadow-sm">
                      <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                      <input
                        ref={newProjectRef} value={newProjectName}
                        onChange={e => setNewProjectName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') submitNewProject(); if (e.key === 'Escape') setIsAddingProject(false); }}
                        placeholder="Project name..."
                        className="flex-1 text-xs outline-none bg-transparent placeholder:text-stone-300"
                      />
                      <button onClick={submitNewProject} className="text-green-600 hover:text-green-700 transition-colors"><Check className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setIsAddingProject(false)} className="text-stone-400 hover:text-red-500 transition-colors"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-1">
                {grouped.map(({ project, sessions: ps }) => (
                  <ProjectFolder
                    key={project.id}
                    project={project}
                    sessions={ps}
                    currentSessionId={currentSessionId}
                    onSelectSession={id => { onSelectSession(id); onClose(); }}
                    onDeleteSession={onDeleteSession}
                    onDelete={() => onDeleteProject(project.id)}
                    onRename={name => onRenameProject(project.id, name)}
                    onDrop={sessionId => onMoveSession(sessionId, project.id)}
                  />
                ))}
                {projects.length === 0 && (
                  <p className="text-[11px] text-stone-300 px-2 py-1 italic">No projects yet — click + to create one.</p>
                )}
              </div>
            </div>
          )}

          {/* All chats / Recent Chats */}
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault();
              const id = e.dataTransfer.getData('sessionId');
              if (id) onMoveSession(id, null);
            }}
          >
            <div className="px-2 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
                {user ? 'All Chats' : 'Recent Chats'}
              </span>
            </div>
            <div className="space-y-1">
              {ungrouped.map(s => (
                <SessionItem
                  key={s.id}
                  session={s}
                  isActive={s.id === currentSessionId}
                  onSelect={() => { onSelectSession(s.id); onClose(); }}
                  onDelete={() => onDeleteSession(s.id)}
                />
              ))}
              {ungrouped.length === 0 && (
                <p className="text-[11px] text-stone-300 px-2 py-1 italic">No chats yet — start a new lesson!</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Bottom: User profile OR Guest CTA ─────────────────── */}
        <div className="border-t border-stone-100 p-3">
          {user ? (
            /* Logged-in user profile */
            <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-stone-100 transition-colors duration-150 group">
              <div className="w-8 h-8 rounded-full bg-stone-900 text-white text-xs font-semibold flex items-center justify-center shrink-0 shadow-sm">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-stone-800 truncate">{user.name}</div>
                <div className="text-[10px] text-stone-400 truncate">{user.email}</div>
              </div>
              <motion.button
                onClick={logout}
                title="Sign Out"
                whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.88 }}
                className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 rounded-lg text-stone-400 transition-all"
              >
                <LogOut className="w-3.5 h-3.5" />
              </motion.button>
            </div>
          ) : (
            /* Guest: Sign In CTA */
            <div className="space-y-2">
              <div className="px-3 py-3.5 bg-stone-50 rounded-xl border border-stone-200/60 shadow-sm">
                <div className="mb-2.5">
                  <p className="text-[11px] text-stone-600 leading-relaxed">
                    <span className="font-semibold text-stone-800">Sign in</span> to save your chats, create projects, and sync across devices.
                  </p>
                </div>
                <motion.button
                  onClick={openAuth}
                  whileHover={{ scale: 1.02, backgroundColor: '#1c1917' }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className="w-full bg-stone-900 text-white text-xs font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 shadow-sm"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Sign In or Create Account
                </motion.button>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  </>
);
});
