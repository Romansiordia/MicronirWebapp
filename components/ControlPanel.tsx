
import React from 'react';
import { ConnectionStatus } from '../types';
import { driver } from '../driver'; // Importamos driver para acceder a sniff

interface ControlPanelProps {
  status: ConnectionStatus;
  isSimulated: boolean;
  setIsSimulated: (val: boolean) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onCommand: (cmd: string) => void;
  onClear: () => void;
  deviceName: string | null;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  status,
  isSimulated,
  setIsSimulated,
  onConnect,
  onDisconnect,
  onCommand,
  onClear,
  deviceName
}) => {
  const isConnected = status === ConnectionStatus.CONNECTED || status === ConnectionStatus.SIMULATING;
  const isConnecting = status === ConnectionStatus.CONNECTING;

  const handleSniff = () => {
    if (driver.isConnected && !isSimulated) {
        driver.sniff(3000); // Escuchar por 3 segundos
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
      <div className="p-6 space-y-6">
        {/* Connection Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px]">01</span> 
              Conexión
            </h2>
            {isConnected && (
              <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded border border-emerald-100 animate-pulse">
                {deviceName}
              </span>
            )}
          </div>
          
          <div className="flex flex-col gap-3">
            {!isConnected ? (
              <button 
                onClick={onConnect}
                disabled={isConnecting}
                className={`w-full font-bold py-4 px-6 rounded-xl shadow-lg transform active:scale-[0.98] transition-all flex items-center justify-center gap-3
                  ${isConnecting ? 'bg-slate-400 cursor-not-allowed' : 'bg-cyan-600 hover:bg-cyan-700 text-white'}`}
              >
                {isConnecting ? (
                  <span className="animate-spin text-xl">⏳</span>
                ) : (
                  <span className="text-xl">🔌</span>
                )}
                <span>{isConnecting ? 'Estableciendo enlace...' : 'Conectar Serial/USB'}</span>
              </button>
            ) : (
              <button 
                onClick={onDisconnect}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg transform active:scale-[0.98] transition-all flex items-center justify-center gap-3"
              >
                <span className="text-xl">⏹️</span> 
                <span>Finalizar Conexión</span>
              </button>
            )}
            
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input 
                    type="checkbox" 
                    checked={isSimulated}
                    onChange={(e) => setIsSimulated(e.target.checked)}
                    disabled={isConnected}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-700">Modo Simulación</span>
                  <span className="text-[10px] text-slate-500 italic">Recomendado para pruebas sin hardware</span>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="h-px bg-slate-100"></div>

        {/* Commands Section */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px]">02</span> 
            Adquisición
          </h2>
          
          <div className="grid grid-cols-2 gap-3">
            {/* Main Scan Button */}
            <button 
              onClick={() => onCommand('PerformScan')}
              disabled={!isConnected}
              className="col-span-2 group p-4 rounded-xl bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-200 disabled:opacity-50 text-white transition-all flex flex-col items-center justify-center gap-1 border-b-4 border-cyan-800 active:border-b-0 active:translate-y-1 shadow-lg"
            >
              <span className="text-sm font-black tracking-[0.2em]">FULL SCAN</span>
              <span className="text-[10px] opacity-70 font-mono italic">Comando 'S'</span>
            </button>

            {/* References */}
            <button 
              onClick={() => onCommand('PerformDark')}
              disabled={!isConnected}
              className="group p-3 rounded-xl bg-slate-800 hover:bg-slate-900 disabled:bg-slate-200 disabled:opacity-50 text-white transition-all flex flex-col items-center justify-center gap-1 border-b-4 border-slate-950 active:border-b-0 active:translate-y-1"
            >
              <span className="text-xs font-bold tracking-widest">DARK REF</span>
              <span className="text-[9px] text-slate-400 font-mono">Bloquear Sensor</span>
            </button>

            <button 
              onClick={() => onCommand('PerformWhite')}
              disabled={!isConnected}
              className="group p-3 rounded-xl bg-slate-50 hover:bg-white disabled:bg-slate-200 disabled:opacity-50 text-slate-800 transition-all flex flex-col items-center justify-center gap-1 border border-slate-200 border-b-4 border-slate-300 active:border-b-0 active:translate-y-1"
            >
              <span className="text-xs font-bold tracking-widest">WHITE REF</span>
              <span className="text-[9px] text-cyan-600 font-mono">Estándar Blanco</span>
            </button>
            
            {/* Engineering Commands */}
            <div className="col-span-2 mt-2">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Comandos Ingeniería</h3>
                <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => onCommand('WarmUp')}
                      disabled={!isConnected}
                      className="group p-3 rounded-xl bg-amber-50 hover:bg-amber-100 disabled:bg-slate-100 text-amber-700 border border-amber-200 transition-all flex flex-col items-center justify-center gap-1"
                    >
                      <span className="text-xs font-bold">WARM UP</span>
                      <span className="text-[9px] font-mono">Cmd 'W'</span>
                    </button>
                    
                    <button 
                      onClick={() => onCommand('GetVersion')}
                      disabled={!isConnected}
                      className="group p-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 disabled:bg-slate-100 text-indigo-700 border border-indigo-200 transition-all flex flex-col items-center justify-center gap-1"
                    >
                      <span className="text-xs font-bold">VERSION</span>
                      <span className="text-[9px] font-mono">Cmd 'V'</span>
                    </button>
                </div>
            </div>

            {/* NEW SNIFFER BUTTON */}
            <button 
              onClick={handleSniff}
              disabled={!isConnected}
              className="col-span-2 mt-1 p-2 rounded-lg bg-pink-50 text-pink-600 hover:bg-pink-100 border border-pink-200 transition-all font-bold text-[10px] uppercase flex items-center justify-center gap-2"
            >
              <span>👂</span> Test de Señal (Sniffer)
            </button>
            
            <button 
              onClick={onClear}
              className="col-span-2 mt-1 p-2 rounded-lg text-slate-400 hover:text-slate-600 transition-all font-bold text-[10px] uppercase flex items-center justify-center"
            >
              Limpiar Terminal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;
