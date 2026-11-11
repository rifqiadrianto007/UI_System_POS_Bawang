import { useQuery, type QueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { ProductAdmin, ProductKind, Purchase, Supplier } from '../lib/types'

function purchaseRows(payload: unknown): Purchase[] {
  if (!payload || typeof payload !== 'object') return []
  const root = payload as { data?: unknown }
  if (Array.isArray(root.data)) return root.data as Purchase[]
  if (root.data && typeof root.data === 'object') {
    const nested = root.data as { data?: unknown; items?: unknown }
    if (Array.isArray(nested.data)) return nested.data as Purchase[]
    if (Array.isArray(nested.items)) return nested.items as Purchase[]
  }
  return []
}

export const usePurchases = (jenis?: ProductKind) => useQuery({
  queryKey: ['purchases', jenis ?? 'all'],
  queryFn: () => api<unknown>(jenis ? `/purchases?jenis=${jenis}&per_page=50` : '/purchases?per_page=50').then((r) => purchaseRows(r).sort((a, b) => String(b.purchased_at ?? '').localeCompare(String(a.purchased_at ?? '')) || b.id - a.id)),
})
export const useSuppliers = () => useQuery({ queryKey: ['suppliers'], queryFn: () => api<{ data: Supplier[] }>('/suppliers').then((r) => r.data) })
export const useProductsAdmin = () => useQuery({ queryKey: ['products-admin'], queryFn: () => api<{ data: ProductAdmin[] }>('/products').then((r) => r.data) })

export const refreshStock = (qc: QueryClient) =>
  Promise.all(['purchases', 'stock', 'stock-report', 'products-admin', 'finance'].map((k) => qc.invalidateQueries({ queryKey: [k] })))
