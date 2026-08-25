import { supabase } from '@/lib/supabase';
import type { FeeItem, ScholarshipType, Student, Transaction, PaymentChannel, ReconStatus, Mensualidad, BankStatement } from '@/types';

interface AlumnoRow {
  id: string;
  perfil_id: string | null;
  ci: string;
  nombres: string;
  apellidos: string;
  correo_electronico: string | null;
  telefono: string | null;
  estado_financiero: string | null;
  estado: string | null;
  becado: boolean;
  carrera_id: string | null;
  curso_id: string | null;
  turno_id: string | null;
  tipo_beca_id: number | null;
}

interface PagoRow {
  id: string;
  alumno_id: string;
  monto_pagado: string;
  canal_pago: string;
  numero_transaccion: string | null;
  fecha_pago: string;
  comprobante_url: string | null;
  estado_conciliacion: string;
  concepto: string | null;
  observacion: string | null;
  ocr_data: Record<string, string | number | boolean> | null;
  alumno: { nombres: string; apellidos: string; ci: string } | null;
}

interface ArancelRow {
  id: string;
  codigo: string;
  concepto: string;
  categoria: string;
  monto: string;
  activo: boolean;
}

interface BecaRow {
  id: number;
  nombre: string;
  porcentaje_descuento: string;
  descripcion: string | null;
  activo: boolean;
}

interface MensualidadRow {
  id: string;
  alumno_id: string;
  gestion_anio: number;
  nro_cuota: number;
  mes_referencia: string;
  monto_original: string;
  monto_con_descuento: string;
  estado: string;
  fecha_vencimiento: string;
}

interface ExtractoRow {
  id: string;
  fecha_transaccion: string;
  numero_transaccion: string;
  monto: string;
  concepto_banco: string | null;
  estado_cruce: string;
  alumno_id: string | null;
}

const asStudent = (row: AlumnoRow): Student => ({
  id: row.id,
  ci: row.ci,
  nombres: row.nombres,
  apellidos: row.apellidos,
  correo: row.correo_electronico ?? '',
  telefono: row.telefono ?? '',
  carrera: row.carrera_id ?? 'Sin carrera',
  curso: row.curso_id ?? '—',
  turno: row.turno_id ?? '—',
  estadoFinanciero: row.estado_financiero ?? 'AL DIA',
  estado: row.estado ?? 'ACTIVO',
  becado: row.becado,
  tipoBecaId: row.tipo_beca_id ?? undefined,
  perfilId: row.perfil_id ?? undefined,
});

const asFee = (row: ArancelRow): FeeItem => ({
  id: row.id,
  codigo: row.codigo,
  concepto: row.concepto,
  categoria: row.categoria,
  monto: Number(row.monto),
  activo: row.activo,
});

const asScholarship = (row: BecaRow): ScholarshipType => ({
  id: row.id,
  nombre: row.nombre,
  porcentaje: Number(row.porcentaje_descuento),
  descripcion: row.descripcion ?? undefined,
  activo: row.activo,
});

const asMensualidad = (row: MensualidadRow): Mensualidad => ({
  id: row.id,
  alumnoId: row.alumno_id,
  gestionAnio: row.gestion_anio,
  nroCuota: row.nro_cuota,
  mesReferencia: row.mes_referencia,
  montoOriginal: Number(row.monto_original),
  montoConDescuento: Number(row.monto_con_descuento),
  estado: row.estado,
  fechaVencimiento: row.fecha_vencimiento,
});

const asTransaction = (row: PagoRow): Transaction => ({
  id: row.id,
  fecha: row.fecha_pago,
  alumnoId: row.alumno_id,
  estudiante: row.alumno ? `${row.alumno.nombres} ${row.alumno.apellidos}` : 'Estudiante no disponible',
  ci: row.alumno?.ci ?? '—',
  concepto: row.concepto ?? 'Sin concepto',
  monto: Number(row.monto_pagado),
  canal: row.canal_pago as PaymentChannel,
  estado: row.estado_conciliacion as ReconStatus,
  numeroTransaccion: row.numero_transaccion ?? '—',
  comprobanteUrl: row.comprobante_url ?? undefined,
  observacion: row.observacion ?? undefined,
  ocrData: row.ocr_data ?? undefined,
});

