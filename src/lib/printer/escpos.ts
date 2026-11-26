// Encoder struk untuk printer thermal 58 mm (lebar cetak 48 mm = 384 dot).
// Dua tahap supaya mudah dites:
//   layoutReceipt: data transaksi menjadi daftar baris teks (isi, font, rata)
//   encodeLines:   daftar baris menjadi byte ESC/POS
// Kolom per baris: font A (12x24) 32 kolom, font B (9x17) 42 kolom.
// Font B (ESC M 1) di printer RPP02N mencetak angka 2 sebagai 3 (hari, jam buka, nomor telepon,
// harga per kg), padahal font A benar. Karena itu seluruh struk memakai font A. Font B hanya
// dipakai bila useSmallFont dinyalakan, dan jangan dinyalakan sebelum diuji di printer.
// Isi dan urutan baris sengaja sama dengan components/Receipt58.tsx.

export interface StoreInfo {
  name: string;
  address: string;
  hours: string;
  showInvoiceNo?: boolean; // bawaan false, sama dengan config/store.ts
  showPayment?: boolean; // bawaan true: baris BAYAR dan KEMBALI
}

export interface ReceiptItem {
  product_name: string;
  weight_kg: string | number;
  price_per_kg: number;
  line_total: number;
}

// Cukup field yang dicetak. Objek Receipt dari API bisa langsung dipakai.
export interface ReceiptData {
  invoice_no?: string;
  customer_name?: string | null;
  occurred_at: string;
  items: ReceiptItem[];
  discount: number;
  total: number;
  amount_paid?: number | null;
}

export interface LayoutOptions {
  // Font kecil (B, 42 kolom) untuk baris keterangan. Bawaan mati, lihat catatan di atas.
  useSmallFont?: boolean;
  // Jam dan tanggal yang sudah diformat aplikasi (formatReceiptDate), supaya sama dengan nota lain.
  dateTime?: { date: string; time: string };
}

export interface BuildOptions extends LayoutOptions {
  feedLines?: number;
}

export type Align = "left" | "center" | "right";
export type Font = "A" | "B";

export interface Line {
  text: string;
  align?: Align;
  font?: Font;
  bold?: boolean;
  big?: boolean;
}

export const WIDTH_A = 32;
export const WIDTH_B = 42;

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;
const ALIGN_CODE: Record<Align, number> = { left: 0, center: 1, right: 2 };

// Printer memakai set karakter ASCII: aksen dibuang, karakter lain menjadi "?".
function asciiOnly(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, "?");
}

function clean(s: string): string {
  return asciiOnly(s).replace(/\s+/g, " ").trim();
}

export function formatRupiah(n: number): string {
  const v = Math.round(Number.isFinite(n) ? n : 0);
  const digits = Math.abs(v)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (v < 0 ? "-" : "") + "Rp " + digits;
}

// Sama dengan parseFloat di Receipt58: "2.000" menjadi "2", "0.250" menjadi "0.25".
export function formatWeight(w: string | number): string {
  const n = typeof w === "number" ? w : parseFloat(w);
  return Number.isFinite(n) && n > 0 ? String(n) : "0";
}

