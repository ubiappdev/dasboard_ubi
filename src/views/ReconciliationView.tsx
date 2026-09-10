import { useMemo, useRef, useState } from 'react';
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle, Eye, ShieldAlert, Landmark, QrCode, Banknote, ArrowRightLeft, RefreshCw, X, Calendar, Filter, Loader2 } from 'lucide-react';
import type { PaymentChannel, ReconStatus, ToastPush, Transaction } from '@/types';
import { createStatement, updatePaymentStatus } from '@/lib/database';
import { formatBs, formatDateTime } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';

interface ReconciliationViewProps {
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  pushToast: ToastPush;
  onRefresh: () => Promise<void>;
}

type ChannelTab = PaymentChannel | 'all';
type StatusTab = 'all' | 'CONCILIADO' | 'PENDIENTE' | 'RECHAZADO' | 'REVISION';

const CHANNEL_LABELS: Record<PaymentChannel, string> = { QR: 'QR', DEPOSITO: 'Depósito', EFECTIVO: 'Efectivo', TRANSFERENCIA: 'Transferencia' };
const DOCUMENT_LABELS: Record<PaymentChannel, string> = { QR: 'comprobante QR', DEPOSITO: 'voucher de depósito', EFECTIVO: 'recibo de caja', TRANSFERENCIA: 'comprobante interbancario' };

