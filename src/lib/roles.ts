import type { User } from './auth'

// Halaman pertama setelah login / saat membuka alamat yang tidak dikenal.
export const homeFor = (role: User['role']) => (role === 'owner' ? '/laporan' : '/kasir')