// Memecah teks per kata supaya nama produk tidak terpotong. Kata yang lebih panjang
// dari satu baris dipecah paksa.
export function wrapText(text: string, width: number): string[] {
  const max = Math.max(1, width);
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (let word of words) {
    while (word.length > max) {
      if (current) {
        lines.push(current);
        current = "";
      }
      lines.push(word.slice(0, max));
      word = word.slice(max);
    }
    if (!current) current = word;
    else if (current.length + 1 + word.length <= max) current += " " + word;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

// Teks kiri dan kanan dalam satu baris. Kalau tidak muat, kiri dibungkus
// dan kanan rata kanan di baris berikutnya.
function rowText(left: string, right: string, width: number): string[] {
  const gap = width - left.length - right.length;
  if (gap >= 1) return [left + " ".repeat(gap) + right];
  return [...wrapText(left, width), " ".repeat(Math.max(0, width - right.length)) + right];
}

// Cadangan bila aplikasi tidak memberi dateTime. Selalu WIB, apa pun zona waktu perangkat.
function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("hour")}.${get("minute")}  ${get("day")}/${get("month")}/${get("year")}`;
}

export function layoutReceipt(data: ReceiptData, store: StoreInfo, options: LayoutOptions = {}): Line[] {
  const lines: Line[] = [];
  const detailFont: Font = options.useSmallFont ? "B" : "A";
  const detailWidth = options.useSmallFont ? WIDTH_B : WIDTH_A;
  const small = (text: string, align: Align = "left") =>
    lines.push({ text, font: detailFont, align });
  const money = (label: string, value: string, bold = false) => {
    for (const text of rowText(label, value, WIDTH_A)) {
      lines.push({ text, font: "A", bold });
    }
  };
  const separator = "-".repeat(detailWidth);

  // Judul besar hanya kalau muat (lebar ganda: setengah dari 32 kolom).
  const name = clean(store.name);
  if (name.length > 0 && name.length <= WIDTH_A / 2) {
    lines.push({ text: name, font: "A", align: "center", bold: true, big: true });
  } else {
    for (const text of wrapText(name, WIDTH_A)) {
      lines.push({ text, font: "A", align: "center", bold: true });
    }
  }
  for (const field of [store.address, store.hours]) {
    const value = clean(field);
    if (value) for (const text of wrapText(value, detailWidth)) small(text, "center");
  }

  const dateText = options.dateTime
    ? asciiOnly(`${options.dateTime.time}  ${options.dateTime.date}`)
    : formatDateTime(data.occurred_at);
  for (const text of rowText("Date:", dateText, detailWidth)) small(text);
  if (store.showInvoiceNo && data.invoice_no) {
    for (const text of wrapText(clean(data.invoice_no), detailWidth)) small(text);
  }
  // Nama pelanggan selalu tercetak: "-" bila kosong.
  const customer = clean(data.customer_name ?? "") || "-";
  for (const text of wrapText(`Nama pelanggan : ${customer}`, detailWidth)) small(text);
  small(separator);

  for (const item of data.items) {
    for (const text of wrapText(clean(item.product_name), detailWidth)) small(text);
    const left = `${formatWeight(item.weight_kg)}kg x ${formatRupiah(item.price_per_kg)}/kg`;
    for (const text of rowText(left, formatRupiah(item.line_total), detailWidth)) small(text);
  }
  small(separator);

  if (data.discount > 0) money("DISKON:", formatRupiah(data.discount));
  money("TOTAL:", formatRupiah(data.total), true);
  const paid = data.amount_paid ?? null;
  if ((store.showPayment ?? true) && paid != null) {
    money("BAYAR:", formatRupiah(paid));
    money("KEMBALI:", formatRupiah(Math.max(0, paid - data.total)));
  }

  lines.push({ text: "", font: "A" });
  lines.push({ text: "TERIMA KASIH", font: "A", align: "center", bold: true });

  return lines;
}

// Perintah hanya dikirim saat berubah dari baris sebelumnya, supaya data tetap kecil.
export function encodeLines(lines: Line[], feedLines = 4): Uint8Array {
  const out: number[] = [ESC, 0x40]; // reset printer
  let align: Align = "left";
  let font: Font = "A";
  let bold = false;
  let big = false;

  for (const line of lines) {
    const nextAlign = line.align ?? "left";
    const nextFont = line.font ?? "A";
    const nextBold = line.bold ?? false;
    const nextBig = line.big ?? false;

    if (nextAlign !== align) {
      out.push(ESC, 0x61, ALIGN_CODE[nextAlign]);
      align = nextAlign;
    }
    if (nextFont !== font) {
      out.push(ESC, 0x4d, nextFont === "B" ? 1 : 0);
      font = nextFont;
    }
    if (nextBold !== bold) {
      out.push(ESC, 0x45, nextBold ? 1 : 0);
      bold = nextBold;
    }
    if (nextBig !== big) {
      out.push(GS, 0x21, nextBig ? 0x11 : 0x00);
      big = nextBig;
    }

    for (let i = 0; i < line.text.length; i++) out.push(line.text.charCodeAt(i) & 0x7f);
    out.push(LF);
  }

  out.push(ESC, 0x64, feedLines); // dorong kertas supaya struk bisa disobek
  return Uint8Array.from(out);
}

export function buildReceipt(data: ReceiptData, store: StoreInfo, options: BuildOptions = {}): Uint8Array {
  return encodeLines(layoutReceipt(data, store, options), options.feedLines ?? 4);
}
