import { useLayoutEffect, useRef, useState } from 'react'
import { STORE } from '../config/store'
import { formatReceiptDate, rupiah } from '../lib/format'
import type { Receipt } from '../lib/types'

const Dash = () => <div className="my-1 border-t border-dashed border-black" />
function Row({ a, b, bold }: { a: string; b: string; bold?: boolean }) {
    return <div className={`flex justify-between gap-2 ${bold ? 'font-bold' : ''}`}><span>{a}</span><span>{b}</span></div>
}

// Nota kertas 58 mm sesuai desain client. Hanya tampil saat print (lihat .print-only di index.css).
export default function Receipt58({ r, width = 58 }: { r: Receipt; width?: 58 | 80 }) {
    const ref = useRef<HTMLDivElement>(null)
    const [mm, setMm] = useState<number | null>(null)
    // Ukur tinggi nota (px -> mm) lalu pasang sebagai ukuran kertas, supaya tidak jatuh ke A4.
    useLayoutEffect(() => { if (ref.current) setMm(Math.ceil((ref.current.offsetHeight * 25.4) / 96) + 2) }, [r])
    const { date, time } = formatReceiptDate(r.occurred_at)
    const paid = r.amount_paid ?? null
    const change = paid != null ? Math.max(0, paid - r.total) : 0
    return (
        <div className="print-only" ref={ref} style={{ width: `${width}mm` }}>
            {mm && <style>{`@page { size: ${width}mm ${mm}mm; margin: 0; }`}</style>}
            <div className="text-center leading-tight">
                <p className="text-[14px] font-extrabold tracking-wide">{STORE.name}</p>
                <p className="mt-0.5 text-[8px] italic">{STORE.address}</p>
                <p className="text-[8px] italic">{STORE.hours}</p>
            </div>

            <div className="mt-2 flex justify-between text-[9px]"><span>Date:</span><span>{time}&nbsp;&nbsp;{date}</span></div>
            {STORE.showInvoiceNo && <p className="text-[8px]">{r.invoice_no}</p>}
            <p className="wrap-break-word text-[9px]">Nama pelanggan : {r.customer_name?.trim() || '-'}</p>
            <Dash />

            <div className="space-y-1 text-[9px] leading-tight">
                {r.items.map((i, k) => (
                    <div key={k}>
                        <p className="wrap-break-word">{i.product_name}</p>
                        <div className="flex justify-between gap-2"><span>{parseFloat(i.weight_kg)}kg x {rupiah(i.price_per_kg)}/kg</span><span className="shrink-0 text-right">{rupiah(i.line_total)}</span></div>
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

            <p className="mt-3 text-center text-[10px] font-bold italic tracking-wide">TERIMA KASIH</p>
        </div>
    )
}
