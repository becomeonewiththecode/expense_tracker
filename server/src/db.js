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
    ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_lookup TEXT NULL;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_token_hash TEXT NULL;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_code_ciphertext TEXT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_recovery_lookup ON users(recovery_lookup)
      WHERE recovery_lookup IS NOT NULL;
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
    ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_month SMALLINT NULL;
    ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_payment_month_range;
    ALTER TABLE expenses ADD CONSTRAINT expenses_payment_month_range
      CHECK (payment_month IS NULL OR (payment_month >= 1 AND payment_month <= 12));
    ALTER TABLE expenses ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT 'active';
    ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_state_check;
    UPDATE expenses SET state = 'cancelled' WHERE state = 'cancel';
    ALTER TABLE expenses ADD CONSTRAINT expenses_state_check
      CHECK (state IN ('active', 'paused', 'cancelled'));
    ALTER TABLE expenses ADD COLUMN IF NOT EXISTS website TEXT NULL;
    ALTER TABLE expenses ADD COLUMN IF NOT EXISTS renewal_kind TEXT NULL;
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
    ALTER TABLE import_staging_rows ADD COLUMN IF NOT EXISTS payment_month SMALLINT NULL;
    ALTER TABLE import_staging_rows DROP CONSTRAINT IF EXISTS import_staging_rows_payment_month_range;
    ALTER TABLE import_staging_rows ADD CONSTRAINT import_staging_rows_payment_month_range
      CHECK (payment_month IS NULL OR (payment_month >= 1 AND payment_month <= 12));
    ALTER TABLE import_staging_rows ADD COLUMN IF NOT EXISTS website TEXT NULL;
    ALTER TABLE import_staging_rows ADD COLUMN IF NOT EXISTS renewal_kind TEXT NULL;
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
    CREATE TABLE IF NOT EXISTS prescriptions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
      renewal_period TEXT NOT NULL,
      next_renewal_date DATE NOT NULL,
      vendor TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE prescriptions DROP CONSTRAINT IF EXISTS prescriptions_state_check;
    UPDATE prescriptions SET state = 'cancelled' WHERE state = 'cancel';
    ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_state_check
      CHECK (state IN ('active', 'paused', 'cancelled'));
    CREATE INDEX IF NOT EXISTS idx_prescriptions_user_next ON prescriptions(user_id, next_renewal_date);
    CREATE TABLE IF NOT EXISTS payment_plans (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      source_expense_id INTEGER NULL REFERENCES expenses(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
      category TEXT NOT NULL,
      payment_schedule TEXT NOT NULL,
      priority_level TEXT NOT NULL,
      status TEXT NOT NULL,
      account_type TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      institution TEXT NOT NULL,
      tag TEXT NOT NULL,
      frequency TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE payment_plans ADD COLUMN IF NOT EXISTS source_expense_id INTEGER NULL REFERENCES expenses(id) ON DELETE CASCADE;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_plans_user_source_expense
      ON payment_plans(user_id, source_expense_id)
      WHERE source_expense_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_payment_plans_user_id_desc ON payment_plans(user_id, id DESC);
  `);
}
