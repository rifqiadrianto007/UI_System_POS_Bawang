export const rupiah = (n: number) => 'Rp ' + new Intl.NumberFormat('id-ID').format(n)
export const formatKg = (g: number) => String(g / 1000).replace('.', ',')
export const formatKgStr = (s: string) => String(parseFloat(s)).replace('.', ',')
export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('id-ID', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(iso))

// Format nota sesuai desain client: jam "16.57" dan tanggal "12/08/2030", zona Asia/Jakarta.
export function formatReceiptDate(iso: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return { date: `${g('day')}/${g('month')}/${g('year')}`, time: `${g('hour')}.${g('minute')}` }
}
