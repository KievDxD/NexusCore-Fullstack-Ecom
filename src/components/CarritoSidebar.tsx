import { useCarrito } from '../hooks/useCarrito';
import { useSettings } from '../hooks/useSettings';
import { convertPrice, formatCurrency } from '../utils/currency';
import { X, Trash2, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';

interface CarritoSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CarritoSidebar({ isOpen, onClose }: CarritoSidebarProps) {
  const { items, eliminarProducto, limpiarCarrito } = useCarrito();
  const { currency, rates, whatsappNumber } = useSettings();

  // 💰 Calcular el precio total acumulado
  const totalOriginal = items.reduce((sum, item) => sum + item.precio * item.cantidad, 0);
  const totalConvertido = convertPrice(totalOriginal, currency, rates);
  const totalFormateado = formatCurrency(totalConvertido, currency);

  // 📱 Función para armar el mensaje de texto y mandarlo a WhatsApp
  const enviarPedidoWhatsApp = () => {
    if (items.length === 0) return;

    let mensaje = `👋 ¡Hola! Me gustaría realizar el siguiente pedido:\n\n`;
    
    items.forEach((item) => {
      const precioItemConvertido = convertPrice(item.precio, currency, rates);
      const precioItemFormateado = formatCurrency(precioItemConvertido, currency);
      mensaje += `▪ *${item.cantidad}x* ${item.nombre} — (${precioItemFormateado} c/u)\n`;
    });

    mensaje += `\n💰 *Total del Pedido:* ${totalFormateado}`;
    mensaje += `\n\n💵 *Moneda de pago elegida:* ${currency}`;

    // Codificamos el texto para que sea válido dentro de un enlace URL
    const mensajeCodificado = encodeURIComponent(mensaje);
    
    // Usamos el número guardado en la configuración o el fallback
    const numeroTelefono = whatsappNumber || "573043104831"; 
    
    toast.success("Redirigiendo a WhatsApp para finalizar tu pedido...");
    window.open(`https://wa.me/${numeroTelefono}?text=${mensajeCodificado}`, '_blank');
  };

  const handleEliminarProducto = (id: number, nombre: string) => {
    eliminarProducto(id);
    toast.error(`Eliminado: ${nombre}`);
  };

  const handleVaciarCarrito = () => {
    limpiarCarrito();
    toast.error("Se ha vaciado el carrito");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Fondo oscuro traslúcido */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-themeCard border-l border-themeBorder text-themeText shadow-2xl flex flex-col h-full">
          
          {/* ENCABEZADO DEL CARRITO */}
          <div className="px-4 py-6 bg-themeInput border-b border-themeBorder sm:px-6 flex items-center justify-between">
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
          <div className="flex-1 py-6 overflow-y-auto px-4 sm:px-6">
            {items.length === 0 ? (
              <div className="text-center py-12 flex flex-col items-center justify-center h-full">
                <ShoppingBag className="w-16 h-16 text-themeTextMuted mb-4 stroke-[1.5] opacity-50" />
                <p className="text-themeTextMuted font-medium">El carrito está vacío</p>
                <p className="text-xs text-themeTextMuted/70 mt-1">¡Agrega algunos productos de la tienda!</p>
              </div>
            ) : (
              <div className="space-y-6">
                {items.map((item) => {
                  const itemPrecioConvertido = convertPrice(item.precio, currency, rates);
                  const itemPrecioFormateado = formatCurrency(itemPrecioConvertido, currency);
                  
                  return (
                    <div key={item.id} className="flex py-4 border-b border-themeBorder/40 last:border-none items-center gap-4">
                      <img 
                        src={item.imagen} 
                        alt={item.nombre} 
                        className="w-16 h-16 rounded-lg object-cover border border-themeBorder flex-shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://placehold.co/600x400/1e293b/475569?text=Hardware';
                        }}
                      />
                      <div className="flex-1">
                        <h3 className="text-sm font-bold text-themeText line-clamp-1">{item.nombre}</h3>
                        <p className="text-xs text-themeTextMuted mt-0.5">Cantidad: {item.cantidad}</p>
                        <p className="text-sm font-black text-themeAccent mt-1">{itemPrecioFormateado}</p>
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

          {/* RESUMEN Y BOTONES */}
          {items.length > 0 && (
            <div className="border-t border-themeBorder px-4 py-6 sm:px-6 bg-themeInput">
              <div className="flex justify-between text-base font-bold text-themeText mb-4">
                <span>Subtotal</span>
                <span className="text-themeAccent text-xl font-black">{totalFormateado}</span>
              </div>
              
              <p className="text-xs text-themeTextMuted mb-4">
                Los precios se actualizaron según tu moneda predeterminada. El envío se coordina de manera directa.
              </p>

              <div className="space-y-3">
                <button
                  onClick={enviarPedidoWhatsApp}
                  className="w-full flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all active:scale-[0.98]"
                >
                  Enviar pedido por WhatsApp
                </button>
                
                <button
                  onClick={handleVaciarCarrito}
                  className="w-full text-center text-xs font-semibold text-themeTextMuted hover:text-red-500 py-1 transition-colors"
                >
                  Vaciar todo el carrito
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}