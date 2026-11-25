import { describe, expect, it } from "vitest";
import {
  WIDTH_A,
  WIDTH_B,
  buildReceipt,
  encodeLines,
  formatRupiah,
  formatWeight,
  layoutReceipt,
  wrapText,
  type LayoutOptions,
  type ReceiptData,
  type StoreInfo,
} from "./escpos";
import { isBluetoothPreferred, normalizeSettings } from "./printerService";

const store: StoreInfo = {
  name: "FAUNA BAWANG",
  address: "Pasar Buah Gebang",
  hours: "05.30-12.00 dan 16.00-21.00",
  phone: "08123456789",
};

const sample: ReceiptData = {
  invoice_no: "POS-261124-0003",
  occurred_at: "2026-11-24T23:20:49+07:00",
  items: [{ product_name: "Merah Premium A", weight_kg: "2.000", price_per_kg: 27500, line_total: 55000 }],
  discount: 0,
  total: 55000,
  amount_paid: 55000,
};

const texts = (data: ReceiptData, info: StoreInfo = store, options?: LayoutOptions) =>
  layoutReceipt(data, info, options).map((line) => line.text);

describe("format", () => {
  it("rupiah memakai titik ribuan", () => {
    expect(formatRupiah(0)).toBe("Rp 0");
    expect(formatRupiah(55000)).toBe("Rp 55.000");
    expect(formatRupiah(1234567)).toBe("Rp 1.234.567");
  });

  it("berat sama dengan parseFloat di Receipt58", () => {
    expect(formatWeight("2.000")).toBe("2");
    expect(formatWeight("0.250")).toBe("0.25");
    expect(formatWeight(1.5)).toBe("1.5");
    expect(formatWeight("10.000")).toBe("10");
    expect(formatWeight("abc")).toBe("0");
  });

  it("wrapText tidak melewati lebar dan tidak memotong kata pendek", () => {
    const wrapped = wrapText("Bawang Merah Super Premium Pilihan Nomor Satu Bersih", WIDTH_B);
    expect(wrapped.length).toBeGreaterThan(1);
    for (const line of wrapped) expect(line.length).toBeLessThanOrEqual(WIDTH_B);
    expect(wrapped.join(" ")).toBe("Bawang Merah Super Premium Pilihan Nomor Satu Bersih");
  });

  it("wrapText memecah paksa kata yang lebih panjang dari baris", () => {
    const wrapped = wrapText("x".repeat(100), WIDTH_B);
    for (const line of wrapped) expect(line.length).toBeLessThanOrEqual(WIDTH_B);
    expect(wrapped.join("")).toBe("x".repeat(100));
  });
});

describe("layoutReceipt", () => {
  it("memuat bagian yang ada di desain struk client", () => {
    const lines = texts(sample);
    expect(lines).toContain("FAUNA BAWANG");
    expect(lines).toContain("Pasar Buah Gebang");
    expect(lines).toContain("Merah Premium A");
    expect(lines).toContain("TERIMA KASIH");
    expect(lines).toContain("hubungi : 08123456789");

    const item = lines.find((t) => t.startsWith("2kg x Rp 27.500/kg"));
    expect(item?.endsWith("Rp 55.000")).toBe(true);
    expect(lines.find((t) => t.startsWith("TOTAL:"))?.endsWith("Rp 55.000")).toBe(true);
    expect(lines.find((t) => t.startsWith("KEMBALI:"))?.endsWith("Rp 0")).toBe(true);
  });

  it("baris tanggal memakai WIB bila aplikasi tidak memberi dateTime", () => {
    const date = texts(sample).find((t) => t.startsWith("Date:"));
    expect(date).toHaveLength(WIDTH_B);
    expect(date?.endsWith("23.20  24/11/2026")).toBe(true);
  });

  it("baris tanggal memakai dateTime dari aplikasi, dua spasi seperti Receipt58", () => {
    const date = texts(sample, store, { dateTime: { date: "24/11/2026", time: "23.20" } }).find((t) =>
      t.startsWith("Date:"),
    );
    expect(date?.endsWith("23.20  24/11/2026")).toBe(true);
  });

  it("nomor invoice hanya tercetak bila showInvoiceNo menyala", () => {
    expect(texts(sample).join("\n")).not.toContain("POS-261124");
    expect(texts(sample, { ...store, showInvoiceNo: true })).toContain("POS-261124-0003");
  });

  it("baris DISKON hanya muncul bila ada diskon, tanpa tanda minus", () => {
    expect(texts(sample).some((t) => t.startsWith("DISKON:"))).toBe(false);
    const discounted: ReceiptData = { ...sample, discount: 5000, total: 50000, amount_paid: 50000 };
    const row = texts(discounted).find((t) => t.startsWith("DISKON:"));
    expect(row?.endsWith("Rp 5.000")).toBe(true);
    expect(row).not.toContain("-");
  });

  it("BAYAR dan KEMBALI dilewati untuk data lama tanpa amount_paid", () => {
    for (const old of [{ ...sample, amount_paid: null }, { ...sample, amount_paid: undefined }]) {
      const lines = texts(old);
      expect(lines.some((t) => t.startsWith("BAYAR:"))).toBe(false);
      expect(lines.some((t) => t.startsWith("KEMBALI:"))).toBe(false);
      expect(lines.some((t) => t.startsWith("TOTAL:"))).toBe(true);
    }
  });

  it("BAYAR dan KEMBALI dilewati bila showPayment dimatikan", () => {
    const lines = texts(sample, { ...store, showPayment: false });
    expect(lines.some((t) => t.startsWith("BAYAR:"))).toBe(false);
    expect(lines.some((t) => t.startsWith("KEMBALI:"))).toBe(false);
  });

  it("kembalian dihitung dari bayar dikurangi total, tidak pernah negatif", () => {
    const more = texts({ ...sample, amount_paid: 100000 });
    expect(more.find((t) => t.startsWith("KEMBALI:"))?.endsWith("Rp 45.000")).toBe(true);
    const less = texts({ ...sample, amount_paid: 40000 });
    expect(less.find((t) => t.startsWith("KEMBALI:"))?.endsWith("Rp 0")).toBe(true);
  });

  it("nomor telepon kosong tidak mencetak baris kontak", () => {
    expect(texts(sample, { ...store, phone: "" }).some((t) => t.startsWith("hubungi"))).toBe(false);
  });

  it("aksen dibuang dari nama produk", () => {
    const data: ReceiptData = {
      ...sample,
      items: [{ ...sample.items[0], product_name: "Bawang Mérah Spésial" }],
    };
    expect(texts(data)).toContain("Bawang Merah Spesial");
  });

  it("tidak ada baris yang melebihi lebar kolomnya", () => {
    const longStore: StoreInfo = { ...store, name: "TOKO BAWANG MERAH PUTIH SEJAHTERA ABADI" };
    const data: ReceiptData = {
      ...sample,
      items: [
        { product_name: "Bawang Merah Super Premium Pilihan Nomor Satu Bersih Kering", weight_kg: "12.500", price_per_kg: 27500, line_total: 343750 },
        { product_name: "x".repeat(90), weight_kg: 0.25, price_per_kg: 1000000, line_total: 250000000 },
      ],
      total: 250343750,
      amount_paid: 300000000,
    };
    for (const line of layoutReceipt(data, longStore)) {
      const width = line.font === "B" ? WIDTH_B : WIDTH_A;
      expect(line.text.length).toBeLessThanOrEqual(line.big ? width / 2 : width);
    }
  });

  it("struk 60 item tetap dibangun", () => {
    const items = Array.from({ length: 60 }, () => sample.items[0]);
    const bytes = buildReceipt({ ...sample, items }, store);
    expect(bytes.length).toBeGreaterThan(2000);
  });
});

