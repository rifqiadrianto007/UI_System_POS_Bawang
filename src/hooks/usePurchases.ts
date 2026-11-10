import { useQuery, type QueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { ProductAdmin, Purchase, Supplier } from '../lib/types'

export const usePurchases = () => useQuery({
  queryKey: ['purchases'],
  queryFn: () => api<{ data?: Purchase[] }>('/purchases').then((r) => [...(Array.isArray(r.data) ? r.data : [])].sort((a, b) => String(b.purchased_at ?? '').localeCompare(String(a.purchased_at ?? '')) || b.id - a.id)),
})
export const useSuppliers = () => useQuery({ queryKey: ['suppliers'], queryFn: () => api<{ data: Supplier[] }>('/suppliers').then((r) => r.data) })
export const useProductsAdmin = () => useQuery({ queryKey: ['products-admin'], queryFn: () => api<{ data: ProductAdmin[] }>('/products').then((r) => r.data) })

export const refreshStock = (qc: QueryClient) =>
  Promise.all(['purchases', 'stock', 'stock-report', 'products-admin', 'finance'].map((k) => qc.invalidateQueries({ queryKey: [k] })))
