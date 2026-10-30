// Tanggal dalam bentuk "YYYY-MM-DD" (WIB). Aritmetika memakai UTC agar tidak terpengaruh zona waktu perangkat.
const pad = (n: number) => String(n).padStart(2, '0')
const toYmd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
const fromYmd = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)) }

export const todayWib = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
export const addDays = (s: string, n: number) => { const d = fromYmd(s); d.setUTCDate(d.getUTCDate() + n); return toYmd(d) }
export const monthStart = (s: string) => s.slice(0, 8) + '01'
export const monthEnd = (s: string) => { const d = fromYmd(monthStart(s)); d.setUTCMonth(d.getUTCMonth() + 1, 0); return toYmd(d) }
export const diffDays = (a: string, b: string) => Math.round((fromYmd(b).getTime() - fromYmd(a).getTime()) / 86400000)
export const eachDay = (from: string, to: string) => { const out: string[] = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push(d); return out }
export const fmtShort = (s: string) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(fromYmd(s))
export const fmtLong = (s: string) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(fromYmd(s))
