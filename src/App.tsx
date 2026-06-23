import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Send, Image as ImageIcon, X, GraduationCap, MessageCircle,
  Loader2, Menu, Brain, Camera, Compass, BookOpen, ArrowRight, Sparkles
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import { cn } from './lib/utils';
import { streamTutorResponse } from './services/geminiService';
import { AuthProvider, useAuth } from './hooks/useAuth';
import AuthModal from './components/AuthPage';
import Sidebar from './components/Sidebar';
import type { ChatSession, Project } from './types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeId() { return Date.now().toString() + Math.random().toString(36).slice(2); }

function createSession(title = 'New Math Problem'): ChatSession {
  return { id: makeId(), title, messages: [], updatedAt: Date.now(), projectId: null };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "I couldn't process that just now. Please try again.";
}

async function apiFetch(path: string, token: string | null, opts: RequestInit = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers ?? {}),
    },
  });
  if (res.status === 204) return null;
  return res.json();
}

// ─── Typing indicator dots ────────────────────────────────────────────────────

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1.5 px-5 py-4 bg-white border border-stone-100 rounded-2xl shadow-sm w-fit">
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="w-2 h-2 rounded-full bg-stone-400"
          animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.9, delay: i * 0.18, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

// ─── Inner app (uses auth context) ───────────────────────────────────────────

