export type ModuleId = 'dashboard' | 'reconciliation' | 'window' | 'students' | 'fees';

export type PaymentChannel = 'QR' | 'DEPOSITO' | 'EFECTIVO' | 'TRANSFERENCIA';
export type ReconStatus = 'PENDIENTE' | 'CONCILIADO' | 'REVISION' | 'RECHAZADO';

export interface ScholarshipType {
  id: number;
  nombre: string;
  porcentaje: number;
  descripcion?: string;
  activo: boolean;
}

export interface Student {
  id: string;
  ci: string;
  nombres: string;
  apellidos: string;
  correo: string;
  telefono: string;
  carrera: string;
  curso: string;
  turno: string;
  estadoFinanciero: string;
  estado: string;
  becado: boolean;
  tipoBecaId?: number;
  perfilId?: string;
}

export interface Mensualidad {
  id: string;
  alumnoId: string;
  gestionAnio: number;
  nroCuota: number;
  mesReferencia: string;
  montoOriginal: number;
  montoConDescuento: number;
  estado: string;
  fechaVencimiento: string;
}

export interface Transaction {
  id: string;
  fecha: string;
  alumnoId: string;
  estudiante: string;
  ci: string;
  concepto: string;
  monto: number;
  canal: PaymentChannel;
  estado: ReconStatus;
  numeroTransaccion: string;
  comprobanteUrl?: string;
  observacion?: string;
  ocrData?: Record<string, string | number | boolean>;
}

export interface FeeItem {
  id: string;
  codigo: string;
  concepto: string;
  categoria: string;
  monto: number;
  activo: boolean;
}

export interface BankStatement {
  id: string;
  fechaTransaccion: string;
  numeroTransaccion: string;
  monto: number;
  conceptoBanco?: string;
  estadoCruce: string;
  alumnoId?: string;
}

export interface WeeklyCollection {
  semana: string;
  Mensualidad: number;
  Matricula: number;
  Certificados: number;
  Tramites: number;
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}
export type ToastPush = (type: Toast['type'], message: string) => void;
