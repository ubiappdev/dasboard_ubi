import { useState, useMemo } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Award, 
  FileText, 
  Download, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  PieChart as PieIcon, 
  Briefcase,
  Filter,
  FileSpreadsheet
} from 'lucide-react';
import type { Student, ScholarshipType, Transaction } from '@/types';
import { formatBs, formatDate } from '@/lib/format';

const OLAP_SQL = `SELECT
  EXTRACT(YEAR FROM p.fecha_pago) AS anio_pago,
  TO_CHAR(p.fecha_pago, 'YYYY-MM') AS periodo_mes_pago,
  DATE(p.fecha_pago) AS fecha_exacta,
  a.ci AS alumno_ci,
  CONCAT(a.apellidos, ', ', a.nombres) AS alumno_nombre_completo,
  COALESCE(a.carrera_id, 'Sin Carrera') AS carrera,
  COALESCE(a.turno_id, 'Sin Turno') AS turno,
  COALESCE(a.modalidad, 'Regular') AS modalidad,
  COALESCE(a.curso_id, 'Sin Curso') AS curso,
  CASE WHEN a.becado THEN 'Becado' ELSE 'Regular' END AS tipo_alumno,
  a.estado_financiero AS estado_financiero_alumno,
  COALESCE(ac.concepto, p.concepto, 'Pago de Mensualidad / Arancel') AS concepto_pago,
  COALESCE(ac.categoria, 'GENERAL') AS categoria_arancel,
  p.canal_pago AS canal_pago,
  p.numero_transaccion AS nro_transaccion,
  p.estado_conciliacion AS estado_conciliacion,
  COALESCE(m.gestion_anio::text, 'N/A') AS mensualidad_gestion,
  COALESCE(m.mes_referencia, 'N/A') AS mensualidad_mes,
  COALESCE(m.nro_cuota::text, 'N/A') AS nro_cuota,
  COALESCE(cr.numero_recibo, 'Sin Recibo') AS nro_recibo,
  COALESCE(cr.estado, 'EMITIDO') AS estado_recibo,
  p.monto_pagado AS monto_recaudado,
  COALESCE(m.monto_original, p.monto_pagado) AS monto_esperado_original,
  COALESCE(m.monto_con_descuento, p.monto_pagado) AS monto_con_descuento
FROM public.alumnos_pagos p
LEFT JOIN public.alumnos a ON p.alumno_id = a.id
LEFT JOIN public.alumnos_mensualidades m ON p.mensualidad_id = m.id
LEFT JOIN public.aranceles_conceptos ac ON p.arancel_id = ac.id
LEFT JOIN public.cajas_recibos cr ON cr.pago_id = p.id
ORDER BY p.fecha_pago DESC;`;

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
  const [activeTab, setActiveTab] = useState<'ejecutivo' | 'operativo' | 'consolidado' | 'olap'>('ejecutivo');
  const [gestionFilter, setGestionFilter] = useState('all');

  // Estados específicos para los filtros de la nueva vista de Consolidado
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [canalFilter, setCanalFilter] = useState('all');

  // Años disponibles basados en transacciones
  const years = useMemo(() => {
    const setYears = new Set(transactions.map(getPaymentYear));
    return Array.from(setYears).sort((a, b) => Number(b) - Number(a));
  }, [transactions]);

  // Transacciones filtradas por gestión global
  const filteredTransactions = useMemo(() => {
    if (gestionFilter === 'all') return transactions;
    return transactions.filter(t => getPaymentYear(t) === gestionFilter);
  }, [transactions, gestionFilter]);

  // Dataset OLAP construido con los datos disponibles en las props de esta vista.
  // La consulta SQL se muestra como referencia; el navegador no ejecuta SQL directamente.
  const olapRows = useMemo(() => transactions.map((payment) => {
    const student = students.find((item) => item.id === payment.alumnoId);
    const extra = (payment as unknown as Record<string, unknown>);
    const alumno = (student as unknown as Record<string, unknown> | undefined) ?? {};
    const fecha = payment.fecha ? new Date(payment.fecha) : null;
    const fechaValida = fecha && !Number.isNaN(fecha.getTime());
    const monto = Number(payment.monto) || 0;
    const value = (source: Record<string, unknown>, key: string, fallback = 'N/A') => {
      const candidate = source[key];
      return candidate === null || candidate === undefined || candidate === '' ? fallback : String(candidate);
    };

    return {
      anio_pago: fechaValida ? String(fecha!.getFullYear()) : 'N/A',
      periodo_mes_pago: fechaValida ? `${fecha!.getFullYear()}-${String(fecha!.getMonth() + 1).padStart(2, '0')}` : 'N/A',
      fecha_exacta: fechaValida ? fecha!.toISOString().slice(0, 10) : 'N/A',
      alumno_ci: value(alumno, 'ci'),
      alumno_nombre_completo: [value(alumno, 'apellidos', ''), value(alumno, 'nombres', '')].filter(Boolean).join(', ') || 'N/A',
      carrera: value(alumno, 'carrera', 'Sin Carrera'),
      turno: value(alumno, 'turno', 'Sin Turno'),
      modalidad: value(alumno, 'modalidad', 'Regular'),
      curso: value(alumno, 'curso', 'Sin Curso'),
      tipo_alumno: alumno.becado ? 'Becado' : 'Regular',
      estado_financiero_alumno: value(alumno, 'estadoFinanciero'),
      concepto_pago: payment.concepto || 'Pago de Mensualidad / Arancel',
      categoria_arancel: value(extra, 'categoria', 'GENERAL'),
      canal_pago: payment.canal || 'N/A',
      nro_transaccion: value(extra, 'numeroTransaccion'),
      estado_conciliacion: value(extra, 'estadoConciliacion', payment.estado || 'N/A'),
      mensualidad_gestion: value(extra, 'gestionAnio'),
      mensualidad_mes: value(extra, 'mesReferencia'),
      nro_cuota: value(extra, 'nroCuota'),
      nro_recibo: value(extra, 'numeroRecibo', 'Sin Recibo'),
      estado_recibo: value(extra, 'estadoRecibo', 'EMITIDO'),
      monto_recaudado: monto,
      monto_esperado_original: Number(extra.montoOriginal ?? monto),
      monto_con_descuento: Number(extra.montoConDescuento ?? monto),
    };
  }), [transactions, students]);

  const handleExportOlapExcel = () => {
    const headers = Object.keys(olapRows[0] ?? {
      anio_pago: '', periodo_mes_pago: '', fecha_exacta: '', alumno_ci: '', alumno_nombre_completo: '',
      carrera: '', turno: '', modalidad: '', curso: '', tipo_alumno: '', estado_financiero_alumno: '',
      concepto_pago: '', categoria_arancel: '', canal_pago: '', nro_transaccion: '', estado_conciliacion: '',
      mensualidad_gestion: '', mensualidad_mes: '', nro_cuota: '', nro_recibo: '', estado_recibo: '',
      monto_recaudado: '', monto_esperado_original: '', monto_con_descuento: '',
    });
    const escapeCsv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = [headers.map(escapeCsv).join(';'), ...olapRows.map((row) => headers.map((key) => escapeCsv(row[key as keyof typeof row])).join(';'))].join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reporte-olap-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    pushToast('success', 'Reporte OLAP exportado. Excel puede abrir el archivo CSV.');
  };

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

  // Transacciones filtradas para el Consolidado (Fecha + Canal)
  const transactionsConsolidado = useMemo(() => {
    return filteredTransactions.filter(t => {
      const matchesCanal = canalFilter === 'all' || t.canal === canalFilter;
      if (!matchesCanal) return false;
      
      if (!fechaInicio && !fechaFin) return true;
      
      const fechaPago = t.fecha ? t.fecha.split('T')[0] : '';
      if (!fechaPago) return false;
      
      if (fechaInicio && fechaPago < fechaInicio) return false;
      if (fechaFin && fechaPago > fechaFin) return false;
      
      return true;
    });
  }, [filteredTransactions, fechaInicio, fechaFin, canalFilter]);

  // Totales recalculados según filtro del Consolidado
  const totalConsolidadoFiltrado = useMemo(() => {
    return transactionsConsolidado
      .filter(t => t.estado === 'CONCILIADO' || t.estado === 'APROBADO')
      .reduce((acc, t) => acc + (Number(t.monto) || 0), 0);
  }, [transactionsConsolidado]);

  // --- FUNCIONES DE EXPORTACIÓN ---

  // 1. Exportar Reporte Ejecutivo a PDF
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

  // 1.1. Exportar Reporte Ejecutivo a Excel
  const handleExportEjecutivoExcel = () => {
    const headers = ['Carrera / Programa', 'Monto Recaudado (Bs)', '% del Total'];
    const rowsHtml = ingresosPorCarrera.map(([carrera, monto]) => `
      <tr>
        <td>${carrera}</td>
        <td>${monto}</td>
        <td>${totalRecaudado > 0 ? ((monto / totalRecaudado) * 100).toFixed(1) : 0}%</td>
      </tr>
    `).join('');

    const tableHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/1999/xhtml">
        <head><meta charset="utf-8"></head>
        <body>
          <h3>Reporte Ejecutivo - Gestión: ${gestionFilter}</h3>
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
    link.download = `reporte-ejecutivo-${gestionFilter}.xls`;
    link.click();
    URL.revokeObjectURL(url);
    pushToast('success', 'Reporte ejecutivo exportado con éxito a Excel.');
  };

  // 2. Exportar Reporte Operativo a Excel
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

  // 2.1. Exportar Reporte Operativo a PDF
  const handleExportOperativoPdf = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Control de Caja - Operativo</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 12px; color: #1e293b; margin: 30px; }
            h1 { color: #1e3a8a; text-align: center; margin-bottom: 5px; font-size: 20px; }
            p.subtitle { text-align: center; color: #64748b; margin-top: 0; margin-bottom: 25px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
            th { background-color: #1e3a8a; color: white; font-weight: bold; }
            tr:nth-child(even) { background-color: #f8fafc; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
          </style>
        </head>
        <body>
          <h1>CONTROL DE CAJA Y DESGLOSE POR CONCEPTOS</h1>
          <p class="subtitle">Gestión: ${gestionFilter === 'all' ? 'Histórico General' : gestionFilter} | Generado el ${new Date().toLocaleDateString()}</p>
          <table>
            <thead>
              <tr>
                <th>Concepto de Cobro</th>
                <th class="text-center">N° de Pagos</th>
                <th class="text-right">Monto Total (Bs)</th>
              </tr>
            </thead>
            <tbody>
              ${ingresosPorConcepto.map(item => `
                <tr>
                  <td><b>${item.concepto}</b></td>
                  <td class="text-center">${item.count}</td>
                  <td class="text-right">Bs ${formatBs(item.total)}</td>
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

  // 3. Exportar Consolidado a Excel
  const handleExportConsolidadoExcel = () => {
    const headers = ['Fecha', 'Concepto', 'Canal', 'Estado', 'Monto (Bs)'];
    const rowsHtml = transactionsConsolidado.map(t => `
      <tr>
        <td>${t.fecha ? t.fecha.split('T')[0] : ''}</td>
        <td>${t.concepto}</td>
        <td>${t.canal || 'No especificado'}</td>
        <td>${t.estado}</td>
        <td>${Number(t.monto) || 0}</td>
      </tr>
    `).join('');

    const tableHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/1999/xhtml">
        <head><meta charset="utf-8"></head>
        <body>
          <h3>Consolidado de Ingresos y Arqueo</h3>
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
    link.download = `consolidado-ingresos-${gestionFilter}.xls`;
    link.click();
    URL.revokeObjectURL(url);
    pushToast('success', 'Consolidado exportado con éxito a Excel.');
  };

  // 3.1. Exportar Consolidado a PDF
  const handleExportConsolidadoPdf = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Consolidado de Ingresos</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 12px; color: #1e293b; margin: 30px; }
            h1 { color: #1e3a8a; text-align: center; margin-bottom: 5px; font-size: 20px; }
            p.subtitle { text-align: center; color: #64748b; margin-top: 0; margin-bottom: 25px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
            th { background-color: #1e3a8a; color: white; font-weight: bold; }
            tr:nth-child(even) { background-color: #f8fafc; }
            .text-right { text-align: right; }
          </style>
        </head>
        <body>
          <h1>CONSOLIDADO DE INGRESOS Y ARQUEO</h1>
          <p class="subtitle">Filtros - Inicio: ${fechaInicio || 'N/A'} | Fin: ${fechaFin || 'N/A'} | Canal: ${canalFilter} | Total Filtrado: Bs ${formatBs(totalConsolidadoFiltrado)}</p>
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Concepto</th>
                <th>Canal</th>
                <th>Estado</th>
                <th class="text-right">Monto (Bs)</th>
              </tr>
            </thead>
            <tbody>
              ${transactionsConsolidado.map(t => `
                <tr>
                  <td>${formatDate(t.fecha)}</td>
                  <td>${t.concepto}</td>
                  <td>${t.canal || 'No especificado'}</td>
                  <td>${t.estado}</td>
                  <td class="text-right">Bs ${formatBs(Number(t.monto) || 0)}</td>
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

  return (
    <div className="space-y-6">
      {/* Cabecera y Selector de Gestión */}
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

      {/* Selector de Vistas (Directorio vs Administración vs Consolidado) */}
      <div className="flex border-b border-ink-200 gap-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('ejecutivo')}
          className={`pb-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
            activeTab === 'ejecutivo' 
              ? 'border-navy-700 text-navy-900' 
              : 'border-transparent text-ink-500 hover:text-ink-800'
          }`}
        >
          <Briefcase className="h-4 w-4" /> Vista Ejecutiva
        </button>
        <button
          onClick={() => setActiveTab('operativo')}
          className={`pb-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
            activeTab === 'operativo' 
              ? 'border-navy-700 text-navy-900' 
              : 'border-transparent text-ink-500 hover:text-ink-800'
          }`}
        >
          <TrendingUp className="h-4 w-4" /> Vista Operativa
        </button>
        <button
          onClick={() => setActiveTab('consolidado')}
          className={`pb-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
            activeTab === 'consolidado' 
              ? 'border-navy-700 text-navy-900' 
              : 'border-transparent text-ink-500 hover:text-ink-800'
          }`}
        >
          <Filter className="h-4 w-4" /> Consolidado de Ingresos 
        </button>
        <button
          onClick={() => setActiveTab('olap')}
          className={`pb-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
            activeTab === 'olap' ? 'border-navy-700 text-navy-900' : 'border-transparent text-ink-500 hover:text-ink-800'
          }`}
        >
          <FileSpreadsheet className="h-4 w-4" /> OLAP
        </button>

      </div>

      {/* ================= VISTA EJECUTIVA (DIRECTORIO) ================= */}
      {activeTab === 'ejecutivo' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="text-base font-bold text-ink-900">Indicadores Clave de Desempeño (KPIs)</h3>
              <p className="text-xs text-ink-500">Resumen financiero consolidado para toma de decisiones directivas.</p>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn-primary text-xs flex items-center gap-1.5" onClick={handleExportEjecutivoExcel}>
                <FileSpreadsheet className="h-4 w-4 text-emerald-200" /> Excel
              </button>
              <button className="btn-primary text-xs flex items-center gap-1.5" onClick={handleExportEjecutivoPdf}>
                <FileText className="h-4 w-4 text-red-200" /> PDF
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-5 border-l-4 border-l-navy-600 space-y-1">
              <div className="flex items-center justify-between text-ink-500 text-xs font-bold uppercase">
                <span>Ingresos Totales</span>
                <BarChart3 className="h-4 w-4 text-navy-600" />
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="text-base font-bold text-ink-900">Control de Caja y Desglose por Conceptos</h3>
              <p className="text-xs text-ink-500">Monitoreo detallado de cobros, mensualidades y arqueo interno.</p>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn-primary text-xs flex items-center gap-1.5" onClick={handleExportOperativoExcel}>
                <FileSpreadsheet className="h-4 w-4 text-emerald-200" /> Excel
              </button>
              <button className="btn-primary text-xs flex items-center gap-1.5" onClick={handleExportOperativoPdf}>
                <FileText className="h-4 w-4 text-red-200" /> PDF
              </button>
            </div>
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

      {/* ================= VISTA CONSOLIDADO DE INGRESOS ================= */}
      {activeTab === 'consolidado' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-ink-900">Consolidado de Ingresos y Arqueo</h3>
              <p className="text-xs text-ink-500">Filtre las transacciones por rangos de fecha y canal de pago específico.</p>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn-primary text-xs flex items-center gap-1.5" onClick={handleExportConsolidadoExcel}>
                <FileSpreadsheet className="h-4 w-4 text-emerald-200" /> Excel
              </button>
              <button className="btn-primary text-xs flex items-center gap-1.5" onClick={handleExportConsolidadoPdf}>
                <FileText className="h-4 w-4 text-red-200" /> PDF
              </button>
            </div>
          </div>

          {/* Filtros de Fecha y Canal */}
          <div className="card p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">Fecha Inicio</label>
              <input 
                type="date" 
                className="input text-xs"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">Fecha Fin</label>
              <input 
                type="date" 
                className="input text-xs"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">Canal de Pago</label>
              <select 
                className="input text-xs"
                value={canalFilter}
                onChange={(e) => setCanalFilter(e.target.value)}
              >
                <option value="all">Todos los canales</option>
                {ingresosPorCanal.map(([canal]) => (
                  <option key={canal} value={canal}>{canal}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Resumen Total Filtrado */}
          <div className="card p-5 bg-navy-900 text-white flex justify-between items-center">
            <div>
              <p className="text-xs text-navy-200 uppercase font-bold">Total Recaudado en el Filtro</p>
              <p className="text-2xl font-black mt-1">Bs {formatBs(totalConsolidadoFiltrado)}</p>
            </div>
            <div className="text-right">
              <span className="badge-navy">{transactionsConsolidado.length} transacciones encontradas</span>
            </div>
          </div>

          {/* Tabla Detallada Consolidada */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-head">Fecha</th>
                    <th className="table-head">Concepto</th>
                    <th className="table-head">Canal</th>
                    <th className="table-head">Estado</th>
                    <th className="table-head text-right">Monto (Bs)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {transactionsConsolidado.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-xs text-ink-400">No se encontraron transacciones con los filtros seleccionados.</td>
                    </tr>
                  ) : (
                    transactionsConsolidado.map((t) => (
                      <tr key={t.id} className="hover:bg-ink-50">
                        <td className="table-cell text-xs">{formatDate(t.fecha)}</td>
                        <td className="table-cell font-medium text-ink-900">{t.concepto}</td>
                        <td className="table-cell text-xs"><span className="badge-gray">{t.canal || 'No especificado'}</span></td>
                        <td className="table-cell text-xs">
                          <span className={t.estado === 'APROBADO' || t.estado === 'CONCILIADO' ? 'text-emerald-600 font-bold' : 'text-amber-600'}>
                            {t.estado}
                          </span>
                        </td>
                        <td className="table-cell text-right font-bold text-navy-800">Bs {formatBs(Number(t.monto) || 0)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'olap' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-ink-900">Modelo OLAP de pagos</h3>
              <p className="text-xs text-ink-500">Dimensiones de tiempo, alumno, conceptos y métricas para análisis multidimensional.</p>
            </div>
            <button className="btn-primary text-xs flex items-center gap-1.5" onClick={handleExportOlapExcel}>
              <Download className="h-4 w-4" /> Exportar a Excel
            </button>
          </div>

          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-ink-200 bg-ink-50 flex items-center justify-between">
              <span className="font-bold text-sm text-ink-900">Consulta SQL de referencia (PostgreSQL)</span>
              <span className="text-xs text-ink-500">{olapRows.length} registros exportables</span>
            </div>
            <pre className="p-5 overflow-x-auto text-xs leading-relaxed text-ink-800 bg-white whitespace-pre">{OLAP_SQL}</pre>
          </div>

          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-ink-200 bg-ink-50 font-bold text-sm text-ink-900">Vista previa de datos OLAP</div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-max">
                <thead><tr>
                  <th className="table-head">Año</th><th className="table-head">Periodo</th><th className="table-head">Fecha</th>
                  <th className="table-head">CI alumno</th><th className="table-head">Alumno</th><th className="table-head">Carrera</th>
                  <th className="table-head">Turno</th><th className="table-head">Modalidad</th><th className="table-head">Curso</th>
                  <th className="table-head">Tipo alumno</th><th className="table-head">Estado financiero</th><th className="table-head">Concepto</th>
                  <th className="table-head">Categoría</th><th className="table-head">Canal</th><th className="table-head">N° transacción</th>
                  <th className="table-head">Conciliación</th><th className="table-head">Gestión mensualidad</th><th className="table-head">Mes mensualidad</th>
                  <th className="table-head">Cuota</th><th className="table-head">Recibo</th><th className="table-head">Estado recibo</th>
                  <th className="table-head text-right">Recaudado</th><th className="table-head text-right">Original</th><th className="table-head text-right">Con descuento</th>
                </tr></thead>
                <tbody className="divide-y divide-ink-100">
                  {olapRows.length === 0 ? <tr><td colSpan={24} className="text-center py-6 text-xs text-ink-400">No hay pagos disponibles para mostrar.</td></tr> : olapRows.map((row, index) => (
                    <tr key={`${row.nro_transaccion}-${index}`} className="hover:bg-ink-50">
                      <td className="table-cell">{row.anio_pago}</td><td className="table-cell">{row.periodo_mes_pago}</td><td className="table-cell">{row.fecha_exacta}</td>
                      <td className="table-cell">{row.alumno_ci}</td><td className="table-cell">{row.alumno_nombre_completo}</td><td className="table-cell">{row.carrera}</td>
                      <td className="table-cell">{row.turno}</td><td className="table-cell">{row.modalidad}</td><td className="table-cell">{row.curso}</td>
                      <td className="table-cell">{row.tipo_alumno}</td><td className="table-cell">{row.estado_financiero_alumno}</td><td className="table-cell">{row.concepto_pago}</td>
                      <td className="table-cell">{row.categoria_arancel}</td><td className="table-cell">{row.canal_pago}</td><td className="table-cell">{row.nro_transaccion}</td>
                      <td className="table-cell">{row.estado_conciliacion}</td><td className="table-cell">{row.mensualidad_gestion}</td><td className="table-cell">{row.mensualidad_mes}</td>
                      <td className="table-cell">{row.nro_cuota}</td><td className="table-cell">{row.nro_recibo}</td><td className="table-cell">{row.estado_recibo}</td>
                      <td className="table-cell text-right">{row.monto_recaudado}</td><td className="table-cell text-right">{row.monto_esperado_original}</td><td className="table-cell text-right">{row.monto_con_descuento}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}