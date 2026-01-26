
export enum LogType {
  INFO = 'info',
  ERROR = 'error',
  WARN = 'warn',
  CMD = 'cmd',
  DATA = 'data'
}

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: LogType;
}

export interface SpectrumPoint {
  wavelength: number;
  intensity: number;
}

export enum ConnectionStatus {
  IDLE = 'IDLE',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  SIMULATING = 'SIMULATING',
  DISCONNECTED = 'DISCONNECTED'
}

export interface BLEServiceState {
  status: ConnectionStatus;
  deviceName: string | null;
}