describe("encodeLines", () => {
  it("diawali reset printer dan diakhiri dorong kertas", () => {
    const bytes = buildReceipt(sample, store);
    expect([bytes[0], bytes[1]]).toEqual([0x1b, 0x40]);
    expect(Array.from(bytes.slice(-3))).toEqual([0x1b, 0x64, 4]);
  });

  it("jumlah baris dorong kertas bisa diatur", () => {
    const bytes = buildReceipt(sample, store, { feedLines: 2 });
    expect(Array.from(bytes.slice(-3))).toEqual([0x1b, 0x64, 2]);
  });

  it("semua byte ASCII, tidak ada sisa UTF-8", () => {
    const data: ReceiptData = {
      ...sample,
      items: [{ ...sample.items[0], product_name: "Bawang Mérah ★" }],
    };
    for (const byte of buildReceipt(data, store)) expect(byte).toBeLessThan(0x80);
  });

  it("perintah gaya hanya dikirim saat berubah", () => {
    const bytes = encodeLines([
      { text: "A", bold: true },
      { text: "B", bold: true },
    ]);
    const boldOn = [0x1b, 0x45, 1];
    let count = 0;
    for (let i = 0; i < bytes.length - 2; i++) {
      if (bytes[i] === boldOn[0] && bytes[i + 1] === boldOn[1] && bytes[i + 2] === boldOn[2]) count++;
    }
    expect(count).toBe(1);
  });
});

describe("pengaturan printer", () => {
  it("memakai nilai bawaan 20 byte dan 10 ms", () => {
    expect(normalizeSettings(undefined)).toEqual({ chunkSize: 20, delayMs: 10 });
    expect(normalizeSettings(null)).toEqual({ chunkSize: 20, delayMs: 10 });
  });

  it("membatasi nilai di luar rentang", () => {
    expect(normalizeSettings({ chunkSize: 5, delayMs: -3 })).toEqual({ chunkSize: 20, delayMs: 0 });
    expect(normalizeSettings({ chunkSize: 9999, delayMs: 999 })).toEqual({ chunkSize: 512, delayMs: 200 });
  });

  it("nilai bukan angka kembali ke bawaan, bukan nol", () => {
    const bad = { chunkSize: null, delayMs: "5" } as unknown as { chunkSize: number; delayMs: number };
    expect(normalizeSettings(bad)).toEqual({ chunkSize: 20, delayMs: 10 });
  });

  it("membulatkan angka desimal", () => {
    expect(normalizeSettings({ chunkSize: 100.4, delayMs: 7.6 })).toEqual({ chunkSize: 100, delayMs: 8 });
  });

  it("cetak Bluetooth tidak menyala sendiri di perangkat baru", () => {
    expect(isBluetoothPreferred()).toBe(false);
  });
});
