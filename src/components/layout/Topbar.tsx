import { Search, Bell, ChevronDown, Calendar } from 'lucide-react';

interface TopbarProps {
  title: string;
  subtitle: string;
  searchPlaceholder?: string;
  onSearch?: (q: string) => void;
  userProfile?: {
    nombres: string;
    apellidos: string;
    tipo_usuario: string;
    rol?: string | null;
  };
}

export default function Topbar({ 
  title, 
  subtitle, 
  searchPlaceholder = 'Buscar estudiantes, pagos, comprobantes…', 
  onSearch,
  userProfile 
}: TopbarProps) {
  const today = new Date().toLocaleDateString('es-BO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Extraer iniciales para el avatar de forma segura
  const nombres = userProfile?.nombres || 'Usuario';
  const apellidos = userProfile?.apellidos || '';
  const iniciales = `${nombres.charAt(0)}${apellidos.charAt(0)}`.toUpperCase();

  // Formatear el rol o tipo de usuario para mostrarlo ordenado
  const rolTexto = userProfile?.rol 
    ? `${userProfile.rol.charAt(0) + userProfile.rol.slice(1).toLowerCase()}` 
    : (userProfile?.tipo_usuario || 'Administrador');

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-ink-200">
      <div className="flex items-center justify-between gap-6 px-8 py-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-ink-900 tracking-tight">{title}</h2>
          <p className="text-sm text-ink-500 mt-0.5">{subtitle}</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              onChange={(e) => onSearch?.(e.target.value)}
              className="input pl-9"
            />
          </div>

          <div className="hidden lg:flex items-center gap-2 rounded-lg bg-ink-50 border border-ink-200 px-3 py-2 text-sm text-ink-600">
            <Calendar className="h-4 w-4 text-ink-400" />
            <span className="capitalize">{today}</span>
          </div>

          <button className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-ink-200 text-ink-600 hover:bg-ink-50 transition">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
          </button>

          <div className="flex items-center gap-2.5 rounded-lg border border-ink-200 px-2.5 py-1.5 hover:bg-ink-50 transition cursor-pointer">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0A2463] text-white text-sm font-bold">
              {iniciales}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-semibold text-ink-800 leading-tight">
                {nombres} {apellidos}
              </p>
              <p className="text-xs text-ink-500 leading-tight capitalize">
                {rolTexto} {userProfile?.tipo_usuario ? `(${userProfile.tipo_usuario.toLowerCase()})` : ''}
              </p>
            </div>
            <ChevronDown className="h-4 w-4 text-ink-400" />
          </div>
        </div>
      </div>
    </header>
  );
}