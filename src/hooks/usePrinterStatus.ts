import { useSyncExternalStore } from "react";
import { getStatus, subscribe } from "../lib/printer/printerService";

// Status: "unsupported" | "disconnected" | "connecting" | "connected".
// Pasang di header kasir. Ketukan pada indikator memanggil connect() dari printerService.
export function usePrinterStatus() {
  return useSyncExternalStore(subscribe, getStatus, getStatus);
}
