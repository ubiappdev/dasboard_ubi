import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import { ToastContainer } from '@/components/ui/Toast';
import { useToasts } from '@/hooks/useToasts';
import DashboardView from '@/views/DashboardView';
import ReconciliationView from '@/views/ReconciliationView';
import WindowView from '@/views/WindowView';
import StudentsView from '@/views/StudentsView';
import FeesView from '@/views/FeesView';
import AuthView from '@/views/AuthView';
import { supabase } from '@/lib/supabase';
import { loadStudents, loadFees, loadScholarships, loadPayments } from '@/lib/database';
import type { ModuleId, Student, FeeItem, ScholarshipType, Transaction } from '@/types';

const MODULE_META: Record<ModuleId, { title: string; subtitle: string }> = {
  dashboard: { title: 'Vista General', subtitle: 'Resumen ejecutivo de la plataforma universitaria' },
  reconciliation: { title: 'Conciliación Bancaria', subtitle: 'Cruce de extractos bancarios con pagos de mensualidades y aranceles' },
  window: { title: 'Ventanilla / Caja', subtitle: 'Registro de pagos en efectivo y carga masiva de recibos' },
  students: { title: 'Estudiantes', subtitle: 'Gestión de alumnos y estado de cuenta' },
  fees: { title: 'Aranceles y Becas', subtitle: 'Configuración de precios oficiales, becas y requisitos' },
};

export default function App() {
  const [session, setSession] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [activeModule, setActiveModule] = useState<ModuleId>('dashboard');
  const { toasts, push, dismiss } = useToasts();

  const [students, setStudents] = useState<Student[]>([]);
  const [fees, setFees] = useState<FeeItem[]>([]);
  const [scholarships, setScholarships] = useState<ScholarshipType[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

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
      push('error', 'No se pudieron cargar los datos. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(!!data.session);
      setUserEmail(data.session?.user?.email ?? undefined);
      if (data.session) void refreshAll();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(!!sess);
      setUserEmail(sess?.user?.email ?? undefined);
      if (sess) void refreshAll();
    });
    return () => sub.subscription.unsubscribe();
  }, [refreshAll]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(false);
    setUserEmail(undefined);
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

  const meta = MODULE_META[activeModule];

  return (
    <div className="flex min-h-screen bg-ink-100">
      <Sidebar active={activeModule} onNavigate={setActiveModule} userEmail={userEmail} onSignOut={handleSignOut} />
      <main className="flex-1 min-w-0 flex flex-col">
        <Topbar title={meta.title} subtitle={meta.subtitle} />
        <div className="flex-1 p-8 overflow-x-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 border-4 border-navy-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {activeModule === 'dashboard' && (
                <DashboardView students={students} transactions={transactions} pushToast={push} />
              )}
              {activeModule === 'reconciliation' && (
                <ReconciliationView transactions={transactions} setTransactions={setTransactions} pushToast={push} onRefresh={refreshAll} />
              )}
              {activeModule === 'window' && (
                <WindowView students={students} fees={fees} scholarships={scholarships} pushToast={push} onRefresh={refreshAll} />
              )}
              {activeModule === 'students' && (
                <StudentsView students={students} scholarships={scholarships} transactions={transactions} pushToast={push} />
              )}
              {activeModule === 'fees' && (
                <FeesView fees={fees} setFees={setFees} scholarships={scholarships} setScholarships={setScholarships} students={students} pushToast={push} />
              )}
            </>
          )}
        </div>
      </main>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
