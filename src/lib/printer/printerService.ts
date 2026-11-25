// Layanan Bluetooth (BLE) untuk printer thermal lewat Web Bluetooth.
// Butuh Chrome dengan HTTPS. Objek Web Bluetooth sengaja bertipe any
// supaya proyek tidak perlu menambah @types/web-bluetooth.
//
// Aturan penting dari uji di perangkat:
// - Potongan tulis 20 byte. Di HP Android, potongan 100 byte hilang diam-diam
//   (printer hanya menggerakkan kertas kosong), sedangkan di laptop 100 byte lancar.
// - Dialog pilih printer wajib setelah halaman dimuat ulang. Setelah itu koneksi
//   disambung ulang diam-diam memakai objek perangkat yang masih ada di memori.

export type PrinterStatus = "unsupported" | "disconnected" | "connecting" | "connected";
export type PrinterErrorCode = "UNSUPPORTED" | "CANCELLED" | "NOT_CONNECTED" | "WRITE_FAILED";

export class PrinterError extends Error {
  code: PrinterErrorCode;
  constructor(code: PrinterErrorCode, message: string) {
    super(message);
    this.name = "PrinterError";
    this.code = code;
  }
}

// Jalur tulis yang terbaca dari printer RPP02N, dicoba berurutan (bukan "yang pertama ditemukan",
// karena urutan penemuan bisa berbeda antar perangkat).
const ROUTES = [
  { service: "49535343-fe7d-4ae5-8fa9-9fafd205e455", characteristic: "49535343-8841-43f4-a8d4-ecbe34729bb3" },
  { service: "0000ff00-0000-1000-8000-00805f9b34fb", characteristic: "0000ff02-0000-1000-8000-00805f9b34fb" },
  { service: "000018f0-0000-1000-8000-00805f9b34fb", characteristic: "00002af1-0000-1000-8000-00805f9b34fb" },
  { service: "e7810a71-73ae-499d-8c15-faa9aef0c3f2", characteristic: "bef8d6c9-9c21-4c9e-b632-bd58c1009f9f" },
];

const RECONNECT_TIMEOUT_MS = 8000; // sambung ulang saat mencetak
const QUICK_TIMEOUT_MS = 3000; // sambung ulang cepat sebelum dialog (izin sentuhan Chrome terbatas ~5 detik)

// ---------- Pengaturan ----------

export interface PrinterSettings {
  chunkSize: number;
  delayMs: number;
}

const SETTINGS_KEY = "pos.printer.settings";
const DEFAULT_SETTINGS: PrinterSettings = { chunkSize: 20, delayMs: 10 };

function pick(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

// Nilai di atas 20 byte hanya aman kalau sudah diuji di perangkat yang sama.
export function normalizeSettings(raw: Partial<PrinterSettings> | null | undefined): PrinterSettings {
  return {
    chunkSize: pick(raw?.chunkSize, 20, 512, DEFAULT_SETTINGS.chunkSize),
    delayMs: pick(raw?.delayMs, 0, 200, DEFAULT_SETTINGS.delayMs),
  };
}

export function getSettings(): PrinterSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    return normalizeSettings(stored ? (JSON.parse(stored) as Partial<PrinterSettings>) : null);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(next: Partial<PrinterSettings>): PrinterSettings {
  const merged = normalizeSettings({ ...getSettings(), ...next });
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
  } catch {
    // penyimpanan penuh atau diblokir: pengaturan berlaku sampai halaman dimuat ulang
  }
  return merged;
}

// Penanda bahwa perangkat ini memakai printer Bluetooth. Dinyalakan saat printer pertama
// kali berhasil dipilih. Selama belum menyala, cetak tetap lewat window.print (laptop, demo).
const PREFER_KEY = "pos.printer.prefer";

export function isBluetoothPreferred(): boolean {
  try {
    return localStorage.getItem(PREFER_KEY) === "1";
  } catch {
    return false;
  }
}

export function setBluetoothPreferred(value: boolean): void {
  try {
    if (value) localStorage.setItem(PREFER_KEY, "1");
    else localStorage.removeItem(PREFER_KEY);
  } catch {
    // diabaikan
  }
}

// ---------- Status ----------

function getBluetooth(): any {
  return typeof navigator !== "undefined" ? ((navigator as any).bluetooth ?? null) : null;
}

export function isPrinterSupported(): boolean {
  return getBluetooth() !== null;
}

let status: PrinterStatus = isPrinterSupported() ? "disconnected" : "unsupported";
const listeners = new Set<() => void>();

function setStatus(next: PrinterStatus): void {
  if (status === next) return;
  status = next;
  listeners.forEach((listener) => listener());
}

