import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ShieldCheck,
  CreditCard,
  Smartphone,
  Building2,
  Loader2,
  CheckCircle2,
  XCircle,
  Lock,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Pedido } from '../types';
import { generarFirmaIntegridadWompi, usePedidosStore } from '../hooks/usePedidos';
import { formatCurrency } from '../utils/currency';

interface WompiCheckoutModalProps {
  pedido: Pedido | null;
  onClose: () => void;
  onSuccess: () => void;
}

type MedioPagoWompi = 'nequi' | 'pse' | 'card';

export default function WompiCheckoutModal({ pedido, onClose, onSuccess }: WompiCheckoutModalProps) {
  const cambiarEstadoPedido = usePedidosStore((s) => s.cambiarEstadoPedido);

  const [medio, setMedio] = useState<MedioPagoWompi>('nequi');
  const [firmaSha256, setFirmaSha256] = useState<string>('');
  const [procesando, setProcesando] = useState(false);

  // Campos simulador Sandbox
  const [celularNequi, setCelularNequi] = useState('3001234567');
  const [bancoPse, setBancoPse] = useState('Bancolombia');
  const [numTarjeta, setNumTarjeta] = useState('4242 •••• •••• 4242');

  const montoEnCentavos = pedido ? Math.round(pedido.total * 100) : 0;
  const publicKey = import.meta.env.VITE_WOMPI_PUBLIC_KEY || 'pub_test_NexusCoreSandboxCol';

  useEffect(() => {
    if (!pedido) return;
    let active = true;
    generarFirmaIntegridadWompi(pedido.id, Math.round(pedido.total * 100), 'COP')
      .then((hash) => {
        if (active) setFirmaSha256(hash);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [pedido]);

  if (!pedido) return null;

  const simularResultadoTransaccion = async (resultado: 'APPROVED' | 'DECLINED') => {
    setProcesando(true);
    try {
      await new Promise((r) => setTimeout(r, 900));
      const wompiTxId = `wompi_sandbox_${medio}_${Date.now()}`;

      if (resultado === 'APPROVED') {
        await cambiarEstadoPedido(pedido.id, 'pagado', wompiTxId);
        toast.success('¡Pago APROBADO en Wompi Sandbox!', {
          description: `Referencia: ${wompiTxId} · Tu pedido ha quedado confirmado.`,
        });
        onSuccess();
      } else {
        await cambiarEstadoPedido(pedido.id, 'cancelado', wompiTxId);
        toast.error('Transacción RECHAZADA en Wompi Sandbox', {
          description: 'El pedido pasó a Cancelado y el stock reservado fue devuelto automáticamente al inventario.',
        });
        onClose();
      }
    } catch (err) {
      toast.error('Error al procesar respuesta de pasarela', {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setProcesando(false);
    }
  };

  const abrirWompiWebCheckout = () => {
    const params = new URLSearchParams({
      'public-key': publicKey,
      currency: 'COP',
      'amount-in-cents': String(montoEnCentavos),
      reference: pedido.id,
      'signature:integrity': firmaSha256,
      'redirect-url': window.location.origin,
    });
    window.open(`https://checkout.wompi.co/p/?${params.toString()}`, '_blank', 'noopener,noreferrer');
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-backdrop-in"
      onClick={() => !procesando && onClose()}
      data-lenis-prevent="true"
    >
      <div
        className="w-full max-w-lg bg-themeBg rounded-3xl border border-themeBorder/80 shadow-2xl overflow-hidden flex flex-col animate-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* CABECERA WOMPI SANDBOX */}
        <div className="px-5 py-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
              <ShieldCheck size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black uppercase tracking-wider">Wompi Checkout</h3>
                <span className="text-[9px] font-black uppercase tracking-widest bg-black/30 px-2 py-0.5 rounded-full">
                  Modo Sandbox
                </span>
              </div>
              <p className="text-[10px] text-white/80 font-medium">
                Pedido #{pedido.id.slice(0, 8)} · Stock reservado temporalmente
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={procesando}
            className="w-8 h-8 rounded-xl bg-black/20 hover:bg-black/40 flex items-center justify-center transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* CUERPO DE LA PASARELA */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[80dvh] custom-scrollbar">
          {/* Resumen de Monto y Firma SHA-256 */}
          <div className="p-3.5 rounded-2xl bg-themeCard border border-themeBorder/60 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-themeTextMuted block">
                Total a pagar (COP)
              </span>
              <span className="text-xl font-black text-themeAccent">
                {formatCurrency(pedido.total, 'COP')}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400 flex items-center justify-end gap-1">
                <Lock size={11} /> Firma SHA-256 Activa
              </span>
              <p className="text-[10px] font-mono text-themeTextMuted truncate max-w-[160px]" title={firmaSha256}>
                {firmaSha256 ? `${firmaSha256.slice(0, 16)}...` : 'Calculando...'}
              </p>
            </div>
          </div>

          {/* Selector de Método de Pago Colombiano (Nequi, PSE, Tarjetas) */}
          <div className="space-y-2">
            <label className="block text-[10px] font-black uppercase tracking-wider text-themeTextMuted">
              Selecciona el medio de pago de prueba
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setMedio('nequi')}
                className={`p-3 rounded-2xl border text-xs font-black flex flex-col items-center gap-1.5 transition-all ${
                  medio === 'nequi'
                    ? 'border-fuchsia-500 bg-fuchsia-500/15 text-fuchsia-400 shadow-sm'
                    : 'border-themeBorder/60 bg-themeCard text-themeTextMuted hover:text-themeText'
                }`}
              >
                <Smartphone size={18} />
                <span>Nequi</span>
              </button>

              <button
                type="button"
                onClick={() => setMedio('pse')}
                className={`p-3 rounded-2xl border text-xs font-black flex flex-col items-center gap-1.5 transition-all ${
                  medio === 'pse'
                    ? 'border-sky-500 bg-sky-500/15 text-sky-400 shadow-sm'
                    : 'border-themeBorder/60 bg-themeCard text-themeTextMuted hover:text-themeText'
                }`}
              >
                <Building2 size={18} />
                <span>PSE</span>
              </button>

              <button
                type="button"
                onClick={() => setMedio('card')}
                className={`p-3 rounded-2xl border text-xs font-black flex flex-col items-center gap-1.5 transition-all ${
                  medio === 'card'
                    ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400 shadow-sm'
                    : 'border-themeBorder/60 bg-themeCard text-themeTextMuted hover:text-themeText'
                }`}
              >
                <CreditCard size={18} />
                <span>Tarjeta</span>
              </button>
            </div>
          </div>

          {/* Formulario contextual según el medio elegido */}
          <div className="p-4 rounded-2xl bg-themeCard border border-themeBorder/60 space-y-3">
            {medio === 'nequi' && (
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-themeTextMuted mb-1.5">
                  Número Celular Nequi (Sandbox)
                </label>
                <input
                  type="tel"
                  value={celularNequi}
                  onChange={(e) => setCelularNequi(e.target.value)}
                  placeholder="3001234567"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-themeInput border border-themeBorder text-xs font-bold text-themeText"
                />
                <p className="text-[10px] text-themeTextMuted mt-1.5">
                  Simula la notificación Push de Nequi en entorno de pruebas.
                </p>
              </div>
            )}

            {medio === 'pse' && (
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-themeTextMuted mb-1.5">
                  Banco PSE (Sandbox)
                </label>
                <select
                  value={bancoPse}
                  onChange={(e) => setBancoPse(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-themeInput border border-themeBorder text-xs font-bold text-themeText"
                >
                  <option value="Bancolombia">Bancolombia (Pruebas)</option>
                  <option value="Davivienda">Davivienda (Pruebas)</option>
                  <option value="Banco de Bogotá">Banco de Bogotá (Pruebas)</option>
                  <option value="Nequi PSE">Nequi / DaviPlata PSE</option>
                </select>
              </div>
            )}

            {medio === 'card' && (
              <div className="space-y-2.5">
                <label className="block text-[10px] font-black uppercase tracking-wider text-themeTextMuted">
                  Tarjeta de Prueba (Visa / Mastercard)
                </label>
                <input
                  type="text"
                  value={numTarjeta}
                  onChange={(e) => setNumTarjeta(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-themeInput border border-themeBorder text-xs font-bold text-themeText"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    defaultValue="12/29"
                    placeholder="MM/AA"
                    className="px-3.5 py-2 rounded-xl bg-themeInput border border-themeBorder text-xs font-bold text-themeText"
                  />
                  <input
                    type="text"
                    defaultValue="123"
                    placeholder="CVC"
                    className="px-3.5 py-2 rounded-xl bg-themeInput border border-themeBorder text-xs font-bold text-themeText"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Botones de Simulación de Transacción (Aprobada vs Rechazada con reversión de stock) */}
          <div className="space-y-2.5 pt-1">
            <p className="text-[10px] font-black uppercase tracking-wider text-themeTextMuted text-center">
              Simulador de Respuesta de Webhook / RPC
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={procesando}
                onClick={() => simularResultadoTransaccion('APPROVED')}
                className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
              >
                {procesando ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                Simular Pago Aprobado
              </button>

              <button
                type="button"
                disabled={procesando}
                onClick={() => simularResultadoTransaccion('DECLINED')}
                className="py-3 px-4 rounded-xl bg-red-500/15 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/30 disabled:opacity-50 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <XCircle size={15} />
                Simular Rechazo (+Stock)
              </button>
            </div>

            {import.meta.env.VITE_WOMPI_PUBLIC_KEY && (
              <button
                type="button"
                onClick={abrirWompiWebCheckout}
                className="w-full py-2 text-[11px] font-bold text-themeAccent hover:underline flex items-center justify-center gap-1.5"
              >
                <ExternalLink size={12} /> Abrir pasarela externa checkout.wompi.co
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

