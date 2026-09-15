import { useEffect, useState } from 'react';
import {
  Search, Landmark, QrCode, Banknote, ArrowRightLeft,
  Receipt, UploadCloud, Loader2, X, CheckCircle2, Camera, Sparkles, PlusCircle, Eye, AlertCircle
} from 'lucide-react';
import type { ToastPush, PaymentChannel } from '@/types';
import { formatBs, formatDateTime } from '@/lib/format';
import { supabase } from '@/lib/supabase';


interface WindowViewProps {
  pushToast: ToastPush;
}


type ChannelTab = PaymentChannel | 'all';
type MainTab = 'gestion_recibos' | 'pagos_conciliados' | 'pagos_efectivo_pendientes';


const CHANNEL_LABELS: Record<PaymentChannel, string> = { 
  QR: 'QR', 
  DEPOSITO: 'Depósito', 
  EFECTIVO: 'Efectivo', 
  TRANSFERENCIA: 'Transferencia' 
};


const COMPROBANTES_BUCKET = 'comprobantes';


interface ExtractedData {
  idItem?: string;
  storagePath: string;
  numero_recibo: string;
  monto_total: string;
  concepto_cobro: string;
  fecha_emision: string;
  ci_detectado?: string;
  confianza?: 'ALTA' | 'MEDIA' | 'BAJA';
  preview_url?: string;
  ocr_data?: Record<string, unknown>;
  error?: string;
}


