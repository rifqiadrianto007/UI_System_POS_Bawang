import { useLayoutEffect, useRef, useState } from 'react'
import { STORE } from '../config/store'
import { formatReceiptDate, rupiah } from '../lib/format'
import type { Receipt } from '../lib/types'

const Dash = () => <div className="my-1.5 border-t border-dashed border-black" />
function Row({ a, b, bold }: { a: string; b: string; bold?: boolean }) {
  return <div className={`flex justify-between gap-2 ${bold ? 'font-bold' : ''}`}><span>{a}</span><span>{b}</span></div>
}

// Nota kertas 58 mm sesuai desain client. Hanya tampil saat print (lihat .print-only di index.css).
export default function Receipt58({ r }: { r: Receipt }) {
  const ref = useRef<HTMLDivElement>(null)
  const [mm, setMm] = useState<number | null>(null)
  // Ukur tinggi nota (px -> mm) lalu pasang sebagai ukuran kertas, supaya tidak jatuh ke A4.
  useLayoutEffect(() => { if (ref.current) setMm(Math.ceil((ref.current.offsetHeight * 25.4) / 96) + 2) }, [r])
  const { date, time } = formatReceiptDate(r.occurred_at)
  const paid = r.amount_paid ?? null
  const change = paid != null ? Math.max(0, paid - r.total) : 0
  return (
    <div className="print-only" ref={ref}>
      {mm && <style>{`@page { size: 58mm ${mm}mm; margin: 0; }`}</style>}
      <div className="text-center">
        <p className="text-[18px] leading-tight font-extrabold tracking-wide">{STORE.name}</p>
        <p className="mt-0.5 text-[10px] italic">{STORE.address}</p>
        <p className="text-[10px] italic">{STORE.hours}</p>
      </div>

      <div className="mt-3 flex justify-between"><span>Date:</span><span>{time}&nbsp;&nbsp;{date}</span></div>
      {STORE.showInvoiceNo && <p className="text-[9px]">{r.invoice_no}</p>}
      <Dash />

      <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 gap-y-0.5">
        {r.items.map((i, k) => (
          <div key={k} className="contents">
            <span>{i.product_name}</span>
            <span className="text-right">{parseFloat(i.weight_kg)}kg</span>
            <span className="text-right">{rupiah(i.line_total)}</span>
          </div>
        ))}
      </div>
      <Dash />

      {r.discount > 0 && <Row a="DISKON:" b={rupiah(r.discount)} />}
      <Row a="TOTAL:" b={rupiah(r.total)} bold />
      {STORE.showPayment && paid != null && (
        <>
          <Row a="BAYAR:" b={rupiah(paid)} />
          <Row a="KEMBALI:" b={rupiah(change)} />
        </>
      )}

      <p className="mt-5 text-center font-bold italic tracking-wide">TERIMA KASIH</p>
      <p className="mt-4 pb-8 text-center text-[10px]">hubungi : {STORE.phone}</p>
    </div>
  )
}
