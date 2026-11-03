import { useEffect, useState } from 'react';
import site from '../../data/site.json';
import { slotTime, type QueueInfo } from '../../lib/util';
import { apiBook, fetchQueue } from '../../lib/api';
import TurnstileWidget from './TurnstileWidget';
import NumGrid from './NumGrid';

export default function BookingWizard({ turnstileSiteKey }: { turnstileSiteKey?: string }) {
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [q, setQ] = useState<QueueInfo | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  useEffect(() => {
    fetchQueue().then(setQ).catch(() => setQ(null));
  }, []);

  const closed = q?.is_closed ?? false;

  if (closed) {
    return (
      <div className="wizard">
        <div className="closed-banner">Hari ini tutup. Booking tidak tersedia.</div>
        <a className="btn btn-primary" href="/">Kembali ke Beranda</a>
      </div>
    );
  }

  if (!q) return <div className="loading">Memuat nomor…</div>;

  const submit = () => {
    setError(null);
    if (selected == null) return;
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 9 || phoneDigits.length > 13) {
      setError('Nomor HP tidak valid. Gunakan nomor HP aktif WhatsApp (contoh: 0812xxxxxxxx).');
      return;
    }
    if (turnstileSiteKey && !turnstileToken) {
      setError('Selesaikan dulu verifikasi keamanan (captcha).');
      setStep(2);
      return;
    }
    apiBook(selected, name, phone, turnstileToken).then((r) => {
      if (r.ok) {
        setDone(true);
        window.location.href = '/status';
      } else {
        setError(r.error || 'Gagal booking.');
      }
    });
  };

  return (
    <div className="wizard">
      <div className="steps-indicator">
        <span className={`step ${step >= 1 ? 'active' : ''}`} />
        <span className={`step ${step >= 2 ? 'active' : ''}`} />
        <span className={`step ${step >= 3 ? 'active' : ''}`} />
      </div>

      {step === 1 && (
        <div className="step-panel">
          <h2>1. Pilih Nomor</h2>
          <p style={{ color: 'var(--muted)', margin: '0.5rem 0 1.25rem' }}>
            Nomor kecil = jam lebih awal. {q.total_numbers} nomor tersedia per hari.
          </p>
          <NumGrid q={q} selectable selected={selected} onSelect={setSelected} />
          <div className="wizard-actions">
            <span />
            <button className="btn btn-primary" disabled={selected == null} onClick={() => setStep(2)}>
              Lanjut
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="step-panel">
          <h2>2. Isi Data</h2>
          <p style={{ color: 'var(--muted)', margin: '0.5rem 0 1.25rem' }}>
            Nomor terpilih: <b>#{selected} · {q.slot_times?.[(selected ?? 1) - 1] ?? slotTime(selected ?? 1)}</b>
          </p>
          <div className="form-field">
            <label htmlFor="bookName">Nama lengkap</label>
            <input id="bookName" value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: Bagus Setiawan" autoComplete="name" />
          </div>
          <div className="form-field">
            <label htmlFor="bookPhone">Nomor HP (terdaftar WhatsApp)</label>
            <input id="bookPhone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0812…" inputMode="tel" autoComplete="tel" />
            <div className="wa-warn">
              ⚠️ Wajib nomer Whatsapp yang aktif untuk memudahkan pengingat giliran dan nanti akan dikirim lewat WhatsApp
            </div>
          </div>
          {turnstileSiteKey && (
            <div className="form-field">
              <TurnstileWidget siteKey={turnstileSiteKey} onToken={setTurnstileToken} />
            </div>
          )}
          {error && <p className="form-error">{error}</p>}
          <div className="wizard-actions">
            <button className="btn btn-outline" onClick={() => setStep(1)}>Kembali</button>
            <button className="btn btn-primary" onClick={() => setStep(3)}>Lanjut</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="step-panel">
          <h2>3. Konfirmasi</h2>
          <div className="summary" style={{ marginTop: '0.75rem' }}>
            <div className="summary-row"><span>Nomor antrian</span><b>#{selected}</b></div>
            <div className="summary-row"><span>Perkiraan jam</span><b>{q.slot_times?.[(selected ?? 1) - 1] ?? slotTime(selected ?? 1)}</b></div>
            <div className="summary-row"><span>Layanan</span><b>{site.serviceName} · {site.priceLabel}</b></div>
            <div className="summary-row"><span>Nama</span><b>{name}</b></div>
            <div className="summary-row"><span>HP</span><b>{phone}</b></div>
          </div>
          {error && <p className="form-error" style={{ marginTop: '1rem' }}>{error}</p>}
          <div className="wizard-actions">
            <button className="btn btn-outline" onClick={() => setStep(2)}>Kembali</button>
            <button className="btn btn-accent" onClick={submit} disabled={done}>Konfirmasi Booking</button>
          </div>
        </div>
      )}
    </div>
  );
}