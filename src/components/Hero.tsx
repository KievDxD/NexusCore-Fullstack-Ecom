// src/components/Hero.tsx
export default function Hero() {
  const abrirWhatsApp = () => {
    // Reemplaza con tu número de WhatsApp
    window.open("https://wa.me/573043104831", "_blank");
  };

  return (
    <section className="relative w-full py-16 px-6 bg-slate-900 border-b border-indigo-500/20 overflow-hidden">
      {/* Efecto decorativo de luz sutil */}
      <div className="absolute top-0 right-0 w-1/3 h-full bg-indigo-500/5 blur-3xl rounded-full translate-x-1/2"></div>
      
      <div className="max-w-4xl mx-auto relative z-10 flex flex-col gap-6">
        <span className="self-start px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-widest rounded-full">
          Hardware & Componentes Premium
        </span>

        <h1 className="text-4xl md:text-5xl font-black text-white leading-tight">
          Potencia tu setup con <br />
          <span className="text-indigo-400">tecnología de última generación.</span>
        </h1>

        <p className="text-slate-400 text-lg max-w-xl">
          Añade lo que necesites al carrito y procesa tu cotización al instante a través de WhatsApp.
        </p>

        <div className="flex flex-wrap gap-4 pt-2">
          <button 
            onClick={() => window.scrollTo({ top: 700, behavior: 'smooth' })}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 py-3 rounded-xl transition-all shadow-lg shadow-indigo-600/20"
          >
            Ver Catálogo
          </button>
          <button 
            onClick={abrirWhatsApp}
            className="bg-transparent border border-slate-700 hover:border-emerald-500 text-slate-200 hover:text-emerald-400 font-bold px-8 py-3 rounded-xl transition-all"
          >
            Cotizar por WhatsApp
          </button>
        </div>
      </div>
    </section>
  );
}