export interface Product { id: number; name: string; price_retail: number; price_3kg: number; price_5kg: number; is_active: boolean }
export type Category = 'ecer' | 'grosir'
export type Method = 'cash' | 'qris'
export interface CartLine { product: Product; grams: number } // berat disimpan sebagai gram (integer), bukan float
export interface QuoteItem { product_id: number; product_name: string; weight_kg: string; price_tier: string; price_per_kg: number; line_total: number }
export interface Quote { items: QuoteItem[]; subtotal: number; discount: number; total: number }
export interface Receipt {
  invoice_no: string; occurred_at: string; cashier: string; customer_name: string | null
  items: QuoteItem[]; subtotal: number; discount: number; total: number
  payment_method: Method; status: string; amount_paid?: number | null
}

// Riwayat transaksi. Status voided di backend bernilai "void" (bukan "voided").
export type TxStatus = 'completed' | 'void'
export interface TxRow {
  id: number; invoice_no: string; occurred_at: string; cashier_name: string
  items_count: number; total_weight_kg: string
  subtotal: number; discount: number; total: number
  payment_method: Method; status: TxStatus; customer_name: string | null
}
export interface TxSummary { transactions_count: number; voided_count: number; subtotal_sum: number; discount_sum: number; total_sum: number }
export interface TxList { data: TxRow[]; meta: { total: number; current_page: number; last_page: number; per_page: number }; summary: TxSummary }
export interface TxDetail {
  id: number; invoice_no: string; cashier_name: string; customer_category: Category; customer_name: string | null
  subtotal: number; discount: number; total: number; amount_paid: number | null; change: number | null
  payment_method: Method; status: TxStatus; occurred_at: string
  void_reason: string | null; voided_at: string | null; items: QuoteItem[]
}
