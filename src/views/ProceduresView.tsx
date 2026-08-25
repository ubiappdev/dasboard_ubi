import { useState, useEffect, useMemo } from 'react';
import {
  FolderCheck,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Circle,
  FileText,
  Search,
  Timer,
  Inbox,
  Eye,
  Save,
  MessageSquare,
} from 'lucide-react';
import type { Procedure, Requirement, ToastPush } from '@/types';
import { formatDateTime } from '@/lib/format';

interface ProceduresViewProps {
  procedures: Procedure[];
  setProcedures: React.Dispatch<React.SetStateAction<Procedure[]>>;
  pushToast: ToastPush;
}

function SlaTimer({ transcurrido, sla }: { transcurrido: number; sla: number }) {
  const [elapsed, setElapsed] = useState(transcurrido);
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1 / 3600);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const remaining = sla - elapsed;
  const isVencido = elapsed > sla;
  const isNear = remaining > 0 && remaining < sla * 0.25;
  const pct = Math.min((elapsed / sla) * 100, 100);

  const hours = Math.floor(elapsed);
  const mins = Math.floor((elapsed - hours) * 60);

  const color = isVencido ? 'text-red-600' : isNear ? 'text-amber-600' : 'text-ink-700';
  const barColor = isVencido ? 'bg-red-500' : isNear ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className={`flex items-center gap-2 ${isVencido ? 'animate-pulse-alert' : ''}`}>
      <Timer className={`h-4 w-4 ${color}`} />
      <div>
        <div className={`font-mono text-sm font-semibold ${color}`}>
          {String(hours).padStart(2, '0')}h {String(mins).padStart(2, '0')}m
        </div>
        <div className="h-1 w-20 rounded-full bg-ink-100 overflow-hidden mt-0.5">
          <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

const STATUS_CONFIG = {
  ingresado: { label: 'Ingresado', badge: 'badge-navy' },
  en_revision: { label: 'En revisión', badge: 'badge-yellow' },
  observado: { label: 'Observado', badge: 'badge-yellow' },
  completado: { label: 'Completado', badge: 'badge-green' },
  vencido: { label: 'SLA vencido', badge: 'badge-red' },
} as const;

