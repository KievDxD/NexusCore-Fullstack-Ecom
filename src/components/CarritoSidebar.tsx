import { useCarrito } from '../hooks/useCarrito';
import { useSettings } from '../hooks/useSettings';
import { convertPrice, formatCurrency } from '../utils/currency';
import { X, Trash2, ShoppingBag } from 'lucide-react';

interface CarritoSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CarritoSidebar({ isOpen, onClose }: CarritoSidebarProps) {
  const { items, eliminarProducto, limpiarCarrito } = useCarrito();
  const { currency, rates } = useSettings();

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
    
    // ⚠️ REEMPLAZA ESTE NÚMERO POR EL TUYO (código de país + número, sin +)
    const numeroTelefono = "573043104831"; 
    
    window.open(`https://wa.me/${numeroTelefono}?text=${mensajeCodificado}`, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Fondo oscuro traslúcido */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col">
          
          {/* ENCABEZADO DEL CARRITO */}
          <div className="px-4 py-6 bg-gray-50 border-b border-gray-100 sm:px-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="text-indigo-600 w-5 h-5" />
              <h2 className="text-lg font-bold text-gray-900">Tu Carrito</h2>
            </div>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 p-1 rounded-full hover:bg-gray-200 transition-all active:scale-95"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* LISTA DE PRODUCTOS */}
          <div className="flex-1 py-6 overflow-y-auto px-4 sm:px-6">
            {items.length === 0 ? (
              <div className="text-center py-12 flex flex-col items-center justify-center h-full">
                <ShoppingBag className="w-16 h-16 text-gray-300 mb-4 stroke-[1.5]" />
                <p className="text-gray-500 font-medium">El carrito está vacío</p>
                <p className="text-xs text-gray-400 mt-1">¡Agrega algunos productos de la tienda!</p>
              </div>
            ) : (
              <div className="space-y-6">
                {items.map((item) => {
                  const itemPrecioConvertido = convertPrice(item.precio, currency, rates);
                  const itemPrecioFormateado = formatCurrency(itemPrecioConvertido, currency);
                  
                  return (
                    <div key={item.id} className="flex py-4 border-b border-gray-100 last:border-none items-center gap-4">
                      <img 
                        src={item.imagen} 
                        alt={item.nombre} 
                        className="w-16 h-16 rounded-lg object-cover border border-gray-100 flex-shrink-0"
                      />
                      <div className="flex-1">
                        <h3 className="text-sm font-bold text-gray-800 line-clamp-1">{item.nombre}</h3>
                        <p className="text-xs text-gray-400 mt-0.5">Cantidad: {item.cantidad}</p>
                        <p className="text-sm font-black text-indigo-600 mt-1">{itemPrecioFormateado}</p>
                      </div>
                      <button 
                        onClick={() => eliminarProducto(item.id)}
                        className="text-gray-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors active:scale-95"
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
            <div className="border-t border-gray-100 px-4 py-6 sm:px-6 bg-gray-50">
              <div className="flex justify-between text-base font-bold text-gray-900 mb-4">
                <span>Subtotal</span>
                <span className="text-indigo-600 text-xl font-black">{totalFormateado}</span>
              </div>
              
              <p className="text-xs text-gray-500 mb-4">
                Los precios se actualizaron según tu moneda predeterminada. El envío se coordina de manera directa.
              </p>

              <div className="space-y-3">
                <button
                  onClick={enviarPedidoWhatsApp}
                  className="w-full flex items-center justify-center bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all active:scale-[0.98]"
                >
                  Enviar pedido por WhatsApp
                </button>
                
                <button
                  onClick={limpiarCarrito}
                  className="w-full text-center text-xs font-semibold text-gray-400 hover:text-red-500 py-1 transition-colors"
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