import { ApiError } from './api'

const LABEL: Record<string, string> = {
  name: 'Nama', price_retail: 'Harga ecer', price_3kg: 'Harga 3 kg', price_5kg: 'Harga 5 kg',
  counted_weight_kg: 'Berat hasil hitung', counted_at: 'Tanggal', product_id: 'Barang',
}

// Backend memakai pesan bawaan Laravel berbahasa Inggris pada sebagian endpoint; terjemahkan yang umum.
export function translate(msg: string, field?: string): string {
  const label = (field && LABEL[field]) || null
  const req = msg.match(/^The (.+?) field is required\.$/)
  if (req) return `${label ?? req[1]} wajib diisi.`
  const min = msg.match(/^The (.+?) field must be at least (\d+)\.$/)
  if (min) return `${label ?? min[1]} minimal ${min[2]}.`
  if (/must be an integer\.$/.test(msg)) return `${label ?? 'Nilai'} harus berupa angka bulat.`
  if (/must be a number\.$/.test(msg)) return `${label ?? 'Nilai'} harus berupa angka.`
  return msg
}

export function formErrors(e: unknown): { fields: Record<string, string>; message: string } {
  if (!(e instanceof ApiError)) return { fields: {}, message: 'Terjadi kesalahan.' }
  const fields: Record<string, string> = {}
  for (const [k, v] of Object.entries(e.errors ?? {})) fields[k] = translate(v[0] ?? '', k)
  return { fields, message: Object.keys(fields).length ? '' : e.message }
}
