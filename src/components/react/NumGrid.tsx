import ScissorsIcon from './ScissorsIcon';
import { slotTime, type QueueInfo } from '../../lib/util';

type NumStatus = 'available' | 'booked' | 'serving' | 'done' | 'skipped' | 'passed';

interface Props {
  q: QueueInfo;
  selectable?: boolean;
  selected?: number | null;
  onSelect?: (n: number | null) => void;
}

export default function NumGrid({ q, selectable = false, selected = null, onSelect }: Props) {
  const statusOf = (n: number): NumStatus => {
    if (q.serving === n) return 'serving';
    if (q.done.includes(n)) return 'done';
    if (q.skipped.includes(n)) return 'skipped';
    if (q.booked.includes(n)) return 'booked';
    if (q.currently_serving > 0 && n < q.currently_serving) return 'passed';
    return 'available';
  };

  return (
    <>
      <div className="num-grid">
        {Array.from({ length: q.total_numbers }, (_, i) => i + 1).map((n) => {
          const st = statusOf(n);
          const isSelected = selected === n;
          const clickable = selectable && (st === 'available' || isSelected);
          return (
            <button
              key={n}
              type="button"
              className={`num-btn ${st !== 'available' ? st : ''} ${isSelected ? 'selected' : ''}`}
              disabled={!clickable}
              onClick={() => onSelect?.(isSelected ? null : n)}
              aria-pressed={isSelected}
              aria-label={`Nomor ${n}`}
            >
              {st === 'serving' ? (
                <>
                  <ScissorsIcon className="scissors-anim" />
                  {n}
                </>
              ) : (
                <>
                  {n}
                  <small>{q.slot_times?.[n - 1] ?? slotTime(n)}</small>
                </>
              )}
            </button>
          );
        })}
      </div>

      <div className="num-legend" aria-label="Keterangan warna nomor">
        <span><i className="dot available" />Bisa dipilih</span>
        <span><i className="dot serving" />Sedang dilayani</span>
        <span><i className="dot booked" />Sudah diambil</span>
        <span><i className="dot done" />Selesai</span>
        <span><i className="dot skipped" />Dilewati</span>
        <span><i className="dot passed" />Sudah lewat</span>
      </div>
    </>
  );
}