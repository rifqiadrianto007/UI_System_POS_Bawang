import { formatDate, formatKgStr, rupiah } from '../lib/format'
import type { Receipt } from '../lib/types'

function Row({ a, b, bold }: { a: string; b: string; bold?: boolean }) {
  return <div className={`flex justify-between gap-2 ${bold ? 'font-bold' : ''}`}><span>{a}</span><span>{b}</span></div>
}
const Line = () => <div className="my-1 border-t border-dashed border-black" />

// Nota kertas 58 mm. Hanya tampil saat print (lihat .print-only di index.css).
export default function Receipt58({ r }: { r: Receipt }) {
  const paid = r.amount_paid ?? null
  const change = paid != null ? Math.max(0, paid - r.total) : null
  return (
    <div className="print-only">
      <div className="text-center">
        <p className="text-sm font-bold">FAUNA BAWANG</p>
        <p>Toko Sumber Rezeki</p>
      </div>
      <Line />
      <p>{r.invoice_no}</p>
      <p>{formatDate(r.occurred_at)}</p>
      <p>Kasir: {r.cashier}</p>
      {r.customer_name && <p>Pelanggan: {r.customer_name}</p>}
      <Line />
      {r.items.map((i, k) => (
        <div key={k} className="mb-1">
          <p>{i.product_name}</p>
          <Row a={`${formatKgStr(i.weight_kg)}kg x ${new Intl.NumberFormat('id-ID').format(i.price_per_kg)}`} b={rupiah(i.line_total)} />
        </div>
      ))}
      <Line />
      <Row a="Subtotal" b={rupiah(r.subtotal)} />
      {r.discount > 0 && <Row a="Diskon" b={`-${rupiah(r.discount)}`} />}
      <Row a="Total" b={rupiah(r.total)} bold />
      {paid != null && <Row a="Bayar" b={rupiah(paid)} />}
      {change != null && change > 0 && <Row a="Kembali" b={rupiah(change)} />}
      <Row a="Metode" b={r.payment_method === 'cash' ? 'Tunai' : 'QRIS'} />
      <Line />
      <p className="text-center">Terima kasih</p>
    </div>
  )
}