export default function ReconciliationView({ transactions, setTransactions, pushToast, onRefresh }: ReconciliationViewProps) {
  const [activeTab, setActiveTab] = useState<ChannelTab>('all');
  const [statusFilter, setStatusFilter] = useState<StatusTab>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filtrado avanzado por canal, estado y rango de fechas
  const filtered = useMemo(() => {
    return transactions.filter((item) => {
      const matchChannel = activeTab === 'all' || item.canal === activeTab;
      const matchStatus = statusFilter === 'all' || item.estado === statusFilter;
      
      let matchDate = true;
      if (startDate || endDate) {
        const itemDate = new Date(item.fecha).toISOString().split('T')[0];
        if (startDate && itemDate < startDate) matchDate = false;
        if (endDate && itemDate > endDate) matchDate = false;
      }

      return matchChannel && matchStatus && matchDate;
    });
  }, [activeTab, statusFilter, startDate, endDate, transactions]);

  const counts = {
    conciliado: transactions.filter((item) => item.estado === 'CONCILIADO').length,
    pendiente: transactions.filter((item) => item.estado === 'PENDIENTE').length,
    rechazado: transactions.filter((item) => item.estado === 'RECHAZADO').length,
  };

  // Procesar extracto leyendo el Excel localmente y llamando a la Edge Function con mode: 'conciliar_banco'
  const processStatement = async (file: File) => {
    setUploading(true);
    setFileName(file.name);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convertir la hoja de Excel a un array de objetos JSON planos
      const movimientosJson = XLSX.utils.sheet_to_json(worksheet);

      if (!movimientosJson || movimientosJson.length === 0) {
        throw new Error("El archivo Excel está vacío o no contiene filas legibles.");
      }

      // Invocar a la Edge Function enviando mode: 'conciliar_banco'
      const { data: responseData, error: fnError } = await supabase.functions.invoke('conciliar-banco', {
        body: {
          mode: 'conciliar_banco',
          movimientos: movimientosJson
        }
      });

      if (fnError) {
        throw new Error(fnError.message || "Error al invocar la Edge Function.");
      }

      if (responseData?.error) {
        throw new Error(responseData.error);
      }

      const totalConciliados = responseData.totalConciliados || 0;

      // Registrar historial del extracto y refrescar la vista
      await createStatement(file.name, `Extracto importado y procesado por Edge Function. Conciliados: ${totalConciliados}`);
      await onRefresh();
      
      pushToast('success', responseData.mensaje || `Extracto procesado. Se conciliaron ${totalConciliados} pagos con éxito.`);
    } catch (error: any) {
      console.error('statement processing failed', error);
      pushToast('error', error.message || 'No se pudo procesar el archivo del extracto bancario.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const changeStatus = async (tx: Transaction, estado: ReconStatus, obs?: string) => {
    try {
      await updatePaymentStatus(tx.id, estado);
      setTransactions((current) => current.map((item) => item.id === tx.id ? { ...item, estado, observacion: obs || item.observacion } : item));
      pushToast('success', 'Estado de pago actualizado correctamente.');
    } catch (error) { 
      console.error('status update failed', error); 
      pushToast('error', 'No se pudo actualizar el estado.'); 
    }
  };

  const channelIcon = (channel: PaymentChannel) => channel === 'QR' ? QrCode : channel === 'EFECTIVO' ? Banknote : channel === 'TRANSFERENCIA' ? ArrowRightLeft : Landmark;
  const statusBadge = (status: ReconStatus) => status === 'CONCILIADO' ? <span className="badge-green">✅ Conciliado</span> : status === 'RECHAZADO' ? <span className="badge-red">❌ Rechazado</span> : status === 'REVISION' ? <span className="badge-yellow">⚠️ Revisión</span> : <span className="badge-yellow">⏳ Pendiente</span>;

  const getComprobanteUrl = (url?: string | null) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const { data } = supabase.storage.from('comprobantes').getPublicUrl(url);
    return data.publicUrl;
  };

  return <div className="space-y-6">
    {/* SECCIÓN DE CARGA Y ESTADÍSTICAS */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="card p-6 lg:col-span-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-bold text-ink-900">Cargar extracto bancario</h3>
            <p className="text-sm text-ink-500 mt-1">Importa el archivo Excel del banco para ejecutar el cruce automático a través de la Edge Function.</p>
          </div>
          <FileSpreadsheet className="h-7 w-7 text-navy-600" />
        </div>
        <button onClick={() => inputRef.current?.click()} disabled={uploading} className="mt-5 w-full rounded-xl border-2 border-dashed border-ink-300 hover:border-navy-500 hover:bg-navy-50 p-8 transition text-center disabled:opacity-60 flex flex-col items-center justify-center">
          {uploading ? (
            <>
              <Loader2 className="h-9 w-9 mx-auto text-navy-600 animate-spin" />
              <p className="mt-3 font-semibold text-ink-800">Procesando extracto en el servidor...</p>
            </>
          ) : (
            <>
              <UploadCloud className="h-9 w-9 mx-auto text-navy-600" />
              <p className="mt-3 font-semibold text-ink-800">{fileName || 'Seleccionar Excel o CSV del banco'}</p>
              <p className="text-xs text-ink-500 mt-1">El sistema evaluará únicamente los pagos pendientes y descartará los pagos en efectivo.</p>
            </>
          )}
          <input ref={inputRef} type="file" hidden accept=".xlsx,.xls,.csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void processStatement(file); }} />
        </button>
      </div>
      <div className="card p-5">
        <h3 className="font-bold text-ink-900 mb-4">Resumen general</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-lg bg-emerald-50 border border-emerald-200 p-3"><CheckCircle2 className="h-5 w-5 text-emerald-600" /><span className="text-sm font-semibold text-emerald-800 flex-1">Conciliados</span><b className="text-emerald-700">{counts.conciliado}</b></div>
          <div className="flex items-center gap-3 rounded-lg bg-amber-50 border border-amber-200 p-3"><AlertTriangle className="h-5 w-5 text-amber-600" /><span className="text-sm font-semibold text-amber-800 flex-1">Pendientes</span><b className="text-amber-700">{counts.pendiente}</b></div>
          <div className="flex items-center gap-3 rounded-lg bg-red-50 border border-red-200 p-3"><ShieldAlert className="h-5 w-5 text-red-600" /><span className="text-sm font-semibold text-red-800 flex-1">Rechazados</span><b className="text-red-700">{counts.rechazado}</b></div>
        </div>
      </div>
    </div>

    {/* PANEL DE FILTROS INFERIORES */}
    <div className="card p-4 flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-ink-600 flex items-center gap-1 mr-1"><Filter className="h-3.5 w-3.5" /> Estado:</span>
        {(['all', 'CONCILIADO', 'PENDIENTE', 'RECHAZADO'] as StatusTab[]).map((st) => (
          <button key={st} onClick={() => setStatusFilter(st)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${statusFilter === st ? 'bg-navy-900 text-white shadow-sm' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'}`}>
            {st === 'all' ? 'Todos los estados' : st}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 text-xs">
        <Calendar className="h-4 w-4 text-ink-500" />
        <span className="font-medium text-ink-600">Desde:</span>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-lg border border-ink-300 px-2 py-1 text-xs" />
        <span className="font-medium text-ink-600">Hasta:</span>
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-lg border border-ink-300 px-2 py-1 text-xs" />
        {(startDate || endDate) && <button onClick={() => { setStartDate(''); setEndDate(''); }} className="text-red-600 font-bold hover:underline ml-1">Limpiar</button>}
      </div>
    </div>
    
    {/* TABLA PRINCIPAL DE PAGOS */}
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-ink-200">
        <div><h3 className="font-bold text-ink-900">Transacciones de alumnos ({filtered.length})</h3><p className="text-sm text-ink-500 mt-1">Revisa los comprobantes, estados y observaciones con indicadores visuales.</p></div>
        <button onClick={() => void onRefresh()} className="btn-secondary"><RefreshCw className="h-4 w-4" /> Actualizar</button>
      </div>
      
      <div className="flex gap-1 p-3 border-b border-ink-100 overflow-x-auto">
        {(['all', 'QR', 'DEPOSITO', 'EFECTIVO', 'TRANSFERENCIA'] as ChannelTab[]).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`btn text-xs ${activeTab === tab ? 'bg-navy-800 text-white' : 'text-ink-500 hover:bg-ink-100'}`}>
            {tab === 'all' ? <Landmark className="h-4 w-4" /> : (() => { const Icon = channelIcon(tab); return <Icon className="h-4 w-4" />; })()}
            {tab === 'all' ? 'Todos los canales' : CHANNEL_LABELS[tab]}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-head">Estado</th>
              <th className="table-head">N° Transacción</th>
              <th className="table-head">Estudiante</th>
              <th className="table-head">Canal</th>
              <th className="table-head">Concepto / Obs</th>
              <th className="table-head text-right">Monto</th>
              <th className="table-head">Fecha</th>
              <th className="table-head text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {filtered.map((tx) => { 
              const Icon = channelIcon(tx.canal); 
              return (
                <tr key={tx.id} className="hover:bg-ink-50">
                  <td className="table-cell">{statusBadge(tx.estado)}</td>
                  <td className="table-cell font-mono text-xs font-semibold">{tx.numeroTransaccion || 'S/N'}</td>
                  <td className="table-cell"><b>{tx.estudiante}</b><div className="text-xs text-ink-400">{tx.ci}</div></td>
                  <td className="table-cell"><span className="badge-navy"><Icon className="h-3 w-3" />{CHANNEL_LABELS[tx.canal]}</span></td>
                  <td className="table-cell">
                    <div>{tx.concepto}</div>
                    {tx.observacion && <div className="text-xs font-medium text-amber-700 mt-0.5">{tx.observacion}</div>}
                  </td>
                  <td className="table-cell text-right font-semibold">Bs {formatBs(tx.monto)}</td>
                  <td className="table-cell text-xs text-ink-500">{formatDateTime(tx.fecha)}</td>
                  <td className="table-cell">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setSelected(tx)} className="btn-ghost text-xs"><Eye className="h-4 w-4" /> Ver</button>
                      {tx.estado !== 'CONCILIADO' && <button onClick={() => void changeStatus(tx, 'CONCILIADO', '✅ Conciliado correctamente por cajero')} className="btn-success text-xs"><CheckCircle2 className="h-4 w-4" /> Conciliar</button>}
                    </div>
                  </td>
                </tr>
              ); 
            })}
          </tbody>
        </table>
      </div>
    </div>
    
    {/* MODAL DE DETALLE */}
    {selected && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
        <div className="absolute inset-0 bg-navy-950/40 backdrop-blur-sm" />
        <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-pop p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-ink-900">{DOCUMENT_LABELS[selected.canal]}</h3>
              <p className="text-xs text-ink-500">{selected.numeroTransaccion} · Estado: {selected.estado}</p>
            </div>
            <button onClick={() => setSelected(null)} className="btn-ghost"><X className="h-5 w-5" /></button>
          </div>
          
          <div className="rounded-xl border border-ink-200 bg-ink-50 p-6 font-mono text-sm space-y-2">
            <p className="font-bold">Información de la transacción</p>
            <p>Estudiante: {selected.estudiante}</p>
            <p>Concepto: {selected.concepto}</p>
            <p>Fecha: {formatDateTime(selected.fecha)}</p>
            <p className="text-lg font-bold text-navy-800">Monto: Bs {formatBs(selected.monto)}</p>
            {selected.observacion && <p className="text-xs text-amber-700 font-sans mt-2">Observación: {selected.observacion}</p>}
          </div>

          <div className="mt-4 p-4 rounded-xl border border-ink-200 bg-white">
            <p className="text-xs font-bold text-ink-700 mb-2">Comprobante de pago</p>
            {selected.comprobanteUrl ? (
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-lg overflow-hidden border border-ink-300 bg-ink-100 cursor-pointer relative group flex items-center justify-center flex-shrink-0" onClick={() => setShowImageModal(true)}>
                  <img src={getComprobanteUrl(selected.comprobanteUrl)} alt="Comprobante" className="h-full w-full object-cover group-hover:scale-105 transition" />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition"><Eye className="h-5 w-5 text-white" /></div>
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={() => setShowImageModal(true)} className="btn-secondary text-xs py-1.5 px-3"><Eye className="h-4 w-4 inline mr-1" /> Ver imagen completa</button>
                  <a href={getComprobanteUrl(selected.comprobanteUrl)} target="_blank" rel="noopener noreferrer" className="text-xs text-navy-600 hover:underline font-medium">Abrir en nueva pestaña ↗</a>
                </div>
              </div>
            ) : (<p className="text-xs text-ink-400 italic">No hay ningún comprobante adjunto.</p>)}
          </div>

          <div className="flex gap-2 mt-5">
            {selected.estado !== 'CONCILIADO' && <button onClick={() => { void changeStatus(selected, 'CONCILIADO', '✅ Validado manualmente'); setSelected(null); }} className="btn-success flex-1"><CheckCircle2 className="h-4 w-4" /> Conciliar</button>}
            {selected.estado !== 'RECHAZADO' && <button onClick={() => { void changeStatus(selected, 'RECHAZADO', '❌ Rechazado por inconsistencia'); setSelected(null); }} className="btn-danger flex-1"><XCircle className="h-4 w-4" /> Rechazar</button>}
            <button onClick={() => setSelected(null)} className="btn-secondary">Cerrar</button>
          </div>
        </div>
      </div>
    )}

    {/* MODAL AMPLIAR IMAGEN */}
    {showImageModal && selected?.comprobanteUrl && (
      <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowImageModal(false)}>
        <div className="relative bg-white rounded-2xl p-4 max-w-3xl max-h-[95vh] overflow-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <button className="absolute top-4 right-4 bg-red-600 text-white rounded-full p-2 text-xs font-bold hover:bg-red-700 z-10 transition shadow-md" onClick={() => setShowImageModal(false)}><X className="h-5 w-5" /></button>
          <p className="text-sm font-bold text-ink-900 mb-2 px-1">Comprobante de {selected.estudiante}</p>
          <img src={getComprobanteUrl(selected.comprobanteUrl)} alt="Comprobante Ampliado" className="w-full h-auto rounded-xl object-contain max-h-[80vh] border border-ink-200 bg-ink-50" />
        </div>
      </div>
    )}
  </div>;
}