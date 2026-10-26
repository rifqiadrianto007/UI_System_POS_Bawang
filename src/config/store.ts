// Data toko di nota. Ubah di sini, bukan di komponen.
export const STORE = {
  name: 'FAUNA BAWANG',
  address: 'Pasar Buah Gebang',
  hours: '05.30-12.00 dan 16.00-21.00',
  phone: '082139578380', // dari desain nota client, pastikan bukan data dummy
  // Di luar desain client. Nyalakan bila client setuju.
  showInvoiceNo: false, // nomor invoice kecil di bawah tanggal (berguna untuk mencari transaksi saat void/komplain)
  showPayment: false,   // baris BAYAR dan KEMBALI setelah TOTAL
}
