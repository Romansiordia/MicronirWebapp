
import React, { useRef, useEffect } from 'react';
import { LogEntry, LogType, ConnectionStatus } from '../types';

interface DiagnosticTerminalProps {
  logs: LogEntry[];
  status: ConnectionStatus;
}

const DiagnosticTerminal: React.FC<DiagnosticTerminalProps> = ({ logs, status }) => {
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  const getLogColor = (type: LogType) => {
    switch (type) {
      case LogType.ERROR: return 'text-rose-400';
      case LogType.WARN: return 'text-amber-400';
      case LogType.CMD: return 'text-white font-bold';
      case LogType.DATA: return 'text-emerald-400';
      default: return 'text-cyan-400';
    }
  };

  const getPrefix = (type: LogType) => {
    switch (type) {
      case LogType.ERROR: return '[ERR]';
      case LogType.WARN: return '[WRN]';
      case LogType.CMD: return '>>>';
      case LogType.DATA: return '[DATA]';
      default: return '>>';
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-2 px-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span> 
          Terminal de Diagnóstico
        </span>
        <span className={`text-[10px] px-3 py-1 rounded font-bold uppercase ${
          status === ConnectionStatus.CONNECTED ? 'bg-emerald-600 text-white' :
          status === ConnectionStatus.SIMULATING ? 'bg-amber-500 text-white' :
          status === ConnectionStatus.CONNECTING ? 'bg-cyan-600 text-white' :
          'bg-slate-200 text-slate-600'
        }`}>
          {status}
        </span>
      </div>
      
      <div 
        ref={terminalRef}
        className="bg-slate-900 text-slate-300 p-5 rounded-xl h-80 lg:h-96 overflow-y-auto log-font text-xs border-b-4 border-slate-800 shadow-xl leading-relaxed scroll-smooth"
      >
        {logs.map((log) => (
          <div key={log.id} className={`${getLogColor(log.type)} mb-1.5 border-l-2 border-opacity-20 border-white pl-3 hover:bg-white/5 transition-colors group`}>
            <span className="opacity-30 mr-2 tabular-nums group-hover:opacity-60 transition-opacity">[{log.timestamp}]</span> 
            <span className="font-bold mr-2 opacity-50">{getPrefix(log.type)}</span>
            <span className="whitespace-pre-wrap">{log.message}</span>
          </div>
        ))}
        {logs.length === 0 && (
          <div className="text-slate-600 italic">Esperando inicialización...</div>
        )}
      </div>
    </div>
  );
};

export default DiagnosticTerminal;
