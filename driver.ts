
/**
 * DRIVER MICRO NIR - VERSIÓN SERVICE FIRST V10
 * Estrategia: Forzar descubrimiento por UUID de Servicio.
 * Al filtrar por { services: [UUID] }, obligamos a Windows a verificar
 * que el dispositivo realmente tiene el servicio antes de mostrarlo,
 * rompiendo el caché de "Solo Generic Access".
 */

const UUIDS = {
  SERVICE_DATA: '0000ffe0-0000-1000-8000-00805f9b34fb', // SERVICE_UART
  CHARACTERISTIC_DATA: '0000ffe1-0000-1000-8000-00805f9b34fb', // CHAR_UART_TX_RX
  
  // Servicios estándar
  SERVICE_BATTERY: 'battery_service',
  SERVICE_DEV_INFO: 'device_information'
};

export class MicroNIRDriver {
  private device: any = null;
  private characteristic: any = null;
  public isConnected = false;
  private logger: (msg: string) => void = () => {};
  private scanBuffer: number[] = [];
  private onScanComplete: ((data: Uint16Array) => void) | null = null;

  public setLogger(fn: (msg: string) => void) { this.logger = fn; }
  private log(msg: string) { this.logger(msg); }

  async connect(): Promise<any> {
    try {
      this.log("Iniciando conexión V10 (Service First)...");
      
      // PASO 1: Solicitud de Dispositivo - ESTRATEGIA INVERTIDA
      // Buscamos explícitamente el UUID. Si el dispositivo aparece en la lista
      // usando este filtro, GARANTIZA que Windows ha visto el servicio.
      this.device = await (navigator as any).bluetooth.requestDevice({
        filters: [
          { services: [UUIDS.SERVICE_DATA] }, // Prioridad 1: Debe tener FFE0
          { namePrefix: 'MicroNIR' },         // Respaldo por nombre
          { namePrefix: 'Viavi' },
          { namePrefix: 'M1-' }
        ],
        optionalServices: [
          UUIDS.SERVICE_DATA,       
          UUIDS.SERVICE_BATTERY,
          UUIDS.SERVICE_DEV_INFO
        ]
      });

      this.log(`Dispositivo seleccionado: ${this.device.name}`);
      
      this.device.addEventListener('gattserverdisconnected', () => {
        this.log("⚠️ Dispositivo desconectado.");
        this.isConnected = false;
      });

      // PASO 2: Conexión Inmediata (Sin esperas artificiales)
      const server = await this.device.gatt.connect();
      this.log("GATT Conectado. Accediendo a servicios...");

      // PASO 3: Obtención de Servicio
      // Al haber filtrado por servicio, el acceso debería ser directo.
      let service = null;
      try {
        service = await server.getPrimaryService(UUIDS.SERVICE_DATA);
        this.log("✅ Servicio FFE0 verificado.");
      } catch (e) {
        this.log("⚠️ Fallo acceso UUID completo. Probando alias corto 0xffe0...");
        try {
            service = await server.getPrimaryService(0xffe0);
        } catch(err) {
            // Último intento: listar todo
            const all = await server.getPrimaryServices();
            this.log(`Mapa real: ${all.map((s:any)=>s.uuid).join(',')}`);
            throw new Error("El sistema operativo insiste en que el servicio no existe. Requiere reinicio de Bluetooth.");
        }
      }

      // PASO 4: Característica
      this.characteristic = await service.getCharacteristic(UUIDS.CHARACTERISTIC_DATA);
      await this.characteristic.startNotifications();
      this.characteristic.addEventListener('characteristicvaluechanged', (event: any) => {
        const value = event.target.value;
        const bytes = new Uint8Array(value.buffer);
        this.handleDataPacket(bytes);
      });
      
      this.log("✅ Canal de datos listo (Comando 'S').");
      this.isConnected = true;
      return { model: this.device.name, status: "CONNECTED" };

    } catch (error: any) {
      this.isConnected = false;
      this.log(`❌ ERROR: ${error.message}`);
      throw error;
    }
  }

  private handleDataPacket(data: Uint8Array) {
    for (let i = 0; i < data.length; i++) {
      this.scanBuffer.push(data[i]);
    }

    // Procesamiento Little Endian (Vía Snippet)
    if (this.scanBuffer.length >= 256) {
      const pixels = new Uint16Array(128);
      const view = new DataView(new Uint8Array(this.scanBuffer).buffer);

      for (let i = 0; i < 128; i++) {
        // Little Endian explícito
        pixels[i] = view.getUint16(i * 2, true); 
      }
      
      this.log(`Espectro recibido (${pixels.length} pts).`);
      
      if (this.onScanComplete) {
        this.onScanComplete(pixels);
      }
      this.scanBuffer = [];
    }
  }

  async setLamp(on: boolean): Promise<boolean> {
    if (!this.isConnected) return false;
    // Protocolo Binario para lámpara (suele ser estándar)
    const packet = new Uint8Array([0x02, 0x03, on ? 0x01 : 0x00, 0x00]);
    try {
        await this.characteristic.writeValueWithoutResponse(packet);
        return true;
    } catch(e) { return false; }
  }

  async scan(): Promise<Uint16Array | null> {
    if (!this.isConnected) return null;
    this.scanBuffer = [];
    
    return new Promise(async (resolve) => {
      const timer = setTimeout(() => {
        this.onScanComplete = null;
        resolve(null);
      }, 8000);

      this.onScanComplete = (pixels) => {
        clearTimeout(timer);
        resolve(pixels);
      };

      // INTENTO 1: Protocolo de Texto (Snippet Usuario)
      try {
          const cmd = new TextEncoder().encode("S");
          // Usamos writeValue (con respuesta) si es posible, es más seguro
          if (this.characteristic.properties.write) {
             await this.characteristic.writeValue(cmd);
          } else {
             await this.characteristic.writeValueWithoutResponse(cmd);
          }
          this.log("TX: 'S' (Scan)");
      } catch(e: any) {
          this.log(`Error TX 'S': ${e.message}`);
          
          // Fallback: Protocolo Binario
          this.log("Reintentando con protocolo binario...");
          const packet = new Uint8Array([0x02, 0x02, 0x01, 0x00]);
          await this.characteristic.writeValueWithoutResponse(packet);
      }
    });
  }

  async disconnect() {
    if (this.device?.gatt.connected) {
      this.device.gatt.disconnect();
    }
    this.isConnected = false;
    this.characteristic = null;
    this.log("Desconectado.");
  }
}

export const driver = new MicroNIRDriver();
