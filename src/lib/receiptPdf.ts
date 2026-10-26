import type { jsPDF } from 'jspdf'
import { STORE } from '../config/store'
import { formatReceiptDate, rupiah } from './format'
import type { Receipt } from './types'

// PDF struk lebar 58 mm, tinggi mengikuti isi (seperti PDF dari server pada umumnya).
const W = 58, MX = 3, R = W - MX
const lh = (pt: number) => pt * 0.3528 * 1.3 // tinggi baris (mm) dari ukuran font (pt)

function draw(doc: jsPDF, r: Receipt): number {
  const { date, time } = formatReceiptDate(r.occurred_at)
  let y = 2
  const text = (t: string, size: number, style: 'normal' | 'bold' | 'italic' | 'bolditalic' = 'normal') => {
    doc.setFont('helvetica', style); doc.setFontSize(size); y += lh(size); doc.text(t, W / 2, y, { align: 'center' })
  }
  const row = (a: string, b: string, size = 8, style: 'normal' | 'bold' = 'normal') => {
    doc.setFont('helvetica', style); doc.setFontSize(size); y += lh(size)
    doc.text(a, MX, y); doc.text(b, R, y, { align: 'right' })
  }
  const dash = () => {
    y += 1.2; doc.setLineWidth(0.15); doc.setLineDashPattern([0.6, 0.6], 0); doc.line(MX, y, R, y); doc.setLineDashPattern([], 0); y += 0.6
  }

  text(STORE.name, 14, 'bold')
  y += 0.4
  text(STORE.address, 7, 'italic')
  text(STORE.hours, 7, 'italic')
  y += 3
  row('Date:', `${time}  ${date}`)
  if (STORE.showInvoiceNo) { doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); y += lh(6.5); doc.text(r.invoice_no, MX, y) }
  dash()

  doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
  const weights = r.items.map((i) => `${parseFloat(i.weight_kg)}kg`)
  const prices = r.items.map((i) => rupiah(i.line_total))
  const wW = Math.max(...weights.map((s) => doc.getTextWidth(s)))
  const pW = Math.max(...prices.map((s) => doc.getTextWidth(s)))
  const nameW = R - MX - wW - pW - 4
  r.items.forEach((i, k) => {
    const lines: string[] = doc.splitTextToSize(i.product_name, nameW)
    lines.forEach((ln, n) => {
      y += lh(8)
      doc.text(ln, MX, y)
      if (n === 0) { doc.text(weights[k], R - pW - 2, y, { align: 'right' }); doc.text(prices[k], R, y, { align: 'right' }) }
    })
    y += 0.5
  })
  dash()

  if (r.discount > 0) row('DISKON:', rupiah(r.discount))
  row('TOTAL:', rupiah(r.total), 9, 'bold')
  if (STORE.showPayment && r.amount_paid != null) {
    row('BAYAR:', rupiah(r.amount_paid))
    if (r.amount_paid > r.total) row('KEMBALI:', rupiah(r.amount_paid - r.total))
  }
  y += 4
  text('TERIMA KASIH', 9, 'bolditalic')
  y += 2.5
  text(`hubungi : ${STORE.phone}`, 7)
  return y + 7
}

export async function buildReceiptPdf(r: Receipt) {
  const { jsPDF } = await import('jspdf')
  const height = draw(new jsPDF({ unit: 'mm', format: [W, 800] }), r) // dry-run untuk mengukur tinggi
  const doc = new jsPDF({ unit: 'mm', format: [W, Math.max(Math.ceil(height), 59)] })
  draw(doc, r)
  return doc
}

export async function downloadReceiptPdf(r: Receipt) {
  ;(await buildReceiptPdf(r)).save(`${r.invoice_no}.pdf`)
}
