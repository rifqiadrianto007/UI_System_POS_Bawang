import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { api, ApiError } from '../lib/api'
import Receipt58 from '../components/Receipt58'
import type { Receipt } from '../lib/types'

// Cetak ulang / unduh PDF nota dari id transaksi. Pasang `node` sekali di halaman yang memakainya.
export function useReceiptPrint() {
  const [data, setData] = useState<Receipt | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!data) return
    const t = setTimeout(() => window.print(), 150)
    const after = () => setData(null)
    window.addEventListener('afterprint', after)
    return () => { clearTimeout(t); window.removeEventListener('afterprint', after) }
  }, [data])

  async function run(id: number, paid: number | null | undefined, job: (r: Receipt) => void | Promise<void>, failMsg: string) {
    setBusyId(id); setError(null)
    try {
      const rc = await api<{ data: Receipt }>(`/transactions/${id}/receipt`)
      await job({ ...rc.data, amount_paid: rc.data.amount_paid ?? paid ?? null })
    } catch (e) {
      setError(e instanceof ApiError && e.status === 404 ? 'Transaksi ini di luar jangka waktu yang bisa dilihat kasir.' : failMsg)
    } finally { setBusyId(null) }
  }

  return {
    busyId, error, clearError: () => setError(null),
    print: (id: number, paid?: number | null) => run(id, paid, (r) => setData(r), 'Nota gagal diambil, coba lagi.'),
    pdf: (id: number, paid?: number | null) =>
      run(id, paid, async (r) => { const { downloadReceiptPdf } = await import('../lib/receiptPdf'); await downloadReceiptPdf(r) }, 'PDF gagal dibuat, coba lagi.'),
    node: data ? createPortal(<Receipt58 r={data} />, document.body) : null,
  }
}
