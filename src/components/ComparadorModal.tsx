import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Scale, X, Trash2, Trophy, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { useComparadorStore, obtenerIndicesGanadores } from '../hooks/useComparador';
import { useSettings } from '../hooks/useSettings';
import { useCarritoStore } from '../hooks/useCarrito';
import { convertPrice, formatCurrency, precioConDescuento } from '../utils/currency';

export default function ComparadorModal() {
  const items = useComparadorStore((s) => s.items);
  const modalAbierto = useComparadorStore((s) => s.modalAbierto);
  const quitarDeComparador = useComparadorStore((s) => s.quitarDeComparador);
  const limpiarComparador = useComparadorStore((s) => s.limpiarComparador);
  const setModalAbierto = useComparadorStore((s) => s.setModalAbierto);

  const currency = useSettings((s) => s.currency);
  const rates = useSettings((s) => s.rates);
  const agregarProducto = useCarritoStore((s) => s.agregarProducto);

  // Recolectar todas las llaves de especificaciones técnicas de los productos seleccionados
  const clavesSpecs = useMemo(() => {
    const conjunto = new Set<string>();
    items.forEach((p) => {
      if (p.especificaciones) {
        Object.keys(p.especificaciones).forEach((k) => conjunto.add(k));
      }
    });
    return Array.from(conjunto);
  }, [items]);

  const ganadoresPrecio = useMemo(
    () => obtenerIndicesGanadores('precio', items.map((p) => precioConDescuento(p))),
    [items]
  );

  const ganadoresStock = useMemo(
    () => obtenerIndicesGanadores('stock', items.map((p) => p.stock ?? 0)),
    [items]
  );

  if (items.length === 0) return null;

  return createPortal(
    <>
      {/* BARRA FLOTANTE DE COMPARACIÓN */}
      {!modalAbierto && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[90] w-[94vw] max-w-2xl bg-themeCard/95 backdrop-blur-xl border border-themeAccent/40 rounded-2xl shadow-2xl p-3 flex flex-wrap items-center justify-between gap-3 animate-slide-up">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-themeAccent/15 text-themeAccent flex items-center justify-center shrink-0">
              <Scale size={18} />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
              {items.map((prod) => (
                <div
                  key={prod.id}
                  className="flex items-center gap-1.5 bg-themeInput px-2.5 py-1 rounded-xl border border-themeBorder/60 shrink-0"
                >
                  <img src={prod.imagen} alt={prod.nombre} className="w-6 h-6 rounded object-cover" />
                  <span className="text-[11px] font-bold text-themeText truncate max-w-[100px] sm:max-w-[130px]">
                    {prod.nombre}
                  </span>
                  <button
                    type="button"
                    onClick={() => quitarDeComparador(prod.id)}
                    className="text-themeTextMuted hover:text-red-500 p-0.5"
                    aria-label={`Quitar ${prod.nombre}`}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={limpiarComparador}
              className="px-2.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider text-themeTextMuted hover:text-red-400 hover:bg-red-500/10 transition-all"
            >
              Limpiar
            </button>
            <button
              type="button"
              onClick={() => setModalAbierto(true)}
              disabled={items.length < 2}
              className="px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider bg-themeAccent hover:bg-themeAccentHover disabled:opacity-40 text-white shadow-lg shadow-themeAccent/25 transition-all active:scale-95"
            >
              Comparar ({items.length}/3)
            </button>
          </div>
        </div>
      )}

      {/* MODAL COMPARATIVO LADO A LADO */}
      {modalAbierto && (
        <div
          className="fixed inset-0 z-[999] bg-black/75 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-backdrop-in"
          onClick={() => setModalAbierto(false)}
          data-lenis-prevent="true"
        >
          <div
            className="w-full max-w-5xl max-h-[90dvh] bg-themeBg rounded-2xl sm:rounded-3xl border border-themeBorder/70 shadow-2xl flex flex-col overflow-hidden box-border animate-modal-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera */}
            <div className="px-4 py-3.5 sm:px-6 sm:py-4 bg-themeCard border-b border-themeBorder/60 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-themeAccent/15 text-themeAccent flex items-center justify-center">
                  <Scale size={20} />
                </div>
                <div>
                  <h2 className="text-sm sm:text-lg font-black uppercase tracking-tight text-themeText">
                    Comparador Técnico Lado a Lado
                  </h2>
                  <p className="text-[10px] sm:text-xs text-themeTextMuted font-semibold">
                    Las celdas resaltadas en <span className="text-emerald-400 font-black">verde</span> indican la ventaja técnica o mejor precio
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={limpiarComparador}
                  className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all flex items-center gap-1"
                >
                  <Trash2 size={13} /> Vaciar
                </button>
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  className="w-9 h-9 rounded-xl bg-themeInput hover:bg-red-500 text-themeTextMuted hover:text-white flex items-center justify-center transition-all"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Tabla Comparativa Lado a Lado */}
            <div className="flex-1 overflow-auto custom-scrollbar p-4 sm:p-6">
              <table className="w-full border-collapse min-w-[540px]">
                <thead>
                  <tr>
                    <th className="w-40 p-3 text-left text-[10px] font-black uppercase tracking-widest text-themeTextMuted align-bottom border-b border-themeBorder/60">
                      Hardware ({items.length})
                    </th>
                    {items.map((prod) => (
                      <th key={prod.id} className="p-3 align-top border-b border-themeBorder/60 min-w-[180px]">
                        <div className="bg-themeCard p-3.5 rounded-2xl border border-themeBorder/60 space-y-2.5 text-left relative">
                          <button
                            type="button"
                            onClick={() => quitarDeComparador(prod.id)}
                            className="absolute top-2.5 right-2.5 w-6 h-6 rounded-lg bg-themeInput hover:bg-red-500 text-themeTextMuted hover:text-white flex items-center justify-center"
                            title="Quitar de la comparativa"
                          >
                            <X size={12} />
                          </button>
                          <img
                            src={prod.imagen}
                            alt={prod.nombre}
                            className="w-full h-28 object-contain rounded-xl bg-themeInput p-2"
                          />
                          <div>
                            <span className="text-[9px] font-black uppercase tracking-widest text-themeAccent">
                              {prod.marca || prod.categoria}
                            </span>
                            <h3 className="text-xs font-black text-themeText line-clamp-2 mt-0.5">{prod.nombre}</h3>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (agregarProducto(prod, 1)) {
                                toast.success(`Añadido al carrito: ${prod.nombre}`);
                              } else {
                                toast.info('Ya alcanzaste el stock disponible en tu carrito');
                              }
                            }}
                            className="w-full py-2 px-3 rounded-xl bg-themeAccent hover:bg-themeAccentHover text-white text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all active:scale-95"
                          >
                            <ShoppingCart size={12} /> Agregar
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-themeBorder/40">
                  {/* Fila de Precio Final */}
                  <tr>
                    <td className="p-3 font-black uppercase text-[10px] tracking-wider text-themeTextMuted">
                      Precio Final
                    </td>
                    {items.map((prod, idx) => {
                      const esGanador = ganadoresPrecio.includes(idx);
                      const precioFmt = formatCurrency(
                        convertPrice(precioConDescuento(prod), currency, rates),
                        currency
                      );
                      return (
                        <td
                          key={prod.id}
                          className={`p-3 font-black text-sm ${
                            esGanador ? 'bg-emerald-500/15 text-emerald-400' : 'text-themeText'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span>{precioFmt}</span>
                            {esGanador && (
                              <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500 text-white flex items-center gap-1">
                                <Trophy size={10} /> Mejor Precio
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Fila de Stock */}
                  <tr>
                    <td className="p-3 font-black uppercase text-[10px] tracking-wider text-themeTextMuted">
                      Disponibilidad
                    </td>
                    {items.map((prod, idx) => {
                      const esGanador = ganadoresStock.includes(idx);
                      return (
                        <td
                          key={prod.id}
                          className={`p-3 font-bold ${
                            esGanador ? 'bg-emerald-500/10 text-emerald-400' : 'text-themeText'
                          }`}
                        >
                          {prod.stock} unidades
                        </td>
                      );
                    })}
                  </tr>

                  {/* Filas dinámicas de Especificaciones Técnicas */}
                  {clavesSpecs.map((clave) => {
                    const valores = items.map((p) => p.especificaciones?.[clave] ?? '—');
                    const ganadores = obtenerIndicesGanadores(clave, valores);
                    return (
                      <tr key={clave}>
                        <td className="p-3 font-black uppercase text-[10px] tracking-wider text-themeTextMuted">
                          {clave}
                        </td>
                        {valores.map((valor, idx) => {
                          const esGanador = ganadores.includes(idx);
                          return (
                            <td
                              key={`${clave}-${idx}`}
                              className={`p-3 font-bold transition-colors ${
                                esGanador
                                  ? 'bg-emerald-500/15 text-emerald-400 border-l-2 border-emerald-500'
                                  : 'text-themeText'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span>{valor}</span>
                                {esGanador && (
                                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 shrink-0">
                                    ✓ Superior
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}

