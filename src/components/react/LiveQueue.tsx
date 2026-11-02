import { useEffect, useState } from 'react';
import { fetchQueue } from '../../lib/api';
import type { QueueInfo } from '../../lib/util';

export default function LiveQueue() {
  const [q, setQ] = useState<QueueInfo | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = () => {
      fetchQueue()
        .then((next) => {
          if (mounted) setQ(next);
        })
        .catch(() => {
          if (mounted) setQ(null);
        });
    };
    load();
    const id = setInterval(load, 30000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="live-card">
      <div>
        <h3>
          <span className="pulse-dot" aria-hidden="true" /> Live dari kursi Dodik
        </h3>
        <p>
          {q?.is_closed
            ? 'Hari ini tutup. Booking dibuka kembali besok.'
            : 'Status antrian diperbarui otomatis.'}
        </p>
      </div>
      <div className="live-numbers">
        <div className="live-number">
          <div className="label">Sedang Dilayani</div>
          <div className="value">{q && !q.is_closed && q.currently_serving > 0 ? `#${q.currently_serving}` : '—'}</div>
        </div>
        <div className="live-number">
          <div className="label">Nomor Tersisa</div>
          <div className="value muted">{q ? q.remaining : '—'}</div>
        </div>
      </div>
    </div>
  );
}