-- Pangkas Rambut Dodik — D1 schema (initial migration)
-- Run: wrangler d1 migrations apply pangkas-dodik-db --remote

CREATE TABLE IF NOT EXISTS bookings (
  id            TEXT PRIMARY KEY,
  date          TEXT NOT NULL,
  number        INTEGER NOT NULL,
  slot_time     TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'booked',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  wa_last_notified_at TEXT,
  UNIQUE(date, number)
);

CREATE INDEX IF NOT EXISTS idx_bookings_date_status ON bookings(date, status);
CREATE INDEX IF NOT EXISTS idx_bookings_phone_date ON bookings(customer_phone, date);

CREATE TABLE IF NOT EXISTS queue_state (
  date              TEXT PRIMARY KEY,
  currently_serving INTEGER NOT NULL DEFAULT 0,
  updated_at        TEXT NOT NULL
);