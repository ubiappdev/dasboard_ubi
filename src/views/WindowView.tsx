import { useMemo, useState } from 'react';
import { Banknote, CheckCircle2, FilePlus2, Plus, Receipt, ScanLine, Search, Upload, X } from 'lucide-react';
import type { FeeItem, ScholarshipType, Student, ToastPush, PaymentChannel } from '@/types';
import { createPayment } from '@/lib/database';
import { formatBs } from '@/lib/format';
import RemoteScanModal from '@/components/ui/RemoteScanModal';

interface WindowViewProps {
  students: Student[];
  fees: FeeItem[];
  scholarships: ScholarshipType[];
  pushToast: ToastPush;
  onRefresh: () => Promise<void>;
}

type FormState = {
  student: Student | null;
  concepto: string;
  monto: string;
  recibido: string;
  comprobante: string;
  imageData?: string;
};

const initialForm: FormState = { student: null, concepto: '', monto: '', recibido: '', comprobante: '' };

export default function WindowView({ students, fees, pushToast, onRefresh }: WindowViewProps) {
  const [form, setForm] = useState<FormState>(initialForm);
  const [query, setQuery] = useState('');
  const [manualMode, setManualMode] = useState(true);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanImage, setScanImage] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);

  const results = useMemo(() => {
    const q = query.toLowerCase();
    return q.length < 2 ? [] : students.filter((student) =>
      `${student.nombres} ${student.apellidos} ${student.ci}`.toLowerCase().includes(q)
    ).slice(0, 5);
  }, [query, students]);

  const cash = Number(form.recibido) || 0;
  const amount = Number(form.monto) || 0;
  const change = Math.max(0, cash - amount);
  const feeOptions = fees;

  const selectStudent = (student: Student) => {
    setForm((current) => ({ ...current, student }));
    setQuery(`${student.nombres} ${student.apellidos}`);
  };

  const savePayment = async () => {
    if (!form.student || !form.concepto || amount <= 0 || cash < amount || !form.comprobante) {
      pushToast('error', 'Completa estudiante, concepto, monto, efectivo recibido y número de recibo.');
      return;
    }
    setSaving(true);
    try {
      await createPayment({
        studentId: form.student.id,
        concepto: form.concepto,
        monto: amount,
        canal: 'EFECTIVO' as PaymentChannel,
        numeroTransaccion: form.comprobante,
        comprobanteUrl: form.imageData,
        ocrData: form.imageData ? { comprobante: form.comprobante, monto: amount, estudiante: `${form.student.nombres} ${form.student.apellidos}`, validado_por_cajero: true } : undefined,
      });
      await onRefresh();
      pushToast('success', `Recibo ${form.comprobante} registrado correctamente.`);
      setForm(initialForm);
      setQuery('');
      setScanImage(undefined);
    } catch (error) {
      console.error('cash payment failed', error);
      pushToast('error', 'No se pudo guardar el pago en caja.');
    } finally {
      setSaving(false);
    }
  };

  const handleScan = (imageData: string) => {
    setScanImage(imageData);
    setForm((current) => ({ ...current, imageData }));
    pushToast('info', 'Recibo escaneado. Revisa los datos antes de aceptar.');
  };

  const handleBulkFile = (file: File) => {
    setBulkMode(true);
    pushToast('info', `${file.name} cargado. Revisa cada recibo escaneado antes de guardarlo.`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-ink-900">Pagos en efectivo</h3>
          <p className="text-sm text-ink-500">Registra mensualidades y otros aranceles cobrados en ventanilla.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setScanOpen(true)}>
            <ScanLine className="h-4 w-4" /> Escanear recibo con celular
          </button>
          <label className="btn-secondary cursor-pointer">
            <Upload className="h-4 w-4" /> Carga masiva
            <input type="file" hidden accept="image/*,.pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) handleBulkFile(file); }} />
          </label>
        </div>
      </div>

      {bulkMode && (
        <div className="card border-navy-200 bg-navy-50 p-5 flex items-center gap-4">
          <FilePlus2 className="h-7 w-7 text-navy-700" />
          <div className="flex-1">
            <h4 className="font-bold text-navy-900">Lote de recibos listo para revisión</h4>
            <p className="text-sm text-navy-700">La API de OCR puede entregar varios recibos. Acepta cada lectura antes de guardarla definitivamente.</p>
          </div>
          <button className="btn-secondary" onClick={() => setBulkMode(false)}>
            <X className="h-4 w-4" /> Cerrar
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="card p-6 xl:col-span-2">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Banknote className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-ink-900">Nuevo pago de caja</h3>
              <p className="text-sm text-ink-500">Opción manual o datos capturados por OCR.</p>
            </div>
          </div>

          <div className="flex gap-1 rounded-lg bg-ink-100 p-1 w-fit mb-5">
            <button onClick={() => setManualMode(true)} className={`btn ${manualMode ? 'bg-white text-navy-800 shadow-sm' : 'text-ink-500'}`}>Carga manual</button>
            <button onClick={() => setManualMode(false)} className={`btn ${!manualMode ? 'bg-white text-navy-800 shadow-sm' : 'text-ink-500'}`}>Datos del escaneo</button>
          </div>

          <label className="label">Estudiante</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
            <input
              className="input pl-9"
              value={query}
              onChange={(event) => { setQuery(event.target.value); setForm((current) => ({ ...current, student: null })); }}
              placeholder="Buscar por CI o nombre"
            />
            {results.length > 0 && !form.student && (
              <div className="absolute top-full left-0 right-0 z-10 mt-1 rounded-lg border border-ink-200 bg-white shadow-pop overflow-hidden">
                {results.map((student) => (
                  <button key={student.id} className="w-full text-left px-4 py-3 hover:bg-navy-50 border-b border-ink-100" onClick={() => selectStudent(student)}>
                    <b>{student.nombres} {student.apellidos}</b>
                    <span className="block text-xs text-ink-500">CI {student.ci}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {form.student && (
            <div className="mt-2 rounded-lg bg-navy-50 border border-navy-200 px-4 py-3 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-navy-800 text-white flex items-center justify-center font-bold">
                {form.student.nombres[0]}{form.student.apellidos[0]}
              </div>
              <div className="flex-1">
                <b>{form.student.nombres} {form.student.apellidos}</b>
                <p className="text-xs text-ink-500">CI {form.student.ci} · {form.student.carrera}</p>
              </div>
              <button className="btn-ghost" onClick={() => setForm((current) => ({ ...current, student: null }))}>
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="label">Concepto</label>
              <select
                className="input"
                value={form.concepto}
                onChange={(event) => {
                  const fee = feeOptions.find((item) => item.concepto === event.target.value);
                  setForm((current) => ({ ...current, concepto: event.target.value, monto: fee ? String(fee.monto) : current.monto }));
                }}
              >
                <option value="">Seleccionar arancel</option>
                {feeOptions.map((fee) => (
                  <option key={fee.id} value={fee.concepto}>{fee.concepto} — Bs {formatBs(fee.monto)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Monto a pagar (Bs)</label>
              <input className="input" type="number" value={form.monto} onChange={(event) => setForm((current) => ({ ...current, monto: event.target.value }))} />
            </div>
            <div>
              <label className="label">Número de recibo</label>
              <input className="input font-mono" value={form.comprobante} onChange={(event) => setForm((current) => ({ ...current, comprobante: event.target.value }))} placeholder="REC-00000" />
            </div>
            <div>
              <label className="label">Efectivo recibido (Bs)</label>
              <input className="input" type="number" value={form.recibido} onChange={(event) => setForm((current) => ({ ...current, recibido: event.target.value }))} />
            </div>
          </div>

          {scanImage && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 flex gap-3">
              <img src={scanImage} alt="Recibo escaneado" className="h-24 w-36 object-contain rounded-lg bg-white border border-ink-200" />
              <div className="flex-1">
                <p className="font-semibold text-emerald-800">Recibo capturado por OCR</p>
                <p className="text-xs text-emerald-700 mt-1">La información queda pendiente de aceptación del cajero.</p>
                <button className="btn-ghost text-emerald-800 px-0" onClick={() => { setScanImage(undefined); setForm((current) => ({ ...current, imageData: undefined })); }}>
                  Quitar imagen
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-5 pt-4 border-t border-ink-200">
            <div>
              <p className="text-sm text-ink-500">Cambio a devolver</p>
              <p className="text-xl font-bold text-emerald-700">Bs {formatBs(change)}</p>
            </div>
            <button disabled={saving} onClick={() => void savePayment()} className="btn-primary">
              <Receipt className="h-4 w-4" /> {saving ? 'Guardando…' : 'Aceptar y emitir recibo'}
            </button>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="font-bold text-ink-900">Flujo de caja</h3>
          <div className="space-y-4 mt-5">
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-navy-800 text-white flex items-center justify-center font-bold">1</div>
              <div>
                <b className="text-sm">Identificar estudiante</b>
                <p className="text-xs text-ink-500 mt-1">Busca por CI en la base institucional.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-navy-800 text-white flex items-center justify-center font-bold">2</div>
              <div>
                <b className="text-sm">Capturar o cargar recibo</b>
                <p className="text-xs text-ink-500 mt-1">OCR e IA proponen los datos del talonario.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">3</div>
              <div>
                <b className="text-sm">Aceptar y guardar</b>
                <p className="text-xs text-ink-500 mt-1">El cajero valida y el pago queda registrado.</p>
              </div>
            </div>
          </div>
          <div className="mt-6 rounded-xl bg-amber-50 border border-amber-200 p-4">
            <p className="text-sm font-semibold text-amber-900">Recibos masivos</p>
            <p className="text-xs text-amber-800 mt-1">Puedes revisar el lote cargado y guardar cada lectura solo después de confirmarla.</p>
          </div>
        </div>
      </div>

      <RemoteScanModal open={scanOpen} onClose={() => setScanOpen(false)} onCapture={handleScan} title="Escanear recibo de caja" />
    </div>
  );
}
