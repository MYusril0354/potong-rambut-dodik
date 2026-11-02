import { useEffect, useState } from 'react';
import { CONFIG, PILL, buildWaUrl, effectiveStatus, waTemplate, type Booking, type QueueInfo } from '../../lib/util';
import {
  apiAdminDemoFill,
  apiAdminList,
  apiAdminLogin,
  apiAdminLogout,
  apiAdminNext,
  apiAdminReset,
  apiAdminSkip,
  fetchQueue,
} from '../../lib/api';

export default function AdminPanel() {
  const [authed, setAuthed] = useState<boolean | null>(null); // null = memeriksa
  const [pw, setPw] = useState('');
  const [loginErr, setLoginErr] = useState<string | null>(null);
  const [list, setList] = useState<Booking[]>([]);
  const [q, setQ] = useState<QueueInfo | null>(null);
  const [autoWa, setAutoWa] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const flash = (m: string) => {
    setNotice(m);
    window.setTimeout(() => setNotice(null), 3500);
  };

  const refresh = async () => {
    const qq = await fetchQueue().catch(() => null);
    setQ(qq);
    const lr = await apiAdminList().catch(() => ({ ok: false } as const));
    if (lr.ok) {
      setAuthed(true);
      setList(lr.bookings || []);
    } else {
      setAuthed(false);
      setList([]);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const doLogin = async () => {
    const r = await apiAdminLogin(pw).catch(() => ({ ok: false, error: 'Gagal terhubung ke server.' }));
    if (r.ok) {
      setLoginErr(null);
      setPw('');
      await refresh();
    } else {
      setLoginErr(r.error || 'Login gagal.');
    }
  };

  const doLogout = async () => {
    await apiAdminLogout().catch(() => {});
    await refresh();
  };

  const doNext = async () => {
    const r = await apiAdminNext().catch(() => ({ ok: false, error: 'Gagal terhubung ke server.' }));
    await refresh();
    if (r.ok && r.next != null && autoWa) {
      const updated = await apiAdminList().catch(() => ({ ok: false } as const));
      const b = (updated.ok ? updated.bookings : []).find((x) => x.number === r.next);
      if (b && q) {
        const url = buildWaUrl(b.customer_phone, waTemplate(b, q, 'serving'));
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
      }
    }
    flash(r.ok ? `Memanggil nomor berikutnya (#${r.next ?? '—'}).` : r.error || 'Tidak ada nomor berikutnya.');
  };

  const doSkip = async () => {
    const r = await apiAdminSkip().catch(() => ({ ok: false } as const));
    await refresh();
    flash(r.ok ? `Nomor #${(r as any).skipped} dilewati.` : 'Tidak ada nomor untuk dilewati.');
  };

  const doReset = async () => {
    if (!window.confirm('Reset hari ini? Semua booking hari ini akan dibatalkan.')) return;
    await apiAdminReset().catch(() => {});
    await refresh();
    flash('Hari ini direset.');
  };

  const doDemoFill = async () => {
    await apiAdminDemoFill().catch(() => {});
    await refresh();
    flash('Data demo diisi (7 booking).');
  };

  if (authed === null) return <div className="loading">Memeriksa sesi…</div>;

  if (!authed) {
    return (
      <div className="admin-wrap">
        <div className="wizard">
          <h2>Login Admin</h2>
          <p style={{ color: 'var(--muted)', margin: '0.5rem 0 1rem' }}>
            Khusus untuk Pak Dodik. Demo password: <b>{CONFIG.demoAdminPassword}</b>
          </p>
          <div className="form-field">
            <label htmlFor="adminPass">Password</label>
            <input
              id="adminPass"
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doLogin()}
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </div>
          {loginErr && <p className="form-error" style={{ marginBottom: '0.75rem' }}>{loginErr}</p>}
          <button className="btn btn-primary btn-block" onClick={doLogin}>Masuk</button>
        </div>
      </div>
    );
  }

  const servingNumber = q && q.currently_serving > 0 ? q.currently_serving : null;
  const servingBooking = servingNumber ? list.find((b) => b.number === servingNumber) : null;

  return (
    <div className="admin-wrap">
      <div className="admin-grid">
        <div className="admin-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
            <div>
              <div className="eyebrow">Panel Admin</div>
              <h2>Selamat datang, Pak Dodik</h2>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-outline btn-sm" onClick={doDemoFill}>Isi data demo</button>
              <button className="btn btn-outline btn-sm" onClick={doLogout}>Keluar</button>
            </div>
          </div>

          <div style={{ margin: '1.25rem 0' }}>
            <div className="label" style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Sedang dilayani</div>
            <div className="big">#{servingNumber ?? '—'}</div>
            <div style={{ color: 'var(--muted)' }}>
              {servingBooking ? servingBooking.customer_name : 'Belum ada yang dipanggil hari ini'}
            </div>
          </div>

          <div className="admin-actions">
            <button className="btn btn-accent" onClick={doNext}>Panggil Berikutnya</button>
            <button className="btn btn-outline" onClick={doSkip}>Lewati Nomor Ini</button>
            <button className="btn btn-danger" onClick={doReset}>Reset Hari Ini</button>
          </div>
          <label className="checkbox-row">
            <input type="checkbox" checked={autoWa} onChange={(e) => setAutoWa(e.target.checked)} />
            Kirim WA juga ke pelanggan saat panggil berikutnya
          </label>
          {notice && (
            <p style={{ marginTop: '1rem', color: 'var(--success)', fontWeight: 600 }}>{notice}</p>
          )}
        </div>

        <div className="admin-card">
          <h3 style={{ marginBottom: '0.5rem' }}>Daftar Booking Hari Ini</h3>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            Klik ikon 💬 untuk follow-up via WhatsApp.
          </p>
          {list.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>Belum ada booking hari ini.</p>
          ) : (
            <div className="admin-list">
              {list.map((b) => {
                const st = q ? effectiveStatus(b, q) : 'booked';
                const url = q ? buildWaUrl(b.customer_phone, waTemplate(b, q, st)) : null;
                return (
                  <div className="admin-row" key={b.id}>
                    <div className="anum">#{b.number}</div>
                    <div className="ainfo">
                      <div className="aname">{b.customer_name}</div>
                      <div className="asub">{b.slot_time} · {b.customer_phone}</div>
                    </div>
                    <span className={PILL[st]}>{st}</span>
                    <button
                      className="wa-mini"
                      disabled={st === 'cancelled' || !url}
                      title={url ? 'Follow-up via WhatsApp' : 'Tidak tersedia'}
                      aria-label={`Follow-up ${b.customer_name} via WhatsApp`}
                      onClick={() => url && window.open(url, '_blank', 'noopener,noreferrer')}
                    >
                      💬
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: '0.82rem', marginTop: '1.5rem', textAlign: 'center' }}>
        Data tersimpan di Cloudflare D1 (fallback in-memory saat dev lokal).
      </p>
    </div>
  );
}