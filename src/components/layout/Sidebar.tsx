import {
  LayoutDashboard,
  Landmark,
  Store,
  Users,
  DollarSign,
  GraduationCap,
  ShieldCheck,
  LogOut,
} from 'lucide-react';
import type { ModuleId } from '@/types';

interface NavItem {
  id: ModuleId;
  label: string;
  icon: typeof LayoutDashboard;
  description: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Vista General', icon: LayoutDashboard, description: 'KPIs y resumen' },
  { id: 'reconciliation', label: 'Conciliación Bancaria', icon: Landmark, description: 'Cruce de extractos' },
  { id: 'window', label: 'Ventanilla / Caja', icon: Store, description: 'Pagos en efectivo' },
  { id: 'students', label: 'Estudiantes', icon: Users, description: 'Alumnos' },
  { id: 'fees', label: 'Aranceles y Becas', icon: DollarSign, description: 'Precios y becas' },
];

interface SidebarProps {
  active: ModuleId;
  onNavigate: (id: ModuleId) => void;
  userEmail?: string;
  onSignOut: () => void;
}

export default function Sidebar({ active, onNavigate, userEmail, onSignOut }: SidebarProps) {
  const initials = userEmail ? userEmail.slice(0, 2).toUpperCase() : 'UC';
  return (
    <aside className="w-64 flex-shrink-0 bg-navy-900 text-white flex flex-col h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-navy-800">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-700 ring-1 ring-navy-600">
            <GraduationCap className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight">UniControl</h1>
            <p className="text-xs text-navy-300">Panel de Administración</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-navy-400">
          Módulos
        </p>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`nav-item w-full text-left ${isActive ? 'nav-item-active' : ''}`}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="truncate">{item.label}</p>
                <p className={`text-xs ${isActive ? 'text-navy-200' : 'text-navy-400'} truncate`}>
                  {item.description}
                </p>
              </div>
            </button>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-navy-800">
        <div className="flex items-center gap-3 rounded-lg bg-navy-800 px-3 py-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{userEmail ?? 'Administrador'}</p>
            <p className="text-xs text-navy-300 truncate">Sesión activa</p>
          </div>
          <button onClick={onSignOut} className="text-navy-300 hover:text-white transition" title="Cerrar sesión">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
