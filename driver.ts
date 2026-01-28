
/**
 * DRIVER MICRO NIR - VERSIÓN 5.0 (BAUD RATE HUNTER)
 * Estrategia:
 * 1. Signals: DTR=ON, RTS=OFF (Estándar).
 * 2. Baud Sweep: Probar lista de velocidades comunes y extremas.
 * 3. Stimulus: Enviar Ping (0x00) + GetVersion en cada intento.
 */

// --- Web Serial Types Polyfill ---
interface SerialPort {
  open(options: { 
    baudRate: number, 
    dataBits?: number, 
    stopBits?: number, 
    parity?: string,
    flowControl?: string 
  }): Promise<void>;
  setSignals(options: { dataTerminalReady?: boolean, requestToSend?: boolean }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream | null;
  writable: WritableStream | null;
}

interface Serial extends EventTarget {
  requestPort(options?: { filters: any[] }): Promise<SerialPort>;
}

declare global {
  interface Navigator {
    serial: Serial;
  }
}
// -----------------------------

const COMMANDS = {
  SCAN:      new Uint8Array([0x02, 0x01, 0x53, 0x03]),
  WARMUP:    new Uint8Array([0x02, 0x01, 0x57, 0x03]),
  VERSION:   new Uint8Array([0x02, 0x01, 0x56, 0x03]),
  PING:      new Uint8Array([0x00]), 
};

export class MicroNIRDriver {
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader | null = null;
  
  public isConnected = false;
  private logger: (msg: string) => void = () => {};

  public setLogger(fn: (msg: string) => void) { this.logger = fn; }
  private log(msg: string) { this.logger(msg); }

  /**
   * Conexión Web Serial V5.0 (Baud Hunter)
   */
  async connect(): Promise<any> {
    try {
      this.log("Iniciando V5.0: Baud Rate Hunter...");
      
      if (!navigator.serial) throw new Error("Navegador no compatible.");

      // 1. Solicitar permiso al usuario (una sola vez)
      this.port = await navigator.serial.requestPort({ 
        filters: [{ usbVendorId: 0x0403 }, { usbVendorId: 0x2457 }] 
      });
      
      // Lista de velocidades a probar (De más probable a menos probable + extrema)
      const BAUDS = [115200, 9600, 921600, 57600, 38400, 19200];
      let foundBaud = null;

      for (const baud of BAUDS) {
        this.log(`🔍 Probando velocidad: ${baud} baud...`);
        
        try {
            // Abrir puerto
            await this.port.open({ 
                baudRate: baud,
                dataBits: 8,
                stopBits: 1,
                parity: "none",
                flowControl: "none" 
            });

            // Configuración eléctrica estándar
            await this.port.setSignals({ dataTerminalReady: true, requestToSend: false });
            
            // Esperar estabilización eléctrica
            await new Promise(r => setTimeout(r, 100));

            // ENVIAR ESTÍMULO (Ping + Version)
            // Usamos writer directo porque isConnected es false aún
            if (this.port.writable) {
                const writer = this.port.writable.getWriter();
                // Enviar 0x00 para despertar
                await writer.write(COMMANDS.PING); 
                // Enviar comando versión real
                await writer.write(COMMANDS.VERSION);
                writer.releaseLock();
            }

            // ESCUCHAR RESPUESTA (800ms es suficiente para un ACK)
            const gotData = await this.sniff(800);
            
            if (gotData) {
                this.log(`✅ ¡ENLACE CONFIRMADO @ ${baud} BAUD!`);
                foundBaud = baud;
                this.isConnected = true;
                break; // Mantenemos el puerto abierto y salimos del loop
            } else {
                // Cerrar para intentar siguiente velocidad
                await this.port.close();
                // Breve pausa para que el OS libere el handle
                await new Promise(r => setTimeout(r, 200));
            }

        } catch (e: any) {
            this.log(`Error en ${baud}: ${e.message}`);
            // Asegurar cierre en caso de error
            if (this.port && (this.port.readable || this.port.writable)) {
                try { await this.port.close(); } catch {}
            }
        }
      }

      // Resultado Final
      if (!foundBaud) {
          this.log("⚠️ Barrido fallido. Sin respuesta en ninguna velocidad.");
          this.log("🔄 Forzando conexión @ 115200 (Default) para pruebas manuales.");
          
          await this.port.open({ baudRate: 115200 });
          await this.port.setSignals({ dataTerminalReady: true, requestToSend: false });
          this.isConnected = true;
          return { model: "MicroNIR (No Response)", status: "CONNECTED_FORCED" };
      }

      return { model: `MicroNIR @ ${foundBaud}`, status: "CONNECTED" };

    } catch (error: any) {
      this.isConnected = false;
      this.log(`❌ Error Fatal: ${error.message}`);
      throw error;
    }
  }

