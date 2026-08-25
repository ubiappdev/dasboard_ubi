import { useMemo, useState } from 'react';
import { Users, Search, Upload, ChevronLeft, ChevronRight, Award, Download, History, X } from 'lucide-react';
import type { Student, ScholarshipType, ToastPush, Transaction } from '@/types';
import { formatBs, formatDate } from '@/lib/format';
import Modal from '@/components/ui/Modal';

interface StudentsViewProps {
  students: Student[];
  scholarships: ScholarshipType[];
  transactions: Transaction[];
  pushToast: ToastPush;
}

interface ExportRow {
  gestion: string;
  student: Student;
  payment?: Transaction;
}

const PAGE_SIZE = 12;

function getPaymentYear(payment: Transaction): string {
  return new Date(payment.fecha).getFullYear().toString();
}

function paymentMatchesStudent(payment: Transaction, student: Student): boolean {
  return payment.alumnoId === student.id;
}

function getExportRows(students: Student[], transactions: Transaction[], gestion: string): ExportRow[] {
  return students.flatMap((student) => {
    const payments = transactions.filter((payment) => paymentMatchesStudent(payment, student) && (gestion === 'all' || getPaymentYear(payment) === gestion));
    return payments.length > 0 ? payments.map((payment) => ({ gestion: getPaymentYear(payment), student, payment })) : [{ gestion: gestion === 'all' ? '—' : gestion, student }];
  });
}

function escapeCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function exportToExcel(rows: ExportRow[], fileName: string): void {
  const headers = ['Gestión', 'CI', 'Nombres', 'Apellidos', 'Carrera', 'Curso', 'Turno', 'Mensualidad / concepto', 'Monto (Bs)', 'Fecha de pago', 'Forma de pago', 'N° Transacción / Recibo', 'Estado del pago'];
  const body = rows.map(({ gestion, student, payment }) => [
    gestion,
    student.ci,
    student.nombres,
    student.apellidos,
    student.carrera,
    student.curso,
    student.turno,
    payment?.concepto ?? 'Sin pagos registrados',
    payment?.monto ?? 0,
    payment ? formatDate(payment.fecha) : '—',
    payment?.canal ?? '—',
    payment?.numeroTransaccion ?? '—',
    payment?.estado ?? '—',
  ].map(escapeCell).join('\t'));
  const content = `\ufeff${headers.map(escapeCell).join('\t')}\n${body.join('\n')}`;
  const blob = new Blob([content], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export default function StudentsView({ students, scholarships, transactions, pushToast }: StudentsViewProps) {
  const [search, setSearch] = useState('');
  const [career, setCareer] = useState('all');
  const [status, setStatus] = useState('all');
  const [gestion, setGestion] = useState('all');
  const [page, setPage] = useState(0);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const filtered = useMemo(() => students.filter((student) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || `${student.nombres} ${student.apellidos} ${student.ci}`.toLowerCase().includes(q);
    return matchesSearch && (career === 'all' || student.carrera === career) && (status === 'all' || student.estadoFinanciero === status);
  }), [students, search, career, status]);

  const years = useMemo(() => Array.from(new Set(transactions.map(getPaymentYear))).sort((a, b) => Number(b) - Number(a)), [transactions]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const selectedPayments = selectedStudent ? transactions.filter((payment) => paymentMatchesStudent(payment, selectedStudent) && (gestion === 'all' || getPaymentYear(payment) === gestion)) : [];

  const handleExport = (exportRows: ExportRow[], fileName: string) => {
    if (!exportRows.length) {
      pushToast('warning', 'No hay estudiantes para exportar con los filtros seleccionados.');
      return;
    }
    exportToExcel(exportRows, fileName);
    pushToast('success', 'El historial se exportó en un archivo compatible con Excel.');
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5"><p className="text-sm text-ink-500">Total estudiantes</p><p className="text-2xl font-bold text-ink-900 mt-1">{students.length}</p></div>
        <div className="card p-5"><p className="text-sm text-ink-500">Al día</p><p className="text-2xl font-bold text-emerald-600 mt-1">{students.filter((s) => s.estadoFinanciero === 'AL DIA').length}</p></div>
        <div className="card p-5"><p className="text-sm text-ink-500">Pendientes</p><p className="text-2xl font-bold text-red-600 mt-1">{students.filter((s) => s.estadoFinanciero !== 'AL DIA').length}</p></div>
        <div className="card p-5"><p className="text-sm text-ink-500">Becados</p><p className="text-2xl font-bold text-navy-700 mt-1">{students.filter((s) => s.becado).length}</p></div>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-ink-200">
          <div className="flex flex-wrap gap-3">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
              <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="input pl-9" placeholder="Buscar por nombre o CI" />
            </div>
            <select className="input w-auto" value={career} onChange={(e) => setCareer(e.target.value)}>
              <option value="all">Todas las carreras</option>
              {Array.from(new Set(students.map((s) => s.carrera))).sort().map((c) => <option key={c}>{c}</option>)}
            </select>
            <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">Todos los estados</option>
              <option value="AL DIA">Al día</option>
              <option value="PENDIENTE">Pendiente</option>
            </select>
            <select className="input w-auto" value={gestion} onChange={(e) => setGestion(e.target.value)}>
              <option value="all">Todas las gestiones</option>
              {years.map((year) => <option key={year}>{year}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => pushToast('info', 'La importación de estudiantes estará disponible en el siguiente paso.')}>
              <Upload className="h-4 w-4" /> Importar
            </button>
            <button className="btn-primary" onClick={() => handleExport(getExportRows(filtered, transactions, gestion), `historial-estudiantes-${gestion}.xls`)}>
              <Download className="h-4 w-4" /> Exportar Excel
            </button>
          </div>
        </div>

        <div className="px-6 py-3 bg-navy-50 border-b border-navy-100 text-sm text-navy-800 flex items-center gap-2">
          <History className="h-4 w-4" /> Selecciona un estudiante para ver sus pagos de la gestión elegida.
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-head">Estudiante</th>
                <th className="table-head">CI</th>
                <th className="table-head">Carrera</th>
                <th className="table-head">Curso</th>
                <th className="table-head">Turno</th>
                <th className="table-head">Beca</th>
                <th className="table-head">Estado</th>
                <th className="table-head text-right">Historial</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {rows.map((student) => {
                const scholarship = scholarships.find((item) => item.id === student.tipoBecaId);
                return (
                  <tr key={student.id} className="hover:bg-ink-50">
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-navy-100 text-navy-700 flex items-center justify-center text-xs font-bold">
                          {student.nombres[0]}{student.apellidos[0]}
                        </div>
                        <span className="font-semibold">{student.nombres} {student.apellidos}</span>
                      </div>
                    </td>
                    <td className="table-cell">{student.ci}</td>
                    <td className="table-cell">{student.carrera}</td>
                    <td className="table-cell">{student.curso}</td>
                    <td className="table-cell">{student.turno}</td>
                    <td className="table-cell">{scholarship ? <span className="badge-navy"><Award className="h-3 w-3" /> {scholarship.nombre}</span> : '—'}</td>
                    <td className="table-cell">{student.estadoFinanciero === 'AL DIA' ? <span className="badge-green">Al día</span> : <span className="badge-red">Pendiente</span>}</td>
                    <td className="table-cell text-right">
                      <button className="btn-secondary" onClick={() => setSelectedStudent(student)}>
                        <History className="h-4 w-4" /> Ver pagos
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {rows.length === 0 && (
          <div className="py-12 text-center text-ink-500">
            <Users className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p>No hay estudiantes con esos filtros.</p>
          </div>
        )}

        <div className="flex items-center justify-between px-6 py-4 border-t border-ink-200">
          <span className="text-sm text-ink-500">{filtered.length} estudiantes encontrados</span>
          <div className="flex items-center gap-2">
            <button className="btn-secondary" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm">Página {page + 1} de {pages}</span>
            <button className="btn-secondary" disabled={page >= pages - 1} onClick={() => setPage((value) => Math.min(pages - 1, value + 1))}>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <Modal
        open={!!selectedStudent}
        onClose={() => setSelectedStudent(null)}
        title={selectedStudent ? `${selectedStudent.nombres} ${selectedStudent.apellidos}` : 'Historial de pagos'}
        subtitle={selectedStudent ? `${selectedStudent.carrera} · Curso ${selectedStudent.curso} · CI ${selectedStudent.ci}` : undefined}
        size="xl"
        icon={<History className="h-5 w-5" />}
      >
        {selectedStudent && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-ink-500">Historial de la gestión</p>
                <p className="text-xl font-bold text-ink-900">{gestion === 'all' ? 'Todas' : gestion}</p>
              </div>
              <button className="btn-primary" onClick={() => handleExport(getExportRows([selectedStudent], transactions, gestion), `historial-${selectedStudent.ci}-${gestion}.xls`)}>
                <Download className="h-4 w-4" /> Exportar Excel
              </button>
            </div>

            {selectedPayments.length === 0 ? (
              <div className="rounded-xl border border-dashed border-ink-300 p-8 text-center text-ink-500">
                No hay pagos registrados para esta gestión.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="table-head">Gestión</th>
                      <th className="table-head">Fecha</th>
                      <th className="table-head">Mensualidad / concepto</th>
                      <th className="table-head">Forma de pago</th>
                      <th className="table-head">N° Transacción</th>
                      <th className="table-head text-right">Monto</th>
                      <th className="table-head">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {selectedPayments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="table-cell">{getPaymentYear(payment)}</td>
                        <td className="table-cell">{formatDate(payment.fecha)}</td>
                        <td className="table-cell font-medium">{payment.concepto}</td>
                        <td className="table-cell">{payment.canal}</td>
                        <td className="table-cell">{payment.numeroTransaccion}</td>
                        <td className="table-cell text-right font-semibold">Bs {formatBs(payment.monto)}</td>
                        <td className="table-cell">
                          {payment.estado === 'CONCILIADO' ? <span className="badge-green">Conciliado</span> :
                           payment.estado === 'RECHAZADO' ? <span className="badge-red">Rechazado</span> :
                           <span className="badge-yellow">{payment.estado}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end">
              <button className="btn-secondary" onClick={() => setSelectedStudent(null)}>
                <X className="h-4 w-4" /> Cerrar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
