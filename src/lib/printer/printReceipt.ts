import { STORE } from "../../config/store";
import { formatReceiptDate } from "../format";
import type { Receipt } from "../types";
import { buildReceipt } from "./escpos";
import { printBytes } from "./printerService";

// Mencetak objek Receipt dari API ke printer thermal lewat Bluetooth.
// Data toko diambil dari config/store.ts, dan jam serta tanggal dari formatReceiptDate,
// jadi sama dengan nota di Receipt58 dan PDF.
export function printReceiptBluetooth(r: Receipt): Promise<void> {
  return printBytes(buildReceipt(r, STORE, { dateTime: formatReceiptDate(r.occurred_at) }));
}
