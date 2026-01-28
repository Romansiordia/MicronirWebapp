import React, { useState, useCallback, useEffect } from 'react';
import { LogType, LogEntry, ConnectionStatus, SpectrumPoint } from './types';
import DiagnosticTerminal from './components/DiagnosticTerminal';
import Header from './components/Header';
import ControlPanel from './components/ControlPanel';
import SpectrumChart from './components/SpectrumChart';
import { driver } from './driver';

const App: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.IDLE);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [isSimulated, setIsSimulated] = useState<boolean>(false);
  const [spectrumData, setSpectrumData] = useState<SpectrumPoint[]>([]);
  
  const addLog = useCallback((message: string, type: LogType = LogType.INFO) => {
    const entry: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      message,
      type
    };
    setLogs(prev => [...prev, entry]);
  }, []);

  useEffect(() => {
    driver.setLogger((msg: string) => {
      let type = LogType.INFO;
      if (msg.includes("TX ->") || msg.includes("RX <<")) type = LogType.CMD;
      if (msg.includes("ERROR") || msg.includes("Error") || msg.includes("Timeout")) type = LogType.ERROR;
      if (msg.includes("Espectro") || msg.includes("recibido")) type = LogType.DATA;
      addLog(msg, type);
    });
  }, [addLog]);

  const handleConnect = async () => {
    if (isSimulated) {
      setStatus(ConnectionStatus.CONNECTING);
      setTimeout(() => {
        setStatus(ConnectionStatus.SIMULATING);
        setDeviceName("MicroNIR-Sim-Proto");
      }, 500);
      return;
    }

    try {
      setStatus(ConnectionStatus.CONNECTING);
      const res = await driver.connect();
      
      if (driver.isConnected) {
        setDeviceName(res.model || "MicroNIR Serial");
        setStatus(ConnectionStatus.CONNECTED);
        addLog("Conexión serial establecida. Protocolo V2 activo.", LogType.INFO);
      } else {
        setStatus(ConnectionStatus.IDLE);
      }
    } catch (error: any) {
      addLog(`Fallo en conexión: ${error.message}`, LogType.ERROR);
      setStatus(ConnectionStatus.IDLE);
    }
  };

  const handleDisconnect = async () => {
    await driver.disconnect();
    setStatus(ConnectionStatus.IDLE);
    setDeviceName(null);
    setSpectrumData([]);
  };

  const processScanResult = (raw: Uint16Array) => {
    return Array.from(raw).map((val, i) => ({
      wavelength: Math.round(900 + (i * (1700 - 900) / 127)),
      intensity: val / 65535.0
    }));
  };

  const sendCommand = async (cmd: string) => {
    if (isSimulated) {
      if (cmd === 'PerformScan') {
          const mockData = Array.from({ length: 128 }, (_, i) => ({
            wavelength: 900 + (i * 6.3),
            intensity: 0.1 + Math.random() * 0.5
          }));
          setSpectrumData(mockData);
          addLog("Simulación: Scan completado.", LogType.DATA);
      } else {
          addLog(`Simulación: Comando ${cmd} ejecutado.`, LogType.CMD);
      }
      return;
    }

    if (!driver.isConnected) {
      addLog("Error: Dispositivo no conectado.", LogType.ERROR);
      setStatus(ConnectionStatus.IDLE);
      return;
    }

    try {
      switch (cmd) {
        case 'PerformScan':
          addLog("Iniciando Scan (Cmd S)...", LogType.INFO);
          const raw = await driver.scan();
          if (raw) setSpectrumData(processScanResult(raw));
          break;

        case 'PerformDark':
          addLog("⚠️ PARA DARK REF: Asegure que el sensor esté totalmente bloqueado.", LogType.WARN);
          addLog("Ejecutando Scan para referencia oscura...", LogType.CMD);
          const darkRaw = await driver.scan();
          if (darkRaw) setSpectrumData(processScanResult(darkRaw));
          break;

        case 'PerformWhite':
          addLog("⚠️ PARA WHITE REF: Coloque el estándar de referencia blanco.", LogType.WARN);
          // Opcional: Hacer un Warm-up antes para asegurar estabilidad
          await driver.warmUp(); 
          addLog("Ejecutando Scan de referencia blanca...", LogType.CMD);
          const whiteRaw = await driver.scan();
          if (whiteRaw) setSpectrumData(processScanResult(whiteRaw));
          break;

        case 'WarmUp':
          addLog("Enviando comando Warm-up (W)...", LogType.CMD);
          await driver.warmUp();
          break;
        
        case 'GetVersion':
          addLog("Solicitando info del sistema (V)...", LogType.CMD);
          await driver.getSystemInfo();
          break;

        default:
          addLog(`Comando UI ${cmd} no implementado.`, LogType.WARN);
      }
    } catch (e: any) {
      addLog(`Error ejecución: ${e.message}`, LogType.ERROR);
    }
  };

  return (
    <div className="min-h-screen pb-12">
      <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
        <Header />
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-6">
            <ControlPanel 
              status={status}
              isSimulated={isSimulated}
              setIsSimulated={setIsSimulated}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              onCommand={sendCommand}
              onClear={() => setLogs([])}
              deviceName={deviceName}
            />
            <DiagnosticTerminal logs={logs} status={status} />
          </div>

          <div className="lg:col-span-7">
            <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden h-full flex flex-col">
              <div className="bg-slate-50 border-b border-slate-200 p-4 flex justify-between items-center">
                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                  <span className="text-cyan-500">📊</span> Spectral Data (900-1700nm)
                </h3>
                {status === ConnectionStatus.CONNECTED && (
                  <span className="text-[10px] bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded-full font-bold animate-pulse">
                    SERIAL V2
                  </span>
                )}
              </div>
              <div className="flex-1 p-6 flex flex-col items-center justify-center min-h-[400px]">
                {spectrumData.length > 0 ? (
                  <SpectrumChart data={spectrumData} />
                ) : (
                  <div className="text-center text-slate-400 space-y-2">
                    <div className="text-4xl">📡</div>
                    <p className="text-sm font-medium italic">Esperando adquisición de datos...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;