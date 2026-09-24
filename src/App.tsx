import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import { ToastContainer } from '@/components/ui/Toast';
import { useToasts } from '@/hooks/useToasts';
import DashboardView from '@/views/DashboardView';
import ReconciliationView from '@/views/ReconciliationView';
import WindowView from '@/views/WindowView';
import StudentsView from '@/views/StudentsView';
import ReportsView from '@/views/ReportsView';
import FeesView from '@/views/FeesView';
import AuthView from '@/views/AuthView';
import { supabase } from '@/lib/supabase';
import { loadStudents, loadFees, loadScholarships, loadPayments } from '@/lib/database';
import type { ModuleId, Student, FeeItem, ScholarshipType, Transaction } from '@/types';
import { Key, X, Save, ShieldAlert, LogOut } from 'lucide-react';

const MODULE_META: Record<ModuleId, { title: string; subtitle: string }> = {
  dashboard: { title: 'Transacciones', subtitle: 'Ingresos registrados en plataforma y caja' },
  reconciliation: { title: 'Conciliación Bancaria', subtitle: 'Cruce de extractos bancarios con pagos de mensualidades y aranceles' },
  window: { title: 'Administracion / Caja', subtitle: 'Registro de pagos en efectivo y carga masiva de recibos' },
  students: { title: 'Estudiantes', subtitle: 'Gestión de alumnos y estado de cuenta' },
  fees: { title: 'Configuracion del Sistema', subtitle: 'Configuración de precios oficiales, becas / Administracion de Usuarios' },
  rep: { title: 'Reportes y Estadisticas', subtitle: 'KPIs y reportes estratégicos para administración y directorio' },
};

