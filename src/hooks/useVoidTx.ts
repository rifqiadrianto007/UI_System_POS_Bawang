import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '../components/Toast'
import { api } from '../lib/api'

// Batalkan transaksi (khusus owner). Memengaruhi laporan, stok, dan HPP, jadi semuanya disegarkan.
export function useVoidTx() {
  const qc = useQueryClient()
  const toast = useToast()
  return async (id: number, reason: string) => {
    await api(`/transactions/${id}/void`, { method: 'POST', body: JSON.stringify({ reason }) })
    await Promise.all(['transactions', 'transaction', 'finance', 'stock', 'stock-report', 'products-admin'].map((k) => qc.invalidateQueries({ queryKey: [k] })))
    toast.success('Transaksi dibatalkan')
  }
}
