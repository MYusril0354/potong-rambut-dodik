import { useEffect, useState } from 'react';
import site from '../../data/site.json';
import { CONFIG, effectiveStatus, firstName, PILL, type Booking, type QueueInfo } from '../../lib/util';
import { apiCancel, apiLookup, fetchQueue, getMyBooking, setMyBooking } from '../../lib/api';
import NumGrid from './NumGrid';
import QueueTicket from './QueueTicket';

function statusMessage(b: Booking, q: QueueInfo): { text: string; cls: string } {
  const st = effectiveStatus(b, q);
  if (st === 'serving') return { text: '🎉 Giliran Anda! Silakan ke kursi Pak ' + site.barberName + '.', cls: 'serving' };
  if (st === 'done') return { text: 'Layanan sudah selesai. Terima kasih!', cls: 'done' };
  if (st === 'skipped') return { text: 'Nomor dilewati. Silakan booking ulang atau hubungi ' + site.barberName + '.', cls: 'skipped' };
  if (st === 'cancelled') return { text: 'Booking dibatalkan.', cls: 'cancelled' };
  const diff = b.number - q.currently_serving;
  if (diff <= 2 && q.currently_serving > 0) {
    return { text: `Segera datang! Nomor Anda akan dipanggil dalam ±${Math.max(0, diff * CONFIG.slotMinutes)} menit.`, cls: 'booked' };
  }
  return { text: `Booking aktif. Perkiraan jam ${b.slot_time}. Datang sesuai giliran.`, cls: 'booked' };
}

export default function StatusPanel() {
  const [q, setQ] = useState<QueueInfo | null>(null);
  const [myBooking, setMyBookingState] = useState<Booking | null>(null);
  const [lookupPhone, setLookupPhone] = useState('');
  const [lookupMsg, setLookupMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      const qq = await fetchQueue().catch(() => null);
      if (!mounted) return;
      setQ(qq);
      const m = getMyBooking();
      if (m) {
        const b = await apiLookup(m.phone).catch(() => null);
        if (mounted) setMyBookingState(b);
      }
    };
    refresh();
    const id = setInterval(refresh, 20000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  const doLookup = async () => {
    setLookupMsg(null);
    setError(null);
    const b = await apiLookup(lookupPhone).catch(() => null);
    if (b) {
      setMyBookingState(b);
      setMyBooking({ number: b.number, phone: b.customer_phone, date: b.date });
    } else {
      setLookupMsg('Booking tidak ditemukan untuk nomor ini.');
    }
  };

  const doCancel = async () => {
    if (!myBooking) return;
    setError(null);
    const r = await apiCancel(myBooking.number, myBooking.customer_phone).catch(() => ({ ok: false, error: 'Gagal terhubung ke server.' }));
    if (r.ok) {
      setMyBookingState(null);
      setMyBooking(null);
      setQ(await fetchQueue().catch(() => null));
    } else {
      setError(r.error || 'Gagal membatalkan.');
    }
  };

  const doForget = () => {
    setMyBooking(null);
    setMyBookingState(null);
  };

  if (!q) return <div className="loading">Memuat…</div>;

  if (q.is_closed) {
    return (
      <div className="status-wrap">
        <div className="closed-banner">Hari ini tutup. Tidak ada antrian hari ini.</div>
        <a className="btn btn-primary" href="/">Kembali ke Beranda</a>
      </div>
    );
  }

  return (
    <div className="status-wrap">
      {myBooking ? (
        <div className="wizard">
          <h2 style={{ textAlign: 'center' }}>Status Booking Anda</h2>
          <div className="big-num" style={{ marginTop: '1rem' }}>#{myBooking.number}</div>
          <div className={`status-msg ${statusMessage(myBooking, q).cls}`}>
            {statusMessage(myBooking, q).text}
          </div>
          <p className="status-meta">
            {firstName(myBooking.customer_name)} · {myBooking.slot_time} · {site.priceLabel}
          </p>
          <p style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
            <span className={PILL[effectiveStatus(myBooking, q)]}>{effectiveStatus(myBooking, q)}</span>
          </p>
          {effectiveStatus(myBooking, q) === 'booked' && (
            <div className="wizard-actions">
              <button className="btn btn-outline" onClick={doCancel}>Batalkan Booking</button>
              <button className="btn btn-outline" onClick={doForget}>Lupakan di perangkat ini</button>
            </div>
          )}
          {error && <p className="form-error" style={{ marginTop: '1rem' }}>{error}</p>}
        </div>
      ) : (
        <>
          <QueueTicket number={q.currently_serving} remaining={q.remaining} />

          <div style={{ marginBottom: '1.25rem' }}>
            <NumGrid q={q} />
          </div>

          <div className="wizard">
            <h3>Lihat status saya</h3>
            <p style={{ color: 'var(--muted)', margin: '0.5rem 0 1rem' }}>
              Masukkan nomor HP yang dipakai saat booking.
            </p>
            <div className="form-field">
              <label htmlFor="lookupPhone">Nomor HP</label>
              <input id="lookupPhone" value={lookupPhone} onChange={(e) => setLookupPhone(e.target.value)} placeholder="0812…" inputMode="tel" />
            </div>
            <button className="btn btn-primary btn-block" onClick={doLookup}>Cek Status</button>
            {lookupMsg && <p className="form-error" style={{ marginTop: '0.75rem' }}>{lookupMsg}</p>}
          </div>
        </>
      )}
    </div>
  );
}