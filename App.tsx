
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
      if (msg.includes("TX ->")) type = LogType.CMD;
      if (msg.includes("ERROR")) type = LogType.ERROR;
      if (msg.includes("Espectro") || msg.includes("LISTO")) type = LogType.DATA;
      addLog(msg, type);
    });
  }, [addLog]);

  const handleConnect = async () => {
    if (isSimulated) {
      setStatus(ConnectionStatus.CONNECTING);
      setTimeout(() => {
        setStatus(ConnectionStatus.SIMULATING);
        setDeviceName("MicroNIR-Sim-BT");
      }, 500);
      return;
    }

    try {
      setStatus(ConnectionStatus.CONNECTING);
      const res = await driver.connect();
      
      // Aseguramos que el estado cambie SÓLO si el driver confirma conexión
      if (driver.isConnected) {
        setDeviceName(res.model || "MicroNIR OnSite");
        setStatus(ConnectionStatus.CONNECTED);
        addLog("Interfaz desbloqueada. Listo para comandos.", LogType.INFO);
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
      const mockData = Array.from({ length: 128 }, (_, i) => ({
        wavelength: 900 + (i * 6.3),
        intensity: 0.1 + Math.random() * 0.5
      }));
      setSpectrumData(mockData);
      return;
    }

    if (!driver.isConnected) {
      addLog("Error: El driver reporta que no hay conexión activa.", LogType.ERROR);
      setStatus(ConnectionStatus.IDLE);
      return;
    }

    try {
      switch (cmd) {
        case 'PerformScan':
          const raw = await driver.scan();
          if (raw) setSpectrumData(processScanResult(raw));
          break;

        case 'PerformDark':
          addLog("Iniciando captura DARK (Lámpara Apagada)...", LogType.CMD);
          await driver.setLamp(false);
          const darkRaw = await driver.scan();
          if (darkRaw) setSpectrumData(processScanResult(darkRaw));
          break;

        case 'PerformWhite':
          addLog("Iniciando captura WHITE (Lámpara Encendida)...", LogType.CMD);
          await driver.setLamp(true);
          addLog("Esperando estabilidad de la lámpara (1.5s)...", LogType.INFO);
          await new Promise(r => setTimeout(r, 1500));
          const whiteRaw = await driver.scan();
          if (whiteRaw) setSpectrumData(processScanResult(whiteRaw));
          break;

        case 'LampsOn':
          await driver.setLamp(true);
          break;
        
        case 'GetTemp':
          addLog("Comando de temperatura no soportado en este modelo BLE todavía.", LogType.WARN);
          break;

        default:
          addLog(`Comando ${cmd} desconocido.`, LogType.WARN);
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
                    LIVE
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
