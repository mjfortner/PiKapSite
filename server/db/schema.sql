-- Kappa Pi Kappa Donation Database Schema

CREATE TABLE IF NOT EXISTS donors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    name TEXT,
    amount INTEGER NOT NULL,           -- Amount in cents
    currency TEXT DEFAULT 'usd',
    payment_method TEXT,               -- 'stripe' or 'venmo'
    payment_id TEXT,                   -- External payment reference (Stripe PaymentIntent ID or PayPal Order ID)
    donation_type TEXT,                -- 'one-time', 'monthly', 'dollar-a-day'
    status TEXT DEFAULT 'pending',     -- 'pending', 'completed', 'failed', 'refunded'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT                      -- JSON for additional info (recognition level, notes, etc.)
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    donor_id INTEGER REFERENCES donors(id),
    stripe_subscription_id TEXT,
    plan_type TEXT,                    -- 'monthly', 'dollar-a-day-5yr', 'dollar-a-day-7yr', 'dollar-a-day-10yr'
    amount INTEGER,                    -- Monthly amount in cents
    status TEXT,                       -- 'active', 'canceled', 'past_due', 'paused'
    current_period_start DATETIME,
    current_period_end DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    canceled_at DATETIME
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_donors_email ON donors(email);
CREATE INDEX IF NOT EXISTS idx_donors_payment_id ON donors(payment_id);
CREATE INDEX IF NOT EXISTS idx_donors_status ON donors(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_donor_id ON subscriptions(donor_id);
