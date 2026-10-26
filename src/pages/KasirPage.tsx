import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { CheckCircle2, Download, Package, Plus, Printer, Search, ShoppingCart } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { rupiah } from '../lib/format'
import { gramsToKgString, kgStringToGrams, uuid, useDebounced, useMediaQuery } from '../lib/util'
import type { CartLine, Category, Method, Product, Quote, Receipt } from '../lib/types'
import CartPanel from '../components/CartPanel'
import Modal from '../components/Modal'
import PaymentModal from '../components/PaymentModal'
import Receipt58 from '../components/Receipt58'
import WeightPicker from '../components/WeightPicker'

interface Done { id: number; invoice: string; total: number; paid: number; change: number }

export default function KasirPage() {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const [search, setSearch] = useState('')
  const [lines, setLines] = useState<CartLine[]>([])
  const [category, setCategory] = useState<Category>('ecer')
  const [name, setName] = useState('')
  const [method, setMethod] = useState<Method>('cash')
  const [picking, setPicking] = useState<Product | null>(null)
  const [sheet, setSheet] = useState(false)
  const [paying, setPaying] = useState(false)
  const [busy, setBusy] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  const [done, setDone] = useState<Done | null>(null)
  const [printData, setPrintData] = useState<Receipt | null>(null)
  const [printErr, setPrintErr] = useState<string | null>(null)
  const attempt = useRef<{ sig: string; id: string } | null>(null)

  const products = useQuery({
    queryKey: ['products'],
    queryFn: () => api<{ data: Product[] }>('/products').then((r) => r.data.filter((p) => p.is_active)),
  })

  // Harga SELALU dari backend (quote). Jumlah yang harus dibayar = quote.subtotal (bukan quote.total, yang bergantung pada final_total).
  const items = lines.map((l) => ({ product_id: l.product.id, weight_kg: gramsToKgString(l.grams) }))
  const liveKey = JSON.stringify([category, items])
  const key = useDebounced(liveKey, 300)
  const quoteQ = useQuery({
    queryKey: ['quote', key],
    enabled: lines.length > 0,
    placeholderData: keepPreviousData,
    queryFn: () => {
      const [cat, its] = JSON.parse(key) as [Category, { product_id: number; weight_kg: string }[]]
      return api<{ data: Quote }>('/transactions/quote', {
        method: 'POST', body: JSON.stringify({ customer_category: cat, items: its, final_total: null }),
      }).then((r) => r.data)
    },
  })
  const quote = quoteQ.data
  const quoteError = quoteQ.isError ? (quoteQ.error instanceof Error ? quoteQ.error.message : 'Gagal menghitung harga.') : null
  const ready = lines.length > 0 && key === liveKey && (quote?.subtotal ?? 0) > 0 && !quoteQ.isFetching && !quoteQ.isError && !!quote &&
    lines.every((l) => quote.items.some((i) => i.product_id === l.product.id && kgStringToGrams(i.weight_kg) === l.grams))

  const add = (p: Product, g: number) => {
    setLines((ls) => ls.some((l) => l.product.id === p.id)
      ? ls.map((l) => (l.product.id === p.id ? { ...l, grams: l.grams + g } : l))
      : [...ls, { product: p, grams: g }])
    setPicking(null)
  }
  const setGrams = (id: number, g: number) => setLines((ls) => ls.map((l) => (l.product.id === id ? { ...l, grams: g } : l)))
  const remove = (id: number) => setLines((ls) => ls.filter((l) => l.product.id !== id))
  const resetCart = () => { setLines([]); setName(''); setCategory('ecer'); setMethod('cash'); setSheet(false); attempt.current = null }

  const fetchReceipt = (id: number, paid: number) =>
    api<{ data: Receipt }>(`/transactions/${id}/receipt`).then((rc) => ({ ...rc.data, amount_paid: rc.data.amount_paid ?? paid }))

  async function printFor(id: number, paid: number) {
    try { setPrintData(await fetchReceipt(id, paid)); setPrintErr(null) }
    catch { setPrintErr('Nota gagal diambil. Transaksi sudah tersimpan, coba cetak lagi.') }
  }
  async function pdfFor(id: number, paid: number) {
    try {
      const { downloadReceiptPdf } = await import('../lib/receiptPdf')
      await downloadReceiptPdf(await fetchReceipt(id, paid)); setPrintErr(null)
    } catch { setPrintErr('PDF gagal dibuat. Transaksi sudah tersimpan, coba lagi.') }
  }

  useEffect(() => {
    if (!printData) return
    const t = setTimeout(() => window.print(), 150)
    const after = () => setPrintData(null)
    window.addEventListener('afterprint', after)
    return () => { clearTimeout(t); window.removeEventListener('afterprint', after) }
  }, [printData])

  async function submit(finalTotal: number, paid: number, print: boolean) {
    if (!quote || busy) return
    setBusy(true); setPayError(null)
    const body = {
      customer_category: category, items, customer_name: name.trim() || null,
      payment_method: method, final_total: finalTotal, amount_paid: paid, occurred_at: null,
    }
    // UUID dipakai ulang selama isi transaksi sama, jadi retry setelah sinyal putus tidak membuat transaksi ganda.
    const sig = JSON.stringify(body)
    if (attempt.current?.sig !== sig) attempt.current = { sig, id: uuid() }
    try {
      const tx = await api<{ data: { id: number; invoice_no: string } }>('/transactions', {
        method: 'POST', body: JSON.stringify({ client_uuid: attempt.current.id, ...body }),
      })
      setPaying(false)
      setDone({ id: tx.data.id, invoice: tx.data.invoice_no, total: finalTotal, paid, change: Math.max(0, paid - finalTotal) })
      resetCart()
      if (print) void printFor(tx.data.id, paid)
    } catch (e) {
      const msg = e instanceof ApiError ? (e.errors ? Object.values(e.errors)[0]?.[0] : e.message) : 'Terjadi kesalahan.'
      setPayError(`${msg ?? 'Gagal menyimpan.'}${e instanceof ApiError && e.status === 0 ? ' Transaksi belum tersimpan, tekan simpan lagi.' : ''}`)
    } finally { setBusy(false) }
  }

  const shown = (products.data ?? []).filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()))
  const priceOf = (p: Product) => (category === 'grosir' ? p.price_5kg : p.price_retail)

  const cart = (
    <CartPanel lines={lines} quote={quote} ready={ready} error={quoteError}
      category={category} setCategory={setCategory} name={name} setName={setName} method={method} setMethod={setMethod}
      setGrams={setGrams} remove={remove} clear={resetCart}
      onPay={() => { setSheet(false); setPayError(null); setPaying(true) }} />
  )

  return (
    <>
      <div className="flex gap-6">
        <section className="min-w-0 flex-1 pb-24 lg:pb-0">
          <div className="relative mb-4">
            <Search size={18} className="absolute top-1/2 left-4 -translate-y-1/2 text-ink-muted" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari"
              className="w-full rounded-xl border border-surface-border bg-white py-3 pr-4 pl-11 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
          </div>

          {products.isPending && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-44 animate-pulse rounded-2xl bg-surface" />)}</div>}
          {products.isError && (
            <div className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
              {products.error instanceof Error ? products.error.message : 'Gagal memuat produk.'}
              <button onClick={() => products.refetch()} className="ml-2 font-semibold underline">Coba lagi</button>
            </div>
          )}
          {products.isSuccess && shown.length === 0 && <p className="py-10 text-center text-sm text-ink-muted">Produk tidak ditemukan.</p>}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {shown.map((p) => (
              <button key={p.id} onClick={() => setPicking(p)} className="flex flex-col overflow-hidden rounded-2xl border border-surface-border bg-white text-left shadow-sm active:scale-[0.99]">
                <div className="grid h-24 place-items-center bg-surface text-brand sm:h-28"><Package size={36} /></div>
                <div className="p-3">
                  <p className="font-semibold leading-tight">{p.name}</p>
                  <div className="mt-3 flex items-end justify-between">
                    <p className="text-sm font-bold text-brand">{rupiah(priceOf(p))}<span className="font-normal text-ink-muted">/kg</span></p>
                    <span className="grid size-9 place-items-center rounded-lg bg-brand text-white"><Plus size={18} /></span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {isDesktop && <aside className="sticky top-0 w-85 shrink-0 self-start overflow-hidden rounded-2xl border border-surface-border bg-white">{cart}</aside>}
      </div>

      {!isDesktop && lines.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-surface-border bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button onClick={() => setSheet(true)} className="flex w-full items-center justify-between rounded-xl bg-brand px-4 py-3 text-white">
            <span className="flex items-center gap-2 font-semibold"><ShoppingCart size={18} /> {lines.length} item</span>
            <span className="font-bold">{ready && quote ? rupiah(quote.subtotal) : '...'} &middot; Lihat keranjang</span>
          </button>
        </div>
      )}
      {!isDesktop && sheet && <Modal title="Keranjang" onClose={() => setSheet(false)}><div className="-mx-5 -my-4">{cart}</div></Modal>}
      {picking && <WeightPicker product={picking} onAdd={(g) => add(picking, g)} onClose={() => setPicking(null)} />}
      {paying && quote && <PaymentModal subtotal={quote.subtotal} method={method} busy={busy} error={payError} onSubmit={submit} onClose={() => setPaying(false)} />}

      {done && (
        <Modal title="Transaksi berhasil" onClose={() => { setDone(null); setPrintErr(null) }}
          footer={
            <div className="space-y-2">
              <div className="flex gap-2">
                <button onClick={() => void printFor(done.id, done.paid)} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-brand py-3 font-semibold text-brand"><Printer size={16} /> Cetak nota</button>
                <button onClick={() => void pdfFor(done.id, done.paid)} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-brand py-3 font-semibold text-brand"><Download size={16} /> Unduh PDF</button>
              </div>
              <button onClick={() => { setDone(null); setPrintErr(null) }} className="w-full rounded-xl bg-brand py-3 font-semibold text-white">Transaksi baru</button>
            </div>
          }>
          <div className="text-center">
            <CheckCircle2 size={44} className="mx-auto text-brand" />
            <p className="mt-2 text-xs text-ink-muted">{done.invoice}</p>
            <p className="text-3xl font-extrabold text-brand">{rupiah(done.total)}</p>
            {done.change > 0 && <p className="mt-2 rounded-xl bg-surface py-2 font-bold">Kembalian {rupiah(done.change)}</p>}
            {printErr && <p role="alert" className="mt-3 text-sm text-danger">{printErr}</p>}
          </div>
        </Modal>
      )}
      {printData && createPortal(<Receipt58 r={printData} />, document.body)}
    </>
  )
}
