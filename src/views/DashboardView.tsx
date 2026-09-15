import { useMemo, useState } from 'react';
import {
  Wallet,
  Clock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  QrCode,
  Banknote,
  ArrowRightLeft,
  Landmark,
  Eye,
  Filter,
  X,
  ExternalLink,
} from 'lucide-react';
import type { Student, Transaction, ToastPush, PaymentChannel } from '@/types';
import { formatBs, timeAgo } from '@/lib/format';
import { supabase } from '@/lib/supabase';

interface DashboardViewProps {
  students: Student[];
  transactions: Transaction[];
  pushToast: ToastPush;
}

const COMPROBANTES_BUCKET = 'comprobantes';

// Función para resolver la URL pública usando el SDK de Supabase Storage
const getPublicUrl = (url?: string | null): string => {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  const { data } = supabase.storage.from(COMPROBANTES_BUCKET).getPublicUrl(trimmed);
  return data?.publicUrl || '';
};

const ACCENT_STYLES = {
  navy: { bg: 'bg-navy-50', text: 'text-navy-700', ring: 'ring-navy-200' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200' },
  red: { bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-200' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-200' },
};

const CHANNEL_ICONS: Record<PaymentChannel, typeof QrCode> = {
  QR: QrCode,
  DEPOSITO: Landmark,
  EFECTIVO: Banknote,
  TRANSFERENCIA: ArrowRightLeft,
};

const CHANNEL_LABELS: Record<PaymentChannel, string> = {
  QR: 'QR',
  DEPOSITO: 'Depósito',
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
};

function KpiCard({ label, value, subValue, icon: Icon, trend, accent, alert }: {
  label: string;
  value: string;
  subValue?: string;
  icon: typeof Wallet;
  trend?: { value: string; up: boolean };
  accent: keyof typeof ACCENT_STYLES;
  alert?: boolean;
}) {
  const s = ACCENT_STYLES[accent];
  return (
    <div className={`card card-hover p-5 relative overflow-hidden ${alert ? 'ring-2 ring-red-300' : ''}`}>
      <div className="flex items-start justify-between">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${s.bg} ${s.text} ring-1 ${s.ring}`}>
          <Icon className="h-6 w-6" />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-semibold ${trend.up ? 'text-emerald-600' : 'text-red-600'}`}>
            {trend.up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {trend.value}
          </div>
        )}
        {alert && (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white animate-pulse-alert">
            <AlertTriangle className="h-3.5 w-3.5" />
          </div>
        )}
      </div>
      <p className="mt-4 text-sm font-medium text-ink-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink-900 tracking-tight">{value}</p>
      {subValue && <p className="mt-1 text-xs text-ink-500">{subValue}</p>}
    </div>
  );
}