  /**
   * FUNCIÓN SNIFFER
   */
  async sniff(durationMs: number = 3000): Promise<boolean> {
    if (!this.port || !this.port.readable) return false;

    let receivedData = false;

    try {
        this.reader = this.port.readable.getReader();
        const startTime = Date.now();
        
        while (Date.now() - startTime < durationMs) {
            const { value, done } = await Promise.race([
                this.reader.read(),
                new Promise<any>(r => setTimeout(() => r({value: null, done: false}), 100))
            ]);

            if (done) break;

            if (value && value.length > 0) {
                receivedData = true;

                const hex = Array.from(value)
                    .map((b: any) => b.toString(16).padStart(2, '0').toUpperCase())
                    .join(' ');
                
                let ascii = "";
                for(let i=0; i<value.length; i++) {
                    const c = value[i];
                    ascii += (c >= 32 && c <= 126) ? String.fromCharCode(c) : '.';
                }

                this.log(`RX << [${hex}] ${ascii}`);
            }
        }
    } catch (e: any) {
        // Ignorar errores de cierre esperados
    } finally {
        if (this.reader) {
            try {
                this.reader.releaseLock();
            } catch(e) { console.error(e); }
            this.reader = null;
        }
    }

    return receivedData;
  }

  private async writeCommand(cmd: Uint8Array, label: string, silent: boolean = false): Promise<boolean> {
    if (!this.isConnected || !this.port || !this.port.writable) return false;
    try {
        const writer = this.port.writable.getWriter();
        await writer.write(cmd);
        writer.releaseLock();
        if(!silent) this.log(`TX -> ${label}`);
        return true;
    } catch(e: any) {
        if(!silent) this.log(`Error TX ${label}: ${e.message}`);
        return false;
    }
  }

  async warmUp(): Promise<boolean> {
    return this.writeCommand(COMMANDS.WARMUP, "WARM UP (Cmd: W)");
  }

  async getSystemInfo(): Promise<void> {
    await this.writeCommand(COMMANDS.VERSION, "GET VERSION (Cmd: V)");
    await this.sniff(1000); 
  }

  async scan(): Promise<Uint16Array | null> {
    if (!this.isConnected || !this.port || !this.port.readable) return null;

    if (!await this.writeCommand(COMMANDS.SCAN, "SCAN (Cmd: S)")) return null;

    const TARGET_BYTES = 256;
    let buffer = new Uint8Array(TARGET_BYTES);
    let bytesRead = 0;
    
    try {
        this.reader = this.port.readable.getReader();
        const TIMEOUT_MS = 3000;
        
        const timeoutPromise = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error("TIMEOUT_SCAN")), TIMEOUT_MS)
        );
      
        const readLoop = async (): Promise<void> => {
            while (bytesRead < TARGET_BYTES) {
                const { value, done } = await this.reader!.read();
                if (done) break;
                if (value) {
                    for (let i = 0; i < value.length; i++) {
                        if (bytesRead < TARGET_BYTES) {
                            buffer[bytesRead] = value[i];
                            bytesRead++;
                        }
                    }
                }
                if (bytesRead >= TARGET_BYTES) break;
            }
        };

        await Promise.race([readLoop(), timeoutPromise]);

    } catch (e: any) {
        if (e.message === "TIMEOUT_SCAN") {
             this.log(`⚠️ Timeout (>3000ms). ¿Buffer vacío?`);
             try { await this.reader.cancel(); } catch {}
        } else {
            this.log(`Error Lectura: ${e.message}`);
        }
        return null;
    } finally {
        if (this.reader) {
            try { this.reader.releaseLock(); } catch {}
            this.reader = null;
        }
    }

    if (bytesRead < TARGET_BYTES) {
        this.log(`⚠️ Incompleto: ${bytesRead} bytes.`);
    } else {
        this.log(`⚡ Scan OK: ${bytesRead} bytes.`);
    }

    const pixels = new Uint16Array(128);
    const view = new DataView(buffer.buffer);
    for (let i = 0; i < 128; i++) {
        if (i * 2 + 1 < bytesRead) {
            pixels[i] = view.getUint16(i * 2, true);
        }
    }
    return pixels;
  }

  async disconnect() {
    if (this.reader) {
        try { await this.reader.cancel(); this.reader.releaseLock(); } catch {}
    }
    if (this.port) {
      try { 
        await this.port.close(); 
      } catch (e) { console.error(e); }
    }
    this.port = null;
    this.isConnected = false;
    this.log("Desconectado.");
  }
}

export const driver = new MicroNIRDriver();
