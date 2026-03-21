import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT NULL;
    CREATE TABLE IF NOT EXISTS oauth_identities (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      provider_user_id TEXT NOT NULL,
      email TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (provider, provider_user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_oauth_identities_user ON oauth_identities(user_id);
    CREATE TABLE IF NOT EXISTS expenses (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
      category TEXT NOT NULL DEFAULT 'personal',
      financial_institution TEXT NOT NULL DEFAULT 'bank',
      frequency TEXT NOT NULL DEFAULT 'monthly',
      description TEXT DEFAULT '',
      spent_at DATE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_expenses_user_spent ON expenses(user_id, spent_at);
    ALTER TABLE expenses ADD COLUMN IF NOT EXISTS financial_institution TEXT NOT NULL DEFAULT 'bank';
    ALTER TABLE expenses ADD COLUMN IF NOT EXISTS frequency TEXT NOT NULL DEFAULT 'monthly';
    ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_day SMALLINT NULL;
    ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_payment_day_range;
    ALTER TABLE expenses ADD CONSTRAINT expenses_payment_day_range
      CHECK (payment_day IS NULL OR (payment_day >= 1 AND payment_day <= 30));
    CREATE TABLE IF NOT EXISTS import_batches (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      source_filename TEXT NOT NULL DEFAULT '',
      default_financial_institution TEXT NOT NULL DEFAULT 'visa',
      default_frequency TEXT NOT NULL DEFAULT 'once',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS import_staging_rows (
      id SERIAL PRIMARY KEY,
      batch_id INTEGER NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      spent_at DATE NOT NULL,
      amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
      description TEXT DEFAULT '',
      category TEXT NULL,
      frequency TEXT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE import_staging_rows ADD COLUMN IF NOT EXISTS frequency TEXT;
    ALTER TABLE import_staging_rows ADD COLUMN IF NOT EXISTS payment_day SMALLINT NULL;
    ALTER TABLE import_staging_rows DROP CONSTRAINT IF EXISTS import_staging_rows_payment_day_range;
    ALTER TABLE import_staging_rows ADD CONSTRAINT import_staging_rows_payment_day_range
      CHECK (payment_day IS NULL OR (payment_day >= 1 AND payment_day <= 30));
    CREATE INDEX IF NOT EXISTS idx_import_staging_batch ON import_staging_rows(batch_id);
    CREATE INDEX IF NOT EXISTS idx_import_batches_user ON import_batches(user_id);
    CREATE TABLE IF NOT EXISTS monthly_summaries (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      year SMALLINT NOT NULL,
      month SMALLINT NOT NULL CHECK (month >= 1 AND month <= 12),
      total NUMERIC(14, 2) NOT NULL,
      generated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (user_id, year, month)
    );
  `);
}
