// Pengaturan sesi. Nol berarti nonaktif.
export const SECURITY = {
  // Owner membuka data keuangan: logout otomatis bila tidak ada aktivitas.
  ownerIdleMinutes: 30,
  // Kasir tidak di-logout otomatis: perangkat toko dipakai seharian dan keranjang yang sedang dibuat tidak boleh hilang di tengah antrean.
  kasirIdleMinutes: 0,
  // Cek ulang status akun (nonaktif/dicabut) saat aplikasi kembali dibuka, paling sering sekali per interval ini.
  revalidateEveryMs: 60_000,
}
export const FLASH_KEY = 'pos_flash'
