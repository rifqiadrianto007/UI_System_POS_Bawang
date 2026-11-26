import type { jsPDF } from 'jspdf'
import { STORE } from '../config/store'
import { formatReceiptDate, rupiah } from './format'
import type { Receipt } from './types'

// PDF struk lebar 58 mm, tinggi mengikuti isi (seperti PDF dari server pada umumnya).
const MX = 3
const lh = (pt: number) => pt * 0.3528 * 1.3 // tinggi baris (mm) dari ukuran font (pt)

function draw(doc: jsPDF, r: Receipt, W: 58 | 80): number {
  const R = W - MX
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

  text(STORE.name, 11, 'bold')
  y += 0.4
  text(STORE.address, 6, 'italic')
  text(STORE.hours, 6, 'italic')
  y += 2
  row('Date:', `${time}  ${date}`, 7)
  if (STORE.showInvoiceNo) { doc.setFont('helvetica', 'normal'); doc.setFontSize(6); y += lh(6); doc.text(r.invoice_no, MX, y) }
  dash()

  r.items.forEach((i) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
    const lines: string[] = doc.splitTextToSize(i.product_name, R - MX)
    lines.forEach((ln) => { y += lh(8); doc.text(ln, MX, y) })
    row(`${parseFloat(i.weight_kg)}kg x ${rupiah(i.price_per_kg)}/kg`, rupiah(i.line_total), 7)
    y += 0.5
  })
  dash()

  if (r.discount > 0) row('DISKON:', rupiah(r.discount))
  row('TOTAL:', rupiah(r.total), 9, 'bold')
  if (STORE.showPayment && r.amount_paid != null) {
    row('BAYAR:', rupiah(r.amount_paid))
    row('KEMBALI:', rupiah(Math.max(0, r.amount_paid - r.total)))
  }
  y += 4
  text('TERIMA KASIH', 9, 'bolditalic')
  return y + 7
}

export async function buildReceiptPdf(r: Receipt, W: 58 | 80 = 58) {
  const { jsPDF } = await import('jspdf')
  const height = draw(new jsPDF({ unit: 'mm', format: [W, 800] }), r, W)
  const doc = new jsPDF({ unit: 'mm', format: [W, Math.max(Math.ceil(height), W === 58 ? 59 : 70)] })
  draw(doc, r, W)
  return doc
}

export async function downloadReceiptPdf(r: Receipt, W: 58 | 80 = 58) {
  ;(await buildReceiptPdf(r, W)).save(`${r.invoice_no}.pdf`)
}