export function getStatus(): PrinterStatus {
  return status;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// ---------- Koneksi ----------

let device: any = null;
let characteristic: any = null;

function onDisconnected(): void {
  characteristic = null;
  setStatus("disconnected");
}

function attach(next: any): void {
  if (device && device !== next) {
    device.removeEventListener("gattserverdisconnected", onDisconnected);
    try {
      device.gatt?.disconnect();
    } catch {
      // diabaikan
    }
  }
  device = next;
  device.addEventListener("gattserverdisconnected", onDisconnected);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new PrinterError("NOT_CONNECTED", message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function toPrinterError(error: unknown): PrinterError {
  if (error instanceof PrinterError) return error;
  const message = error instanceof Error ? error.message : String(error);
  return new PrinterError("NOT_CONNECTED", `Tidak bisa tersambung ke printer: ${message}`);
}

async function openGatt(target: any, timeoutMs: number): Promise<void> {
  characteristic = null;
  const server = await withTimeout<any>(
    target.gatt.connect(),
    timeoutMs,
    "Printer tidak merespons. Pastikan printer menyala dan dekat dengan perangkat.",
  );
  for (const route of ROUTES) {
    try {
      const service = await server.getPrimaryService(route.service);
      characteristic = await service.getCharacteristic(route.characteristic);
      return;
    } catch {
      // jalur ini tidak ada di printer, coba berikutnya
    }
  }
  throw new PrinterError("NOT_CONNECTED", "Printer ini tidak punya jalur cetak yang dikenal.");
}

async function reconnect(timeoutMs: number): Promise<void> {
  if (!device) throw new PrinterError("NOT_CONNECTED", "Printer belum dipilih.");
  setStatus("connecting");
  try {
    await openGatt(device, timeoutMs);
    setStatus("connected");
  } catch (error) {
    try {
      device.gatt?.disconnect();
    } catch {
      // diabaikan
    }
    characteristic = null;
    setStatus("disconnected");
    throw toPrinterError(error);
  }
}

export function hasDevice(): boolean {
  return device !== null;
}

// Harus dipanggil langsung dari klik pengguna (dialog Chrome butuh sentuhan segar).
// Jangan menunggu permintaan jaringan sebelum memanggil fungsi ini.
export async function connect(): Promise<void> {
  const bluetooth = getBluetooth();
  if (!bluetooth) {
    throw new PrinterError(
      "UNSUPPORTED",
      "Browser ini tidak mendukung Bluetooth. Pakai Chrome di Android dengan alamat HTTPS.",
    );
  }

  // Printer yang pernah dipilih: coba sambung cepat tanpa dialog dulu.
  if (device) {
    try {
      await reconnect(QUICK_TIMEOUT_MS);
      setBluetoothPreferred(true);
      return;
    } catch {
      // lanjut ke dialog pilih printer
    }
  }

  setStatus("connecting");
  try {
    const picked = await bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ROUTES.map((route) => route.service),
    });
    attach(picked);
    await openGatt(picked, RECONNECT_TIMEOUT_MS);
    setStatus("connected");
    setBluetoothPreferred(true);
  } catch (error) {
    characteristic = null;
    setStatus("disconnected");
    if (error instanceof Error && error.name === "NotFoundError") {
      throw new PrinterError("CANCELLED", "Pemilihan printer dibatalkan.");
    }
    throw toPrinterError(error);
  }
}

// Untuk layar pengaturan nanti: lupakan printer dan kembali ke cetak biasa (window.print).
export function forgetPrinter(): void {
  disconnect();
  device = null;
  setBluetoothPreferred(false);
}

export function disconnect(): void {
  try {
    device?.gatt?.disconnect();
  } catch {
    // diabaikan
  }
  characteristic = null;
  setStatus("disconnected");
}

// ---------- Cetak ----------

async function writeChunk(target: any, part: Uint8Array, withoutResponse: boolean): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      if (withoutResponse) await target.writeValueWithoutResponse(part);
      else await target.writeValue(part);
      return;
    } catch {
      if (attempt >= 2) throw new PrinterError("WRITE_FAILED", "Gagal mengirim data ke printer.");
      await sleep(50);
    }
  }
}

async function writeAll(data: Uint8Array): Promise<void> {
  if (!isPrinterSupported()) {
    throw new PrinterError("UNSUPPORTED", "Browser ini tidak mendukung Bluetooth.");
  }
  if (!device) {
    throw new PrinterError(
      "NOT_CONNECTED",
      "Printer belum tersambung. Ketuk tombol cetak sekali lagi untuk memilih printer.",
    );
  }
  if (!characteristic || !device.gatt?.connected) await reconnect(RECONNECT_TIMEOUT_MS);

  const target = characteristic;
  if (!target) throw new PrinterError("NOT_CONNECTED", "Printer belum tersambung.");
  const { chunkSize, delayMs } = getSettings();
  const withoutResponse = Boolean(
    target.properties?.writeWithoutResponse && target.writeValueWithoutResponse,
  );

  try {
    for (let i = 0; i < data.length; i += chunkSize) {
      await writeChunk(target, data.slice(i, i + chunkSize), withoutResponse);
      if (delayMs > 0) await sleep(delayMs);
    }
  } catch (error) {
    // Koneksi diputus supaya percobaan berikutnya mulai bersih.
    try {
      device?.gatt?.disconnect();
    } catch {
      // diabaikan
    }
    throw toPrinterError(error);
  }
}

// Cetakan diantre satu per satu, jadi dua ketukan cepat tidak mencampur data.
let queue: Promise<void> = Promise.resolve();

export function printBytes(data: Uint8Array): Promise<void> {
  const run = queue.then(() => writeAll(data));
  queue = run.catch(() => undefined);
  return run;
}
