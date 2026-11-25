import { Printer } from 'lucide-react'
import { usePrinterStatus } from '../hooks/usePrinterStatus'
import { PrinterError, connect } from '../lib/printer/printerService'

const LABEL = {
  disconnected: 'Printer belum tersambung',
  connecting: 'Menyambung printer...',
  connected: 'Printer siap',
} as const

const DOT = {
  disconnected: 'bg-red-500',
  connecting: 'bg-amber-400',
  connected: 'bg-green-500',
} as const

// Indikator printer untuk header kasir. Ketuk saat belum tersambung untuk memilih printer.
// Saat sudah tersambung, ketukan tidak melakukan apa pun supaya tidak memutus koneksi tanpa sengaja.
// onError: dipanggil dengan pesan kegagalan, atau null untuk menghapus pesan lama.
export default function PrinterStatusButton({ onError }: { onError?: (message: string | null) => void }) {
  const status = usePrinterStatus()
  if (status === 'unsupported') return null

  async function handleClick() {
    if (status !== 'disconnected') return
    onError?.(null)
    try {
      await connect()
    } catch (e) {
      if (e instanceof PrinterError && e.code === 'CANCELLED') return
      onError?.(e instanceof Error ? e.message : 'Printer gagal tersambung.')
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={LABEL[status]}
      aria-label={LABEL[status]}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium"
    >
      <Printer size={18} aria-hidden="true" />
      <span className={`h-2 w-2 rounded-full ${DOT[status]}`} aria-hidden="true" />
      <span className="hidden sm:inline">{LABEL[status]}</span>
    </button>
  )
}
