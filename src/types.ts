import { useEffect, useState } from 'react';
import { Search, Landmark, QrCode, Banknote, ArrowRightLeft, Eye, X } from 'lucide-react';
import type { ToastPush, PaymentChannel } from '@/types';
import { formatBs, formatDateTime } from '@/lib/format';
import { supabase } from '@/lib/supabase';

interface WindowViewProps {
  pushToast: ToastPush;
}

type ChannelTab = PaymentChannel | 'all';

const CHANNEL_LABELS: Record<PaymentChannel, string> = { 
  QR: 'QR', 
  DEPOSITO: 'Depósito', 
  EFECTIVO: 'Efectivo', 
  TRANSFERENCIA: 'Transferencia' 
};

const COMPROBANTES_BUCKET = 'comprobantes';

interface Alumno {
  id: string;
  nombres: string;
  apellidos: string;
  ci: string;
}

interface PagoAlumno {
  id: string;
  alumno_id: string;
  monto_pagado: number;
  canal_pago: PaymentChannel;
  numero_transaccion: string | null;
  fecha_pago: string;
  comprobante_url: string | null;
  estado_conciliacion: string;
  observacion: string | null;
  concepto: string | null;
  created_at: string;
  alumnos: Alumno | null;
}

export default function WindowView({ pushToast }: WindowViewProps) {
  const [payments, setPayments] = useState<PagoAlumno[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalSearch, setGlobalSearch] = useState('');
  const [activeTab, setActiveTab] = useState<ChannelTab>('all');

  // Estado para el visor de imágenes (Lightbox)
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => {
    fetchAlumnosPagosWithStudents();
  }, []);

  const fetchAlumnosPagosWithStudents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('alumnos_pagos')
        .select(`
          id,
          alumno_id,
          monto_pagado,
          canal_pago,
          numero_transaccion,
          fecha_pago,
          comprobante_url,
          estado_conciliacion,
          observacion,
          concepto,
          created_at,
          alumnos!alumnos_pagos_alumno_id_fkey (
            id,
            nombres,
            apellidos,
            ci
          )
        `)
        .order('fecha_pago', { ascending: false });

      if (error) throw error;
      setPayments((data as PagoAlumno[]) || []);
    } catch (error: any) {
      console.error('Error al cargar alumnos_pagos con alumnos:', error);
      pushToast('error', 'No se pudieron cargar los registros de pagos.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Resolución idéntica a la que usas en ventanilla caja para asegurar que la imagen renderice siempre.
   */
  const getPublicUrl = (pathOrUrl: string | null | undefined): string => {
    if (!pathOrUrl || typeof pathOrUrl !== 'string') return '';
    const trimmed = pathOrUrl.trim();
    if (!trimmed) return '';

    // Si ya viene como URL completa (http / https)
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }

    // Limpieza de prefijos comunes de bucket si los tuviera guardados en la BD
    let cleanPath = trimmed;
    if (cleanPath.startsWith(`${COMPROBANTES_BUCKET}/`)) {
      cleanPath = cleanPath.replace(`${COMPROBANTES_BUCKET}/`, '');
    } else if (cleanPath.startsWith('/')) {
      cleanPath = cleanPath.substring(1);
    }

    const { data } = supabase.storage.from(COMPROBANTES_BUCKET).getPublicUrl(cleanPath);
    return data?.publicUrl || '';
  };

  const filteredPayments = payments.filter((p) => {
    const q = globalSearch.toLowerCase();
    const matchesChannel = activeTab === 'all' || p.canal_pago === activeTab;
    const nombreEstudiante = p.alumnos ? `${p.alumnos.nombres} ${p.alumnos.apellidos}`.toLowerCase() : '';
    const ciEstudiante = p.alumnos?.ci ? String(p.alumnos.ci).toLowerCase() : '';

    const matchesSearch = !q || (
      String(p.numero_transaccion || '').toLowerCase().includes(q) ||
      String(p.concepto || '').toLowerCase().includes(q) ||
      nombreEstudiante.includes(q) ||
      ciEstudiante.includes(q)
    );
    return matchesChannel && matchesSearch;
  });

  const channelIcon = (channel: string) => 
    channel === 'QR' ? QrCode : 
    channel === 'EFECTIVO' ? Banknote : 
    channel === 'TRANSFERENCIA' ? ArrowRightLeft : Landmark;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-ink-900">Pagos de Alumnos</h3>
        <p className="text-sm text-ink-500">
          Listado general de la tabla alumnos_pagos vinculado con información de alumnos.
          {!loading && <span className="ml-1 font-semibold text-ink-700">({filteredPayments.length} de {payments.length})</span>}
        </p>
      </div>

      <div className="card p-4 bg-navy-50/50 border-navy-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
          <input
            className="input pl-9 bg-white"
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            placeholder="Buscar por CI, nombre de alumno, concepto o número de transacción..."
          />
        </div>
      </div>

      <div className="flex gap-1 p-3 border-b border-ink-100 overflow-x-auto">
        {(['all', 'QR', 'DEPOSITO', 'EFECTIVO', 'TRANSFERENCIA'] as ChannelTab[]).map((tab) => (
          <button 
            key={tab} 
            onClick={() => setActiveTab(tab)} 
            className={`btn ${activeTab === tab ? 'bg-navy-800 text-white' : 'text-ink-500 hover:bg-ink-100'}`}
          >
            {tab === 'all' ? <Landmark className="h-4 w-4" /> : (() => { const Icon = channelIcon(tab); return <Icon className="h-4 w-4" />; })()}
            {tab === 'all' ? 'Todos' : CHANNEL_LABELS[tab as PaymentChannel]}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-head">Estado Conciliación</th>
                <th className="table-head">N° Transacción</th>
                <th className="table-head">Estudiante</th>
                <th className="table-head">Canal</th>
                <th className="table-head">Concepto</th>
                <th className="table-head text-right">Monto</th>
                <th className="table-head">Fecha de pago</th>
                <th className="table-head text-center">Comprobante (Alumnos Pagos)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {loading ? (
                <tr><td colSpan={8} className="text-center py-8 text-ink-400 text-sm">Cargando pagos de alumnos...</td></tr>
              ) : filteredPayments.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-ink-400 text-sm">No se encontraron registros de pagos.</td></tr>
              ) : (
                filteredPayments.map((p) => {
                  const Icon = channelIcon(p.canal_pago || 'QR');
                  const nombreEstudiante = p.alumnos ? `${p.alumnos.nombres} ${p.alumnos.apellidos}` : 'Sin alumno asignado';
                  const ciEstudiante = p.alumnos?.ci || 'N/A';
                  const comprobanteUrl = getPublicUrl(p.comprobante_url);

                  return (
                    <tr key={p.id} className="hover:bg-ink-50">
                      <td className="table-cell">
                        <span className={`badge ${p.estado_conciliacion === 'CONCILIADO' ? 'badge-green' : 'badge-amber'}`}>
                          {p.estado_conciliacion || 'PENDIENTE'}
                        </span>
                      </td>
                      <td className="table-cell font-mono text-xs font-semibold">{p.numero_transaccion || '—'}</td>
                      <td className="table-cell">
                        <b>{nombreEstudiante}</b>
                        <div className="text-xs text-ink-400">CI: {ciEstudiante}</div>
                      </td>
                      <td className="table-cell">
                        <span className="badge-navy">
                          <Icon className="h-3 w-3" />
                          {CHANNEL_LABELS[p.canal_pago as PaymentChannel] || p.canal_pago}
                        </span>
                      </td>
                      <td className="table-cell">{p.concepto || '—'}</td>
                      <td className="table-cell text-right font-semibold">Bs {formatBs(p.monto_pagado)}</td>
                      <td className="table-cell text-xs text-ink-500">{formatDateTime(p.fecha_pago)}</td>
                      
                      <td className="table-cell text-center">
                        {comprobanteUrl ? (
                          <div 
                            onClick={() => setPreviewImage({ url: comprobanteUrl, title: `Comprobante de Alumno - ${p.concepto || nombreEstudiante}` })}
                            className="relative group w-10 h-10 mx-auto rounded-lg overflow-hidden border border-ink-200 cursor-pointer bg-ink-50 hover:border-navy-500 transition shadow-sm flex items-center justify-center"
                            title="Ver comprobante de alumnos_pagos"
                          >
                            <img 
                              src={comprobanteUrl} 
                              alt="Comprobante" 
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                // Si la miniatura falla al cargar directamente, mostramos un botón indicador claro
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
                          <span className="text-ink-400 text-xs">— Sin archivo —</span>
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

      {/* Visor Lightbox para la imagen del comprobante */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/75 backdrop-blur-md" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl p-4 shadow-2xl flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-full flex items-center justify-between mb-3 pb-2 border-b border-ink-100">
              <h4 className="font-bold text-ink-900 text-sm truncate">{previewImage.title}</h4>
              <button onClick={() => setPreviewImage(null)} className="btn-ghost p-1"><X className="h-5 w-5" /></button>
            </div>
            <div className="overflow-auto max-h-[75vh] w-full flex items-center justify-center bg-ink-50 rounded-xl p-2 border border-ink-200 min-h-[300px]">
              <img 
                src={previewImage.url} 
                alt="Vista ampliada" 
                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-sm"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const parent = e.currentTarget.parentElement;
                  if (parent && !parent.querySelector('.error-msg')) {
                    const errDiv = document.createElement('div');
                    errDiv.className = 'error-msg flex flex-col items-center justify-center text-ink-400 gap-2 p-8';
                    errDiv.innerHTML = '<svg class="w-12 h-12 text-ink-300" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg><span class="text-sm font-medium">No se pudo cargar la imagen del comprobante.</span>';
                    parent.appendChild(errDiv);
                  }
                }}
              />
            </div>
            <div className="mt-3 flex justify-end w-full gap-2">
              <a 
                href={previewImage.url} 
                target="_blank" 
                rel="noreferrer" 
                className="btn-secondary text-xs"
              >
                Abrir en pestaña nueva
              </a>
              <button onClick={() => setPreviewImage(null)} className="btn-primary text-xs">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}