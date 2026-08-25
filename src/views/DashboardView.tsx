import { useMemo } from 'react';
import {
  Wallet,
  Users,
  Clock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  QrCode,
  Banknote,
  ArrowRightLeft,
  Landmark,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { Student, Transaction, ToastPush, PaymentChannel } from '@/types';
import { WEEKLY_COLLECTION } from '@/lib/mockData';
import { formatBs, formatBsShort, timeAgo } from '@/lib/format';

interface DashboardViewProps {
  students: Student[];
  transactions: Transaction[];
  pushToast: ToastPush;
}

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

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-ink-200 bg-white px-3 py-2 shadow-pop">
      <p className="text-xs font-semibold text-ink-700 mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-xs">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-ink-600">{p.name}:</span>
          <span className="font-semibold text-ink-800">Bs {formatBs(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export default function DashboardView({ students, transactions, pushToast }: DashboardViewProps) {
  const stats = useMemo(() => {
    const totalMes = transactions.reduce((sum, t) => sum + t.monto, 0);
    const alDia = students.filter((s) => s.estadoFinanciero === 'AL DIA').length;
    const porValidar = transactions.filter((t) => t.estado === 'PENDIENTE').length;
    const alertas = transactions.filter((t) => t.estado === 'RECHAZADO').length;
    return { totalMes, alDia, porValidar, alertas };
  }, [students, transactions]);

  const recentTx = transactions.slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Recaudación Total del Mes"
          value={`Bs ${formatBs(stats.totalMes)}`}
          subValue="vs. Bs 132,400 mes anterior"
          icon={Wallet}
          trend={{ value: '+9.5%', up: true }}
          accent="navy"
        />
        <KpiCard
          label="Estudiantes al Día"
          value={`${stats.alDia} / ${students.length}`}
          subValue={`${students.length ? Math.round((stats.alDia / students.length) * 100) : 0}% de la matrícula`}
          icon={Users}
          trend={{ value: '+2.1%', up: true }}
          accent="emerald"
        />
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-bold text-ink-900">Recaudación Semanal por Concepto</h3>
              <p className="text-sm text-ink-500 mt-0.5">Distribución de ingresos del último mes</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              <ArrowUpRight className="h-3.5 w-3.5" />
              +12.3% vs. mes anterior
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={WEEKLY_COLLECTION} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="cMensualidad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1b325c" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#1b325c" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="cMatricula" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3d6aaf" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3d6aaf" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="cCertificados" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="cTramites" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#d97706" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" vertical={false} />
              <XAxis dataKey="semana" tick={{ fontSize: 12, fill: '#6b7588' }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 12, fill: '#6b7588' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${formatBsShort(v)}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" />
              <Area type="monotone" dataKey="Mensualidad" stroke="#1b325c" strokeWidth={2.5} fill="url(#cMensualidad)" />
              <Area type="monotone" dataKey="Matricula" stroke="#3d6aaf" strokeWidth={2.5} fill="url(#cMatricula)" />
              <Area type="monotone" dataKey="Certificados" stroke="#059669" strokeWidth={2.5} fill="url(#cCertificados)" />
              <Area type="monotone" dataKey="Tramites" stroke="#d97706" strokeWidth={2.5} fill="url(#cTramites)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-6">
          <h3 className="text-base font-bold text-ink-900 mb-1">Resumen de Cobranza</h3>
          <p className="text-sm text-ink-500 mb-5">Estado general de la cartera</p>
          <div className="space-y-4">
            {[
              { label: 'Estudiantes al día', value: stats.alDia, total: students.length, color: 'bg-emerald-500' },
              { label: 'Estudiantes pendientes', value: students.length - stats.alDia, total: students.length, color: 'bg-red-500' },
              { label: 'Pagos conciliados', value: transactions.filter((t) => t.estado === 'CONCILIADO').length, total: transactions.length, color: 'bg-navy-600' },
              { label: 'Pagos pendientes', value: transactions.filter((t) => t.estado === 'PENDIENTE').length, total: transactions.length, color: 'bg-amber-500' },
            ].map((item) => {
              const pct = item.total ? Math.round((item.value / item.total) * 100) : 0;
              return (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-ink-600">{item.label}</span>
                    <span className="text-sm font-semibold text-ink-800">{item.value} ({pct}%)</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-ink-100 overflow-hidden">
                    <div className={`h-full rounded-full ${item.color} transition-all duration-700`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-6 pt-5 border-t border-ink-200">
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-500">Total recaudado (mes)</span>
              <span className="text-lg font-bold text-navy-800">Bs {formatBs(stats.totalMes)}</span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm text-ink-500">Estudiantes pendientes</span>
              <span className="text-lg font-bold text-red-600">{students.filter((s) => s.estadoFinanciero !== 'AL DIA').length}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink-200">
          <div>
            <h3 className="text-base font-bold text-ink-900">Últimas Transacciones Registradas</h3>
            <p className="text-sm text-ink-500 mt-0.5">Movimientos más recientes del sistema</p>
          </div>
          <button onClick={() => pushToast('info', 'Mostrando todas las transacciones del mes')} className="btn-ghost text-navy-700">
            Ver todas <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-head">Estudiante</th>
                <th className="table-head">Concepto</th>
                <th className="table-head">Canal</th>
                <th className="table-head">Estado</th>
                <th className="table-head text-right">Monto</th>
                <th className="table-head">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {recentTx.map((tx) => {
                const Icon = CHANNEL_ICONS[tx.canal] ?? Landmark;
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
                    <td className="table-cell text-right font-semibold text-ink-900">Bs {formatBs(tx.monto)}</td>
                    <td className="table-cell text-ink-500">{timeAgo(tx.fecha)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
