
import React from 'react';

const Header: React.FC = () => {
  return (
    <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl border-b-4 border-cyan-500 relative overflow-hidden">
      {/* Decorative background element */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
        <div>
          <h1 className="text-3xl font-extrabold flex items-center gap-3 tracking-tight">
            <span className="text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">🔬</span> 
            MicroNIR <span className="text-cyan-400 font-light">Diagnostic Suite</span>
          </h1>
          <p className="text-slate-400 mt-1 text-xs uppercase tracking-[0.2em] font-medium flex items-center gap-2">
            Protocolo V5.0 (Baud Hunter)
            <span className="inline-block w-1 h-1 bg-slate-600 rounded-full"></span>
            Auto-Detect Enabled
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest leading-none mb-1">Entorno</div>
            <div className="text-xs font-bold text-cyan-400">WEB-BROWSER / PWA</div>
          </div>
          <div className="h-10 w-[1px] bg-slate-700 hidden sm:block mx-2"></div>
          <div className="bg-slate-800/50 p-2 rounded-lg border border-slate-700">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-[10px] font-bold text-slate-300 uppercase">Servicio Activo</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Header;