const asStatement = (row: ExtractoRow): BankStatement => ({
  id: row.id,
  fechaTransaccion: row.fecha_transaccion,
  numeroTransaccion: row.numero_transaccion,
  monto: Number(row.monto),
  conceptoBanco: row.concepto_banco ?? undefined,
  estadoCruce: row.estado_cruce,
  alumnoId: row.alumno_id ?? undefined,
});

export async function loadStudents(): Promise<Student[]> {
  const { data, error } = await supabase.from('alumnos').select('*').order('apellidos');
  if (error) throw error;
  return (data as AlumnoRow[]).map(asStudent);
}

export async function loadFees(): Promise<FeeItem[]> {
  const { data, error } = await supabase.from('aranceles_conceptos').select('*').eq('activo', true).order('categoria').order('concepto');
  if (error) throw error;
  return (data as ArancelRow[]).map(asFee);
}

export async function loadScholarships(): Promise<ScholarshipType[]> {
  const { data, error } = await supabase.from('tipos_beca').select('*').eq('activo', true).order('porcentaje_descuento', { ascending: false });
  if (error) throw error;
  return (data as BecaRow[]).map(asScholarship);
}

export async function loadPayments(): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('alumnos_pagos')
    .select('id, alumno_id, monto_pagado, canal_pago, numero_transaccion, fecha_pago, comprobante_url, estado_conciliacion, concepto, observacion, ocr_data, alumno:alumnos(nombres, apellidos, ci)')
    .order('fecha_pago', { ascending: false });
  if (error) throw error;
  return (data as unknown as PagoRow[]).map(asTransaction);
}

export async function loadMensualidades(): Promise<Mensualidad[]> {
  const { data, error } = await supabase.from('alumnos_mensualidades').select('*').order('gestion_anio', { ascending: false }).order('nro_cuota');
  if (error) throw error;
  return (data as MensualidadRow[]).map(asMensualidad);
}

export async function loadStatements(): Promise<BankStatement[]> {
  const { data, error } = await supabase.from('extractos_bancarios').select('*').order('fecha_transaccion', { ascending: false });
  if (error) throw error;
  return (data as ExtractoRow[]).map(asStatement);
}

export async function updatePaymentStatus(id: string, estado: ReconStatus): Promise<void> {
  const { error } = await supabase.from('alumnos_pagos').update({ estado_conciliacion: estado }).eq('id', id);
  if (error) throw error;
}

export async function createPayment(input: {
  studentId: string;
  concepto: string;
  monto: number;
  canal: PaymentChannel;
  numeroTransaccion: string;
  comprobanteUrl?: string;
  ocrData?: Record<string, string | number | boolean>;
}): Promise<void> {
  const { error } = await supabase.from('alumnos_pagos').insert({
    alumno_id: input.studentId,
    concepto: input.concepto,
    monto_pagado: input.monto,
    canal_pago: input.canal,
    numero_transaccion: input.numeroTransaccion,
    comprobante_url: input.comprobanteUrl ?? null,
    ocr_data: input.ocrData ?? null,
    estado_conciliacion: 'PENDIENTE',
  });
  if (error) throw error;
}

export async function createStatement(fileName: string, bankName: string): Promise<string> {
  const { data, error } = await supabase.from('extractos_bancarios').insert({
    fecha_transaccion: new Date().toISOString(),
    numero_transaccion: fileName,
    monto: 0,
    concepto_banco: bankName,
    estado_cruce: 'NO_CONCILIADO',
  }).select('id').single();
  if (error) throw error;
  return data.id as string;
}