export default function App() {
  const [session, setSession] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [userProfile, setUserProfile] = useState<{
    nombres: string;
    apellidos: string;
    tipo_usuario: string;
    rol: string | null;
  } | undefined>(undefined);

  const [activeModule, setActiveModule] = useState<ModuleId>('dashboard');
  const { toasts, push, dismiss } = useToasts();

  const [students, setStudents] = useState<Student[]>([]);
  const [fees, setFees] = useState<FeeItem[]>([]);
  const [scholarships, setScholarships] = useState<ScholarshipType[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalMiPasswordOpen, setModalMiPasswordOpen] = useState(false);
  const [miNuevoPassword, setMiNuevoPassword] = useState('');

  const handleCambiarMiPassword = async () => {
    if (!miNuevoPassword || miNuevoPassword.length < 6) {
      push('error', 'La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password: miNuevoPassword });
      if (error) throw error;
      
      push('success', 'Tu contraseña ha sido actualizada correctamente.');
      setModalMiPasswordOpen(false);
      setMiNuevoPassword('');
    } catch (err: any) {
      push('error', err.message || 'No se pudo actualizar la contraseña.');
    }
  };

  const loadUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('perfiles')
        .select('nombres, apellidos, tipo_usuario, rol')
        .eq('auth_id', userId)
        .single();

      if (error) {
        console.error('Error al cargar perfil:', error.message);
      } else if (data) {
        // Normalizamos a minúsculas o validamos variantes para capturar 'ALUMNO' o 'alumno'
        const tipo = (data.tipo_usuario || '').toLowerCase().trim();

        if (tipo === 'alumno' || tipo.includes('alumno')) {
          // 1. Forzamos el cierre de sesión inmediato en Supabase
          await supabase.auth.signOut();
          
          // 2. Limpiamos los estados locales de sesión para forzar la vista de Auth
          setSession(false);
          setUserEmail(undefined);
          setUserProfile(undefined);
          
          push('error', 'Acceso denegado: Las cuentas de tipo alumno no tienen acceso al sistema.');
          return; // Detenemos cualquier otra ejecución
        }

        setUserProfile(data);

        // Asignación de vistas iniciales según rol administrativo
        const rol = (data.rol || '').toUpperCase();
        if (rol === 'CAJERO') {
          setActiveModule('dashboard');
        } else if (rol === 'SECRETARIA' || rol === 'VENTANILLA' || rol === 'OPERADOR') {
          setActiveModule('students');
        }
      }
    } catch (err) {
      console.error('Error inesperado al cargar perfil:', err);
    }
  };
  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, f, sc, tx] = await Promise.all([loadStudents(), loadFees(), loadScholarships(), loadPayments()]);
      setStudents(s);
      setFees(f);
      setScholarships(sc);
      setTransactions(tx);
    } catch (err) {
      console.error('data load failed', err);
      push('error', 'No se pudieron cargar los datos.');
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const currentSession = data.session;
      setSession(!!currentSession);
      setUserEmail(currentSession?.user?.email ?? undefined);
      if (currentSession?.user) {
        void loadUserProfile(currentSession.user.id);
        void refreshAll();
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(!!sess);
      setUserEmail(sess?.user?.email ?? undefined);
      if (sess?.user) {
        void loadUserProfile(sess.user.id);
        void refreshAll();
      } else {
        setUserProfile(undefined);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [refreshAll]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(false);
    setUserEmail(undefined);
    setUserProfile(undefined);
  };

  // Validación rigurosa de accesos a módulos por tipo y rol
  const validarAccesoModulo = (modulo: ModuleId): boolean => {
    if (!userProfile || userProfile.tipo_usuario?.toLowerCase() !== 'administrativo') {
      return false;
    }

    const rol = (userProfile.rol || '').toUpperCase();
    if (!rol || rol === 'ADMINISTRADOR') return true;

    if (rol === 'CAJERO') {
      return ['dashboard', 'reconciliation', 'window', 'students'].includes(modulo);
    }
    if (rol === 'SECRETARIA' || rol === 'VENTANILLA' || rol === 'OPERADOR') {
      return ['students'].includes(modulo);
    }
    return false;
  };

  const handleNavigateSecure = (id: ModuleId) => {
    if (validarAccesoModulo(id)) {
      setActiveModule(id);
    } else {
      push('error', 'No tienes permisos para acceder a este módulo.');
    }
  };

  if (session === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy-950">
        <div className="h-10 w-10 border-4 border-navy-600 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (session === false) {
    return (
      <>
        <AuthView pushToast={push} />
        <ToastContainer toasts={toasts} onDismiss={dismiss} />
      </>
    );
  }

  // Si por alguna razón un alumno logró loguearse pero el perfil indica que no es administrativo
  if (userProfile && userProfile.tipo_usuario?.toLowerCase() !== 'administrativo') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy-950 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center space-y-4">
          <div className="h-16 w-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Acceso Restringido</h2>
          <p className="text-sm text-gray-600">
            Tu cuenta está registrada como <b>{userProfile.tipo_usuario}</b>. Este sistema de administración está reservado exclusivamente para el personal administrativo.
          </p>
          <button 
            onClick={handleSignOut}
            className="w-full bg-[#0A2463] text-white py-2.5 rounded-xl font-semibold hover:bg-[#081d52] transition flex items-center justify-center gap-2"
          >
            <LogOut className="h-4 w-4" /> Cerrar Sesión
          </button>
        </div>
      </div>
    );
  }

  const meta = MODULE_META[activeModule];

  return (
    <div className="flex min-h-screen bg-ink-100">
      <Sidebar 
        active={activeModule} 
        onNavigate={handleNavigateSecure} 
        userEmail={userEmail} 
        userRol={userProfile?.rol}
        userTipo={userProfile?.tipo_usuario}
        onSignOut={handleSignOut} 
      />
      <main className="flex-1 min-w-0 flex flex-col">
        <Topbar 
          title={meta.title} 
          subtitle={meta.subtitle} 
          userProfile={userProfile}
          onOpenChangePassword={() => setModalMiPasswordOpen(true)}
        />
        <div className="flex-1 p-8 overflow-x-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 border-4 border-navy-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {activeModule === 'dashboard' && validarAccesoModulo('dashboard') && (
                <DashboardView students={students} transactions={transactions} pushToast={push} />
              )}
              {activeModule === 'reconciliation' && validarAccesoModulo('reconciliation') && (
                <ReconciliationView transactions={transactions} setTransactions={setTransactions} pushToast={push} onRefresh={refreshAll} />
              )}
              {activeModule === 'window' && validarAccesoModulo('window') && (
                <WindowView students={students} fees={fees} scholarships={scholarships} pushToast={push} onRefresh={refreshAll} />
              )}
              {activeModule === 'students' && validarAccesoModulo('students') && (
                <StudentsView students={students} scholarships={scholarships} transactions={transactions} pushToast={push} />
              )}
              {activeModule === 'fees' && validarAccesoModulo('fees') && (
                <FeesView fees={fees} setFees={setFees} scholarships={scholarships} setScholarships={setScholarships} students={students} pushToast={push} />
              )}
              {activeModule === 'rep' && validarAccesoModulo('rep') && (
                <ReportsView students={students} scholarships={scholarships} transactions={transactions} pushToast={push} />
              )}
            </>
          )}
        </div>
      </main>

      {/* Modal para cambiar contraseña */}
      {modalMiPasswordOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4 border border-ink-200">
            <div className="flex items-center justify-between border-b border-ink-100 pb-3">
              <h3 className="font-bold text-ink-900 text-lg flex items-center gap-2">
                <Key className="h-5 w-5 text-[#0A2463]" /> Cambiar Mi Contraseña
              </h3>
              <button 
                onClick={() => setModalMiPasswordOpen(false)} 
                className="text-ink-400 hover:text-ink-600 p-1 rounded-lg hover:bg-ink-100 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <p className="text-sm text-ink-600">
              Introduce tu nueva contraseña de acceso en Supabase.
            </p>

            <div>
              <label className="text-xs font-semibold text-ink-700 block mb-1">Nueva Contraseña (mínimo 6 caracteres)</label>
              <input 
                type="password" 
                className="w-full border border-ink-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A2463]" 
                placeholder="••••••••" 
                value={miNuevoPassword} 
                onChange={(e) => setMiNuevoPassword(e.target.value)} 
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-ink-100">
              <button 
                onClick={() => setModalMiPasswordOpen(false)} 
                className="px-4 py-2.5 rounded-xl border border-ink-300 text-ink-700 text-sm font-medium hover:bg-ink-50 transition"
              >
                Cancelar
              </button>
              <button 
                onClick={handleCambiarMiPassword} 
                className="px-4 py-2.5 rounded-xl bg-[#0A2463] text-white text-sm font-semibold hover:bg-[#081d52] transition flex items-center gap-1.5 shadow-sm"
              >
                <Save className="h-4 w-4" /> Actualizar Contraseña
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}