import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Send, 
  Image as ImageIcon, 
  History, 
  X, 
  ChevronLeft, 
  ChevronRight,
  GraduationCap,
  MessageCircle,
  Sparkles,
  Loader2,
  Menu,
  Brain,
  Camera,
  Compass,
  BookOpen,
  ArrowRight,
  Trash2
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import { cn } from './lib/utils';
import { streamTutorResponse } from './services/geminiService';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image?: string;
  timestamp: number;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
}

function createSession(title = 'New Math Problem'): ChatSession {
  return {
    id: Date.now().toString(),
    title,
    messages: [],
    updatedAt: Date.now(),
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "I couldn't process that just now. Please try again.";
}

function upsertSession(sessions: ChatSession[], session: ChatSession) {
  return [session, ...sessions.filter((existingSession) => existingSession.id !== session.id)];
}

export default function App() {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('socratis_sessions');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const currentSession = sessions.find(s => s.id === currentSessionId);
  const lastMessage = currentSession?.messages.at(-1);

  useEffect(() => {
    localStorage.setItem('socratis_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentSession?.messages]);

  const createNewSession = () => {
    const newSession = createSession();
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSessions(prev => prev.filter(s => s.id !== id));
    if (currentSessionId === id) {
      setCurrentSessionId(null);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmedInput = input.trim();
    if ((!trimmedInput && !selectedImage) || isLoading) return;

    const sessionTitle = trimmedInput.slice(0, 30) || 'Math Problem';
    const existingSession = currentSessionId
      ? sessions.find(session => session.id === currentSessionId) ?? null
      : null;
    const session = existingSession ?? createSession(sessionTitle);
    const sessionId = session.id;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmedInput,
      image: selectedImage || undefined,
      timestamp: Date.now(),
    };

    const updatedSession: ChatSession = {
      ...session,
      messages: [...session.messages, userMessage],
      updatedAt: Date.now(),
      title: session.messages.length === 0 ? sessionTitle : session.title,
    };

    setSessions(prev => upsertSession(prev, updatedSession));
    setCurrentSessionId(sessionId);
    setInput('');
    setSelectedImage(null);
    setIsLoading(true);

    const assistantMessageId = (Date.now() + 1).toString();
    const assistantPlaceholder: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: 'Socrates is thinking...',
      timestamp: Date.now(),
    };

    setSessions(prev => prev.map(session => {
      if (session.id === sessionId) {
        return {
          ...session,
          messages: [...session.messages, assistantPlaceholder],
          updatedAt: Date.now(),
        };
      }
      return session;
    }));

    try {
      let response = '';

      for await (const chunk of streamTutorResponse(
        updatedSession.messages.map(m => ({ role: m.role, content: m.content })),
        userMessage.image?.split(',')[1] // Send only base64 part
      )) {
        response += chunk;

        setSessions(prev => prev.map(session => {
          if (session.id === sessionId) {
            return {
              ...session,
              messages: session.messages.map(message =>
                message.id === assistantMessageId
                  ? { ...message, content: response }
                  : message
              ),
              updatedAt: Date.now(),
            };
          }
          return session;
        }));
      }

      if (!response.trim()) {
        setSessions(prev => prev.map(session => {
          if (session.id === sessionId) {
            return {
              ...session,
              messages: session.messages.map(message =>
                message.id === assistantMessageId
                  ? {
                      ...message,
                      content: "I'm sorry, I couldn't process that. Let's try again.",
                    }
                  : message
              ),
              updatedAt: Date.now(),
            };
          }
          return session;
        }));
      }
    } catch (error) {
      console.error(error);
      setSessions(prev => prev.map(session => {
        if (session.id === sessionId) {
          return {
            ...session,
            messages: session.messages.map(message =>
              message.id === assistantMessageId
                ? { ...message, content: getErrorMessage(error) }
                : message
            ),
            updatedAt: Date.now(),
          };
        }
        return session;
      }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#fdfcfb] overflow-hidden">
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 300 : 0 }}
        className={cn(
          "bg-stone-50 border-r border-stone-200 flex flex-col relative transition-all duration-300 ease-in-out",
          !isSidebarOpen && "border-none"
        )}
      >
        <div className={cn("p-4 flex flex-col h-full", !isSidebarOpen && "hidden")}>
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-stone-900 rounded-lg flex items-center justify-center">
                <GraduationCap className="text-white w-5 h-5" />
              </div>
              <h1 className="font-serif text-xl font-semibold tracking-tight">Socrates</h1>
            </div>
            <button 
              onClick={createNewSession}
              className="p-2 hover:bg-stone-200 rounded-full transition-colors"
              title="New Chat"
            >
              <Plus className="w-5 h-5 text-stone-600" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            <div className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2 px-2">History</div>
            {sessions.map(session => (
              <div
                key={session.id}
                onClick={() => setCurrentSessionId(session.id)}
                className={cn(
                  "w-full text-left p-3 rounded-xl transition-all duration-200 group flex items-start gap-3 cursor-pointer",
                  currentSessionId === session.id 
                    ? "bg-white shadow-sm border border-stone-200" 
                    : "hover:bg-stone-100 border border-transparent"
                )}
              >
                <MessageCircle className={cn(
                  "w-4 h-4 mt-1 shrink-0",
                  currentSessionId === session.id ? "text-stone-900" : "text-stone-400"
                )} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate text-stone-800">{session.title}</div>
                  <div className="text-[10px] text-stone-400 mt-1">
                    {new Date(session.updatedAt).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={(e) => deleteSession(e, session.id)}
                  className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 rounded-lg transition-all text-stone-400"
                  title="Delete Chat"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative">
        {/* Sidebar Toggle Button */}
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className={cn(
            "absolute left-4 top-4 p-2 hover:bg-stone-100 rounded-lg transition-colors z-30",
            isSidebarOpen ? "text-stone-400" : "text-stone-600"
          )}
          title="Toggle History"
        >
          <Menu className="w-6 h-6" />
        </button>

        {!currentSessionId ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12 overflow-y-auto custom-scrollbar">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-3xl w-full"
            >
              {/* Hero Section */}
              <div className="text-center mb-12">
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner"
                >
                  <GraduationCap className="text-stone-900 w-8 h-8" />
                </motion.div>
                <div className="mb-4">
                  <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-stone-400">Socrates: The Math Tutor</span>
                </div>
                <h2 className="font-serif text-4xl lg:text-5xl font-medium mb-6 tracking-tight text-stone-900">
                  Master Math, <span className="italic text-stone-400 font-light">Step by Step.</span>
                </h2>
                <p className="text-stone-500 text-base lg:text-lg max-w-lg mx-auto leading-relaxed mb-10">
                  A patient mentor that guides your intuition, clears your doubts, and helps you truly understand the concepts.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-4">
                  <button 
                    onClick={createNewSession}
                    className="bg-stone-900 text-white px-8 py-3.5 rounded-xl font-medium hover:bg-stone-800 transition-all shadow-lg shadow-stone-200 flex items-center gap-2 group"
                  >
                    Start a New Lesson
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-white border border-stone-200 text-stone-600 px-8 py-3.5 rounded-xl font-medium hover:bg-stone-50 transition-all flex items-center gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    Upload Photo
                  </button>
                </div>
              </div>

              {/* Feature Grid - More compact */}
              <div className="grid sm:grid-cols-3 gap-4 mb-12">
                {[
                  {
                    icon: <Brain className="w-5 h-5" />,
                    title: "Socratic Method",
                    desc: "We ask the right questions to lead you to the solution."
                  },
                  {
                    icon: <Camera className="w-5 h-5" />,
                    title: "Visual Analysis",
                    desc: "Snap a photo of any problem. We'll read it instantly."
                  },
                  {
                    icon: <Compass className="w-5 h-5" />,
                    title: "Concept First",
                    desc: "Ask for a conceptual breakdown anytime."
                  }
                ].map((feature, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + i * 0.1 }}
                    className="p-6 bg-white border border-stone-100 rounded-2xl shadow-sm hover:shadow-md transition-all text-center"
                  >
                    <div className="w-10 h-10 bg-stone-50 rounded-lg flex items-center justify-center mb-4 text-stone-900 mx-auto">
                      {feature.icon}
                    </div>
                    <h3 className="font-serif text-lg font-medium mb-2">{feature.title}</h3>
                    <p className="text-stone-400 text-xs leading-relaxed">{feature.desc}</p>
                  </motion.div>
                ))}
              </div>

              {/* Suggested Topics - Centered and cleaner */}
              <div className="bg-stone-50/50 rounded-3xl p-8 border border-stone-100 text-center">
                <div className="flex items-center justify-center gap-2 mb-6">
                  <BookOpen className="w-4 h-4 text-stone-300" />
                  <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">Explore Topics</h4>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {[
                    "Limits",
                    "Derivatives",
                    "Integration",
                    "Quadratic Equations",
                    "Matrices",
                    "Trigonometry"
                  ].map((topic, i) => (
                    <button
                      key={topic}
                      onClick={() => {
                        createNewSession();
                        setInput(`I want to learn about ${topic}.`);
                      }}
                      className="px-4 py-2 bg-white border border-stone-200 rounded-lg text-xs font-medium text-stone-600 hover:border-stone-900 hover:text-stone-900 transition-all"
                    >
                      {topic}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <header className="h-16 border-bottom border-stone-100 flex items-center px-8 pl-16 justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm font-medium text-stone-600">Active Session</span>
              </div>
              <div className="font-serif italic text-stone-400">{currentSession?.title}</div>
            </header>

            {/* Messages */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar"
            >
              {currentSession?.messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex flex-col max-w-3xl mx-auto",
                    message.role === 'user' ? "items-end" : "items-start"
                  )}
                >
                  <div className={cn(
                    "rounded-2xl p-6 shadow-sm",
                    message.role === 'user' 
                      ? "bg-stone-900 text-white" 
                      : "bg-white border border-stone-100 text-stone-800"
                  )}>
                    {message.image && (
                      <img 
                        src={message.image} 
                        alt="Math problem" 
                        className="max-w-full rounded-lg mb-4 border border-white/10"
                      />
                    )}
                    <div className="markdown-body">
                      <ReactMarkdown 
                        remarkPlugins={[remarkMath]} 
                        rehypePlugins={[rehypeKatex, rehypeRaw]}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                  <span className="text-[10px] text-stone-400 mt-2 px-2">
                    {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </motion.div>
              ))}
              {isLoading && lastMessage?.role !== 'assistant' && (
                <div className="flex items-center gap-3 max-w-3xl mx-auto text-stone-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm font-serif italic">Socrates is thinking...</span>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-8 bg-gradient-to-t from-[#fdfcfb] via-[#fdfcfb] to-transparent">
              <form 
                onSubmit={handleSendMessage}
                className="max-w-3xl mx-auto relative"
              >
                <AnimatePresence>
                  {selectedImage && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 10 }}
                      className="absolute bottom-full mb-4 left-0 p-2 bg-white rounded-xl shadow-xl border border-stone-100 flex items-center gap-3"
                    >
                      <img src={selectedImage} className="w-16 h-16 object-cover rounded-lg" alt="Preview" />
                      <button 
                        type="button"
                        onClick={() => setSelectedImage(null)}
                        className="p-1 hover:bg-stone-100 rounded-full"
                      >
                        <X className="w-4 h-4 text-stone-500" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="relative flex items-center">
                  <input 
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask a question or upload a problem..."
                    className="w-full bg-white border border-stone-200 rounded-2xl py-4 pl-14 pr-14 focus:outline-none focus:ring-2 focus:ring-stone-200 transition-all shadow-sm"
                  />
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute left-4 p-2 text-stone-400 hover:text-stone-600 transition-colors"
                  >
                    <ImageIcon className="w-5 h-5" />
                  </button>
                  <input 
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <button 
                    type="submit"
                    disabled={(!input.trim() && !selectedImage) || isLoading}
                    className="absolute right-4 p-2 bg-stone-900 text-white rounded-xl hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-center text-[10px] text-stone-400 mt-4 uppercase tracking-widest">
                  Socrates guides you, it doesn't just solve.
                </p>
              </form>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
