import type { Receipt } from "../types";
import { printReceiptBluetooth } from "./printReceipt";
import { connect, hasDevice, isBluetoothPreferred, isPrinterSupported } from "./printerService";

// Perangkat ini memakai printer Bluetooth bila browser mendukung dan printer pernah dipilih di sini.
// Selain itu cetak tetap lewat window.print seperti sebelumnya.
export function shouldUseBluetooth(): boolean {
  return isPrinterSupported() && isBluetoothPreferred();
}

// Dialog pilih printer di Chrome hanya boleh dibuka tak lama setelah sentuhan pengguna.
function hasFreshTap(): boolean {
  const nav = navigator as Navigator & { userActivation?: { isActive: boolean } };
  return nav.userActivation?.isActive ?? true;
}

// Urutan: sambungkan printer (dialog bila perlu), ambil data struk, lalu cetak.
// Dialog dibuka sebelum permintaan jaringan karena sentuhan pengguna bisa kedaluwarsa
// selagi menunggu server. Bila sentuhan sudah kedaluwarsa, dialog dilewati dan pencetakan
// gagal dengan pesan "ketuk tombol cetak sekali lagi", dan ketukan itu membuka dialog.
// Melempar PrinterError. Kesalahan dari getReceipt dilempar apa adanya.
export async function printViaBluetooth(getReceipt: () => Promise<Receipt>): Promise<void> {
  if (!hasDevice() && hasFreshTap()) await connect();
  const receipt = await getReceipt();
  await printReceiptBluetooth(receipt);
}
