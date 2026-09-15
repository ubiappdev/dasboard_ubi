import { useState, useMemo } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  DollarSign, 
  Award, 
  FileText, 
  Download, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  PieChart as PieIcon, 
  Briefcase 
} from 'lucide-react';
import type { Student, ScholarshipType, Transaction } from '@/types';
import { formatBs, formatDate } from '@/lib/format';

interface ReportsViewProps {
  students: Student[];
  scholarships: ScholarshipType[];
  transactions: Transaction[];
  pushToast: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
}

function getPaymentYear(payment: Transaction): string {
  return new Date(payment.fecha).getFullYear().toString();
}

export default function ReportsView({ students, scholarships, transactions, pushToast }: ReportsViewProps) {
  const [activeTab, setActiveTab] = useState<'ejecutivo' | 'operativo'>('ejecutivo');
  const [gestionFilter, setGestionFilter] = useState('all');

  // Años disponibles basados en transacciones
  const years = useMemo(() => {
    const setYears = new Set(transactions.map(getPaymentYear));
    return Array.from(setYears).sort((a, b) => Number(b) - Number(a));
  }, [transactions]);

  // Transacciones filtradas por gestión
  const filteredTransactions = useMemo(() => {
    if (gestionFilter === 'all') return transactions;
    return transactions.filter(t => getPaymentYear(t) === gestionFilter);
  }, [transactions, gestionFilter]);

  // --- CÁLCULOS Y MÉTRICAS FINANCIERAS ---
  const totalRecaudado = useMemo(() => {
    return filteredTransactions
      .filter(t => t.estado === 'CONCILIADO' || t.estado === 'APROBADO')
      .reduce((acc, t) => acc + (Number(t.monto) || 0), 0);
  }, [filteredTransactions]);

  const totalAlumnos = students.length;
  const alumnosAlDia = students.filter(s => s.estadoFinanciero === 'AL DIA').length;
  const alumnosPendientes = students.filter(s => s.estadoFinanciero !== 'AL DIA').length;
  const porcentajeCobranza = totalAlumnos > 0 ? Math.round((alumnosAlDia / totalAlumnos) * 100) : 0;

  const totalBecados = students.filter(s => s.becado).length;

  // Ingresos por Carrera
  const ingresosPorCarrera = useMemo(() => {
    const map: Record<string, number> = {};
    filteredTransactions.forEach(t => {
      if (t.estado !== 'RECHAZADO') {
        const student = students.find(s => s.id === t.alumnoId);
        const carrera = student?.carrera || 'Sin carrera / Externos';
        map[carrera] = (map[carrera] || 0) + (Number(t.monto) || 0);
      }
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filteredTransactions, students]);

  // Ingresos por Concepto
  const ingresosPorConcepto = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    filteredTransactions.forEach(t => {
      if (t.estado !== 'RECHAZADO') {
        const concepto = t.concepto || 'Otro concepto';
        if (!map[concepto]) map[concepto] = { count: 0, total: 0 };
        map[concepto].count += 1;
        map[concepto].total += Number(t.monto) || 0;
      }
    });
    return Object.entries(map).map(([concepto, data]) => ({
      concepto,
      ...data,
    })).sort((a, b) => b.total - a.total);
  }, [filteredTransactions]);

  // Ingresos por Canal de Pago (Efectivo, QR, Transferencia)
  const ingresosPorCanal = useMemo(() => {
    const map: Record<string, number> = {};
    filteredTransactions.forEach(t => {
      if (t.estado !== 'RECHAZADO') {
        const canal = t.canal || 'No especificado';
        map[canal] = (map[canal] || 0) + (Number(t.monto) || 0);
      }
    });
    return Object.entries(map);
  }, [filteredTransactions]);

  // Exportar Reporte Ejecutivo a PDF (Directorio)
  const handleExportEjecutivoPdf = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Reporte Ejecutivo - Directorio</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 12px; color: #1e293b; margin: 30px; }
            h1 { color: #1e3a8a; text-align: center; margin-bottom: 5px; font-size: 20px; }
            p.subtitle { text-align: center; color: #64748b; margin-top: 0; margin-bottom: 25px; }
            .grid { display: flex; justify-content: space-between; gap: 15px; margin-bottom: 25px; }
            .card { flex: 1; border: 1px solid #cbd5e1; border-radius: 8px; padding: 15px; background: #f8fafc; }
            .card h3 { margin: 0 0 5px 0; font-size: 13px; color: #475569; text-transform: uppercase; }
            .card p { margin: 0; font-size: 18px; font-weight: bold; color: #0f172a; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 25px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
            th { background-color: #1e3a8a; color: white; font-weight: bold; }
            tr:nth-child(even) { background-color: #f8fafc; }
            .text-right { text-align: right; }
          </style>
        </head>
        <body>
          <h1>REPORTE EJECUTIVO FINANCIERO Y ACADÉMICO</h1>
          <p class="subtitle">Gestión: ${gestionFilter === 'all' ? 'Histórico General' : gestionFilter} | Generado el ${new Date().toLocaleDateString()}</p>
          
          <div class="grid">
            <div class="card">
              <h3>Ingresos Totales</h3>
              <p>Bs ${formatBs(totalRecaudado)}</p>
            </div>
            <div class="card">
              <h3>Tasa de Cobranza</h3>
              <p>${porcentajeCobranza}% (${alumnosAlDia} / ${totalAlumnos} al día)</p>
            </div>
            <div class="card">
              <h3>Estud. Becados</h3>
              <p>${totalBecados} alumnos</p>
            </div>
          </div>

          <h3>Ingresos por Carrera / Programa</h3>
          <table>
            <thead>
              <tr>
                <th>Carrera</th>
                <th class="text-right">Monto Recaudado (Bs)</th>
                <th class="text-right">% del Total</th>
              </tr>
            </thead>
            <tbody>
              ${ingresosPorCarrera.map(([carrera, monto]) => `
                <tr>
                  <td><b>${carrera}</b></td>
                  <td class="text-right">Bs ${formatBs(monto)}</td>
                  <td class="text-right">${totalRecaudado > 0 ? ((monto / totalRecaudado) * 100).toFixed(1) : 0}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <h3>Ingresos por Concepto de Pago</h3>
          <table>
            <thead>
              <tr>
                <th>Concepto</th>
                <th class="text-right">Transacciones</th>
                <th class="text-right">Total (Bs)</th>
              </tr>
            </thead>
            <tbody>
              ${ingresosPorConcepto.map(({ concepto, count, total }) => `
                <tr>
                  <td>${concepto}</td>
                  <td class="text-right">${count}</td>
                  <td class="text-right">Bs ${formatBs(total)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Exportar Reporte Operativo a Excel
  const handleExportOperativoExcel = () => {
    const headers = ['Concepto', 'Cantidad de Transacciones', 'Monto Total (Bs)'];
    const rowsHtml = ingresosPorConcepto.map(item => `
      <tr>
        <td>${item.concepto}</td>
        <td>${item.count}</td>
        <td>${item.total}</td>
      </tr>
    `).join('');

    const tableHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/1999/xhtml">
        <head><meta charset="utf-8"></head>
        <body>
          <table>
            <thead>
              <tr>${headers.map(h => `<th style="background:#1e3a8a;color:#fff;font-weight:bold;">${h}</th>`).join('')}</tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </body>
      </html>
    `;

    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reporte-operativo-caja-${gestionFilter}.xls`;
    link.click();
    URL.revokeObjectURL(url);
    pushToast('success', 'Reporte operativo exportado con éxito a Excel.');
  };

  return (
    <div className="space-y-6">
      {/* Cabecera y Selector de Gestión / Pestañas */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 card p-5 bg-gradient-to-r from-navy-900 to-navy-800 text-white">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-accent-400" /> Panel de Reportes y Estadísticas
          </h2>
          <p className="text-navy-200 text-sm mt-1">
            Indicadores financieros y operativos para administración y directorio.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-navy-800/80 px-3 py-1.5 rounded-xl border border-navy-700">
            <Calendar className="h-4 w-4 text-navy-300" />
            <span className="text-xs text-navy-200">Gestión:</span>
            <select 
              className="bg-transparent text-white text-xs font-semibold focus:outline-none cursor-pointer"
              value={gestionFilter}
              onChange={(e) => setGestionFilter(e.target.value)}
            >
              <option value="all" className="text-navy-900">Todas (Histórico)</option>
              {years.map(y => <option key={y} value={y} className="text-navy-900">{y}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Selector de Vistas (Directorio vs Administración) */}
      <div className="flex border-b border-ink-200 gap-6">
        <button
          onClick={() => setActiveTab('ejecutivo')}
          className={`pb-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition ${
            activeTab === 'ejecutivo' 
              ? 'border-navy-700 text-navy-900' 
              : 'border-transparent text-ink-500 hover:text-ink-800'
          }`}
        >
          <Briefcase className="h-4 w-4" /> Vista Ejecutiva (Presidente y Directorio)
        </button>
        <button
          onClick={() => setActiveTab('operativo')}
          className={`pb-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition ${
            activeTab === 'operativo' 
              ? 'border-navy-700 text-navy-900' 
              : 'border-transparent text-ink-500 hover:text-ink-800'
          }`}
        >
          <TrendingUp className="h-4 w-4" /> Vista Operativa (Administración y Caja)
        </button>
      </div>

      {/* ================= VISTA EJECUTIVA (DIRECTORIO) ================= */}
      {activeTab === 'ejecutivo' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-ink-900">Indicadores Clave de Desempeño (KPIs)</h3>
              <p className="text-xs text-ink-500">Resumen financiero consolidado para toma de decisiones directivas.</p>
            </div>
            <button className="btn-primary text-xs" onClick={handleExportEjecutivoPdf}>
              <FileText className="h-4 w-4 text-red-200" /> Exportar Reporte Ejecutivo PDF
            </button>
          </div>

          {/* Tarjetas KPI Superiores */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-5 border-l-4 border-l-navy-600 space-y-1">
              <div className="flex items-center justify-between text-ink-500 text-xs font-bold uppercase">
                <span>Ingresos Totales</span>
                <DollarSign className="h-4 w-4 text-navy-600" />
              </div>
              <p className="text-2xl font-black text-ink-900">Bs {formatBs(totalRecaudado)}</p>
              <p className="text-xs text-emerald-600 font-medium">Recaudación efectiva</p>
            </div>

            <div className="card p-5 border-l-4 border-l-emerald-500 space-y-1">
              <div className="flex items-center justify-between text-ink-500 text-xs font-bold uppercase">
                <span>Tasa de Cobranza</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-black text-ink-900">{porcentajeCobranza}%</p>
              <p className="text-xs text-ink-500">{alumnosAlDia} de {totalAlumnos} alumnos al día</p>
            </div>

            <div className="card p-5 border-l-4 border-l-red-500 space-y-1">
              <div className="flex items-center justify-between text-ink-500 text-xs font-bold uppercase">
                <span>Alumnos en Mora</span>
                <AlertCircle className="h-4 w-4 text-red-600" />
              </div>
              <p className="text-2xl font-black text-red-600">{alumnosPendientes}</p>
              <p className="text-xs text-ink-500">Requieren seguimiento de cobro</p>
            </div>

            <div className="card p-5 border-l-4 border-l-amber-500 space-y-1">
              <div className="flex items-center justify-between text-ink-500 text-xs font-bold uppercase">
                <span>Becas Activas</span>
                <Award className="h-4 w-4 text-amber-600" />
              </div>
              <p className="text-2xl font-black text-ink-900">{totalBecados}</p>
              <p className="text-xs text-ink-500">Estudiantes subvencionados</p>
            </div>
          </div>

          {/* Gráficos / Tablas de Distribución */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Ingresos por Carrera */}
            <div className="card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-ink-900 flex items-center gap-2">
                  <PieIcon className="h-4 w-4 text-navy-600" /> Distribución de Ingresos por Carrera
                </h4>
                <span className="text-xs text-ink-400 font-medium">Acumulado</span>
              </div>
              <div className="space-y-3">
                {ingresosPorCarrera.map(([carrera, monto]) => {
                  const porcentaje = totalRecaudado > 0 ? Math.round((monto / totalRecaudado) * 100) : 0;
                  return (
                    <div key={carrera} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-ink-800">{carrera}</span>
                        <span className="text-navy-700">Bs {formatBs(monto)} ({porcentaje}%)</span>
                      </div>
                      <div className="w-full bg-ink-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-navy-600 h-full rounded-full transition-all duration-500" style={{ width: `${porcentaje}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Ingresos por Canal de Pago */}
            <div className="card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-ink-900 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-600" /> Canales de Recaudación Preferidos
                </h4>
                <span className="text-xs text-ink-400 font-medium">Transacciones</span>
              </div>
              <div className="space-y-3">
                {ingresosPorCanal.map(([canal, monto]) => {
                  const porcentaje = totalRecaudado > 0 ? Math.round((monto / totalRecaudado) * 100) : 0;
                  return (
                    <div key={canal} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-ink-800">{canal}</span>
                        <span className="text-emerald-700">Bs {formatBs(monto)} ({porcentaje}%)</span>
                      </div>
                      <div className="w-full bg-ink-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${porcentaje}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= VISTA OPERATIVA (ADMINISTRACIÓN) ================= */}
      {activeTab === 'operativo' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-ink-900">Control de Caja y Desglose por Conceptos</h3>
              <p className="text-xs text-ink-500">Monitoreo detallado de cobros, mensualidades y arqueo interno.</p>
            </div>
            <button className="btn-primary text-xs" onClick={handleExportOperativoExcel}>
              <Download className="h-4 w-4" /> Exportar Tabla Operativa Excel
            </button>
          </div>

          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-ink-200 bg-ink-50 font-bold text-sm text-ink-900">
              Desglose de Ingresos por Concepto Académico / Administrativo
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-head">Concepto de Cobro</th>
                    <th className="table-head text-center">N° de Pagos Registrados</th>
                    <th className="table-head text-right">Monto Total Recaudado (Bs)</th>
                    <th className="table-head text-right">% Participación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {ingresosPorConcepto.map((item, idx) => {
                    const porcentaje = totalRecaudado > 0 ? ((item.total / totalRecaudado) * 100).toFixed(1) : '0';
                    return (
                      <tr key={idx} className="hover:bg-ink-50">
                        <td className="table-cell font-medium text-ink-900">{item.concepto}</td>
                        <td className="table-cell text-center">
                          <span className="badge-navy">{item.count} pagos</span>
                        </td>
                        <td className="table-cell text-right font-bold text-emerald-600">Bs {formatBs(item.total)}</td>
                        <td className="table-cell text-right text-ink-500">{porcentaje}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}