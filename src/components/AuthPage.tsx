import { useState, FormEvent, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GraduationCap, Mail, Lock, User, Eye, EyeOff, ArrowRight, Loader2, X, Sparkles } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

// ─── Auth Modal ─────────────────────────────────────────────────────────────
// Shown as a floating overlay on top of the app when the user clicks "Sign In"
// so guests can still chat without creating an account first.

export default function AuthModal() {
  const { isAuthOpen, closeAuth, login, register, user } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Close modal when user logs in
  useEffect(() => { if (user) closeAuth(); }, [user]);

  // Reset form when closed
  useEffect(() => {
    if (!isAuthOpen) {
      setTimeout(() => { setError(''); setName(''); setEmail(''); setPassword(''); setShowPass(false); }, 300);
    }
  }, [isAuthOpen]);

  // Lock body scroll when open
  useEffect(() => {
    if (isAuthOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isAuthOpen]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(name, email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isAuthOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-md z-50"
            onClick={closeAuth}
          />

          {/* Modal card */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 24 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl shadow-black/20 pointer-events-auto overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Close button */}
              <motion.button
                whileHover={{ scale: 1.1, backgroundColor: '#f5f5f4' }}
                whileTap={{ scale: 0.92 }}
                onClick={closeAuth}
                className="absolute top-4 right-4 z-10 p-2 rounded-xl text-stone-400 hover:text-stone-700 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </motion.button>

              {/* Header */}
              <div className="px-8 pt-8 pb-0 text-center">
                <motion.div
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25, delay: 0.05 }}
                  className="w-12 h-12 bg-stone-900 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg"
                >
                  <GraduationCap className="text-white w-6 h-6" />
                </motion.div>
                <motion.h2
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="font-serif text-2xl font-semibold text-stone-900 mb-1"
                >
                  {mode === 'login' ? 'Welcome back' : 'Create your account'}
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.15 }}
                  className="text-stone-400 text-sm mb-0"
                >
                  {mode === 'login'
                    ? 'Sign in to save your chat history and projects.'
                    : 'Save your history, create projects, and more.'}
                </motion.p>
              </div>

              {/* Benefits strip (for register) */}
              <AnimatePresence>
                {mode === 'register' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mx-8 mt-4 overflow-hidden"
                  >
                    <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 flex items-start gap-3">
                      <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700 leading-relaxed">
                        Free account — sync chats across devices, organize into projects, and never lose a session.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Tab bar */}
              <div className="flex mx-8 mt-5 border-b border-stone-100">
                {(['login', 'register'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => { setMode(tab); setError(''); }}
                    className={`flex-1 pb-3 text-sm font-medium transition-all duration-200 relative ${
                      mode === tab ? 'text-stone-900' : 'text-stone-400 hover:text-stone-600'
                    }`}
                  >
                    {tab === 'login' ? 'Sign In' : 'Create Account'}
                    {mode === tab && (
                      <motion.div
                        layoutId="tab-indicator"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-stone-900 rounded-full"
                        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                      />
                    )}
                  </button>
                ))}
              </div>

              {/* Form */}
              <div className="px-8 pb-8 pt-5">
                <AnimatePresence mode="wait">
                  <motion.form
                    key={mode}
                    initial={{ opacity: 0, x: mode === 'login' ? -12 : 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: mode === 'login' ? 12 : -12 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    onSubmit={handleSubmit}
                    className="space-y-4"
                  >
                    {mode === 'register' && (
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">Full Name</label>
                        <div className="relative group">
                          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300 group-focus-within:text-stone-500 transition-colors" />
                          <input
                            type="text" value={name} onChange={e => setName(e.target.value)} required
                            placeholder="Ada Lovelace"
                            className="w-full pl-10 pr-4 py-3 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-400 transition-all bg-stone-50/40 placeholder:text-stone-300"
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">Email</label>
                      <div className="relative group">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300 group-focus-within:text-stone-500 transition-colors" />
                        <input
                          type="email" value={email} onChange={e => setEmail(e.target.value)} required
                          placeholder="you@example.com"
                          className="w-full pl-10 pr-4 py-3 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-400 transition-all bg-stone-50/40 placeholder:text-stone-300"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">Password</label>
                      <div className="relative group">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300 group-focus-within:text-stone-500 transition-colors" />
                        <input
                          type={showPass ? 'text' : 'password'} value={password}
                          onChange={e => setPassword(e.target.value)} required minLength={8}
                          placeholder={mode === 'register' ? 'Min. 8 characters' : '••••••••'}
                          className="w-full pl-10 pr-12 py-3 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-400 transition-all bg-stone-50/40 placeholder:text-stone-300"
                        />
                        <button
                          type="button" onClick={() => setShowPass(v => !v)} tabIndex={-1}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-300 hover:text-stone-500 transition-colors p-1"
                        >
                          {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Inline error */}
                    <AnimatePresence>
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, y: -6, height: 0 }}
                          animate={{ opacity: 1, y: 0, height: 'auto' }}
                          exit={{ opacity: 0, y: -6, height: 0 }}
                          className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600 overflow-hidden"
                        >
                          {error}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Submit */}
                    <motion.button
                      type="submit"
                      disabled={isSubmitting}
                      whileHover={{ scale: 1.015, backgroundColor: '#292524' }}
                      whileTap={{ scale: 0.975 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      className="w-full bg-stone-900 text-white py-3.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg shadow-stone-200 mt-1"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          {mode === 'login' ? 'Sign In' : 'Create Account'}
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </motion.button>

                    {/* Guest hint */}
                    <p className="text-center text-[11px] text-stone-400">
                      Just browsing?{' '}
                      <button type="button" onClick={closeAuth} className="text-stone-600 hover:text-stone-900 underline underline-offset-2 transition-colors">
                        Continue as guest
                      </button>
                    </p>
                  </motion.form>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