export default function DashboardView({ students, transactions, pushToast }: DashboardViewProps) {
  // Estados para filtros
  const [filtroEstado, setFiltroEstado] = useState<string>('TODOS');
  const [filtroCanal, setFiltroCanal] = useState<string>('TODOS');
  const [filtroFecha, setFiltroFecha] = useState<string>('TODOS');

  // Estado para el modal de previsualización de comprobante (Lightbox)
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string; subtitle: string } | null>(null);

  const stats = useMemo(() => {
    const porValidar = transactions.filter((t) => t.estado === 'PENDIENTE').length;
    const alertas = transactions.filter((t) => t.estado === 'RECHAZADO').length;
    return { porValidar, alertas };
  }, [transactions]);

  // Lógica de filtrado para las transacciones
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (filtroEstado !== 'TODOS' && tx.estado !== filtroEstado) return false;
      if (filtroCanal !== 'TODOS' && tx.canal !== filtroCanal) return false;
      
      if (filtroFecha !== 'TODOS') {
        const txDate = new Date(tx.fecha);
        const now = new Date();
        if (filtroFecha === 'HOY') {
          if (txDate.toDateString() !== now.toDateString()) return false;
        } else if (filtroFecha === 'SEMANA') {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (txDate < weekAgo) return false;
        } else if (filtroFecha === 'MES') {
          if (txDate.getMonth() !== now.getMonth() || txDate.getFullYear() !== now.getFullYear()) return false;
        }
      }

      return true;
    });
  }, [transactions, filtroEstado, filtroCanal, filtroFecha]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4">
        <KpiCard
          label="Pagos por Validar"
          value={`${stats.porValidar} pendientes`}
          subValue="Requieren revisión manual"
          icon={Clock}
          accent="amber"
        />
        <KpiCard
          label="Alertas de Fraude"
          value={`${stats.alertas} alertas`}
          subValue="Requiere acción inmediata"
          icon={AlertTriangle}
          accent="red"
          alert
        />
      </div>

      <div className="card">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between px-6 py-4 border-b border-ink-200 gap-4">
          <div>
            <h3 className="text-base font-bold text-ink-900">Últimas Transacciones Registradas</h3>
            <p className="text-sm text-ink-500 mt-0.5">Movimientos filtrados del sistema ({filteredTransactions.length})</p>
          </div>
          
          {/* Panel de Filtros */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <div className="flex items-center gap-1 text-xs text-ink-500 font-medium mr-1">
              <Filter className="h-3.5 w-3.5" /> Filtros:
            </div>

            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="text-xs bg-ink-50 border border-ink-200 rounded-lg px-2.5 py-1.5 text-ink-700 font-medium focus:outline-none focus:ring-2 focus:ring-navy-200"
            >
              <option value="TODOS">Todos los Estados</option>
              <option value="CONCILIADO">Conciliado</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="REVISION">En revisión</option>
              <option value="RECHAZADO">Rechazado</option>
            </select>

            <select
              value={filtroCanal}
              onChange={(e) => setFiltroCanal(e.target.value)}
              className="text-xs bg-ink-50 border border-ink-200 rounded-lg px-2.5 py-1.5 text-ink-700 font-medium focus:outline-none focus:ring-2 focus:ring-navy-200"
            >
              <option value="TODOS">Todos los Canales</option>
              <option value="QR">QR</option>
              <option value="DEPOSITO">Depósito</option>
              <option value="EFECTIVO">Efectivo</option>
              <option value="TRANSFERENCIA">Transferencia</option>
            </select>

            <select
              value={filtroFecha}
              onChange={(e) => setFiltroFecha(e.target.value)}
              className="text-xs bg-ink-50 border border-ink-200 rounded-lg px-2.5 py-1.5 text-ink-700 font-medium focus:outline-none focus:ring-2 focus:ring-navy-200"
            >
              <option value="TODOS">Cualquier Fecha</option>
              <option value="HOY">Hoy</option>
              <option value="SEMANA">Última semana</option>
              <option value="MES">Este mes</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-head">Estudiante</th>
                <th className="table-head">Concepto</th>
                <th className="table-head">Canal</th>
                <th className="table-head">Estado</th>
                <th className="table-head text-center">Comprobante</th>
                <th className="table-head text-right">Monto</th>
                <th className="table-head">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-sm text-ink-400">
                    No se encontraron transacciones con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const Icon = CHANNEL_ICONS[tx.canal] ?? Landmark;
                  
                  // Usamos tx.comprobanteUrl (tal cual lo define database.ts)
                  const comprobanteUrl = getPublicUrl(tx.comprobanteUrl);

                  return (
                    <tr key={tx.id} className="hover:bg-ink-50 transition">
                      <td className="table-cell">
                        <div className="font-semibold text-ink-800">{tx.estudiante}</div>
                        <div className="text-xs text-ink-400">{tx.ci}</div>
                      </td>
                      <td className="table-cell">{tx.concepto}</td>
                      <td className="table-cell">
                        <span className="badge-navy"><Icon className="h-3 w-3" /> {CHANNEL_LABELS[tx.canal] ?? tx.canal}</span>
                      </td>
                      <td className="table-cell">
                        {tx.estado === 'CONCILIADO' && <span className="badge-green">Conciliado</span>}
                        {tx.estado === 'PENDIENTE' && <span className="badge-yellow">Pendiente</span>}
                        {tx.estado === 'REVISION' && <span className="badge-yellow">En revisión</span>}
                        {tx.estado === 'RECHAZADO' && <span className="badge-red">Rechazado</span>}
                      </td>
                      <td className="table-cell text-center">
                        {comprobanteUrl ? (
                          <div
                            onClick={() => {
                              setPreviewImage({
                                url: comprobanteUrl,
                                title: `Comprobante - ${tx.estudiante}`,
                                subtitle: `${tx.concepto} • Bs ${formatBs(tx.monto)}`
                              });
                              pushToast('info', `Abriendo comprobante de ${tx.estudiante}`);
                            }}
                            className="relative group w-10 h-10 mx-auto rounded-lg overflow-hidden border border-ink-200 cursor-pointer bg-ink-50 hover:border-navy-500 transition shadow-sm flex items-center justify-center"
                            title="Ver comprobante"
                          >
                            <img
                              src={comprobanteUrl}
                              alt="Comprobante"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const parent = e.currentTarget.parentElement;
                                if (parent && !parent.querySelector('.fallback-txt')) {
                                  const span = document.createElement('span');
                                  span.className = 'fallback-txt text-[10px] text-navy-700 font-bold underline px-1 text-center';
                                  span.innerText = 'Ver';
                                  parent.appendChild(span);
                                }
                              }}
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                              <Eye className="h-4 w-4" />
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-ink-400 italic">Sin archivo</span>
                        )}
                      </td>
                      <td className="table-cell text-right font-semibold text-ink-900">Bs {formatBs(tx.monto)}</td>
                      <td className="table-cell text-ink-500">{timeAgo(tx.fecha)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Visor Lightbox para la imagen del comprobante */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/75 backdrop-blur-md" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-lg w-full bg-white rounded-2xl p-4 shadow-2xl flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-full flex items-center justify-between mb-3 pb-2 border-b border-ink-100">
              <div>
                <h4 className="font-bold text-ink-900 text-sm truncate">{previewImage.title}</h4>
                <p className="text-xs text-ink-500 mt-0.5">{previewImage.subtitle}</p>
              </div>
              <button onClick={() => setPreviewImage(null)} className="h-8 w-8 rounded-lg flex items-center justify-center bg-ink-100 hover:bg-ink-200 text-ink-600 transition">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="overflow-auto max-h-[65vh] w-full flex items-center justify-center bg-ink-50 rounded-xl p-2 border border-ink-200 min-h-[250px]">
              <img
                src={previewImage.url}
                alt="Comprobante ampliado"
                className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-sm"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const parent = e.currentTarget.parentElement;
                  if (parent && !parent.querySelector('.error-msg')) {
                    const errDiv = document.createElement('div');
                    errDiv.className = 'error-msg flex flex-col items-center justify-center text-ink-400 gap-2 p-8 text-xs';
                    errDiv.innerText = 'No se pudo cargar la imagen del comprobante.';
                    parent.appendChild(errDiv);
                  }
                }}
              />
            </div>

            <div className="mt-4 flex items-center justify-end w-full gap-2">
              <a
                href={previewImage.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-navy-700 bg-navy-50 hover:bg-navy-100 rounded-xl transition"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Abrir en pestaña
              </a>
              <button
                onClick={() => setPreviewImage(null)}
                className="px-4 py-2 text-xs font-semibold text-white bg-navy-900 hover:bg-navy-800 rounded-xl transition shadow-sm"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}