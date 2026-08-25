import { useState } from 'react';
import { GraduationCap, ShieldCheck, LogIn, Loader2, Mail, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { ToastPush } from '@/types';

interface AuthViewProps {
  pushToast: ToastPush;
}

export default function AuthView({ pushToast }: AuthViewProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email || !password) {
      pushToast('error', 'Ingresa tu correo y contraseña.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        pushToast('success', 'Sesión iniciada correctamente.');
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        pushToast('success', 'Cuenta creada correctamente. Ya puedes ingresar con tus credenciales.');
      }
    } catch (error) {
      console.error('auth failed', error);
      pushToast('error', mode === 'signin' ? 'Credenciales incorrectas o la cuenta no existe.' : 'No se pudo crear la cuenta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-navy-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-pop p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy-800 text-white">
            <GraduationCap className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-ink-900">UniControl</h1>
            <p className="text-sm text-ink-500">Administración universitaria</p>
          </div>
        </div>
        <div className="rounded-xl bg-navy-50 border border-navy-100 p-4 mb-6">
          <div className="flex gap-3">
            <ShieldCheck className="h-5 w-5 text-navy-700 shrink-0" />
            <p className="text-sm text-navy-700">Ingresa con tu correo institucional y contraseña para acceder al panel.</p>
          </div>
        </div>
        <div className="flex gap-1 rounded-lg bg-ink-100 p-1 w-fit mb-5">
          <button onClick={() => setMode('signin')} className={`btn ${mode === 'signin' ? 'bg-white text-navy-800 shadow-sm' : 'text-ink-500'}`}>Iniciar sesión</button>
          <button onClick={() => setMode('signup')} className={`btn ${mode === 'signup' ? 'bg-white text-navy-800 shadow-sm' : 'text-ink-500'}`}>Crear cuenta</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Correo electrónico</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
              <input type="email" className="input pl-9" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@universidad.edu" autoComplete="email" />
            </div>
          </div>
          <div>
            <label className="label">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
              <input type="password" className="input pl-9" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} />
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
            {mode === 'signin' ? 'Iniciar sesión' : 'Crear cuenta'}
          </button>
        </form>
        <p className="text-center text-xs text-ink-400 mt-5">Solo personal autorizado puede acceder a la información financiera.</p>
      </div>
    </main>
  );
}
