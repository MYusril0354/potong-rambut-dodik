import { useEffect, useState } from 'react';
import { CONFIG, PILL, STATUS_LABEL, buildWaUrl, effectiveStatus, waTemplate, type Booking, type QueueInfo } from '../../lib/util';
import {
  apiAdminDemoFill,
  apiAdminList,
  apiAdminLogin,
  apiAdminLogout,
  apiAdminNext,
  apiAdminReset,
  apiAdminSkip,
  apiGetSettings,
  apiSaveSettings,
  apiAdminNotify,
  fetchQueue,
  type SettingsInfo,
} from '../../lib/api';
import QueueTicket from './QueueTicket';

function fuTime(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
}

export default function AdminPanel() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [pw, setPw] = useState('');
  const [loginErr, setLoginErr] = useState<string | null>(null);
  const [list, setList] = useState<Booking[]>([]);
  const [q, setQ] = useState<QueueInfo | null>(null);
  const [settings, setSettings] = useState<SettingsInfo | null>(null);
  const [autoWa, setAutoWa] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<'antrian' | 'pengaturan'>('antrian');
  const [hours, setHours] = useState<SettingsInfo['hours']>([]);
  const [price, setPrice] = useState<number>(0);
  const [totalNumbers, setTotalNumbers] = useState<number>(40);
  const [breakStart, setBreakStart] = useState('');
  const [breakEnd, setBreakEnd] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ message: string; action: () => void } | null>(null);

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
    const st = await apiGetSettings().catch(() => null);
    if (st) {
      setSettings(st);
      setHours(st.hours || []);
      setPrice(st.price);
      setTotalNumbers(st.totalNumbers || 40);
      setBreakStart(st.breakStart || '');
      setBreakEnd(st.breakEnd || '');
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const setHour = (i: number, patch: Partial<SettingsInfo['hours'][number]>) => {
    setHours((prev) => prev.map((h, j) => (j === i ? { ...h, ...patch } : h)));
  };

  const askConfirm = (message: string, action: () => void) => setConfirm({ message, action });

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
    let remindedNumber: number | undefined;
    if (r.ok && autoWa && r.next != null) {
      const updated = await apiAdminList().catch(() => ({ ok: false } as const));
      const bookings = updated.ok ? updated.bookings || [] : [];
      const nextUp = bookings
        .filter((b) => b.status === 'booked' && b.number > r.next!)
        .sort((a, b) => a.number - b.number)[0];
      if (nextUp) {
        const qq = await fetchQueue().catch(() => null);
        const url = qq ? buildWaUrl(nextUp.customer_phone, waTemplate(nextUp, qq, 'booked')) : null;
        if (url) {
          window.open(url, '_blank', 'noopener,noreferrer');
          remindedNumber = nextUp.number;
        }
      }
    }
    flash(
      r.ok
        ? `Memanggil nomor #${r.next ?? '—'}${remindedNumber ? ` · pengingat dikirim ke #${remindedNumber}` : ''}.`
        : r.error || 'Tidak ada nomor berikutnya.'
    );
  };

  const doSkip = async () => {
    const r = await apiAdminSkip().catch(() => ({ ok: false } as const));
    await refresh();
    flash(r.ok ? `Nomor #${(r as any).skipped} dilewati.` : 'Tidak ada nomor untuk dilewati.');
  };

  const doReset = async () => {
    await apiAdminReset().catch(() => {});
    await refresh();
    flash('Hari ini direset.');
  };

  const doDemoFill = async () => {
    await apiAdminDemoFill().catch(() => {});
    await refresh();
    flash('Data demo diisi (7 booking).');
  };

  const doWa = (b: Booking) => {
    if (!q) return;
    const st = effectiveStatus(b, q);
    const url = buildWaUrl(b.customer_phone, waTemplate(b, q, st));
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
    apiAdminNotify(b.id)
      .then(() => refresh())
      .catch(() => {});
  };

  const saveHours = async () => {
    setSaving('jam');
    const r = await apiSaveSettings({ hours }).catch(() => null);
    setSaving(null);
    if (r?.ok) {
      setSettings(r.settings);
      flash('Jam operasional disimpan.');
    } else {
      flash('Gagal menyimpan jam operasional.');
    }
  };

  const savePrice = async () => {
    setSaving('harga');
    const r = await apiSaveSettings({ price }).catch(() => null);
    setSaving(null);
    if (r?.ok) {
      setSettings(r.settings);
      flash(`Harga disimpan (${r.settings.priceLabel}).`);
    } else {
      flash('Gagal menyimpan harga.');
    }
  };

  const saveTotalNumbers = async () => {
    setSaving('total');
    const r = await apiSaveSettings({ totalNumbers }).catch(() => null);
    setSaving(null);
    if (r?.ok) {
      setSettings(r.settings);
      flash('Total nomor disimpan.');
    } else {
      flash('Gagal menyimpan total nomor.');
    }
  };

  const saveBreak = async () => {
    setSaving('break');
    const r = await apiSaveSettings({ breakStart, breakEnd }).catch(() => null);
    setSaving(null);
    if (r?.ok) {
      setSettings(r.settings);
      flash('Jam istirahat disimpan.');
    } else {
      flash('Gagal menyimpan jam istirahat.');
    }
  };

  const toggleClose = async () => {
    const next = !(settings?.temporarilyClosed);
    const r = await apiSaveSettings({ temporarilyClosed: next }).catch(() => null);
    if (r?.ok) {
      setSettings(r.settings);
      flash(next ? 'Toko ditandai TUTUP sementara.' : 'Toko dibuka kembali.');
    } else {
      flash('Gagal mengubah status tutup.');
    }
  };

  if (authed === null) return <div className="loading">Memeriksa sesi…</div>;

  if (!authed) {
    return (
      <div className="admin-wrap">
        <div className="wizard">
          <h2>Login Admin</h2>
          <p style={{ color: 'var(--muted)', margin: '0.5rem 0 1rem' }}>
            {(import.meta as any).env?.DEV
              ? <>Demo password: <b>{CONFIG.demoAdminPassword}</b></>
              : 'Masuk untuk mengelola antrian.'}
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
      <div className="admin-card" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <div className="eyebrow">Panel Admin</div>
            <h2>Selamat datang, Pak Dodik</h2>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className="btn btn-outline btn-sm" onClick={doDemoFill}>Isi data demo</button>
            <button className="btn btn-outline btn-sm" onClick={doLogout}>Keluar</button>
          </div>
        </div>

        {settings?.temporarilyClosed && (
          <div className="badge-danger" style={{ marginTop: '1rem' }}>⚠️ Toko sedang TUTUP sementara</div>
        )}

        <div className="admin-tabs" style={{ marginTop: '1.25rem' }}>
          <button className={`tab ${tab === 'antrian' ? 'active' : ''}`} onClick={() => setTab('antrian')}>📋 Antrian</button>
          <button className={`tab ${tab === 'pengaturan' ? 'active' : ''}`} onClick={() => setTab('pengaturan')}>⚙️ Pengaturan</button>
        </div>

        {notice && <p style={{ color: 'var(--success)', fontWeight: 600, marginBottom: '0.75rem' }}>{notice}</p>}

        {tab === 'antrian' && (
          <>
            <div className="admin-card">
              <QueueTicket number={servingNumber} />
              <div className="serving-name">
                {servingBooking ? servingBooking.customer_name : 'Belum ada yang dipanggil hari ini'}
              </div>
              <div className="admin-actions">
                <button className="btn btn-accent" onClick={() => askConfirm('Yakin panggil nomor berikutnya?', doNext)}>Panggil Berikutnya</button>
                <button className="btn btn-outline" onClick={() => askConfirm('Yakin lewati nomor ini?', doSkip)}>Lewati Nomor Ini</button>
                <button className="btn btn-danger" onClick={() => askConfirm('Yakin reset hari ini? Semua booking akan dibatalkan.', doReset)}>Reset Hari Ini</button>
              </div>
              <label className="checkbox-row">
                <input type="checkbox" checked={autoWa} onChange={(e) => setAutoWa(e.target.checked)} />
                Kirim WA pengingat ke antrian berikutnya
              </label>
            </div>

            <div className="admin-card">
              <h3 style={{ marginBottom: '0.5rem' }}>Daftar Booking Hari Ini</h3>
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                Klik 💬 untuk follow-up via WhatsApp. Setelah di-FU, tombol berubah jadi ✓ + jam.
              </p>
              {list.length === 0 ? (
                <p style={{ color: 'var(--muted)' }}>Belum ada booking hari ini.</p>
              ) : (
                <div className="admin-list">
                  {list.map((b) => {
                    const st = q ? effectiveStatus(b, q) : 'booked';
                    const url = q ? buildWaUrl(b.customer_phone, waTemplate(b, q, st)) : null;
                    const notified = b.wa_last_notified_at;
                    return (
                      <div className="admin-row" key={b.id}>
                        <div className="anum">#{b.number}</div>
                        <div className="ainfo">
                          <div className="aname">{b.customer_name}</div>
                          <div className="asub">{b.slot_time} · {b.customer_phone}</div>
                        </div>
                        <span className={PILL[st]}>{STATUS_LABEL[st] ?? st}</span>
                        <div className="fu-cell">
                          <button
                            className={notified ? 'wa-mini fu-done' : 'wa-mini'}
                            disabled={st === 'cancelled' || !url}
                            title={notified ? `Terakhir di-FU ${fuTime(notified)}` : 'Follow-up via WhatsApp'}
                            aria-label={`Follow-up ${b.customer_name} via WhatsApp`}
                            onClick={() => doWa(b)}
                          >
                            {notified ? '✓' : '💬'}
                          </button>
                          {notified && <span className="fu-time">FU {fuTime(notified)}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'pengaturan' && (
          <>
            <div className="admin-card">
              <h3 style={{ marginBottom: '0.25rem' }}>Jam Operasional</h3>
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                Atur jam buka/tutup. Perubahan langsung tampil di website.
              </p>
              {hours.map((h, i) => (
                <div className="hours-edit-row" key={i}>
                  <span className="hd">{h.days}</span>
                  {h.closed ? (
                    <span style={{ color: 'var(--muted)' }}>Tutup</span>
                  ) : (
                    <>
                      <input type="time" value={h.open ?? ''} onChange={(e) => setHour(i, { open: e.target.value })} />
                      <span>–</span>
                      <input type="time" value={h.close ?? ''} onChange={(e) => setHour(i, { close: e.target.value })} />
                    </>
                  )}
                  <label>
                    <input type="checkbox" checked={!!h.closed} onChange={(e) => setHour(i, { closed: e.target.checked })} />
                    Tutup
                  </label>
                </div>
              ))}
              <button className="btn btn-primary btn-sm" style={{ marginTop: '0.75rem' }} onClick={saveHours} disabled={saving === 'jam'}>
                {saving === 'jam' ? 'Menyimpan…' : 'Simpan Jam Operasional'}
              </button>
            </div>

            <div className="admin-card">
              <h3 style={{ marginBottom: '0.5rem' }}>Harga Potong Rambut</h3>
              <div className="settings-row">
                <input type="number" value={price} min={0} onChange={(e) => setPrice(Number(e.target.value) || 0)} />
                <button className="btn btn-outline btn-sm" onClick={savePrice} disabled={saving === 'harga'}>
                  {saving === 'harga' ? 'Menyimpan…' : 'Simpan Harga'}
                </button>
                <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Sekarang: {settings?.priceLabel}</span>
              </div>
            </div>

            <div className="admin-card">
              <h3 style={{ marginBottom: '0.5rem' }}>Total Nomor per Hari</h3>
              <div className="settings-row">
                <input type="number" value={totalNumbers} min={1} max={200} onChange={(e) => setTotalNumbers(Number(e.target.value) || 40)} />
                <button className="btn btn-outline btn-sm" onClick={saveTotalNumbers} disabled={saving === 'total'}>
                  {saving === 'total' ? 'Menyimpan…' : 'Simpan Total Nomor'}
                </button>
              </div>
            </div>

            <div className="admin-card">
              <h3 style={{ marginBottom: '0.25rem' }}>Jam Istirahat</h3>
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                Kosongkan jam jika tidak ada istirahat.
              </p>
              <div className="settings-row">
                <input type="time" value={breakStart} onChange={(e) => setBreakStart(e.target.value)} />
                <span>–</span>
                <input type="time" value={breakEnd} onChange={(e) => setBreakEnd(e.target.value)} />
                <button className="btn btn-outline btn-sm" onClick={saveBreak} disabled={saving === 'break'}>
                  {saving === 'break' ? 'Menyimpan…' : 'Simpan Istirahat'}
                </button>
              </div>
            </div>

            <div className="admin-card">
              <h3 style={{ marginBottom: '0.5rem' }}>Tutup Darurat</h3>
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                Saat tombol ini aktif, booking ditolak & website menampilkan "tutup".
              </p>
              {settings?.temporarilyClosed ? (
                <button className="btn btn-accent" onClick={toggleClose}>🔓 Buka Kembali</button>
              ) : (
                <button className="btn btn-danger" onClick={toggleClose}>🔒 Tutup Hari Ini</button>
              )}
            </div>
          </>
        )}
      </div>
      <p style={{ color: 'var(--muted)', fontSize: '0.82rem', marginTop: '1.5rem', textAlign: 'center' }}>
        Data tersimpan di Cloudflare D1 (fallback in-memory saat dev lokal).
      </p>

      {confirm && (
        <div className="modal-overlay" onClick={() => setConfirm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Konfirmasi</h3>
            <p>{confirm.message}</p>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setConfirm(null)}>Tidak</button>
              <button
                className="btn btn-accent"
                onClick={() => {
                  const a = confirm.action;
                  setConfirm(null);
                  a();
                }}
              >
                Ya
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}