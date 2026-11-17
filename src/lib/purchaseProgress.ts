import type { Purchase } from './types'

const kgNumber = (value: unknown): number => {
  const n = Number.parseFloat(String(value ?? ''))
  return Number.isFinite(n) ? Math.max(0, n) : 0
}

export const isPurchaseFinished = (purchase: Purchase) =>
  Boolean(purchase.is_locked) || purchase.status_batch === 'selesai_disortir' || purchase.status_sortir === 'tersortir'

const lotsWeight = (purchase: Purchase) => Array.isArray(purchase.lots)
  ? purchase.lots.reduce((sum, lot) => sum + kgNumber(lot.clean_weight_kg), 0)
  : 0

export const sortedPurchaseKg = (purchase: Purchase) => {
  const gross = kgNumber(purchase.gross_weight_kg)
  const lots = lotsWeight(purchase)
  if (lots > 0) return Math.min(gross, lots)
  const reported = Math.max(kgNumber(purchase.sorted_weight_kg), kgNumber(purchase.added_weight_kg))
  if (isPurchaseFinished(purchase)) return Math.min(gross, reported)
  const remaining = kgNumber(purchase.remaining_weight_kg)
  const fromBalance = Math.max(0, gross - remaining)
  return Math.min(gross, Math.max(reported, fromBalance))
}

export const remainingPurchaseKg = (purchase: Purchase) => {
  if (isPurchaseFinished(purchase)) return Math.max(0, kgNumber(purchase.gross_weight_kg) - sortedPurchaseKg(purchase))
  return kgNumber(purchase.remaining_weight_kg)
}

export const purchaseSortPercentage = (purchase: Purchase) => {
  const gross = kgNumber(purchase.gross_weight_kg)
  if (gross <= 0) return 0
  return Math.min(100, Math.max(0, (sortedPurchaseKg(purchase) / gross) * 100))
}
