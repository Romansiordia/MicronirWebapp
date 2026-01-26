
/**
 * DRIVER MICRO NIR - VERSIÓN ULTRA-COMPATIBLE
 * Integra lógica de: MicroNirCommunication.dll (Binary CCP) + Android Kotlin (GATT FFE0/FFE1)
 */

const UUIDS = {
  // Servicio y Característica identificados en Android y DLL
  SERVICE: '0000ffe0-0000-1000-8000-00805f9b34fb',
  CHARACTERISTIC: '0000ffe1-0000-1000-8000-00805f9b34fb',
  
  // Servicios Auxiliares
  DEVICE_INFO: 0x180a,
  GENERIC_ACCESS: 0x1800
};

const OPCODES = {
  SCAN: 0x02,
  LAMP: 0x03,
  STATUS: 0x05
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

  /**
   * Conexión siguiendo el flujo de Android: Discovery -> Service FFE0 -> Char FFE1 -> Notify
   */
  async connect(): Promise<any> {
    try {
      this.log("Iniciando búsqueda de hardware MicroNIR...");
      
      this.device = await (navigator as any).bluetooth.requestDevice({
        filters: [
          { namePrefix: 'MicroNIR' },
          { namePrefix: 'M1-' },
          { namePrefix: 'VIAVI' }
        ],
        optionalServices: [UUIDS.SERVICE, UUIDS.DEVICE_INFO, UUIDS.GENERIC_ACCESS]
      });

      this.log(`Dispositivo hallado: ${this.device.name}. Conectando...`);
      
      this.device.addEventListener('gattserverdisconnected', () => {
        this.log("ADVERTENCIA: Conexión perdida.");
        this.isConnected = false;
      });

      const server = await this.device.gatt.connect();
      
      // Simulamos el 'discoverServices' de Android con una espera activa
      this.log("Sincronizando servicios GATT...");
      await new Promise(r => setTimeout(r, 1000));

      let service;
      try {
        service = await server.getPrimaryService(UUIDS.SERVICE);
      } catch (e) {
        this.log("Reintentando descubrimiento profundo de canales...");
        const services = await server.getPrimaryServices();
        service = services.find((s: any) => s.uuid.includes('ffe0'));
      }

      if (!service) throw new Error("Servicio FFE0 no disponible.");

      this.characteristic = await service.getCharacteristic(UUIDS.CHARACTERISTIC);

      // Habilitar notificaciones (Equivalente a enableNotifications en Kotlin)
      this.log("Habilitando puerto de datos (FFE1)...");
      await this.characteristic.startNotifications();
      
      this.characteristic.addEventListener('characteristicvaluechanged', (event: any) => {
        const value = new Uint8Array(event.target.value.buffer);
        this.handleDataPacket(value);
      });

      this.isConnected = true;
      this.log("¡MICRO NIR ENLACE ESTABLECIDO!");
      
      return { model: this.device.name, status: "CONNECTED" };
    } catch (error: any) {
      this.isConnected = false;
      this.log(`FALLO: ${error.message}`);
      throw error;
    }
  }

  /**
   * Procesa los bytes del sensor (Reconstrucción del espectro)
   */
  private handleDataPacket(data: Uint8Array) {
    // Acumulamos los bytes (un espectro son 256 bytes)
    for (let i = 0; i < data.length; i++) {
      this.scanBuffer.push(data[i]);
    }

    if (this.scanBuffer.length >= 256) {
      const pixels = new Uint16Array(128);
      for (let i = 0; i < 128; i++) {
        // Los sensores NIR suelen usar Big Endian para el ADC
        pixels[i] = (this.scanBuffer[i * 2] << 8) | this.scanBuffer[i * 2 + 1];
      }
      
      if (this.onScanComplete) {
        this.onScanComplete(pixels);
      }
      this.scanBuffer = [];
    }
  }

  /**
   * Envía comandos siguiendo el formato binario de la DLL
   */
  private async sendCommandPacket(opcode: number, p1: number, p2: number): Promise<void> {
    if (!this.characteristic) return;
    const packet = new Uint8Array([0x02, opcode, p1, p2]);
    try {
      await this.characteristic.writeValueWithoutResponse(packet);
    } catch (e: any) {
      this.log(`Error TX: ${e.message}`);
    }
  }

  async setLamp(on: boolean): Promise<boolean> {
    if (!this.isConnected) return false;
    this.log(`Cambiando estado lámpara: ${on ? 'ON' : 'OFF'}`);
    await this.sendCommandPacket(OPCODES.LAMP, on ? 0x01 : 0x00, 0x00);
    return true;
  }

  async scan(): Promise<Uint16Array | null> {
    if (!this.isConnected) return null;
    this.scanBuffer = [];
    
    return new Promise(async (resolve) => {
      const timer = setTimeout(() => {
        this.onScanComplete = null;
        this.log("TIMEOUT: Sin respuesta del sensor.");
        resolve(null);
      }, 7000);

      this.onScanComplete = (pixels) => {
        clearTimeout(timer);
        this.onScanComplete = null;
        resolve(pixels);
      };

      await this.sendCommandPacket(OPCODES.SCAN, 0x01, 0x00);
    });
  }

  async disconnect() {
    if (this.device?.gatt.connected) {
      await this.setLamp(false);
      this.device.gatt.disconnect();
    }
    this.isConnected = false;
    this.characteristic = null;
    this.log("Desconectado.");
  }
}

export const driver = new MicroNIRDriver();
