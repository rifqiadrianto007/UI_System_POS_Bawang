import { useRef, useState, type CSSProperties } from "react";

// HALAMAN UJI SAJA. Hapus atau kunci sebelum toko memakai sistem.
// Tujuan: membuktikan printer bisa dicetak lewat Web Bluetooth dari Chrome Android,
// membaca UUID yang dipakai printer, dan mencari ukuran potongan serta jeda tercepat yang stabil.

// Layanan BLE yang umum dipakai printer thermal murah.
// Web Bluetooth hanya membuka layanan yang didaftarkan di sini saat memilih perangkat.
// Kalau printer memakai UUID lain, log akan kosong: baca UUID-nya dengan nRF Connect.
const CANDIDATE_SERVICES = [
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000fff0-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "000018f0-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
  "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
];

const ESC = 0x1b;
const GS = 0x1d;
const WIDTH = 32; // kolom per baris: lebar cetak 384 dot dibagi font bawaan 12x24

type Part = number[] | string;

const encoder = new TextEncoder();

// Printer ini memakai set karakter ASCII. Aksen dibuang dan karakter lain jadi "?".
function toAscii(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e\n]/g, "?");
}

function bytes(parts: Part[]) {
  const out: number[] = [];
  for (const p of parts) {
    if (typeof p === "string") out.push(...encoder.encode(toAscii(p)));
    else out.push(...p);
  }
  return new Uint8Array(out);
}

const rupiah = (n: number) => "Rp" + n.toLocaleString("id-ID");

// Satu baris selebar WIDTH: teks kiri dan teks kanan, kiri dipotong kalau terlalu panjang.
function row(left: string, right: string) {
  const space = WIDTH - right.length - 1;
  const l = left.length > space ? left.slice(0, space) : left;
  return l + " ".repeat(WIDTH - l.length - right.length) + right + "\n";
}

function receipt(itemCount: number) {
  const line = "-".repeat(WIDTH) + "\n";
  const parts: Part[] = [
    [ESC, 0x40], // reset printer
    [ESC, 0x61, 1], // rata tengah
    [ESC, 0x45, 1], // tebal
    [GS, 0x21, 0x11], // lebar dan tinggi ganda
    "FAUNA BAWANG\n",
    [GS, 0x21, 0x00],
    [ESC, 0x45, 0],
    "Pasar Buah Gebang\n",
    [ESC, 0x61, 0], // rata kiri
    line,
  ];

  let total = 0;
  for (let i = 1; i <= itemCount; i++) {
    const kg = (i % 3) + 1;
    const harga = 32000;
    total += kg * harga;
    parts.push(`Merah A ${i}\n`, row(`${kg}kg x ${rupiah(harga)}`, rupiah(kg * harga)));
  }

  parts.push(
    line,
    [ESC, 0x45, 1],
    row("TOTAL", rupiah(total)),
    [ESC, 0x45, 0],
    [ESC, 0x61, 1],
    "TERIMA KASIH\n",
    [ESC, 0x64, 4], // dorong kertas 4 baris supaya struk bisa disobek
  );
  return bytes(parts);
}

const btn: CSSProperties = {
  padding: "14px 16px",
  fontSize: 16,
  borderRadius: 8,
  border: "1px solid #888",
  background: "#fff",
  color: "#111",
};

const field: CSSProperties = {
  display: "block",
  width: "100%",
  padding: 10,
  marginTop: 4,
  fontSize: 16,
  boxSizing: "border-box",
};

