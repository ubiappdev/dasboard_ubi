import { useEffect, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Smartphone, CheckCircle2, Loader2, Image as ImageIcon, RefreshCw } from 'lucide-react';
import Modal from './Modal';

interface RemoteScanModalProps {
  open: boolean;
  onClose: () => void;
  onCapture: (imageDataUrl: string) => void;
  title?: string;
}

const SAMPLE_IMAGES = [
  'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="260" viewBox="0 0 400 260"><rect width="400" height="260" fill="#f8fafc"/><rect x="20" y="20" width="360" height="220" fill="white" stroke="#cbd5e1" stroke-width="2" rx="8"/><text x="200" y="50" text-anchor="middle" font-family="monospace" font-size="14" font-weight="bold" fill="#1e293b">BANCO GANADERO</text><text x="200" y="80" text-anchor="middle" font-family="monospace" font-size="12" fill="#64748b">COMPROBANTE DE DEPÓSITO</text><line x1="40" y1="100" x2="360" y2="100" stroke="#e2e8f0"/><text x="40" y="125" font-family="monospace" font-size="11" fill="#475569">N° VCH-847291</text><text x="40" y="145" font-family="monospace" font-size="11" fill="#475569">Fecha: 02/08/2026 14:32</text><text x="40" y="165" font-family="monospace" font-size="11" fill="#475569">Titular: Carlos Mamani</text><text x="40" y="185" font-family="monospace" font-size="11" fill="#475569">Concepto: Mensualidad Ago</text><text x="40" y="215" font-family="monospace" font-size="14" font-weight="bold" fill="#059669">Bs 450.00</text><rect x="280" y="195" width="80" height="30" fill="#1b325c" rx="4"/><text x="320" y="214" text-anchor="middle" font-family="monospace" font-size="9" fill="white">VERIFICADO</text></svg>`
  ),
  'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="260" viewBox="0 0 400 260"><rect width="400" height="260" fill="#fefce8"/><rect x="20" y="20" width="360" height="220" fill="white" stroke="#cbd5e1" stroke-width="2" rx="8"/><text x="200" y="50" text-anchor="middle" font-family="monospace" font-size="14" font-weight="bold" fill="#1e293b">RECIBO DE CAJA</text><text x="200" y="80" text-anchor="middle" font-family="monospace" font-size="12" fill="#64748b">UNIVERSIDAD — VENTANILLA</text><line x1="40" y1="100" x2="360" y2="100" stroke="#e2e8f0"/><text x="40" y="125" font-family="monospace" font-size="11" fill="#475569">N° REC-34821</text><text x="40" y="145" font-family="monospace" font-size="11" fill="#475569">Fecha: 02/08/2026 09:15</text><text x="40" y="165" font-family="monospace" font-size="11" fill="#475569">Estudiante: Ana Quispe</text><text x="40" y="185" font-family="monospace" font-size="11" fill="#475569">Concepto: Certificado</text><text x="40" y="215" font-family="monospace" font-size="14" font-weight="bold" fill="#b45309">Bs 120.00</text><rect x="280" y="195" width="80" height="30" fill="#b45309" rx="4"/><text x="320" y="214" text-anchor="middle" font-family="monospace" font-size="9" fill="white">CAJA</text></svg>`
  ),
];

export default function RemoteScanModal({ open, onClose, onCapture, title = 'Escanear con Celular' }: RemoteScanModalProps) {
  const [pairingCode, setPairingCode] = useState('');
  const [phase, setPhase] = useState<'pairing' | 'waiting' | 'received'>('pairing');
  const [receivedImage, setReceivedImage] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPairingCode(generatePairingCode());
      setPhase('pairing');
      setReceivedImage(null);
    }
  }, [open]);

  function generatePairingCode() {
    return `UC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  }

  function handleSimulate() {
    setPhase('waiting');
    setTimeout(() => {
      const img = SAMPLE_IMAGES[Math.floor(Math.random() * SAMPLE_IMAGES.length)];
      setReceivedImage(img);
      setPhase('received');
    }, 1800);
  }

  function handleConfirm() {
    if (receivedImage) {
      onCapture(receivedImage);
      onClose();
    }
  }

  function regenerate() {
    setPairingCode(generatePairingCode());
    setPhase('pairing');
    setReceivedImage(null);
  }

  return (
    <Modal open={open} onClose={onClose} title={title} subtitle="Empareja tu celular escaneando el código QR" icon={<Smartphone className="h-5 w-5" />} size="md">
      <div className="flex flex-col items-center">
        {phase === 'pairing' && (
          <>
            <div className="relative rounded-2xl bg-white p-5 ring-2 ring-navy-200 animate-qr-pulse">
              <QRCodeCanvas
                value={pairingCode}
                size={200}
                level="M"
                fgColor="#142546"
                bgColor="#ffffff"
                includeMargin={false}
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-md">
                  <Smartphone className="h-6 w-6 text-navy-700" />
                </div>
              </div>
            </div>
            <p className="mt-4 text-sm font-mono font-semibold text-navy-700 tracking-wider">{pairingCode}</p>
            <p className="mt-1 text-xs text-ink-500 text-center max-w-xs">
              Abre la app UniControl en tu celular, ve a "Escanear" y apunta al código QR de esta pantalla.
            </p>
            <div className="mt-5 flex w-full gap-2">
              <button onClick={regenerate} className="btn-secondary flex-1">
                <RefreshCw className="h-4 w-4" /> Regenerar código
              </button>
              <button onClick={handleSimulate} className="btn-primary flex-1">
                <Smartphone className="h-4 w-4" /> Simular captura desde móvil
              </button>
            </div>
          </>
        )}

        {phase === 'waiting' && (
          <div className="flex flex-col items-center py-12">
            <Loader2 className="h-12 w-12 text-navy-600 animate-spin" />
            <p className="mt-4 text-sm font-semibold text-ink-700">Esperando captura del móvil…</p>
            <p className="mt-1 text-xs text-ink-500">Emparejando con el código {pairingCode}</p>
          </div>
        )}

        {phase === 'received' && receivedImage && (
          <div className="w-full flex flex-col items-center animate-scale-in">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <p className="text-sm font-semibold text-emerald-700">¡Captura recibida desde el móvil!</p>
            </div>
            <div className="w-full rounded-xl border-2 border-ink-200 overflow-hidden bg-ink-50">
              <img src={receivedImage} alt="Comprobante capturado" className="w-full h-auto" />
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-ink-500">
              <ImageIcon className="h-3.5 w-3.5" />
              <span>comprobante_movil_{Date.now().toString().slice(-6)}.jpg</span>
            </div>
            <div className="mt-5 flex w-full gap-2">
              <button onClick={regenerate} className="btn-secondary flex-1">Descartar y reintentar</button>
              <button onClick={handleConfirm} className="btn-success flex-1">
                <CheckCircle2 className="h-4 w-4" /> Adjuntar al formulario
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
