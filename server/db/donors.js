const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Initialize database
const dbPath = process.env.DATABASE_URL || path.join(__dirname, 'donors.db');
const db = new Database(dbPath);

// Run schema on initialization
const schemaPath = path.join(__dirname, 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');
db.exec(schema);

// Donor CRUD operations
const donors = {
    /**
     * Create a new donor record
     */
    create: (donorData) => {
        const stmt = db.prepare(`
            INSERT INTO donors (email, name, amount, currency, payment_method, payment_id, donation_type, status, metadata)
            VALUES (@email, @name, @amount, @currency, @paymentMethod, @paymentId, @donationType, @status, @metadata)
        `);

        const result = stmt.run({
            email: donorData.email,
            name: donorData.name || null,
            amount: donorData.amount,
            currency: donorData.currency || 'usd',
            paymentMethod: donorData.paymentMethod,
            paymentId: donorData.paymentId || null,
            donationType: donorData.donationType,
            status: donorData.status || 'pending',
            metadata: donorData.metadata ? JSON.stringify(donorData.metadata) : null
        });

        return { id: result.lastInsertRowid, ...donorData };
    },

    /**
     * Get donor by ID
     */
    getById: (id) => {
        const stmt = db.prepare('SELECT * FROM donors WHERE id = ?');
        const row = stmt.get(id);
        if (row && row.metadata) {
            row.metadata = JSON.parse(row.metadata);
        }
        return row;
    },

    /**
     * Get donor by payment ID
     */
    getByPaymentId: (paymentId) => {
        const stmt = db.prepare('SELECT * FROM donors WHERE payment_id = ?');
        const row = stmt.get(paymentId);
        if (row && row.metadata) {
            row.metadata = JSON.parse(row.metadata);
        }
        return row;
    },

    /**
     * Get all donors by email
     */
    getByEmail: (email) => {
        const stmt = db.prepare('SELECT * FROM donors WHERE email = ? ORDER BY created_at DESC');
        return stmt.all(email).map(row => {
            if (row.metadata) {
                row.metadata = JSON.parse(row.metadata);
            }
            return row;
        });
    },

    /**
     * Update donor status
     */
    updateStatus: (id, status) => {
        const stmt = db.prepare('UPDATE donors SET status = ? WHERE id = ?');
        return stmt.run(status, id);
    },

    /**
     * Update donor by payment ID
     */
    updateByPaymentId: (paymentId, updates) => {
        const fields = [];
        const values = {};

        if (updates.status !== undefined) {
            fields.push('status = @status');
            values.status = updates.status;
        }
        if (updates.name !== undefined) {
            fields.push('name = @name');
            values.name = updates.name;
        }
        if (updates.metadata !== undefined) {
            fields.push('metadata = @metadata');
            values.metadata = JSON.stringify(updates.metadata);
        }

        if (fields.length === 0) return null;

        values.paymentId = paymentId;
        const stmt = db.prepare(`UPDATE donors SET ${fields.join(', ')} WHERE payment_id = @paymentId`);
        return stmt.run(values);
    },

    /**
     * Get donation statistics
     */
    getStats: () => {
        const totalStmt = db.prepare(`
            SELECT
                COUNT(*) as total_donations,
                SUM(amount) as total_amount,
                COUNT(DISTINCT email) as unique_donors
            FROM donors
            WHERE status = 'completed'
        `);
        return totalStmt.get();
    },

    /**
     * Get recent donations
     */
    getRecent: (limit = 10) => {
        const stmt = db.prepare(`
            SELECT * FROM donors
            WHERE status = 'completed'
            ORDER BY created_at DESC
            LIMIT ?
        `);
        return stmt.all(limit).map(row => {
            if (row.metadata) {
                row.metadata = JSON.parse(row.metadata);
            }
            return row;
        });
    }
};

// Subscription CRUD operations
const subscriptions = {
    /**
     * Create a new subscription record
     */
    create: (subData) => {
        const stmt = db.prepare(`
            INSERT INTO subscriptions (donor_id, stripe_subscription_id, plan_type, amount, status, current_period_start, current_period_end)
            VALUES (@donorId, @stripeSubscriptionId, @planType, @amount, @status, @currentPeriodStart, @currentPeriodEnd)
        `);

        const result = stmt.run({
            donorId: subData.donorId,
            stripeSubscriptionId: subData.stripeSubscriptionId,
            planType: subData.planType,
            amount: subData.amount,
            status: subData.status || 'active',
            currentPeriodStart: subData.currentPeriodStart || null,
            currentPeriodEnd: subData.currentPeriodEnd || null
        });

        return { id: result.lastInsertRowid, ...subData };
    },

    /**
     * Get subscription by Stripe ID
     */
    getByStripeId: (stripeSubscriptionId) => {
        const stmt = db.prepare('SELECT * FROM subscriptions WHERE stripe_subscription_id = ?');
        return stmt.get(stripeSubscriptionId);
    },

    /**
     * Get subscriptions by donor ID
     */
    getByDonorId: (donorId) => {
        const stmt = db.prepare('SELECT * FROM subscriptions WHERE donor_id = ? ORDER BY created_at DESC');
        return stmt.all(donorId);
    },

    /**
     * Update subscription status
     */
    updateStatus: (stripeSubscriptionId, status) => {
        const stmt = db.prepare('UPDATE subscriptions SET status = ? WHERE stripe_subscription_id = ?');
        return stmt.run(status, stripeSubscriptionId);
    },

    /**
     * Update subscription period
     */
    updatePeriod: (stripeSubscriptionId, periodStart, periodEnd) => {
        const stmt = db.prepare(`
            UPDATE subscriptions
            SET current_period_start = ?, current_period_end = ?
            WHERE stripe_subscription_id = ?
        `);
        return stmt.run(periodStart, periodEnd, stripeSubscriptionId);
    },

    /**
     * Cancel subscription
     */
    cancel: (stripeSubscriptionId) => {
        const stmt = db.prepare(`
            UPDATE subscriptions
            SET status = 'canceled', canceled_at = CURRENT_TIMESTAMP
            WHERE stripe_subscription_id = ?
        `);
        return stmt.run(stripeSubscriptionId);
    },

    /**
     * Get active subscriptions
     */
    getActive: () => {
        const stmt = db.prepare(`
            SELECT s.*, d.email, d.name
            FROM subscriptions s
            JOIN donors d ON s.donor_id = d.id
            WHERE s.status = 'active'
        `);
        return stmt.all();
    }
};

module.exports = {
    db,
    donors,
    subscriptions
};
