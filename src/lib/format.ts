export const rupiah = (n: number) => 'Rp ' + new Intl.NumberFormat('id-ID').format(n)
export const formatKg = (g: number) => String(g / 1000).replace('.', ',')
export const formatKgStr = (s: string) => String(parseFloat(s)).replace('.', ',')
export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('id-ID', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(iso))
