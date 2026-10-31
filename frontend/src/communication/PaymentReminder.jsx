import { useState } from 'react'
import { Modal, Notice } from '../finance/shared'
import { buttonClass, errorText, financeApi, panelClass, secondaryClass } from '../finance/finance'

export default function PaymentReminder({ invoice }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  async function send() {
    setBusy(true); setError('')
    try { const response = await financeApi.post(`invoices/${invoice.id}/reminders`, {}); setMessage(response.message); setOpen(false) }
    catch (e) { setError(errorText(e)) } finally { setBusy(false) }
  }
  return <section className={`${panelClass} space-y-4`}><div><h2 className="font-semibold text-slate-900">Pengingat Pembayaran</h2><p className="mt-2 text-sm leading-6 text-slate-500">Buat notifikasi untuk akun siswa dan wali yang berhak atas tagihan ini. Pengingat yang sama tidak digandakan. Tidak ada pengiriman berulang otomatis.</p></div><Notice success>{message}</Notice><button className={secondaryClass} onClick={() => { setError(''); setOpen(true) }}>Buat pengingat pembayaran</button>{open && <Modal title="Buat Pengingat Pembayaran?" busy={busy} onClose={() => setOpen(false)}><div className="space-y-4"><Notice>{error}</Notice><p className="text-sm leading-6 text-slate-600">Pengingat tagihan #{invoice.id} akan disimpan pada pusat notifikasi penerima yang berhak. Pengiriman email mengikuti konfigurasi sekolah.</p><button className={`${buttonClass} w-full`} disabled={busy} onClick={send}>{busy ? 'Memproses...' : 'Konfirmasi pengingat'}</button></div></Modal>}</section>
}