export default function ProceduresView({ procedures, setProcedures, pushToast }: ProceduresViewProps) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | Procedure['estado']>('all');
  const [selected, setSelected] = useState<Procedure | null>(null);

  const filtered = useMemo(() => {
    return procedures.filter((p) => {
      if (filterStatus !== 'all' && p.estado !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          p.numero.toLowerCase().includes(q) ||
          p.estudiante.toLowerCase().includes(q) ||
          p.ru.toLowerCase().includes(q) ||
          p.ci.includes(q)
        );
      }
      return true;
    });
  }, [procedures, search, filterStatus]);

  const stats = useMemo(
    () => ({
      total: procedures.length,
      vencidos: procedures.filter((p) => p.estado === 'vencido').length,
      enProceso: procedures.filter((p) => p.estado === 'en_revision' || p.estado === 'ingresado').length,
      observados: procedures.filter((p) => p.estado === 'observado').length,
    }),
    [procedures]
  );

  const updateRequirement = (procId: string, reqId: string, estado: Requirement['estado'], observacion?: string) => {
    setProcedures((prev) =>
      prev.map((p) =>
        p.id === procId
          ? {
              ...p,
              requisitos: p.requisitos.map((r) =>
                r.id === reqId ? { ...r, estado, observacion: estado === 'observado' ? observacion : undefined } : r
              ),
            }
          : p
      )
    );
    if (selected?.id === procId) {
      setSelected((prev) =>
        prev
          ? {
              ...prev,
              requisitos: prev.requisitos.map((r) =>
                r.id === reqId ? { ...r, estado, observacion: estado === 'observado' ? observacion : undefined } : r
              ),
            }
          : prev
      );
    }
  };

  const handleSave = () => {
    if (!selected) return;
    const allOk = selected.requisitos.every((r) => r.estado === 'ok');
    if (allOk) {
      setProcedures((prev) =>
        prev.map((p) => (p.id === selected.id ? { ...p, estado: 'completado' } : p))
      );
      pushToast('success', `Trámite ${selected.numero} completado. Todos los requisitos validados. Notificación enviada al estudiante.`);
    } else {
      const hasObs = selected.requisitos.some((r) => r.estado === 'observado');
      setProcedures((prev) =>
        prev.map((p) => (p.id === selected.id ? { ...p, estado: hasObs ? 'observado' : 'en_revision' } : p))
      );
      pushToast('info', `Revisión de expediente guardada. Sincronizado con la app del estudiante.`);
    }
    setSelected(null);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-50 text-navy-700">
              <Inbox className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-ink-500">Trámites totales</p>
              <p className="text-2xl font-bold text-ink-900">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-ink-500">En proceso</p>
              <p className="text-2xl font-bold text-ink-900">{stats.enProceso}</p>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <MessageSquare className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-ink-500">Con observaciones</p>
              <p className="text-2xl font-bold text-ink-900">{stats.observados}</p>
            </div>
          </div>
        </div>
        <div className="card p-5 ring-2 ring-red-300">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600 animate-pulse-alert">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-ink-500">SLAs vencidos</p>
              <p className="text-2xl font-bold text-red-600">{stats.vencidos}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink-200">
          <div>
            <h3 className="text-base font-bold text-ink-900">Bandeja de Solicitudes Entrantes</h3>
            <p className="text-sm text-ink-500 mt-0.5">Trámites vinculados a folders físicos de ventanilla</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
              <input
                type="text"
                placeholder="Buscar por trámite, RU o CI…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-9"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
              className="input w-auto"
            >
              <option value="all">Todos los estados</option>
              <option value="ingresado">Ingresado</option>
              <option value="en_revision">En revisión</option>
              <option value="observado">Observado</option>
              <option value="completado">Completado</option>
              <option value="vencido">SLA vencido</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-head">N° Trámite</th>
                <th className="table-head">Estudiante</th>
                <th className="table-head">Tipo</th>
                <th className="table-head">Estado</th>
                <th className="table-head">Ingreso</th>
                <th className="table-head">SLA / Cronómetro</th>
                <th className="table-head text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filtered.map((proc) => {
                const cfg = STATUS_CONFIG[proc.estado];
                const isVencido = proc.estado === 'vencido';
                return (
                  <tr
                    key={proc.id}
                    className={`hover:bg-ink-50 transition ${isVencido ? 'bg-red-50/60' : ''}`}
                  >
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <FolderCheck className={`h-4 w-4 ${isVencido ? 'text-red-500' : 'text-navy-500'}`} />
                        <span className="font-mono font-semibold text-ink-800">{proc.numero}</span>
                      </div>
                    </td>
                    <td className="table-cell">
                      <div className="font-semibold text-ink-800">{proc.estudiante}</div>
                      <div className="text-xs text-ink-400">{proc.ru} · CI {proc.ci}</div>
                    </td>
                    <td className="table-cell text-ink-600">{proc.tipo}</td>
                    <td className="table-cell">
                      <span className={cfg.badge}>{cfg.label}</span>
                    </td>
                    <td className="table-cell text-xs text-ink-500">{formatDateTime(proc.fechaIngreso)}</td>
                    <td className="table-cell">
                      <SlaTimer transcurrido={proc.transcurridoHoras} sla={proc.slaHoras} />
                    </td>
                    <td className="table-cell text-right">
                      <button
                        onClick={() => setSelected(proc)}
                        className="flex items-center gap-1.5 rounded-md bg-navy-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-700 transition ml-auto"
                      >
                        <Eye className="h-3.5 w-3.5" /> Revisar expediente
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="absolute inset-0 bg-navy-950/40 backdrop-blur-sm animate-fade-in" />
          <div
            className="relative w-full max-w-3xl bg-white rounded-2xl shadow-pop animate-scale-in max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-6 py-5 border-b border-ink-200">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-50 text-navy-700">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-ink-900">Revisión de Expediente Físico</h2>
                  <p className="text-sm text-ink-500">
                    Trámite <span className="font-mono font-semibold">{selected.numero}</span> · {selected.estudiante}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-ink-400 hover:text-ink-700 text-xl leading-none">
                ×
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="rounded-lg bg-ink-50 px-3 py-2">
                  <p className="text-xs text-ink-500">Estudiante</p>
                  <p className="text-sm font-semibold text-ink-800">{selected.estudiante}</p>
                </div>
                <div className="rounded-lg bg-ink-50 px-3 py-2">
                  <p className="text-xs text-ink-500">Registro Universitario</p>
                  <p className="text-sm font-semibold text-ink-800 font-mono">{selected.ru}</p>
                </div>
                <div className="rounded-lg bg-ink-50 px-3 py-2">
                  <p className="text-xs text-ink-500">Cédula</p>
                  <p className="text-sm font-semibold text-ink-800 font-mono">{selected.ci}</p>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-bold text-ink-900">Tikeo de Documentos del Folder</h4>
                  <span className="text-xs text-ink-500">
                    {selected.requisitos.filter((r) => r.estado === 'ok').length}/{selected.requisitos.length} validados
                  </span>
                </div>
                <div className="space-y-2">
                  {selected.requisitos.map((req) => (
                    <RequirementRow
                      key={req.id}
                      req={req}
                      onToggle={(estado, obs) => updateRequirement(selected.id, req.id, estado, obs)}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-ink-200 bg-ink-50 rounded-b-2xl">
              <p className="text-xs text-ink-500 flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" />
                Los cambios se sincronizan automáticamente con la app del estudiante.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setSelected(null)} className="btn-secondary">Cancelar</button>
                <button onClick={handleSave} className="btn-primary">
                  <Save className="h-4 w-4" /> Guardar revisión
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RequirementRow({
  req,
  onToggle,
}: {
  req: Requirement;
  onToggle: (estado: Requirement['estado'], observacion?: string) => void;
}) {
  const [obs, setObs] = useState(req.observacion ?? '');

  return (
    <div
      className={`rounded-lg border p-3 transition ${
        req.estado === 'ok'
          ? 'border-emerald-200 bg-emerald-50/50'
          : req.estado === 'observado'
          ? 'border-red-200 bg-red-50/50'
          : 'border-ink-200 bg-white'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onToggle('ok')}
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${
              req.estado === 'ok' ? 'bg-emerald-600 text-white' : 'bg-ink-100 text-ink-400 hover:bg-emerald-100 hover:text-emerald-600'
            }`}
            title="Documento correcto"
          >
            <CheckCircle2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => onToggle('observado', obs || 'Sin observación')}
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${
              req.estado === 'observado' ? 'bg-red-600 text-white' : 'bg-ink-100 text-ink-400 hover:bg-red-100 hover:text-red-600'
            }`}
            title="Observado"
          >
            <XCircle className="h-4 w-4" />
          </button>
          <button
            onClick={() => onToggle('pendiente')}
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${
              req.estado === 'pendiente' ? 'bg-ink-300 text-white' : 'bg-ink-100 text-ink-400 hover:bg-ink-200'
            }`}
            title="Pendiente"
          >
            <Circle className="h-4 w-4" />
          </button>
        </div>
        <span className="text-sm font-medium text-ink-800 flex-1">{req.nombre}</span>
        {req.estado === 'ok' && <span className="badge-green">Correcto</span>}
        {req.estado === 'observado' && <span className="badge-red">Observado</span>}
        {req.estado === 'pendiente' && <span className="badge-gray">Pendiente</span>}
      </div>
      {req.estado === 'observado' && (
        <div className="mt-2 pl-16 animate-fade-in">
          <input
            type="text"
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            onBlur={() => onToggle('observado', obs)}
            placeholder="Ej: Cédula de identidad fenecida"
            className="input text-sm"
            autoFocus
          />
        </div>
      )}
    </div>
  );
}
