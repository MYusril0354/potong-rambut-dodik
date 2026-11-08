import ScissorsIcon from './ScissorsIcon';

interface Props {
  number: number | null;
  remaining?: number;
  closed?: boolean;
}

export default function QueueTicket({ number, remaining, closed }: Props) {
  return (
    <div className="queue-ticket" role="status" aria-live="polite">
      <div className="ticket-stub" aria-hidden="true" />
      <div className="ticket-body">
        {closed ? (
          <div className="ticket-closed">Tutup Hari Ini</div>
        ) : (
          <>
            <div className="ticket-label">Sedang Dilayani</div>
            <ScissorsIcon className="ticket-scissors" />
            <div className="ticket-number">{number && number > 0 ? `#${number}` : '—'}</div>
            {typeof remaining === 'number' && (
              <div className="ticket-sub">
                Tersisa <b>{remaining}</b> nomor
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}