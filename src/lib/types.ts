export type ProductKind = 'merah' | 'putih'
export interface Product { id: number; name: string; jenis: ProductKind; price_retail: number; price_5kg: number; is_active: boolean }
export type Category = 'ecer' | 'grosir'
export type Method = 'cash' | 'qris'
export interface CartLine { product: Product; grams: number } // berat disimpan sebagai gram (integer), bukan float
export interface QuoteItem { product_id: number; product_name: string; weight_kg: string; price_tier: string; price_per_kg: number; line_total: number; cogs?: number }
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
  has_shortfall?: boolean // hanya untuk owner: HPP belum lengkap karena stok sistem kurang saat dijual
}
export interface TxSummary { transactions_count: number; voided_count: number; subtotal_sum: number; discount_sum: number; total_sum: number }
export interface TxList { data: TxRow[]; meta: { total: number; current_page: number; last_page: number; per_page: number }; summary: TxSummary }
export interface TxDetail {
  id: number; invoice_no: string; cashier_name: string; customer_category: Category; customer_name: string | null
  subtotal: number; discount: number; total: number; amount_paid: number | null; change: number | null
  payment_method: Method; status: TxStatus; occurred_at: string
  void_reason: string | null; voided_at: string | null; items: QuoteItem[]
  cogs?: number; has_shortfall?: boolean // hanya dikirim ke owner
}

// GET /reports/finance (owner). Rumus laba dihitung backend, jangan dihitung ulang di frontend.
export interface FinanceDaily {
  date: string; net_sales: number; operating_expenses: number; purchases_total: number
  cogs: number; display_shrink_value: number; net_profit: number
}
export interface Finance {
  net_sales: number; discount_sum: number; transactions_count: number; void_count: number
  cogs: number; gross_profit: number; display_shrink_value: number
  operating_expenses: number; purchases_total: number; total_spending: number
  net_profit: number; cash_flow: number; cleaning_loss_value: number; susut_kg: string
  by_payment_method: { cash: { count: number; total: number }; qris: { count: number; total: number } }
  shortfall_count?: number // penjualan yang terjadi saat stok sistem kurang (HPP belum lengkap)
  daily: FinanceDaily[]
}

// Barang & stok (owner). Berat selalu string 3 desimal.
export interface ProductAdmin extends Product { stock_kg: string; stock_value: number; shortfall_kg: string }
export interface StockRow { product_id: number; name: string; jenis: ProductKind; is_active: boolean; stock_kg: string; shortfall_kg: string; stock_value: number; avg_cost: number; last_count_date: string | null }
export interface StockTotals { display_kg: string; warehouse_kg: string; stock_value: number; inventory_value: number }
export interface StockResponse { data: StockRow[]; totals: StockTotals }
export interface StockReportProduct {
  product_id: number; name: string; is_active: boolean; stock_kg: string; stock_value: number
  sold_kg: string; display_shrink_kg: string; display_shrink_value: number; last_count_date: string | null
}
export interface StockReport {
  from: string; to: string; incoming_gross_kg: string; pending_gross_kg: string; clean_kg: string; cleaning_shrink_kg: string
  sold_kg: string; display_shrink_kg: string; display_shrink_value: number; stock_value: number
  products: StockReportProduct[]
}
export interface StockCount {
  id: number; product_id: number; purchase_id: number; product_name: string; counted_weight_kg: string; system_weight_kg: string
  diff_kg: string; unit_cost_avg: number | null; loss_value: number; counted_at: string; notes: string | null
  status?: 'active' | 'cancelled'; cancelled_at?: string | null; cancelled_by_name?: string | null; cancel_reason?: string | null
}

// Kulak aktif; tidak memiliki workflow Draft/Final atau lot manual.
export interface Supplier { id: number; name: string; phone: string | null; note: string | null }
export interface PurchaseLot { id: number; purchase_id: number; product_id: number; product_name: string; clean_weight_kg: string }
export interface Purchase {
  id: number; code: string; supplier_id: number; supplier: Supplier; purchased_at: string
  jenis: ProductKind
  gross_weight_kg: string; price_per_kg: number; total_cost: number; sorted_weight_kg: string; remaining_weight_kg: string
  sort_percentage: number; status_sortir: 'belum_disortir' | 'tersortir'; can_edit: boolean; can_delete: boolean
  notes: string | null; lots: PurchaseLot[]
}

export interface PriceHistoryRow { id: number; product_id: number; price_retail: number; price_5kg: number; changed_by: number; changed_at: string }

// Pengeluaran operasional. Jenis = teks bebas (name). Backend masih mewajibkan category, frontend selalu mengirim "lainnya".
export interface Expense {
  id: number; name: string; category: string; category_label: string; amount: number
  spent_at: string; notes: string | null; created_by_name: string; created_at: string
}
export interface ExpenseList {
  data: Expense[]
  meta: { total: number; current_page: number; last_page: number; per_page: number; from: number | null; to: number | null }
  summary: { total_amount: number; count: number }
}
