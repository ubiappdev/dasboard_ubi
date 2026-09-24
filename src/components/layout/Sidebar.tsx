import {
  LayoutDashboard,
  Landmark,
  Store,
  Users,
  BarChart3,
  ComputerIcon,
  ShieldCheck,
  LogOut
} from 'lucide-react';
import type { ModuleId } from '@/types';

interface NavItem {
  id: ModuleId;
  label: string;
  icon: typeof LayoutDashboard;
  description: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Transacciones Generales', icon: LayoutDashboard, description: 'Pagos por banco y caja' },
  { id: 'reconciliation', label: 'Conciliación Bancaria', icon: Landmark, description: 'Extractos/Conciliación' },
  { id: 'window', label: 'Conciliacion de Caja', icon: Store, description: 'Validación de pagos' },
  { id: 'students', label: 'Control/Consulta de Pagos', icon: Users, description: 'Historial de Pagos' },
  { id: 'rep', label: 'Reportes y Estadisticas', icon: BarChart3, description: 'Reportes' },
  { id: 'fees', label: 'Configuracion/Sistema', icon: ComputerIcon, description: 'Usuarios/ Catalogos ' },
];

interface SidebarProps {
  active: ModuleId;
  onNavigate: (id: ModuleId) => void;
  userEmail?: string;
  userRol?: string | null;
  userTipo?: string;       // <--- Tipo de usuario ('administrativo' / 'alumno')
  onSignOut: () => void;
}

export default function Sidebar({ active, onNavigate, userEmail, userRol, userTipo, onSignOut }: SidebarProps) {
  
  const getFilteredNavItems = () => {
    // Si no es administrativo (ej. es alumno), no ve ningún menú administrativo
    if (userTipo && userTipo.toLowerCase() !== 'administrativo') {
      return [];
    }

    // Filtrado según rol administrativo
    const rol = (userRol || '').toUpperCase();
    if (rol === 'CAJERO') {
      return NAV_ITEMS.filter(item => ['dashboard', 'reconciliation', 'window', 'students'].includes(item.id));
    }
    if (rol === 'SECRETARIA' || rol === 'VENTANILLA' || rol === 'OPERADOR') {
      return NAV_ITEMS.filter(item => ['students'].includes(item.id));
    }
    // Administrador: ve todo
    return NAV_ITEMS;
  };

  const visibleItems = getFilteredNavItems();

  return (
    <aside className="w-64 flex-shrink-0 bg-navy-900 text-white flex flex-col h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-navy-800">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-8 items-center justify-center rounded-xl bg-navy-700 ring-1 ring-navy-600 overflow-hidden">
            <img 
              src="https://ahjgfwpqugokzksfoufu.supabase.co/storage/v1/object/public/configuracion-pagos/logo.png" 
              alt="Logo UniControl" 
              className="h-full w-full object-cover"
            />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight">UniControl</h1>
            <p className="text-xs text-navy-300">Panel de Administración</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-navy-400">
          Módulos {userRol ? `(${userRol})` : ''}
        </p>
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`nav-item w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition ${
                isActive ? 'bg-navy-800 text-white font-semibold' : 'text-navy-300 hover:bg-navy-800/50 hover:text-white'
              }`}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm">{item.label}</p>
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
            <p className="text-xs text-navy-300 truncate">{userRol ? `Rol: ${userRol}` : 'Sesión activa'}</p>
          </div>
          <button onClick={onSignOut} className="text-navy-300 hover:text-white transition" title="Cerrar sesión">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </aside>
  );
}