function AppInner() {
  const { user, token, isLoading: authLoading, openAuth } = useAuth();

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentSession = sessions.find(s => s.id === currentSessionId);
  const lastMessage = currentSession?.messages.at(-1);
  const isThinking = isLoading && (lastMessage?.role === 'user' || !lastMessage);

  // ── Data loading: guests → localStorage, users → API ─────────────────────
  useEffect(() => {
    if (authLoading) return;

    if (user && token) {
      // Logged-in: load from server
      setDataLoaded(false);
      Promise.all([
        apiFetch('/api/sessions', token),
        apiFetch('/api/projects', token),
      ]).then(([rawSessions, rawProjects]) => {
        const mapped: ChatSession[] = (rawSessions ?? []).map((s: any) => ({
          id: s.id, title: s.title, projectId: s.project_id ?? null, updatedAt: s.updated_at,
          messages: (s.messages ?? []).map((m: any) => ({
            id: m.id, role: m.role as 'user' | 'assistant',
            content: m.content, image: m.image ?? undefined, timestamp: m.timestamp,
          })),
        }));
        const mappedProjects: Project[] = (rawProjects ?? []).map((p: any) => ({
          id: p.id, name: p.name, createdAt: p.created_at,
        }));
        setSessions(mapped);
        setProjects(mappedProjects);
        setDataLoaded(true);
        if (window.innerWidth >= 1024) setIsSidebarOpen(true);
      }).catch(console.error);
    } else {
      // Guest: load from localStorage
      try {
        const saved = localStorage.getItem('socratis_sessions');
        setSessions(saved ? JSON.parse(saved) : []);
      } catch { setSessions([]); }
      setProjects([]);
      setDataLoaded(true);
    }
  }, [user, token, authLoading]);

  // ── Persist guest sessions to localStorage ────────────────────────────────
  useEffect(() => {
    if (!user && dataLoaded) {
      localStorage.setItem('socratis_sessions', JSON.stringify(sessions));
    }
  }, [sessions, user, dataLoaded]);

  // ── Auto-open sidebar on desktop ──────────────────────────────────────────
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handler = (e: MediaQueryListEvent) => { if (e.matches) setIsSidebarOpen(true); };
    mq.addEventListener('change', handler);
    if (mq.matches && dataLoaded) setIsSidebarOpen(true);
    return () => mq.removeEventListener('change', handler);
  }, [dataLoaded]);

  // ── Auto-scroll on new messages ───────────────────────────────────────────
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [currentSession?.messages]);

  // ── Session helpers ────────────────────────────────────────────────────────

  const persistSession = useCallback(async (session: ChatSession) => {
    if (!token || !user) return; // Guests: localStorage handled via useEffect
    const existing = sessions.find(s => s.id === session.id);
    const method = existing ? 'PATCH' : 'POST';
    const path = existing ? `/api/sessions/${session.id}` : '/api/sessions';
    await apiFetch(path, token, {
      method,
      body: JSON.stringify({
        id: session.id, title: session.title, project_id: session.projectId ?? null,
        messages: session.messages, updated_at: session.updatedAt,
      }),
    });
  }, [token, user, sessions]);

  const goHome = useCallback(() => {
    setCurrentSessionId(null);
  }, []);

  const createNewSession = useCallback(() => {
    const s = createSession();
    setSessions(prev => [s, ...prev]);
    setCurrentSessionId(s.id);
    setIsSidebarOpen(false);
    setTimeout(() => inputRef.current?.focus(), 120);
  }, []);

  const deleteSession = useCallback(async (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    if (currentSessionId === id) setCurrentSessionId(null);
    if (token) await apiFetch(`/api/sessions/${id}`, token, { method: 'DELETE' });
  }, [currentSessionId, token]);

  // ── Project helpers (users only) ──────────────────────────────────────────

  const createProject = useCallback(async (name: string) => {
    if (!token) return;
    const data = await apiFetch('/api/projects', token, { method: 'POST', body: JSON.stringify({ name }) });
    if (data) setProjects(prev => [{ id: data.id, name: data.name, createdAt: data.created_at }, ...prev]);
  }, [token]);

  const deleteProject = useCallback(async (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    setSessions(prev => prev.map(s => s.projectId === id ? { ...s, projectId: null } : s));
    if (token) await apiFetch(`/api/projects/${id}`, token, { method: 'DELETE' });
  }, [token]);

  const renameProject = useCallback(async (id: string, name: string) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, name } : p));
    if (token) await apiFetch(`/api/projects/${id}`, token, { method: 'PATCH', body: JSON.stringify({ name }) });
  }, [token]);

  const moveSession = useCallback(async (sessionId: string, projectId: string | null) => {
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, projectId } : s));
    if (token) await apiFetch(`/api/sessions/${sessionId}`, token, { method: 'PATCH', body: JSON.stringify({ project_id: projectId }) });
  }, [token]);

  // ── Image upload ──────────────────────────────────────────────────────────

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setSelectedImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  // ── Send message ──────────────────────────────────────────────────────────

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmedInput = input.trim();
    if ((!trimmedInput && !selectedImage) || isLoading) return;

    const sessionTitle = trimmedInput.slice(0, 40) || 'Math Problem';
    const existingSession = currentSessionId ? sessions.find(s => s.id === currentSessionId) ?? null : null;
    const session = existingSession ?? createSession(sessionTitle);
    const sessionId = session.id;

    const userMessage = {
      id: makeId(), role: 'user' as const,
      content: trimmedInput, image: selectedImage || undefined, timestamp: Date.now(),
    };
    const updatedSession: ChatSession = {
      ...session,
      messages: [...session.messages, userMessage],
      updatedAt: Date.now(),
      title: session.messages.length === 0 ? sessionTitle : session.title,
    };

    setSessions(prev => [updatedSession, ...prev.filter(s => s.id !== sessionId)]);
    setCurrentSessionId(sessionId);
    setInput('');
    setSelectedImage(null);
    setIsLoading(true);

    const assistantId = makeId();
    const placeholder = { id: assistantId, role: 'assistant' as const, content: '', timestamp: Date.now() };

    setSessions(prev => prev.map(s =>
      s.id === sessionId ? { ...s, messages: [...s.messages, placeholder], updatedAt: Date.now() } : s
    ));

    try {
      let response = '';
      for await (const chunk of streamTutorResponse(
        updatedSession.messages.map(m => ({ role: m.role, content: m.content })),
        userMessage.image?.split(',')[1]
      )) {
        response += chunk;
        setSessions(prev => prev.map(s =>
          s.id === sessionId
            ? { ...s, messages: s.messages.map(m => m.id === assistantId ? { ...m, content: response } : m) }
            : s
        ));
      }

      if (!response.trim()) {
        setSessions(prev => prev.map(s =>
          s.id === sessionId
            ? { ...s, messages: s.messages.map(m => m.id === assistantId ? { ...m, content: "I'm sorry, I couldn't process that. Let's try again." } : m) }
            : s
        ));
      }

      // Persist to server (users) — localStorage handled by useEffect (guests)
      persistSession({
        ...updatedSession,
        messages: [
          ...updatedSession.messages,
          { ...placeholder, content: response || "I'm sorry, I couldn't process that." }
        ],
        updatedAt: Date.now(),
      }).catch(console.error);

    } catch (error) {
      console.error(error);
      setSessions(prev => prev.map(s =>
        s.id === sessionId
          ? { ...s, messages: s.messages.map(m => m.id === assistantId ? { ...m, content: getErrorMessage(error) } : m) }
          : s
      ));
    } finally {
      setIsLoading(false);
    }
  };

  // ── Loading spinner (auth check) ──────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="h-dvh flex items-center justify-center bg-[#fdfcfb]">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="w-14 h-14 bg-stone-900 rounded-2xl flex items-center justify-center shadow-xl"
          >
            <GraduationCap className="text-white w-7 h-7" />
          </motion.div>
          <p className="text-stone-400 text-sm font-medium">Loading Socrates…</p>
        </motion.div>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <>
      {/* Auth modal (overlay, non-blocking) */}
      <AuthModal />

      <div className="flex h-dvh bg-[#fdfcfb] overflow-hidden sidebar-wrapper">

        {/* Sidebar */}
        <Sidebar
          sessions={sessions}
          projects={projects}
          currentSessionId={currentSessionId}
          onSelectSession={setCurrentSessionId}
          onNewChat={createNewSession}
          onDeleteSession={deleteSession}
          onNewProject={createProject}
          onDeleteProject={deleteProject}
          onRenameProject={renameProject}
          onMoveSession={moveSession}
          onGoHome={goHome}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        {/* Main Content */}
        <main className="flex-1 flex flex-col relative min-w-0 overflow-hidden">

          {/* ── Top Header ────────────────────────────────────────── */}
          <header className="h-14 border-b border-stone-100 flex items-center px-4 justify-between bg-white/80 backdrop-blur-md sticky top-0 z-20">
            {/* Hamburger */}
            <motion.button
              onClick={() => setIsSidebarOpen(v => !v)}
              whileHover={{ scale: 1.08, backgroundColor: '#f5f5f4' }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="p-2 rounded-xl text-stone-600 transition-colors"
              aria-label="Toggle sidebar"
            >
              <Menu className="w-5 h-5" />
            </motion.button>

            {/* Center: clickable logo or session title */}
            {currentSession ? (
              <motion.button
                onClick={goHome}
                className="flex-1 text-center px-3 group"
                title="Go to Home"
              >
                <span className="font-serif italic text-stone-400 text-sm truncate block max-w-[55vw] mx-auto group-hover:text-stone-600 transition-colors duration-200">
                  {currentSession.title}
                </span>
              </motion.button>
            ) : (
              <motion.button
                onClick={goHome}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="flex items-center gap-2 rounded-xl px-2 py-1"
                title="Home"
              >
                <div className="w-6 h-6 bg-stone-900 rounded-md flex items-center justify-center">
                  <GraduationCap className="text-white w-3.5 h-3.5" />
                </div>
                <span className="font-serif text-base font-semibold text-stone-900">Socrates</span>
              </motion.button>
            )}

            {/* Right action */}
            {currentSession ? (
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-stone-400 hidden sm:block">Active</span>
              </div>
            ) : (
              !user ? (
                <motion.button
                  onClick={openAuth}
                  whileHover={{ scale: 1.04, backgroundColor: '#292524' }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className="text-xs font-medium bg-stone-900 text-white px-3.5 py-1.5 rounded-lg shadow-sm"
                >
                  Sign In
                </motion.button>
              ) : (
                <motion.button
                  onClick={createNewSession}
                  whileHover={{ scale: 1.08, backgroundColor: '#f5f5f4' }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className="p-2 rounded-xl text-stone-600 transition-colors"
                  aria-label="New chat"
                >
                  <MessageCircle className="w-5 h-5" />
                </motion.button>
              )
            )}
          </header>

          {/* ── Content Area ──────────────────────────────────────── */}
          {!currentSession ? (
            /* Welcome / Home screen */
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="flex flex-col items-center justify-center min-h-full p-5 sm:p-8 lg:p-12">
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 280, damping: 28 }}
                  className="max-w-2xl w-full"
                >
                  {/* Hero */}
                  <div className="text-center mb-10">
                    <motion.div
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 320, damping: 22, delay: 0.1 }}
                      className="w-16 h-16 sm:w-20 sm:h-20 bg-stone-900 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-stone-300"
                    >
                      <GraduationCap className="text-white w-8 h-8 sm:w-10 sm:h-10" />
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="mb-3"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-stone-400">
                        Socrates: The Math Tutor
                      </span>
                    </motion.div>
                    <motion.h2
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25, type: 'spring', stiffness: 300, damping: 28 }}
                      className="font-serif text-3xl sm:text-4xl lg:text-5xl font-medium mb-4 tracking-tight text-stone-900"
                    >
                      Master Math,{' '}
                      <span className="italic text-stone-400 font-light">Step by Step.</span>
                    </motion.h2>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.32 }}
                      className="text-stone-500 text-sm sm:text-base max-w-md mx-auto leading-relaxed mb-8"
                    >
                      A patient mentor that guides your intuition, clears your doubts, and helps you truly understand.
                    </motion.p>

                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.38 }}
                      className="flex flex-col sm:flex-row items-center justify-center gap-3"
                    >
                      <motion.button
                        onClick={createNewSession}
                        whileHover={{ scale: 1.03, backgroundColor: '#292524' }}
                        whileTap={{ scale: 0.97 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        className="w-full sm:w-auto bg-stone-900 text-white px-7 py-3.5 rounded-xl font-medium shadow-lg shadow-stone-200 flex items-center justify-center gap-2 group"
                      >
                        Start a New Lesson
                        <motion.div
                          animate={{ x: 0 }}
                          whileHover={{ x: 4 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                        >
                          <ArrowRight className="w-4 h-4" />
                        </motion.div>
                      </motion.button>

                      <motion.button
                        onClick={() => fileInputRef.current?.click()}
                        whileHover={{ scale: 1.03, backgroundColor: '#f5f5f4', borderColor: '#a8a29e' }}
                        whileTap={{ scale: 0.97 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        className="w-full sm:w-auto bg-white border border-stone-200 text-stone-600 px-7 py-3.5 rounded-xl font-medium flex items-center justify-center gap-2"
                      >
                        <Camera className="w-4 h-4" />
                        Upload Photo
                      </motion.button>
                    </motion.div>

                    {/* Guest sign-in nudge (non-intrusive) */}
                    {!user && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.55 }}
                        className="text-xs text-stone-400 mt-5"
                      >
                        <button onClick={openAuth} className="hover:text-stone-700 underline underline-offset-2 transition-colors">
                          Sign in
                        </button>{' '}
                        to save your chat history and unlock projects.
                      </motion.p>
                    )}
                  </div>

                  {/* Feature grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
                    {[
                      { icon: <Brain className="w-5 h-5" />, title: 'Socratic Method', desc: 'We ask the right questions to lead you to the solution.' },
                      { icon: <Camera className="w-5 h-5" />, title: 'Visual Analysis', desc: "Snap a photo of any problem. We'll read it instantly." },
                      { icon: <Compass className="w-5 h-5" />, title: 'Concept First', desc: 'Ask for a conceptual breakdown anytime.' },
                    ].map((f, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.44 + i * 0.08, type: 'spring', stiffness: 300, damping: 28 }}
                        whileHover={{ y: -3, boxShadow: '0 8px 30px -8px rgba(0,0,0,0.12)' }}
                        className="p-5 bg-white border border-stone-100 rounded-2xl shadow-sm text-center cursor-default"
                      >
                        <div className="w-9 h-9 bg-stone-50 rounded-lg flex items-center justify-center mb-3 text-stone-900 mx-auto">{f.icon}</div>
                        <h3 className="font-serif text-base font-medium mb-1">{f.title}</h3>
                        <p className="text-stone-400 text-xs leading-relaxed">{f.desc}</p>
                      </motion.div>
                    ))}
                  </div>

                  {/* Topic chips */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="bg-stone-50/70 rounded-2xl p-5 sm:p-7 border border-stone-100 text-center"
                  >
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <BookOpen className="w-4 h-4 text-stone-300" />
                      <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">Explore Topics</h4>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2">
                      {['Limits', 'Derivatives', 'Integration', 'Quadratic Equations', 'Matrices', 'Trigonometry'].map((topic, i) => (
                        <motion.button
                          key={topic}
                          initial={{ opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.62 + i * 0.05 }}
                          whileHover={{ scale: 1.06, borderColor: '#1c1917', color: '#1c1917', backgroundColor: '#fafaf9' }}
                          whileTap={{ scale: 0.94 }}
                          onClick={() => { createNewSession(); setInput(`I want to learn about ${topic}.`); }}
                          className="px-4 py-2 bg-white border border-stone-200 rounded-lg text-xs font-medium text-stone-600 transition-colors"
                        >
                          {topic}
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                </motion.div>
              </div>
            </div>

          ) : (
            /* ── Chat View ──────────────────────────────────────── */
            <>
              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-5 custom-scrollbar">
                <AnimatePresence initial={false}>
                  {currentSession.messages.map(message => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 12, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      className={cn(
                        'flex flex-col max-w-2xl',
                        message.role === 'user' ? 'items-end ml-auto' : 'items-start mr-auto'
                      )}
                    >
                      <div className={cn(
                        'rounded-2xl px-5 py-4 shadow-sm max-w-full',
                        message.role === 'user'
                          ? 'bg-stone-900 text-white'
                          : 'bg-white border border-stone-100 text-stone-800'
                      )}>
                        {message.image && (
                          <img
                            src={message.image} alt="Math problem"
                            className="max-w-full rounded-lg mb-3 border border-white/10"
                            style={{ maxHeight: 280 }}
                          />
                        )}
                        {/* Show empty assistant message as thinking dots */}
                        {message.role === 'assistant' && !message.content ? (
                          <ThinkingDots />
                        ) : (
                          <div className={cn('markdown-body', message.role === 'user' && '[&_p]:text-white [&_strong]:text-white [&_code]:bg-white/10 [&_code]:text-white/90')}>
                            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex, rehypeRaw]}>
                              {message.content}
                            </ReactMarkdown>
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-stone-400 mt-1.5 px-1">
                        {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Extra thinking indicator when no placeholder yet */}
                {isThinking && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 text-stone-400"
                  >
                    <ThinkingDots />
                  </motion.div>
                )}
              </div>

              {/* Input area */}
              <div className="px-4 sm:px-6 pb-5 sm:pb-6 pt-2 bg-gradient-to-t from-[#fdfcfb] via-[#fdfcfb]/95 to-transparent">
                <form onSubmit={handleSendMessage} className="max-w-2xl mx-auto relative">
                  {/* Image preview */}
                  <AnimatePresence>
                    {selectedImage && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.88, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.88, y: 10 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        className="absolute bottom-full mb-3 left-0 p-2 bg-white rounded-xl shadow-xl border border-stone-100 flex items-center gap-3 z-10"
                      >
                        <img src={selectedImage} className="w-14 h-14 object-cover rounded-lg" alt="Preview" />
                        <motion.button
                          type="button" onClick={() => setSelectedImage(null)}
                          whileHover={{ scale: 1.1, backgroundColor: '#f5f5f4' }} whileTap={{ scale: 0.9 }}
                          className="p-1.5 rounded-full transition-colors"
                        >
                          <X className="w-4 h-4 text-stone-500" />
                        </motion.button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="relative flex items-center">
                    <input
                      ref={inputRef} type="text" value={input}
                      onChange={e => setInput(e.target.value)}
                      placeholder="Ask a question or upload a problem…"
                      className="w-full bg-white border border-stone-200 rounded-2xl py-3.5 pl-12 pr-14 focus:outline-none focus:ring-2 focus:ring-stone-300 focus:border-stone-300 transition-all shadow-sm text-sm hover:border-stone-300 hover:shadow-md"
                    />
                    <motion.button
                      type="button" onClick={() => fileInputRef.current?.click()}
                      whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.85 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      className="absolute left-3.5 p-1.5 text-stone-400 hover:text-stone-600 transition-colors"
                      aria-label="Upload image"
                    >
                      <ImageIcon className="w-4 h-4" />
                    </motion.button>
                    <input
                      type="file" ref={fileInputRef} onChange={handleImageUpload}
                      accept="image/*" capture="environment" className="hidden"
                    />
                    <motion.button
                      type="submit"
                      disabled={(!input.trim() && !selectedImage) || isLoading}
                      whileHover={{ scale: 1.08, backgroundColor: '#292524' }}
                      whileTap={{ scale: 0.9 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      className="absolute right-3 p-2 bg-stone-900 text-white rounded-xl disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
                      aria-label="Send"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </motion.button>
                  </div>
                  <p className="text-center text-[10px] text-stone-300 mt-3 uppercase tracking-widest">
                    Socrates guides you, it doesn't just solve.
                  </p>
                </form>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