export default function WindowView({ pushToast }: WindowViewProps) {
  // Las 3 pestañas principales solicitadas
  const [mainTab, setMainTab] = useState<MainTab>('gestion_recibos');
  const [payments, setPayments] = useState<any[]>([]);
  const [cajasRecibos, setCajasRecibos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalSearch, setGlobalSearch] = useState('');
  const [activeTab, setActiveTab] = useState<ChannelTab>('all');


  // Estado del modal unitario de recibo
  const [uploadTarget, setUploadTarget] = useState<any | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [storagePath, setStoragePath] = useState<string>('');
  const [processingAI, setProcessingAI] = useState(false);
  const [savingRecibo, setSavingRecibo] = useState(false);
  const [extracted, setExtracted] = useState<any | null>(null);


  // Estados para el flujo de Subida Masiva de 2 Pasos
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchStep, setBatchStep] = useState<1 | 2 | 3>(1);
  const [linkingRecibo, setLinkingRecibo] = useState<any | null>(null);
  const [paymentCandidates, setPaymentCandidates] = useState<any[]>([]);
  const [searchingPayment, setSearchingPayment] = useState(false);
  const [confirmingPaymentId, setConfirmingPaymentId] = useState<string | null>(null);
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchResults, setBatchResults] = useState<ExtractedData[]>([]);
  
  // Estado para el modal de vista ampliada ("Ojito") de la imagen
  const [modalImagePreview, setModalImagePreview] = useState<string | null>(null);


  useEffect(() => {
    fetchData();
  }, []);


  const fetchData = async () => {
    try {
      setLoading(true);
      const [pagosRes, cajasRes] = await Promise.all([
        supabase
          .from('alumnos_pagos')
          .select(`
            id, alumno_id, monto_pagado, canal_pago, numero_transaccion, fecha_pago,
            comprobante_url, estado_conciliacion, observacion, concepto, ocr_data, created_at,
            alumnos!alumnos_pagos_alumno_id_fkey (id, nombres, apellidos, ci)
          `)
          .order('fecha_pago', { ascending: false }),
        supabase
          .from('cajas_recibos')
          .select(`
            id, numero_recibo, alumno_id, monto_total, concepto_cobro, fecha_emision,
            estado, recibo_data, pago_id, recibo_url,
            alumnos!cajas_recibos_alumno_id_fkey(id, nombres, apellidos, ci),
            alumnos_pagos!cajas_recibos_pago_id_fkey(comprobante_url)
          `)
          .order('numero_recibo', { ascending: true })
      ]);
      if (pagosRes.error) throw pagosRes.error;
      if (cajasRes.error) throw cajasRes.error;
      setPayments(pagosRes.data || []);
      setCajasRecibos(cajasRes.data || []);
    } catch (error) {
      console.error('Error al cargar datos:', error);
      pushToast('error', 'No se pudieron sincronizar los registros de caja y pagos.');
    } finally {
      setLoading(false);
    }
  };


  // Filtros para pagos conciliados bancarios/efectivo (Pestaña 2)
  const filteredPayments = payments.filter((p) => {
    const q = globalSearch.toLowerCase();
    const isConciliado = p.estado_conciliacion === 'CONCILIADO';
    const matchesChannel = activeTab === 'all' || p.canal_pago === activeTab;
    const nombreEstudiante = [p.alumnos?.nombres, p.alumnos?.apellidos].filter(Boolean).join(' ');
    const ciEstudiante = p.alumnos?.ci || '';
    const matchesSearch = !q || (
      String(p.numero_transaccion || '').toLowerCase().includes(q) ||
      String(p.concepto || '').toLowerCase().includes(q) ||
      nombreEstudiante.toLowerCase().includes(q) ||
      String(ciEstudiante).toLowerCase().includes(q)
    );
    return isConciliado && matchesChannel && matchesSearch;
  });


  // Filtros para pagos en efectivo pendientes (Pestaña 3 - idéntica lógica base de la pestaña 2 pero adaptada a pendientes/efectivo)
  const filteredPendingCashPayments = payments.filter((p) => {
    const q = globalSearch.toLowerCase();
    const isEfectivoPendiente = p.canal_pago === 'EFECTIVO' && p.estado_conciliacion !== 'CONCILIADO';
    const nombreEstudiante = [p.alumnos?.nombres, p.alumnos?.apellidos].filter(Boolean).join(' ');
    const ciEstudiante = p.alumnos?.ci || '';
    const matchesSearch = !q || (
      String(p.numero_transaccion || '').toLowerCase().includes(q) ||
      String(p.concepto || '').toLowerCase().includes(q) ||
      nombreEstudiante.toLowerCase().includes(q) ||
      String(ciEstudiante).toLowerCase().includes(q)
    );
    return isEfectivoPendiente && matchesSearch;
  });


  const channelIcon = (channel: string) => 
    channel === 'QR' ? QrCode : 
    channel === 'EFECTIVO' ? Banknote : 
    channel === 'TRANSFERENCIA' ? ArrowRightLeft : Landmark;

    const statusBadge = (estado?: string) =>
    estado === 'CONCILIADO' ? <span className="badge-green">Conciliado</span> :
    estado === 'RECHAZADO' ? <span className="badge-red">Rechazado</span> :
    <span className="badge-amber">Pendiente</span>;

  const getReciboImageUrl = (reciboUrl?: string) => {
    if (!reciboUrl) return '';
    if (/^https?:\/\//i.test(reciboUrl)) return reciboUrl;
    return supabase.storage.from(COMPROBANTES_BUCKET).getPublicUrl(reciboUrl).data.publicUrl;
  };


  const openUploadModal = (pago: any) => {
    setUploadTarget(pago);
    setPhotoFile(null);
    setPhotoPreview(pago.comprobante_url ? supabase.storage.from(COMPROBANTES_BUCKET).getPublicUrl(pago.comprobante_url).data.publicUrl : '');
    setStoragePath(pago.comprobante_url || '');
    setExtracted(null);
  };


  const closeUploadModal = () => {
    setUploadTarget(null);
    setPhotoFile(null);
    setPhotoPreview('');
    setStoragePath('');
    setExtracted(null);
    setProcessingAI(false);
    setSavingRecibo(false);
  };


  const handlePhotoSelected = (file: File) => {
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setExtracted(null);
    setStoragePath('');
  };


  const processWithAI = async () => {
    if ((!photoFile && !storagePath) || !uploadTarget) return;
    try {
      setProcessingAI(true);
      let path = storagePath;
      if (photoFile) {
        const ext = photoFile.name.split('.').pop() || 'jpg';
        path = `recibos/${uploadTarget.alumno_id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from(COMPROBANTES_BUCKET)
          .upload(path, photoFile, { cacheControl: '3600', upsert: false });
        
        if (uploadError) throw uploadError;
        setStoragePath(path);
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const { data, error } = await supabase.functions.invoke('extraer-insertar-recibo', {
        body: { mode: 'extract', pagoId: uploadTarget.id, storagePath: path },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const ex = data.extracted;
      setExtracted({
        numero_recibo: ex?.numero_recibo || `REC-${Date.now().toString().slice(-6)}`,
        monto_total: ex?.monto_total != null ? String(ex.monto_total) : String(uploadTarget.monto_pagado ?? ''),
        concepto_cobro: ex?.concepto_cobro || uploadTarget.concepto || 'Pago de aranceles',
        fecha_emision: ex?.fecha_emision || new Date().toISOString().slice(0, 10),
        ci_detectado: ex?.ci_detectado || uploadTarget.alumnos?.ci || '',
        confianza: ex?.confianza || 'MEDIA',
      });
      pushToast('success', 'Datos extraídos con éxito mediante IA.');
    } catch (error: any) {
      console.error('Error procesando con IA:', error);
      pushToast('error', error?.message || 'No se pudo procesar con IA.');
      setExtracted({
        numero_recibo: `REC-${Date.now().toString().slice(-6)}`,
        monto_total: String(uploadTarget.monto_pagado ?? ''),
        concepto_cobro: uploadTarget.concepto || 'Pago de aranceles',
        fecha_emision: new Date().toISOString().slice(0, 10),
        ci_detectado: uploadTarget.alumnos?.ci || '',
        confianza: 'BAJA',
      });
    } finally {
      setProcessingAI(false);
    }
  };


  const saveReciboToCaja = async () => {
    if (!uploadTarget || !extracted || !storagePath) return;
    try {
      setSavingRecibo(true);
      const monto = parseFloat(extracted.monto_total);
      
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const { data, error } = await supabase.functions.invoke('extraer-insertar-recibo', {
        body: {
          mode: 'confirm',
          pagoId: uploadTarget.id,
          alumnoId: uploadTarget.alumno_id,
          numeroRecibo: extracted.numero_recibo.trim(),
          montoTotal: monto,
          conceptoCobro: extracted.concepto_cobro,
          fechaEmision: extracted.fecha_emision,
          reciboUrl: storagePath,
          ocrData: extracted
        },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      pushToast('success', `Recibo ${extracted.numero_recibo} registrado en caja.`);
      closeUploadModal();
      await fetchData();
    } catch (error: any) {
      console.error('Error guardando recibo:', error);
      pushToast('error', error?.message || 'No se pudo guardar el recibo.');
    } finally {
      setSavingRecibo(false);
    }
  };


  const closeBatchModal = () => {
    setShowBatchModal(false);
    setBatchStep(1);
    setBatchFiles([]);
    setBatchResults([]);
    setLinkingRecibo(null);
    setPaymentCandidates([]);
  };


  const handleStartBatchProcess = async () => {
    if (batchFiles.length === 0) {
      pushToast('error', 'Debes seleccionar al menos una foto.');
      return;
    }
    if (batchFiles.length > 25) {
      pushToast('error', 'El límite máximo permitido es de 25 archivos por lote.');
      return;
    }
    try {
      setBatchProcessing(true);
      const sessionData = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const itemsPayload = [];
      const previewsMap: Record<string, string> = {};
      const batchFolderId = crypto.randomUUID();
      for (let i = 0; i < batchFiles.length; i++) {
        const file = batchFiles[i];
        const ext = file.name.split('.').pop() || 'jpg';
        const path = `recibos/${batchFolderId}/${Date.now()}_${i}.${ext}`;
        const previewUrl = URL.createObjectURL(file);
        previewsMap[path] = previewUrl;
        const { error: uploadError } = await supabase.storage
          .from(COMPROBANTES_BUCKET)
          .upload(path, file, { cacheControl: '3600', upsert: false });
        if (uploadError) throw uploadError;
        itemsPayload.push({
          idItem: `item_${i}`,
          storagePath: path,
          numeroSugerido: ''
        });
      }
      const { data, error } = await supabase.functions.invoke('leer_ocr_ia', {
        body: { mode: 'process_batch', items: itemsPayload },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const resultadosServer = data?.resultados || [];
      const processedList: ExtractedData[] = resultadosServer.map((res: any) => ({
        idItem: res.idItem,
        storagePath: res.storagePath,
        numero_recibo: res.extracted?.numero_recibo || '',
        monto_total: res.extracted?.monto_total != null ? String(res.extracted.monto_total) : '0',
        concepto_cobro: res.extracted?.concepto_cobro || '',
        fecha_emision: res.extracted?.fecha_emision || '',
        confianza: res.extracted?.confianza || 'MEDIA',
        preview_url: previewsMap[res.storagePath],
        ocr_data: res.extracted || {},
        error: res.error
      }));
      setBatchResults(processedList);
      setBatchStep(2);
      const totalOk = processedList.filter(r => !r.error).length;
      pushToast('success', `${totalOk} de ${processedList.length} recibos guardados en caja.`);
    } catch (error: any) {
      console.error('Error en proceso masivo:', error);
      pushToast('error', error?.message || 'Error al procesar el lote con la Edge Function.');
    } finally {
      setBatchProcessing(false);
    }
  };


  const buscarPagoDelRecibo = async (recibo: any) => {
    try {
      setSearchingPayment(true);
      setLinkingRecibo(recibo);
      setPaymentCandidates([]);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const { data, error } = await supabase.functions.invoke('buscar-vincular-pago', {
        body: { action: 'buscar', reciboId: recibo.id },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.vinculado) {
        pushToast('success', 'Pago vinculado automáticamente con alta confianza.');
        setLinkingRecibo(null);
        await fetchData();
        return;
      }
      setPaymentCandidates(data?.candidatos || []);
      if (!(data?.candidatos || []).length) {
        pushToast('error', 'No se encontraron pagos candidatos para este recibo.');
      }
    } catch (error: any) {
      console.error('Error buscando pago:', error);
      pushToast('error', error?.message || 'No se pudo buscar el pago del recibo.');
      setLinkingRecibo(null);
    } finally {
      setSearchingPayment(false);
    }
  };


  const confirmarPagoDelRecibo = async (pagoId: string) => {
    if (!linkingRecibo) return;
    try {
      setConfirmingPaymentId(pagoId);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const { data, error } = await supabase.functions.invoke('buscar-vincular-pago', {
        body: { action: 'vincular', reciboId: linkingRecibo.id, pagoId },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      pushToast('success', 'Pago vinculado correctamente al recibo.');
      setLinkingRecibo(null);
      setPaymentCandidates([]);
      await fetchData();
    } catch (error: any) {
      console.error('Error vinculando pago:', error);
      pushToast('error', error?.message || 'No se pudo confirmar el vínculo.');
    } finally {
      setConfirmingPaymentId(null);
    }
  };


  const abrirPasoTres = async () => {
    try {
      setBatchProcessing(true);
      await fetchData();
      setBatchStep(3);
    } finally {
      setBatchProcessing(false);
    }
  };


  return (
    <div className="space-y-6">
      {/* Pestañas actualizadas */}
      <div className="flex border-b border-ink-200 gap-4">
        <button
          onClick={() => setMainTab('gestion_recibos')}
          className={`pb-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition ${
            mainTab === 'gestion_recibos' ? 'border-navy-800 text-navy-900' : 'border-transparent text-ink-500 hover:text-ink-800'
          }`}
        >
          <Receipt className="h-4 w-4" /> Gestión de Recibos
        </button>
        <button
          onClick={() => setMainTab('pagos_efectivo_pendientes')}
          className={`pb-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition ${
            mainTab === 'pagos_efectivo_pendientes' ? 'border-navy-800 text-navy-900' : 'border-transparent text-ink-500 hover:text-ink-800'
          }`}
        >
          <Banknote className="h-4 w-4" /> Pagos en efectivo
        </button>
        <button
          onClick={() => setMainTab('pagos_conciliados')}
          className={`pb-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition ${
            mainTab === 'pagos_conciliados' ? 'border-navy-800 text-navy-900' : 'border-transparent text-ink-500 hover:text-ink-800'
          }`}
        >
          <Receipt className="h-4 w-4" /> Pagos Bancarios/Efectivo
        </button>
      </div>


      {/* Pestaña 1: GESTIÓN DE RECIBOS */}
      {mainTab === 'gestion_recibos' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-ink-900">Gestión de Recibos</h3>
              <p className="text-sm text-ink-500">
                Historial de recibos emitidos. Los recibos de carga masiva aparecen "Sin asociar" hasta el paso de conciliación.
              </p>
            </div>
            <button
              onClick={() => { setShowBatchModal(true); setBatchStep(1); setBatchFiles([]); setBatchResults([]); setLinkingRecibo(null); setPaymentCandidates([]); }}
              className="btn-primary flex items-center gap-2 text-xs font-semibold"
            >
              <PlusCircle className="h-4 w-4" /> Subida Masiva de Recibos (IA)
            </button>
          </div>
          <div className="card">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-head">N° Recibo</th>
                    <th className="table-head">Estudiante / CI</th>
                    <th className="table-head">Concepto Cobro</th>
                    <th className="table-head text-right">Monto</th>
                    <th className="table-head">Fecha Emisión</th>
                    <th className="table-head">Comprobante</th>
                    <th className="table-head">Comprobante de Pago</th>
                    <th className="table-head">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-ink-400 text-sm">
                        Cargando recibos de caja...
                      </td>
                    </tr>
                  ) : cajasRecibos.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-ink-400 text-sm">
                        No hay recibos registrados en `cajas_recibos`.
                      </td>
                    </tr>
                  ) : (
                    cajasRecibos.map((r) => {
                      const ocr = r.data_ocr || r.recibo_data || {};
                      const nombreOcr = ocr.nombre_alumno || ocr.alumno_nombre || ocr.nombre || ocr.estudiante || '';
                      const ciOcr = ocr.ci_detectado || ocr.ci || ocr.cedula || '';
                      const nombreEstudiante = [r.alumnos?.nombres, r.alumnos?.apellidos].filter(Boolean).join(' ') || nombreOcr || 'Sin asociar';
                      const reciboImageUrl = getReciboImageUrl(r.recibo_url);
                      // Soporta que Supabase devuelva el join como objeto o como array
                      const pagoComprobanteRaw = Array.isArray(r.alumnos_pagos)
                        ? r.alumnos_pagos[0]?.comprobante_url
                        : r.alumnos_pagos?.comprobante_url;
                      const pagoComprobanteUrl = getReciboImageUrl(pagoComprobanteRaw);
                      const asociado = !!r.alumno_id;
                      return (
                        <tr key={`caja-${r.id}`} className="hover:bg-ink-50">
                          <td className="table-cell font-mono font-bold text-navy-900">{r.numero_recibo}</td>
                          <td className="table-cell">
                            <b>{nombreEstudiante}</b>
                            <div className="text-xs text-ink-400">CI: {r.alumnos?.ci || ciOcr || 'No detectado'}</div>
                          </td>
                          <td className="table-cell text-xs">{r.concepto_cobro || '—'}</td>
                          <td className="table-cell text-right font-semibold">Bs {formatBs(r.monto_total)}</td>
                          <td className="table-cell text-xs text-ink-500">{r.fecha_emision || '—'}</td>
                          <td className="table-cell">
                            <button
                              onClick={() => reciboImageUrl && setModalImagePreview(reciboImageUrl)}
                              className="btn-secondary text-xs"
                              disabled={!reciboImageUrl}
                              title={reciboImageUrl ? 'Ver comprobante ampliado' : 'El recibo no tiene imagen'}
                            >
                              <Eye className="h-4 w-4" /> Ver Rec/Fact
                            </button>
                          </td>
                          <td className="table-cell">
                            <button
                              onClick={() => pagoComprobanteUrl && setModalImagePreview(pagoComprobanteUrl)}
                              className="btn-secondary text-xs"
                              disabled={!pagoComprobanteUrl}
                              title={pagoComprobanteUrl ? 'Ver comprobante del pago asociado' : 'Este pago no tiene comprobante'}
                            >
                              <Eye className="h-4 w-4" /> Ver Pago
                            </button>
                          </td>
                          <td className="table-cell">
                            {asociado ? (
                              <span className="badge-green flex items-center gap-1 w-max">
                                <CheckCircle2 className="h-3 w-3" /> Conciliado
                              </span>
                            ) : (
                              <span className="badge-amber flex items-center gap-1 w-max">
                                <AlertCircle className="h-3 w-3" /> Pendiente vínculo
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}


      {/* Pestaña 2: PAGOS EN EFECTIVO (PENDIENTES) */}
      {mainTab === 'pagos_efectivo_pendientes' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-bold text-ink-900">Pagos en efectivo pendientes</h3>
            <p className="text-sm text-ink-500">
              Pagos registrados en efectivo que se encuentran pendientes de conciliación y emisión de recibo.
            </p>
          </div>
          <div className="card p-4 bg-navy-50/50 border-navy-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
              <input
                className="input pl-9 bg-white"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Buscar por CI, nombre, concepto..."
              />
            </div>
          </div>
          <div className="card">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-head">Estado</th>
                    <th className="table-head">N° Transacción</th>
                    <th className="table-head">Estudiante</th>
                    <th className="table-head">Canal</th>
                    <th className="table-head">Concepto</th>
                    <th className="table-head text-right">Monto</th>
                    <th className="table-head">Fecha</th>
                    <th className="table-head text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {loading ? (
                    <tr><td colSpan={8} className="text-center py-8 text-ink-400 text-sm">Cargando...</td></tr>
                  ) : filteredPendingCashPayments.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-8 text-ink-400 text-sm">No hay pagos en efectivo pendientes.</td></tr>
                  ) : (
                    filteredPendingCashPayments.map((p) => {
                      const Icon = channelIcon(p.canal_pago || 'EFECTIVO');
                      const nombreEstudiante = [p.alumnos?.nombres, p.alumnos?.apellidos].filter(Boolean).join(' ') || 'Sin nombre';
                      return (
                        <tr key={p.id} className="hover:bg-ink-50">
                          <td className="table-cell">{statusBadge(p.estado_conciliacion)}</td>
                          <td className="table-cell font-mono text-xs font-semibold">{p.numero_transaccion || '—'}</td>
                          <td className="table-cell">
                            <b>{nombreEstudiante}</b>
                            <div className="text-xs text-ink-400">CI: {p.alumnos?.ci || 'N/A'}</div>
                          </td>
                          <td className="table-cell">
                            <span className="badge-navy"><Icon className="h-3 w-3" />{CHANNEL_LABELS[p.canal_pago as PaymentChannel] || p.canal_pago}</span>
                          </td>
                          <td className="table-cell">{p.concepto || '—'}</td>
                          <td className="table-cell text-right font-semibold">Bs {formatBs(p.monto_pagado)}</td>
                          <td className="table-cell text-xs text-ink-500">{formatDateTime(p.fecha_pago)}</td>
                          <td className="table-cell text-right">
                            <button onClick={() => openUploadModal(p)} className="btn-secondary text-xs">
                              <Receipt className="h-4 w-4" /> Subir comprobante
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}


      {/* Pestaña 3: PAGOS BANCARIOS Y EN EFECTIVO CONCILIADOS */}
      {mainTab === 'pagos_conciliados' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-bold text-ink-900">Pagos Bancarios/Efectivo : Conciliados</h3>
            <p className="text-sm text-ink-500">
              Pagos validados listos para emitir su recibo de caja de forma unitaria.
            </p>
          </div>
          <div className="card p-4 bg-navy-50/50 border-navy-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
              <input
                className="input pl-9 bg-white"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Buscar por CI, nombre, concepto o transacción..."
              />
            </div>
          </div>
          <div className="card">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-head">Estado</th>
                    <th className="table-head">N° Transacción</th>
                    <th className="table-head">Estudiante</th>
                    <th className="table-head">Canal</th>
                    <th className="table-head">Concepto</th>
                    <th className="table-head text-right">Monto</th>
                    <th className="table-head">Fecha</th>
                    <th className="table-head text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {loading ? (
                    <tr><td colSpan={8} className="text-center py-8 text-ink-400 text-sm">Cargando...</td></tr>
                  ) : filteredPayments.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-8 text-ink-400 text-sm">No hay pagos coincidentes.</td></tr>
                  ) : (
                    filteredPayments.map((p) => {
                      const Icon = channelIcon(p.canal_pago || 'QR');
                      const nombreEstudiante = [p.alumnos?.nombres, p.alumnos?.apellidos].filter(Boolean).join(' ') || 'Sin nombre';
                      return (
                        <tr key={p.id} className="hover:bg-ink-50">
                          <td className="table-cell">{statusBadge(p.estado_conciliacion)}</td>
                          <td className="table-cell font-mono text-xs font-semibold">{p.numero_transaccion || '—'}</td>
                          <td className="table-cell">
                            <b>{nombreEstudiante}</b>
                            <div className="text-xs text-ink-400">CI: {p.alumnos?.ci || 'N/A'}</div>
                          </td>
                          <td className="table-cell">
                            <span className="badge-navy"><Icon className="h-3 w-3" />{CHANNEL_LABELS[p.canal_pago as PaymentChannel] || p.canal_pago}</span>
                          </td>
                          <td className="table-cell">{p.concepto || '—'}</td>
                          <td className="table-cell text-right font-semibold">Bs {formatBs(p.monto_pagado)}</td>
                          <td className="table-cell text-xs text-ink-500">{formatDateTime(p.fecha_pago)}</td>
                          <td className="table-cell text-right">
                            <button onClick={() => openUploadModal(p)} className="btn-secondary text-xs">
                              <Receipt className="h-4 w-4" /> Subir comprobante
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}


      {/* MODAL: SUBIDA MASIVA DE 3 PASOS */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={closeBatchModal}>
          <div className="absolute inset-0 bg-navy-950/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-pop p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 border-b pb-3">
              <div>
                <h3 className="font-bold text-ink-900">Subida Masiva de Recibos (3 Pasos)</h3>
                <p className="text-xs text-ink-500">
                  {batchStep === 1 && 'Paso 1: Seleccionar fotos (máx. 25)'}
                  {batchStep === 2 && 'Paso 2: Resultado — recibos leídos y guardados en caja'}
                  {batchStep === 3 && 'Paso 3: Buscar y confirmar el pago correspondiente a cada recibo'}
                </p>
              </div>
              <button onClick={closeBatchModal} className="btn-ghost"><X className="h-5 w-5" /></button>
            </div>
            
            {batchStep === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-ink-700 mb-1">Seleccionar Fotos de Comprobantes (Lote - Máx. 25)</label>
                  <label className="block rounded-xl border-2 border-dashed border-ink-300 hover:border-navy-500 hover:bg-navy-50 p-6 text-center cursor-pointer transition">
                    <UploadCloud className="h-8 w-8 mx-auto text-navy-600" />
                    <p className="mt-2 font-semibold text-ink-800 text-sm">
                      {batchFiles.length > 0 ? `${batchFiles.length} archivos seleccionados` : 'Haz clic para seleccionar múltiples imágenes'}
                    </p>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      hidden
                      onChange={(e) => {
                        if (e.target.files) {
                          const filesArr = Array.from(e.target.files);
                          if (filesArr.length > 25) {
                            pushToast('error', 'Puedes seleccionar un máximo de 25 archivos.');
                            return;
                          }
                          setBatchFiles(filesArr);
                        }
                      }}
                    />
                  </label>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <button onClick={closeBatchModal} className="btn-secondary">Cancelar</button>
                  <button
                    onClick={() => void handleStartBatchProcess()}
                    className="btn-primary flex items-center gap-2"
                    disabled={batchProcessing}
                  >
                    {batchProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Procesar y Guardar con IA
                  </button>
                </div>
              </div>
            )}


            {batchStep === 2 && (
              <div className="space-y-4">
                <div className="rounded-lg bg-navy-50 border border-navy-200 p-3 flex items-center gap-2 text-xs text-navy-800">
                  <Sparkles className="h-4 w-4 flex-shrink-0 text-navy-600" />
                  Estos recibos ya quedaron guardados en `cajas_recibos`. La asociación con alumno se hace en un paso posterior.
                </div>
                <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
                  {batchResults.map((item, idx) => (
                    <div key={idx} className={`p-4 border rounded-2xl bg-white shadow-sm flex flex-col md:flex-row gap-4 items-center ${item.error ? 'border-red-300 bg-red-50' : ''}`}>
                      <div className="relative w-32 h-32 flex-shrink-0 bg-ink-100 rounded-xl overflow-hidden border group">
                        {item.preview_url ? (
                          <>
                            <img src={item.preview_url} alt="Comprobante" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setModalImagePreview(item.preview_url || null)}
                              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white"
                              title="Ampliar imagen"
                            >
                              <Eye className="h-6 w-6" />
                            </button>
                          </>
                        ) : (
                          <div className="flex items-center justify-center h-full text-xs text-ink-400">Sin foto</div>
                        )}
                      </div>
                      {item.error ? (
                        <div className="flex-1 text-xs text-red-700 font-medium flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 flex-shrink-0" /> Error al guardar: {item.error}
                        </div>
                      ) : (
                        <div className="flex-1 space-y-1 text-xs">
                          <div className="flex justify-between items-center font-bold text-navy-900 text-sm">
                            <span>N° Recibo: {item.numero_recibo}</span>
                            <span className="text-emerald-700">Bs {formatBs(item.monto_total)}</span>
                          </div>
                          <div><b>Concepto:</b> {item.concepto_cobro}</div>
                          <div><b>Fecha Emisión:</b> {item.fecha_emision}</div>
                          <div><b>Confianza IA:</b> <span className="badge-navy">{item.confianza}</span></div>
                          <details className="pt-2">
                            <summary className="cursor-pointer text-navy-700 font-semibold">Ver todos los datos OCR</summary>
                            <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-ink-900 p-3 text-[11px] leading-relaxed text-ink-100 whitespace-pre-wrap">{JSON.stringify(item.ocr_data || {}, null, 2)}</pre>
                          </details>
                          <div className="pt-1">
                            <span className="badge-green flex items-center gap-1 w-max">
                              <CheckCircle2 className="h-3 w-3" /> Guardado en caja
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => setBatchStep(1)} className="btn-secondary">Subir otro lote</button>
                  <button
                    onClick={() => void abrirPasoTres()}
                    className="btn-primary flex items-center gap-2"
                    disabled={batchProcessing}
                  >
                    {batchProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    Ir al Paso 3
                  </button>
                </div>
              </div>
            )}


            {batchStep === 3 && (
              <div className="space-y-4">
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex items-center gap-2 text-xs text-amber-900">
                  <Search className="h-4 w-4 flex-shrink-0 text-amber-700" />
                  Selecciona <b>Buscar pagos</b> para vincularlos con el recibo.
                </div>
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {batchResults.filter((item) => !item.error).map((item, idx) => {
                    const reciboGuardado = cajasRecibos.find((recibo) => String(recibo.numero_recibo) === String(item.numero_recibo));
                    const yaVinculado = !!reciboGuardado?.pago_id;
                    return (
                      <div key={idx} className="p-4 border rounded-2xl bg-white shadow-sm flex flex-col md:flex-row gap-4 items-center">
                        <div className="w-20 h-20 flex-shrink-0 bg-ink-100 rounded-xl overflow-hidden border">
                          {item.preview_url ? <img src={item.preview_url} alt={`Recibo ${item.numero_recibo}`} className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full text-xs text-ink-400">Sin foto</div>}
                        </div>
                        <div className="flex-1 text-xs space-y-1">
                          <b className="text-sm text-navy-900">N° Recibo: {item.numero_recibo}</b>
                          <div>Bs {formatBs(item.monto_total)} · {item.fecha_emision}</div>
                          <div>{item.concepto_cobro || 'Sin concepto OCR'}</div>
                        </div>
                        {yaVinculado ? (
                          <span className="badge-green"><CheckCircle2 className="h-3 w-3" /> Vinculado</span>
                        ) : (
                          <button
                            className="btn-primary text-xs"
                            disabled={!reciboGuardado || searchingPayment}
                            onClick={() => reciboGuardado && void buscarPagoDelRecibo(reciboGuardado)}
                          >
                            {searchingPayment && linkingRecibo?.id === reciboGuardado?.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                            Buscar pagos
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                {linkingRecibo && !searchingPayment && (
                  <div className="border border-navy-200 bg-navy-50 rounded-xl p-4 space-y-3">
                    <div>
                      <b className="text-sm text-navy-900">Candidatos para el recibo {linkingRecibo.numero_recibo}</b>
                      <p className="text-xs text-ink-600">Confirma únicamente el pago correspondiente.</p>
                    </div>
                    {paymentCandidates.length === 0 ? (
                      <p className="text-sm text-ink-500">No hay coincidencias suficientes.</p>
                    ) : paymentCandidates.map((pago) => (
                      <div key={pago.id} className="bg-white border border-ink-200 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="text-xs">
                          <b className="text-sm">{pago.alumnos?.nombres} {pago.alumnos?.apellidos}</b>
                          <div>CI: {pago.alumnos?.ci || '—'} · Bs {formatBs(pago.monto_pagado)} · {formatDateTime(pago.fecha_pago)}</div>
                          <div className="text-navy-700">Coincidencias: {pago.reasons?.join(', ') || 'similitud detectada'} ({pago.score} pts)</div>
                        </div>
                        <button className="btn-success text-xs" disabled={confirmingPaymentId === pago.id} onClick={() => void confirmarPagoDelRecibo(pago.id)}>
                          {confirmingPaymentId === pago.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                          Vincular pago
                        </button>
                      </div>
                    ))}
                    <button className="btn-secondary text-xs" onClick={() => { setLinkingRecibo(null); setPaymentCandidates([]); }}>Cancelar</button>
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => setBatchStep(2)} className="btn-secondary">Volver al Paso 2</button>
                  <button onClick={() => { closeBatchModal(); void fetchData(); }} className="btn-success flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" /> Finalizar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}


      {/* Modal para ampliar imagen */}
      {modalImagePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setModalImagePreview(null)}>
          <div className="relative max-w-4xl max-h-[90vh] bg-white p-2 rounded-xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setModalImagePreview(null)}
              className="absolute top-4 right-4 z-10 bg-black/60 text-white p-2 rounded-full hover:bg-black"
            >
              <X className="h-5 w-5" />
            </button>
            <img src={modalImagePreview} alt="Comprobante Ampliado" className="max-w-full max-h-[85vh] object-contain rounded-lg mx-auto" />
          </div>
        </div>
      )}


      {/* Modal Unitario */}
      {uploadTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={closeUploadModal}>
          <div className="absolute inset-0 bg-navy-950/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-pop p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-ink-900">Emitir recibo de caja</h3>
                <p className="text-xs text-ink-500">
                  {[uploadTarget.alumnos?.nombres, uploadTarget.alumnos?.apellidos].filter(Boolean).join(' ')}
                </p>
              </div>
              <button onClick={closeUploadModal} className="btn-ghost"><X className="h-5 w-5" /></button>
            </div>
            {!photoPreview && (
              <div className="space-y-3">
                <label className="block rounded-xl border-2 border-dashed border-ink-300 hover:border-navy-500 hover:bg-navy-50 p-6 text-center cursor-pointer transition">
                  <Camera className="h-8 w-8 mx-auto text-navy-600" />
                  <p className="mt-2 font-semibold text-ink-800 text-sm">Subir comprobante</p>
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => { const file = e.target.files?.[0]; if (file) handlePhotoSelected(file); }}
                  />
                </label>
              </div>
            )}
            {photoPreview && !extracted && (
              <div className="space-y-4">
                <img src={photoPreview} alt="Comprobante" className="w-full max-h-72 object-contain rounded-xl border border-ink-200 bg-ink-50" />
                <div className="flex gap-2">
                  <button onClick={() => { setPhotoFile(null); setPhotoPreview(''); setStoragePath(''); }} className="btn-secondary flex-1" disabled={processingAI}>
                    Cambiar
                  </button>
                  <button onClick={() => void processWithAI()} className="btn-primary flex-1" disabled={processingAI}>
                    {processingAI ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Analizar con IA
                  </button>
                </div>
              </div>
            )}
            {extracted && (
              <div className="space-y-4">
                <img src={photoPreview} alt="Comprobante" className="w-full max-h-40 object-contain rounded-xl border border-ink-200 bg-ink-50" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs font-semibold text-ink-600">Número de recibo</label>
                    <input className="input mt-1" value={extracted.numero_recibo} onChange={(e) => setExtracted({ ...extracted, numero_recibo: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-ink-600">Monto (Bs)</label>
                    <input type="number" step="0.01" className="input mt-1" value={extracted.monto_total} onChange={(e) => setExtracted({ ...extracted, monto_total: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-ink-600">Fecha</label>
                    <input type="date" className="input mt-1" value={extracted.fecha_emision} onChange={(e) => setExtracted({ ...extracted, fecha_emision: e.target.value })} />
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setExtracted(null)} className="btn-secondary flex-1" disabled={savingRecibo}>Volver</button>
                  <button onClick={() => void saveReciboToCaja()} className="btn-success flex-1" disabled={savingRecibo}>
                    {savingRecibo ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                    Guardar en Caja
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}