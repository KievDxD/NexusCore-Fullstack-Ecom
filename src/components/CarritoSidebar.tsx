import { useState, lazy, Suspense } from 'react';
import { useCarrito } from '../hooks/useCarrito';
import { useSettings } from '../hooks/useSettings';
import { useAuth } from '../context/AuthContext';
import { usePedidosStore } from '../hooks/usePedidos';
import { convertPrice, formatCurrency, precioConDescuento } from '../utils/currency';
import { X, Trash2, ShoppingBag, Loader2, ShieldCheck, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { Pedido } from '../types';

const WompiCheckoutModal = lazy(() => import('./WompiCheckoutModal'));

interface CarritoSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const IMAGE_FALLBACK =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='400' fill='%231e293b'%3E%3Crect width='600' height='400'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23475569' font-size='24' font-family='sans-serif'%3ESin imagen%3C/text%3E%3C/svg%3E";

export default function CarritoSidebar({ isOpen, onClose }: CarritoSidebarProps) {
  const { items, total, hayPendientes, eliminarProducto, limpiarCarrito } = useCarrito();
  const currency = useSettings((s) => s.currency);
  const rates = useSettings((s) => s.rates);
  const whatsappNumber = useSettings((s) => s.whatsappNumber);
  const { username, user } = useAuth();
  const crearPedidoConReserva = usePedidosStore((s) => s.crearPedidoConReserva);

  const [isProcessing, setIsProcessing] = useState(false);
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteTelefono, setClienteTelefono] = useState('');
  const [pedidoWompiActivo, setPedidoWompiActivo] = useState<Pedido | null>(null);

  const totalConvertido = convertPrice(total, currency, rates);
  const totalFormateado = formatCurrency(totalConvertido, currency);

  const resolverNombreCliente = () =>
    clienteNombre.trim() || username || user?.email?.split('@')[0] || 'Cliente Nexus';

  // 📱 Opción 1: Reserva stock mediante RPC transaccional y envía pedido por WhatsApp
  const enviarPedidoWhatsApp = async () => {
    if (items.length === 0 || isProcessing) return;
    if (hayPendientes) {
      toast.warning('Aún se está sincronizando el catálogo. Intenta de nuevo en unos segundos.');
      return;
    }

    setIsProcessing(true);

    try {
      const pedido = await crearPedidoConReserva({
        clienteNombre: resolverNombreCliente(),
        clienteTelefono: clienteTelefono.trim(),
        metodoPago: 'whatsapp',
        moneda: currency,
        itemsCarrito: items,
      });

      const refCorta = pedido.id.slice(0, 8).toUpperCase();
      let mensaje = `👋 ¡Hola! Quiero confirmar mi pedido *#${refCorta}* (Stock reservado):\n`;
      mensaje += `👤 *Cliente:* ${pedido.cliente_nombre}\n\n`;

      items.forEach((item) => {
        const precioItemConvertido = convertPrice(precioConDescuento(item), currency, rates);
        const precioItemFormateado = formatCurrency(precioItemConvertido, currency);
        mensaje += `▪ *${item.cantidad}x* ${item.nombre} — (${precioItemFormateado} c/u)\n`;
      });

      mensaje += `\n💰 *Total del Pedido:* ${totalFormateado}`;
      mensaje += `\n💵 *Moneda:* ${currency}`;
      mensaje += `\n🔖 *ID Reserva:* ${pedido.id}`;

      const mensajeCodificado = encodeURIComponent(mensaje);
      const numeroTelefono = whatsappNumber || '573043104831';

      toast.success(`¡Pedido #${refCorta} creado y stock reservado!`, {
        id: 'checkout',
        description: 'Redirigiendo a WhatsApp para coordinar entrega y pago.',
      });
      window.open(`https://wa.me/${numeroTelefono}?text=${mensajeCodificado}`, '_blank');

      limpiarCarrito();
      onClose();
    } catch (err) {
      console.error('Error en reserva de stock / checkout:', err);
      toast.error('No se pudo procesar el pedido', {
        id: 'checkout',
        description: err instanceof Error ? err.message : 'Verifica la disponibilidad de stock.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // 💳 Opción 2: Reserva stock mediante RPC y abre pasarela Wompi Sandbox (PSE, Nequi, Tarjetas)
  const iniciarPagoWompiSandbox = async () => {
    if (items.length === 0 || isProcessing) return;
    if (hayPendientes) {
      toast.warning('Aún se está sincronizando el catálogo. Intenta de nuevo en unos segundos.');
      return;
    }

    setIsProcessing(true);
    try {
      const pedido = await crearPedidoConReserva({
        clienteNombre: resolverNombreCliente(),
        clienteTelefono: clienteTelefono.trim(),
        metodoPago: 'wompi',
        moneda: currency,
        itemsCarrito: items,
      });
      setPedidoWompiActivo(pedido);
    } catch (err) {
      toast.error('No se pudo iniciar Wompi Checkout', {
        description: err instanceof Error ? err.message : 'Verifica el stock disponible.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEliminarProducto = (id: number, nombre: string) => {
    eliminarProducto(id);
    toast.error(`Eliminado: ${nombre}`);
  };

  const handleVaciarCarrito = () => {
    limpiarCarrito();
    toast.error('Se ha vaciado el carrito');
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-50 overflow-hidden transition-all duration-300 ${
          isOpen ? 'visible' : 'invisible pointer-events-none'
        }`}
      >
        <div
          className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
            isOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={onClose}
        />

        <div
          className={`absolute top-0 right-0 w-full max-w-md h-full bg-themeCard border-l border-themeBorder text-themeText shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col ${
            isOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {/* ENCABEZADO DEL CARRITO */}
          <div className="px-4 py-5 bg-themeInput border-b border-themeBorder sm:px-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="text-themeAccent w-5 h-5" />
              <h2 className="text-lg font-bold text-themeText">Tu Carrito</h2>
            </div>
            <button
              onClick={onClose}
              className="text-themeTextMuted hover:text-themeText p-1.5 rounded-full hover:bg-themeCard transition-all active:scale-95"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* LISTA DE PRODUCTOS */}
          <div className="flex-1 py-4 overflow-y-auto px-4 sm:px-6 custom-scrollbar">
            {items.length === 0 ? (
              <div className="text-center py-12 flex flex-col items-center justify-center h-full">
                <ShoppingBag className="w-16 h-16 text-themeTextMuted mb-4 stroke-[1.5] opacity-50" />
                <p className="text-themeTextMuted font-medium">El carrito está vacío</p>
                <p className="text-xs text-themeTextMuted/70 mt-1">¡Agrega algunos productos de la tienda!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item) => {
                  const itemPrecioConvertido = convertPrice(precioConDescuento(item), currency, rates);
                  const itemPrecioFormateado = formatCurrency(itemPrecioConvertido, currency);

                  return (
                    <div
                      key={item.id}
                      className="flex py-3 border-b border-themeBorder/40 last:border-none items-center gap-3.5"
                    >
                      <img
                        src={item.imagen}
                        alt={item.nombre}
                        className="w-14 h-14 rounded-lg object-cover border border-themeBorder flex-shrink-0"
                        onError={(e) => {
                          const target = e.currentTarget;
                          target.onerror = null;
                          target.src = IMAGE_FALLBACK;
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xs sm:text-sm font-bold text-themeText line-clamp-1">{item.nombre}</h3>
                        <p className="text-[11px] text-themeTextMuted mt-0.5">Cantidad: {item.cantidad}</p>
                        <p className="text-sm font-black text-themeAccent mt-0.5">{itemPrecioFormateado}</p>
                      </div>
                      <button
                        onClick={() => handleEliminarProducto(item.id, item.nombre)}
                        className="text-themeTextMuted hover:text-red-500 p-2 rounded-lg hover:bg-red-500/10 transition-colors active:scale-95"
                        title="Eliminar producto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RESUMEN, DATOS DE RESERVA Y BOTONES DE PAGO */}
          {items.length > 0 && (
            <div className="border-t border-themeBorder px-4 py-4 sm:px-6 bg-themeInput space-y-3">
              {/* Campos rápidos para asociar la reserva de stock */}
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder={username ? `@${username}` : 'Tu nombre (opcional)'}
                  value={clienteNombre}
                  onChange={(e) => setClienteNombre(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-themeCard border border-themeBorder text-xs font-semibold text-themeText focus:outline-none focus:ring-1 focus:ring-themeAccent"
                />
                <input
                  type="tel"
                  placeholder="Teléfono / WhatsApp"
                  value={clienteTelefono}
                  onChange={(e) => setClienteTelefono(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-themeCard border border-themeBorder text-xs font-semibold text-themeText focus:outline-none focus:ring-1 focus:ring-themeAccent"
                />
              </div>

              <div className="flex justify-between items-center text-base font-bold text-themeText">
                <span>Total con Reserva</span>
                <span className="text-themeAccent text-xl font-black">{totalFormateado}</span>
              </div>

              <p className="text-[10px] text-themeTextMuted leading-snug">
                Al confirmar, el stock se aparta automáticamente mediante transacción en base de datos.
              </p>

              <div className="space-y-2">
                {/* Botón 1: WhatsApp + Reserva de Stock */}
                <button
                  onClick={enviarPedidoWhatsApp}
                  disabled={isProcessing || hayPendientes}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 disabled:cursor-not-allowed text-white text-xs font-black uppercase tracking-wider py-3 px-4 rounded-xl shadow-md transition-all active:scale-[0.98]"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Reservando stock...
                    </>
                  ) : (
                    <>
                      <MessageCircle className="w-4 h-4" />
                      Pedir por WhatsApp (Contraentrega)
                    </>
                  )}
                </button>

                {/* Botón 2: Pasarela Wompi Sandbox */}
                <button
                  type="button"
                  onClick={iniciarPagoWompiSandbox}
                  disabled={isProcessing || hayPendientes}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 hover:opacity-95 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider py-3 px-4 rounded-xl shadow-md transition-all active:scale-[0.98]"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Pagar con Wompi Sandbox (PSE / Nequi)
                </button>

                <button
                  onClick={handleVaciarCarrito}
                  disabled={isProcessing}
                  className="w-full text-center text-[11px] font-semibold text-themeTextMuted hover:text-red-500 disabled:opacity-50 py-1 transition-colors"
                >
                  Vaciar todo el carrito
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Pasarela Wompi Sandbox */}
      <Suspense fallback={null}>
        <WompiCheckoutModal
          pedido={pedidoWompiActivo}
          onClose={() => setPedidoWompiActivo(null)}
          onSuccess={() => {
            setPedidoWompiActivo(null);
            limpiarCarrito();
            onClose();
          }}
        />
      </Suspense>
    </>
  );
}
