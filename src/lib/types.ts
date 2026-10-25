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
