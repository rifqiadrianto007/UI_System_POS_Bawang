import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

export const useExpenseSuggestions = () => useQuery({
  queryKey: ['expense-suggestions'],
  queryFn: () => api<{ data: string[] }>('/expenses/suggestions').then((r) => r.data),
  staleTime: 60_000,
})
