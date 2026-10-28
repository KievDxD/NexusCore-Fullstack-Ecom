import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Cpu,
  Zap,
  CheckCircle2,
  AlertTriangle,
  ShoppingCart,
  RotateCcw,
  Trash2,
  Filter,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  usePCBuilderStore,
  PASOS_PC_BUILDER,
  detectarSlotProducto,
  evaluarCompatibilidadPieza,
  calcularConsumoEnsamble,
} from '../hooks/usePCBuilder';
import { useProductosStore } from '../hooks/useProductos';
import { useCarritoStore } from '../hooks/useCarrito';
import { useSettings } from '../hooks/useSettings';
import { convertPrice, formatCurrency, precioConDescuento } from '../utils/currency';
import type { Producto } from '../types';

interface PCBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAbrirCarrito?: () => void;
}

export default function PCBuilderModal({ isOpen, onClose, onAbrirCarrito }: PCBuilderModalProps) {
  const productos = useProductosStore((s) => s.productos);
  const agregarProducto = useCarritoStore((s) => s.agregarProducto);
  const currency = useSettings((s) => s.currency);
  const rates = useSettings((s) => s.rates);

  const seleccion = usePCBuilderStore((s) => s.seleccion);
  const pasoActual = usePCBuilderStore((s) => s.pasoActual);
  const soloCompatibles = usePCBuilderStore((s) => s.soloCompatibles);
  const seleccionarPieza = usePCBuilderStore((s) => s.seleccionarPieza);
  const quitarPieza = usePCBuilderStore((s) => s.quitarPieza);
  const setPasoActual = usePCBuilderStore((s) => s.setPasoActual);
  const setSoloCompatibles = usePCBuilderStore((s) => s.setSoloCompatibles);
  const reiniciarBuilder = usePCBuilderStore((s) => s.reiniciarBuilder);

  const infoPaso = useMemo(
    () => PASOS_PC_BUILDER.find((p) => p.slot === pasoActual) ?? PASOS_PC_BUILDER[0],
    [pasoActual]
  );

  const { consumoTotalWatts, fuenteRecomendadaWatts } = useMemo(
    () => calcularConsumoEnsamble(seleccion),
    [seleccion]
  );

  const candidatosSlot = useMemo(() => {
    const delSlot = productos.filter((p) => detectarSlotProducto(p) === pasoActual && (p.stock ?? 0) > 0);
    return delSlot
      .map((prod) => ({
        producto: prod,
        evaluacion: evaluarCompatibilidadPieza(pasoActual, prod, seleccion),
      }))
      .filter((item) => (soloCompatibles ? item.evaluacion.compatible : true));
  }, [productos, pasoActual, seleccion, soloCompatibles]);

  const piezasSeleccionadas = useMemo(
    () => PASOS_PC_BUILDER.map((p) => ({ paso: p, producto: seleccion[p.slot] })).filter((x) => Boolean(x.producto)),
    [seleccion]
  );

  const totalCOP = useMemo(
    () =>
      piezasSeleccionadas.reduce(
        (acc, item) => acc + (item.producto ? precioConDescuento(item.producto) : 0),
        0
      ),
    [piezasSeleccionadas]
  );

  const alertasGlobales = useMemo(() => {
    const alertas: string[] = [];
    PASOS_PC_BUILDER.forEach(({ slot }) => {
      const prod = seleccion[slot];
      if (!prod) return;
      const ev = evaluarCompatibilidadPieza(slot, prod, seleccion);
      ev.motivos.forEach((m) => {
        if (!alertas.includes(m)) alertas.push(m);
      });
    });
    return alertas;
  }, [seleccion]);

  if (!isOpen) return null;

  const handleAgregarEnsambleAlCarrito = () => {
    if (piezasSeleccionadas.length === 0) {
      toast.warning('Selecciona al menos un componente para armar tu PC.');
      return;
    }

    if (alertasGlobales.length > 0) {
      toast.error('Hay incompatibilidades en el ensamble actual', {
        description: alertasGlobales[0],
      });
      return;
    }

    let agregados = 0;
    piezasSeleccionadas.forEach(({ producto }) => {
      if (producto && agregarProducto(producto, 1)) {
        agregados++;
      }
    });

    if (agregados > 0) {
      toast.success(`¡Ensamble de ${agregados} pieza(s) enviado al carrito!`, {
        description: `Consumo estimado: ${consumoTotalWatts}W · Fuente recomendada: ${fuenteRecomendadaWatts}W`,
      });
      onClose();
      onAbrirCarrito?.();
    } else {
      toast.warning('Ya tienes el stock máximo de estas piezas en tu carrito.');
    }
  };

  const formatearPrecio = (p: Producto) =>
    formatCurrency(convertPrice(precioConDescuento(p), currency, rates), currency);

  return createPortal(
    <div
      className="fixed inset-0 z-[998] bg-black/75 backdrop-blur-md flex items-center justify-center p-0 sm:p-4 animate-backdrop-in"
      onClick={onClose}
      data-lenis-prevent="true"
    >
      <div
        className="w-full max-w-full sm:max-w-5xl h-[100dvh] sm:h-[88dvh] bg-themeBg sm:rounded-3xl border-0 sm:border border-themeBorder/70 shadow-2xl flex flex-col overflow-hidden box-border animate-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* CABECERA */}
        <div className="px-4 py-3.5 sm:px-6 sm:py-4 bg-themeCard border-b border-themeBorder/60 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-themeAccent/15 border border-themeAccent/30 flex items-center justify-center text-themeAccent shrink-0">
              <Cpu size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-lg font-black uppercase tracking-tight text-themeText truncate">
                  PC Builder Interactivo
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <Sparkles size={11} /> Verificador Activo
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-themeTextMuted font-semibold truncate">
                Filtra automáticamente piezas compatibles por Socket, RAM y consumo energético en Watts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                reiniciarBuilder();
                toast.info('Ensamble reiniciado');
              }}
              className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider bg-themeInput hover:bg-red-500/15 text-themeTextMuted hover:text-red-400 border border-themeBorder/60 flex items-center gap-1.5 transition-all"
              title="Reiniciar ensamble"
            >
              <RotateCcw size={13} />
              <span className="hidden sm:inline">Reiniciar</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-themeInput hover:bg-red-500 text-themeTextMuted hover:text-white flex items-center justify-center transition-all"
              aria-label="Cerrar PC Builder"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* BARRA DE PASOS (CPU -> Board -> RAM -> GPU -> SSD -> Cooler -> Chasis -> Fuente) */}
        <div className="px-3 py-2.5 sm:px-6 bg-themeInput/40 border-b border-themeBorder/50 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
          {PASOS_PC_BUILDER.map((paso, idx) => {
            const pieza = seleccion[paso.slot];
            const activo = pasoActual === paso.slot;
            return (
              <div key={paso.slot} className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setPasoActual(paso.slot)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 border transition-all ${
                    activo
                      ? 'bg-themeAccent text-white border-themeAccent shadow-md shadow-themeAccent/25'
                      : pieza
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                        : 'bg-themeCard text-themeTextMuted border-themeBorder/60 hover:text-themeText'
                  }`}
                >
                  {pieza ? <CheckCircle2 size={13} /> : <span className="opacity-60">{idx + 1}.</span>}
                  <span>{paso.corto}</span>
                </button>
                {idx < PASOS_PC_BUILDER.length - 1 && (
                  <ChevronRight size={13} className="text-themeTextMuted/40 shrink-0" />
                )}
              </div>
            );
          })}
        </div>

        {/* CONTENIDO PRINCIPAL: SELECTOR DE PIEZAS (IZQUIERDA) + RESUMEN Y WATTS (DERECHA) */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden min-h-0">
          {/* PANEL IZQUIERDO: CATÁLOGO FILTRADO DEL PASO ACTUAL */}
          <div className="lg:col-span-8 p-4 sm:p-6 overflow-y-auto custom-scrollbar space-y-4 border-b lg:border-b-0 lg:border-r border-themeBorder/50">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-themeCard p-3.5 rounded-2xl border border-themeBorder/50">
              <div>
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-themeAccent">
                  Paso actual: {infoPaso.titulo}
                </h3>
                <p className="text-[11px] text-themeTextMuted mt-0.5">{infoPaso.descripcion}</p>
              </div>

              <button
                type="button"
                onClick={() => setSoloCompatibles(!soloCompatibles)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 border transition-all ${
                  soloCompatibles
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : 'bg-themeInput text-themeTextMuted border-themeBorder'
                }`}
              >
                <Filter size={12} />
                {soloCompatibles ? 'Filtro Compatible: ON' : 'Mostrando Todas'}
              </button>
            </div>

            {candidatosSlot.length === 0 ? (
              <div className="text-center py-12 bg-themeCard rounded-2xl border border-dashed border-themeBorder p-6 space-y-3">
                <AlertTriangle size={28} className="mx-auto text-amber-400" />
                <p className="text-xs font-black uppercase tracking-wider text-themeText">
                  No se encontraron piezas compatibles en stock para {infoPaso.titulo}
                </p>
                <p className="text-[11px] text-themeTextMuted">
                  Puedes desactivar el filtro estricto para ver todas las opciones o cambiar el procesador/placa base.
                </p>
                {soloCompatibles && (
                  <button
                    type="button"
                    onClick={() => setSoloCompatibles(false)}
                    className="px-4 py-2 rounded-xl bg-themeAccent text-white text-xs font-black uppercase tracking-wider"
                  >
                    Ver todas las piezas del catálogo
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {candidatosSlot.map(({ producto, evaluacion }) => {
                  const seleccionado = seleccion[pasoActual]?.id === producto.id;
                  return (
                    <div
                      key={producto.id}
                      className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                        seleccionado
                          ? 'bg-themeAccent/10 border-themeAccent ring-1 ring-themeAccent/40'
                          : evaluacion.compatible
                            ? 'bg-themeCard border-themeBorder/60 hover:border-themeAccent/50'
                            : 'bg-red-500/5 border-red-500/30 opacity-75'
                      }`}
                    >
                      <div className="flex gap-3">
                        <img
                          src={producto.imagen}
                          alt={producto.nombre}
                          className="w-16 h-16 rounded-xl object-cover bg-themeInput border border-themeBorder/50 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <span className="text-[9px] font-black uppercase tracking-widest text-themeAccent">
                            {producto.marca || 'NEXUS'}
                          </span>
                          <h4 className="text-xs font-bold text-themeText line-clamp-2 leading-snug">
                            {producto.nombre}
                          </h4>
                          <p className="text-sm font-black text-themeAccent mt-1">{formatearPrecio(producto)}</p>
                        </div>
                      </div>

                      {/* Badges técnicos de compatibilidad */}
                      <div className="flex flex-wrap gap-1.5">
                        {evaluacion.etiquetas.map((tag) => (
                          <span
                            key={tag}
                            className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-themeInput text-themeTextMuted border border-themeBorder/50"
                          >
                            {tag}
                          </span>
                        ))}
                        {evaluacion.compatible ? (
                          <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400">
                            ✓ Compatible
                          </span>
                        ) : (
                          <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-red-500/15 text-red-400">
                            ⚠ {evaluacion.motivos[0]}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => seleccionarPieza(pasoActual, producto)}
                        disabled={!evaluacion.compatible && soloCompatibles}
                        className={`w-full py-2 px-3 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all active:scale-95 ${
                          seleccionado
                            ? 'bg-emerald-500 text-white'
                            : evaluacion.compatible
                              ? 'bg-themeAccent hover:bg-themeAccentHover text-white'
                              : 'bg-themeInput text-themeTextMuted hover:bg-red-500/20 hover:text-red-300'
                        }`}
                      >
                        {seleccionado ? 'Seleccionado ✓' : 'Elegir Componente'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* PANEL DERECHO: MEDIDOR DE CONSUMO EN WATTS + RESUMEN DEL ENSAMBLE */}
          <div className="lg:col-span-4 p-4 sm:p-5 bg-themeCard/60 flex flex-col justify-between overflow-y-auto custom-scrollbar space-y-4">
            <div className="space-y-3">
              {/* Medidor Energético en Tiempo Real */}
              <div className="p-3.5 rounded-2xl bg-themeInput/60 border border-themeBorder/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <Zap size={13} className="fill-current" /> Consumo Estimado
                  </span>
                  <span className="text-sm font-black text-themeText">{consumoTotalWatts} W</span>
                </div>
                <div className="w-full h-2 rounded-full bg-themeCard overflow-hidden border border-themeBorder/40">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.round((consumoTotalWatts / 750) * 100))}%` }}
                  />
                </div>
                <p className="text-[10px] text-themeTextMuted font-semibold flex justify-between">
                  <span>Fuente recomendada (+25% margen):</span>
                  <strong className="text-emerald-400">{fuenteRecomendadaWatts}W o superior</strong>
                </p>
              </div>

              {/* Estado de Compatibilidad General */}
              {alertasGlobales.length > 0 ? (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-[11px] text-red-400 font-bold space-y-1">
                  <div className="flex items-center gap-1.5 uppercase text-[10px] font-black">
                    <AlertTriangle size={13} /> Incompatibilidad detectada
                  </div>
                  {alertasGlobales.map((alerta, i) => (
                    <p key={i}>• {alerta}</p>
                  ))}
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-400 font-bold flex items-center gap-2">
                  <CheckCircle2 size={15} className="shrink-0" />
                  <span>Todas las piezas elegidas son 100% compatibles.</span>
                </div>
              )}

              {/* Lista de Slots */}
              <div className="space-y-1.5 max-h-[260px] overflow-y-auto custom-scrollbar pr-1">
                {PASOS_PC_BUILDER.map((paso) => {
                  const prod = seleccion[paso.slot];
                  return (
                    <div
                      key={paso.slot}
                      onClick={() => setPasoActual(paso.slot)}
                      className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 cursor-pointer transition-all ${
                        pasoActual === paso.slot
                          ? 'border-themeAccent bg-themeAccent/5'
                          : 'border-themeBorder/40 bg-themeInput/30 hover:border-themeBorder'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <span className="text-[9px] font-black uppercase tracking-wider text-themeTextMuted block">
                          {paso.titulo}
                        </span>
                        {prod ? (
                          <p className="font-bold text-themeText truncate">{prod.nombre}</p>
                        ) : (
                          <p className="text-[11px] text-themeTextMuted/50 italic">Sin seleccionar</p>
                        )}
                      </div>
                      {prod && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[11px] font-black text-themeAccent">{formatearPrecio(prod)}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              quitarPieza(paso.slot);
                            }}
                            className="p-1 text-themeTextMuted hover:text-red-500 transition-colors"
                            title="Quitar pieza"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* FOOTER RESUMEN Y ACCIÓN AL CARRITO */}
            <div className="pt-3 border-t border-themeBorder/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-themeTextMuted uppercase">
                  Total Ensamble ({piezasSeleccionadas.length} pzas)
                </span>
                <span className="text-lg font-black text-themeAccent">
                  {formatCurrency(convertPrice(totalCOP, currency, rates), currency)}
                </span>
              </div>

              <button
                type="button"
                onClick={handleAgregarEnsambleAlCarrito}
                disabled={piezasSeleccionadas.length === 0 || alertasGlobales.length > 0}
                className="w-full py-3 px-4 rounded-xl bg-themeAccent hover:bg-themeAccentHover disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-themeAccent/25 flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <ShoppingCart size={16} />
                Enviar Ensamble al Carrito
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

