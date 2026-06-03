import { memo } from 'react';
import { useSettings } from '../hooks/useSettings';
import { useProductos } from '../hooks/useProductos';
import { Sparkles, Terminal } from 'lucide-react';

export default memo(function Hero() {
  const { whatsappNumber } = useSettings();
  const { productos } = useProductos();

  const totalArticulos = productos.length || 12;
  const articulosEnStock = productos.filter(p => (p.stock ?? 10) > 0).length || 12;
  const porcentajeStock = (articulosEnStock / totalArticulos) * 100;

  const abrirWhatsApp = () => {
    const numero = whatsappNumber || "573043104831";
    window.open(`https://wa.me/${numero}`, "_blank");
  };

  return (
    <section className="relative w-full py-20 px-6 bg-gradient-to-br from-themeCard via-themeCard to-themeInput/30 border-b border-themeBorder/80 overflow-hidden transition-all duration-500 select-none">
      
      {/* 🔮 Efecto decorativo de luz neón cyberpunk de fondo */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-themeAccent/10 blur-3xl rounded-full translate-x-1/3 -translate-y-1/3 animate-pulse duration-4000"></div>
      <div className="absolute bottom-0 left-10 w-96 h-96 bg-themeAccent/5 blur-3xl rounded-full -translate-x-1/2 translate-y-1/2"></div>
      
      {/* Patrón de malla de fondo tecnológico */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-70"></div>

      <div className="max-w-5xl mx-auto relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        
        {/* Lado izquierdo: Textos */}
        <div className="lg:col-span-7 flex flex-col gap-6 text-left">
          
          {/* Badge premium */}
          <div className="self-start inline-flex items-center gap-2 px-3.5 py-1.5 bg-themeAccent/10 border border-themeAccent/20 text-themeAccent text-[10px] font-black uppercase tracking-widest rounded-full shadow-inner shadow-themeAccent/5">
            <Sparkles size={12} className="animate-pulse" />
            <span>Hardware & Componentes Premium</span>
          </div>

          {/* Título de alto impacto */}
          <h1 className="text-4xl md:text-6xl font-black text-themeText leading-[1.08] tracking-tighter uppercase">
            POTENCIA TU SETUP CON <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-themeAccent via-themeAccent to-themeAccentHover drop-shadow-sm">
              TECNOLOGÍA CORE
            </span>
          </h1>

          {/* Subtítulo descriptivo */}
          <p className="text-themeTextMuted text-base md:text-lg max-w-xl leading-relaxed font-medium">
            Equipos de alto rendimiento y componentes seleccionados al detalle para ensamblajes extremos. Cotiza y personaliza tu pedido directo en nuestro WhatsApp.
          </p>

          {/* Botones de acción premium */}
          <div className="flex flex-wrap gap-4 pt-3">
            <button 
              onClick={() => document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' })}
              className="bg-themeAccent hover:bg-themeAccentHover text-white font-black text-xs uppercase tracking-widest px-8 py-4 rounded-xl transition-all shadow-lg shadow-themeAccent/15 active:scale-[0.97] hover:shadow-themeAccent/30"
            >
              Ver Catálogo
            </button>
            
            <button 
              onClick={abrirWhatsApp}
              className="bg-themeInput hover:bg-themeBorder/40 border border-themeBorder/80 hover:border-themeAccent text-themeText font-black text-xs uppercase tracking-widest px-8 py-4 rounded-xl transition-all active:scale-[0.97] flex items-center gap-2"
            >
              <Terminal size={14} className="text-themeAccent" />
              Cotizar Setup
            </button>
          </div>
        </div>

        {/* Lado derecho: Tarjeta abstracta futurista flotante */}
        <div className="lg:col-span-5 hidden lg:block relative">
          <div className="relative w-80 h-96 mx-auto bg-themeCard/45 border border-themeBorder/85 backdrop-blur-xl rounded-3xl p-6 shadow-2xl flex flex-col justify-between hover:border-themeAccent/30 transition-all duration-700 hover:shadow-themeAccent/10 group">
            
            {/* Esquina superior brillante */}
            <div className="absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 border-themeAccent rounded-tl-xl opacity-40 group-hover:opacity-100 transition-opacity"></div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 border-themeAccent rounded-br-xl opacity-40 group-hover:opacity-100 transition-opacity"></div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[9px] bg-themeAccent/10 border border-themeAccent/20 text-themeAccent px-2.5 py-1 rounded font-black uppercase tracking-wider">
                  NEXUS//SYSTEMS
                </span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
              </div>
              
              <div className="h-[120px] rounded-2xl bg-gradient-to-tr from-themeAccent/10 to-themeAccent/5 border border-themeBorder/40 overflow-hidden flex items-center justify-center relative">
                {/* Logo del favicon dentro de la tarjeta */}
                <img 
                  src="/favicon.svg" 
                  alt="NEXUS" 
                  className="w-16 h-16 opacity-30 group-hover:opacity-60 transition-opacity duration-700"
                  width={64}
                  height={64}
                  loading="lazy"
                />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-widest text-themeText">ESTADO DEL INVENTARIO</p>
                <div className="flex items-center justify-between text-[11px] text-themeTextMuted">
                  <span>Productos Disponibles</span>
                  <span className="font-bold text-themeText">{articulosEnStock} de {totalArticulos} ítems</span>
                </div>
                <div className="w-full bg-themeInput/50 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-themeAccent h-1.5 rounded-full transition-all duration-1000" style={{ width: `${porcentajeStock}%` }}></div>
                </div>
              </div>
            </div>

            <div className="bg-themeInput/30 border border-themeBorder/40 p-4 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-[8px] text-themeTextMuted font-black tracking-widest uppercase">Moneda Core</p>
                <p className="text-xs font-black text-themeAccent">Sincronizado</p>
              </div>
              <span className="text-[10px] font-black text-themeText uppercase tracking-widest bg-themeCard py-1 px-2.5 rounded border border-themeBorder">
                ONLINE
              </span>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
});