export default function TesPrinter() {
  const [log, setLog] = useState<string[]>([]);
  const [chunk, setChunk] = useState(100);
  const [delay, setDelay] = useState(20);
  const deviceRef = useRef<any>(null);
  const charRef = useRef<any>(null);

  const say = (m: string) => setLog((l) => [...l, m]);

  function attach(device: any) {
    deviceRef.current = device;
    device.addEventListener("gattserverdisconnected", () => {
      charRef.current = null;
      say("Koneksi terputus.");
    });
  }

  async function openGatt(device: any, quiet = false) {
    charRef.current = null;
    const server = await device.gatt.connect();
    let services: any[] = [];
    try {
      services = await server.getPrimaryServices();
    } catch {
      say("Tidak ada layanan yang cocok dengan daftar. Baca UUID printer dengan nRF Connect.");
      return;
    }
    for (const s of services) {
      const chars = await s.getCharacteristics();
      for (const c of chars) {
        const p = c.properties;
        if (!quiet) {
          say(`${s.uuid} | ${c.uuid} | write=${p.write} tanpaBalasan=${p.writeWithoutResponse}`);
        }
        if (!charRef.current && (p.writeWithoutResponse || p.write)) charRef.current = c;
      }
    }
    say(
      charRef.current
        ? `Dipakai: ${charRef.current.uuid}`
        : "Tidak ada characteristic yang bisa ditulis.",
    );
  }

  async function connect() {
    const bt = (navigator as any).bluetooth;
    if (!bt) return say("Web Bluetooth tidak tersedia. Pakai Chrome Android dan alamat HTTPS.");
    try {
      const device = await bt.requestDevice({
        acceptAllDevices: true,
        optionalServices: CANDIDATE_SERVICES,
      });
      attach(device);
      say(`Perangkat: ${device.name ?? "(tanpa nama)"}`);
      await openGatt(device);
    } catch (e: any) {
      say(`Gagal: ${e?.message ?? e}`);
    }
  }

  // Menguji apakah Chrome ini bisa menyambung ulang ke printer yang pernah dipilih tanpa dialog.
  async function reconnectSaved() {
    const bt = (navigator as any).bluetooth;
    if (!bt?.getDevices) return say("getDevices tidak tersedia di Chrome ini.");
    try {
      const devices = await bt.getDevices();
      say(`Perangkat tersimpan: ${devices.length}`);
      if (!devices.length) return;
      attach(devices[0]);
      await openGatt(devices[0]);
    } catch (e: any) {
      say(`Gagal: ${e?.message ?? e}`);
    }
  }

  async function send(data: Uint8Array) {
    if (!charRef.current && deviceRef.current) await openGatt(deviceRef.current, true);
    const c = charRef.current;
    if (!c) throw new Error("Belum terhubung ke printer.");
    const noResponse = c.properties.writeWithoutResponse;
    for (let i = 0; i < data.length; i += chunk) {
      const part = data.slice(i, i + chunk);
      if (noResponse) await c.writeValueWithoutResponse(part);
      else await c.writeValue(part);
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    }
  }

  // Waktu yang dicatat adalah waktu mengirim data ke printer, bukan waktu kertas selesai keluar.
  async function print(label: string, data: Uint8Array) {
    const t0 = performance.now();
    try {
      await send(data);
      say(`${label}: ${data.length} byte terkirim dalam ${Math.round(performance.now() - t0)} ms`);
    } catch (e: any) {
      say(`${label} gagal: ${e?.message ?? e}`);
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 20, margin: "0 0 12px" }}>Tes printer thermal</h1>

      <div style={{ display: "grid", gap: 8 }}>
        <button style={btn} onClick={connect}>Pilih printer</button>
        <button style={btn} onClick={reconnectSaved}>Sambung ulang tanpa dialog</button>
        <button style={btn} onClick={() => print("Tes pendek", receipt(2))}>Cetak tes pendek</button>
        <button style={btn} onClick={() => print("Struk 15 item", receipt(15))}>Cetak struk 15 item</button>
        <button style={btn} onClick={() => deviceRef.current?.gatt?.disconnect()}>Putuskan</button>
        <button style={btn} onClick={() => setLog([])}>Hapus log</button>
      </div>

      <label style={{ display: "block", marginTop: 16 }}>
        Ukuran potongan (byte)
        <input
          style={field}
          type="number"
          min={20}
          max={512}
          value={chunk}
          onChange={(e) => setChunk(Number(e.target.value))}
        />
      </label>
      <label style={{ display: "block", marginTop: 12 }}>
        Jeda antar potongan (ms)
        <input
          style={field}
          type="number"
          min={0}
          max={200}
          value={delay}
          onChange={(e) => setDelay(Number(e.target.value))}
        />
      </label>

      <pre
        style={{
          marginTop: 16,
          padding: 12,
          minHeight: 160,
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
          fontSize: 12,
          border: "1px solid #888",
          borderRadius: 8,
        }}
      >
        {log.join("\n") || "Log kosong."}
      </pre>
    </div>
  );
}
