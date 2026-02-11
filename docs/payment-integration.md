# Payment Integration Documentation

This document describes the Stripe and Venmo payment integration for the Kappa Pi Kappa website.

## Overview

The payment system allows donors to make one-time or recurring donations via credit card (Stripe) or Venmo (PayPal). It includes donor tracking, webhook handling for payment events, and automated receipt emails.

## Architecture

```
PiKapSite/
├── index.html              # Updated with payment UI
├── styles.css              # Added payment form styles
├── script.js               # Added payment logic
├── docs/
│   └── payment-integration.md
└── server/
    ├── package.json        # Node.js dependencies
    ├── index.js            # Express server entry point
    ├── .env.example        # Environment variables template
    ├── routes/
    │   ├── stripe.js       # Stripe API endpoints
    │   └── venmo.js        # PayPal/Venmo API endpoints
    ├── webhooks/
    │   ├── stripe-webhook.js   # Stripe event handlers
    │   └── paypal-webhook.js   # PayPal event handlers
    ├── db/
    │   ├── schema.sql      # Database schema
    │   └── donors.js       # Database operations
    └── utils/
        └── email.js        # Email receipt templates
```

## Technology Stack

| Component | Technology |
|-----------|------------|
| Frontend | HTML/CSS/JavaScript + Stripe.js |
| Backend | Node.js + Express |
| Database | SQLite (better-sqlite3) |
| Payments | Stripe API + PayPal/Venmo SDK |
| Email | Nodemailer |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Stripe account (https://dashboard.stripe.com)
- PayPal Business account (https://www.paypal.com/business)
- SMTP email credentials (Gmail or other provider)

### Installation

1. Install server dependencies:
   ```bash
   cd server
   npm install
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. The server runs on `http://localhost:3001` by default.

### Environment Variables

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | `development` or `production` |
| `PORT` | Server port (default: 3001) |
| `FRONTEND_URL` | Frontend URL for CORS |
| `STRIPE_SECRET_KEY` | Stripe secret key (sk_test_xxx or sk_live_xxx) |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (pk_test_xxx or pk_live_xxx) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (whsec_xxx) |
| `PAYPAL_CLIENT_ID` | PayPal/Venmo client ID |
| `PAYPAL_CLIENT_SECRET` | PayPal/Venmo client secret |
| `PAYPAL_WEBHOOK_ID` | PayPal webhook ID |
| `DATABASE_URL` | SQLite database path |
| `EMAIL_HOST` | SMTP host (e.g., smtp.gmail.com) |
| `EMAIL_PORT` | SMTP port (e.g., 587) |
| `EMAIL_USER` | SMTP username |
| `EMAIL_PASS` | SMTP password or app password |

---

## API Endpoints

### Stripe Endpoints

#### `GET /api/stripe/config`
Returns the Stripe publishable key for frontend initialization.

**Response:**
```json
{
  "publishableKey": "pk_test_xxx"
}
```

#### `POST /api/stripe/create-payment-intent`
Creates a PaymentIntent for one-time donations.

**Request:**
```json
{
  "amount": 10000,
  "email": "donor@example.com",
  "name": "John Smith '85",
  "donationType": "one-time"
}
```

**Response:**
```json
{
  "clientSecret": "pi_xxx_secret_xxx",
  "paymentIntentId": "pi_xxx"
}
```

#### `POST /api/stripe/create-subscription`
Creates a subscription for recurring donations.

**Request:**
```json
{
  "email": "donor@example.com",
  "name": "John Smith '85",
  "priceId": "price_xxx",
  "planType": "monthly"
}
```

**Response:**
```json
{
  "subscriptionId": "sub_xxx",
  "clientSecret": "pi_xxx_secret_xxx"
}
```

#### `GET /api/stripe/prices`
Returns available subscription prices configured in Stripe.

### Venmo/PayPal Endpoints

#### `GET /api/venmo/config`
Returns the PayPal client ID for frontend initialization.

**Response:**
```json
{
  "clientId": "xxx"
}
```

#### `POST /api/venmo/create-order`
Creates a PayPal order for Venmo payment.

**Request:**
```json
{
  "amount": 10000,
  "email": "donor@example.com",
  "name": "John Smith '85",
  "donationType": "one-time"
}
```

**Response:**
```json
{
  "orderId": "xxx",
  "status": "CREATED"
}
```

#### `POST /api/venmo/capture-order`
Captures payment after user approves in Venmo.

**Request:**
```json
{
  "orderId": "xxx"
}
```

**Response:**
```json
{
  "success": true,
  "captureId": "xxx",
  "status": "COMPLETED"
}
```

### Webhook Endpoints

#### `POST /api/webhooks/stripe`
Handles Stripe webhook events:
- `payment_intent.succeeded` - Updates donor record, sends receipt
- `payment_intent.payment_failed` - Marks donation as failed
- `invoice.paid` - Handles subscription renewals
- `customer.subscription.created/updated/deleted` - Manages subscription lifecycle

#### `POST /api/webhooks/paypal`
Handles PayPal webhook events:
- `PAYMENT.CAPTURE.COMPLETED` - Updates donor record, sends receipt
- `PAYMENT.CAPTURE.DENIED` - Marks donation as failed
- `PAYMENT.CAPTURE.REFUNDED` - Updates refund status

---

## Database Schema

### `donors` Table

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| email | TEXT | Donor email (required) |
| name | TEXT | Donor name |
| amount | INTEGER | Amount in cents |
| currency | TEXT | Currency code (default: 'usd') |
| payment_method | TEXT | 'stripe' or 'venmo' |
| payment_id | TEXT | External payment reference |
| donation_type | TEXT | 'one-time', 'monthly', 'dollar-a-day' |
| status | TEXT | 'pending', 'completed', 'failed', 'refunded' |
| created_at | DATETIME | Timestamp |
| metadata | TEXT | JSON for additional info |

### `subscriptions` Table

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| donor_id | INTEGER | Foreign key to donors |
| stripe_subscription_id | TEXT | Stripe subscription ID |
| plan_type | TEXT | 'monthly', 'dollar-a-day-5yr', etc. |
| amount | INTEGER | Monthly amount in cents |
| status | TEXT | 'active', 'canceled', 'past_due' |
| current_period_start | DATETIME | Billing period start |
| current_period_end | DATETIME | Billing period end |
| created_at | DATETIME | Timestamp |
| canceled_at | DATETIME | Cancellation timestamp |

---

## Frontend Components

### Payment Form

The donate section (`#donate`) includes:

1. **Amount Selector** - Preset amounts ($25, $50, $100, $250, $500) plus custom input
2. **Frequency Selector** - One-Time, Monthly, or Dollar-a-Day
3. **Dollar-a-Day Options** - 5yr ($30.42/mo), 7yr ($60.83/mo), 10yr ($91.25/mo)
4. **Donor Information** - Name (optional) and email (required)
5. **Payment Methods** - Stripe card element and Venmo button
6. **Summary** - Shows amount and frequency with submit button

### Payment Modal

Shows success or error states after payment:
- Success: Thank you message, receipt details, transaction ID
- Error: Error message with retry option

### JavaScript Functions

| Function | Description |
|----------|-------------|
| `initPaymentSystem()` | Initializes Stripe and event listeners |
| `initStripe()` | Fetches config and mounts card element |
| `initPayPal()` | Loads PayPal SDK dynamically |
| `processOneTimePayment()` | Handles Stripe one-time payments |
| `processSubscription()` | Handles recurring subscriptions |
| `showModal()` | Displays success/error modal |
| `updateSummary()` | Updates payment summary display |

---

## Stripe Dashboard Setup

### Create Products and Prices

1. Go to **Products** in Stripe Dashboard
2. Create a product called "Kappa Pi Kappa Donation"
3. Add recurring prices:

| Price Name | Amount | Interval |
|------------|--------|----------|
| Monthly $10 | $10.00 | Monthly |
| Monthly $25 | $25.00 | Monthly |
| Monthly $50 | $50.00 | Monthly |
| Monthly $75 | $75.00 | Monthly |
| Monthly $100 | $100.00 | Monthly |
| Dollar-a-Day 5yr | $30.42 | Monthly |
| Dollar-a-Day 7yr | $60.83 | Monthly |
| Dollar-a-Day 10yr | $91.25 | Monthly |

### Configure Webhooks

1. Go to **Developers > Webhooks**
2. Add endpoint: `https://your-domain.com/api/webhooks/stripe`
3. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy the webhook signing secret to your `.env` file

---

## PayPal Dashboard Setup

### Enable Venmo

1. Log in to PayPal Business Dashboard
2. Go to **Account Settings > Payment Preferences**
3. Enable Venmo as a payment method

### Create App

1. Go to **Developer Dashboard** (developer.paypal.com)
2. Create a new app under **My Apps & Credentials**
3. Copy Client ID and Secret to your `.env` file

### Configure Webhooks

1. In the app settings, go to **Webhooks**
2. Add webhook URL: `https://your-domain.com/api/webhooks/paypal`
3. Subscribe to events:
   - `PAYMENT.CAPTURE.COMPLETED`
   - `PAYMENT.CAPTURE.DENIED`
   - `PAYMENT.CAPTURE.REFUNDED`
   - `CHECKOUT.ORDER.APPROVED`

---

## Recognition Levels

Donors are automatically assigned recognition levels based on total donation amount:

| Level | Amount Range |
|-------|--------------|
| Builder Club | $5,000 - $9,999 |
| Hamilton Chase Club | $10,000 - $24,999 |
| Phil McGuinnis Club | $25,000 - $49,999 |
| Judge Amos Blandon Club | $50,000 - $99,999 |
| Philbrick, Hobart, Nash Club | $100,000 - $249,999 |
| Benefactor | $250,000 - $499,999 |
| Lifetime Benefactor | $500,000+ |

---

## Email Receipts

Receipts are sent automatically via Nodemailer when:
- A one-time payment succeeds
- A subscription payment is processed
- A subscription is confirmed

The email includes:
- Organization branding
- Donation amount and date
- Payment method used
- Transaction ID
- Recognition level (if applicable)
- Tax information disclaimer

---

## Testing

### Stripe Test Mode

Use test API keys (sk_test_xxx, pk_test_xxx) and test card numbers:
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- 3D Secure: `4000 0025 0000 3155`

### PayPal Sandbox

1. Create sandbox accounts at developer.paypal.com
2. Use sandbox API credentials
3. Test with sandbox buyer account

### Local Webhook Testing

Use Stripe CLI for local webhook testing:
```bash
stripe listen --forward-to localhost:3001/api/webhooks/stripe
```

---

## Deployment

### Backend Deployment Options

- **Vercel**: Add `vercel.json` configuration
- **Railway**: Connect GitHub repo, set environment variables
- **Heroku**: Use Procfile with `web: node server/index.js`

### Production Checklist

- [ ] Switch to live Stripe keys
- [ ] Switch to PayPal production credentials
- [ ] Configure webhook endpoints in both dashboards
- [ ] Set up SSL certificate
- [ ] Configure production CORS origins
- [ ] Test with real payment (small amount, refund after)
- [ ] Verify receipt emails deliver correctly
- [ ] Set up error monitoring (e.g., Sentry)

---

## Troubleshooting

### Common Issues

**Stripe card element not loading**
- Check that `STRIPE_PUBLISHABLE_KEY` is set correctly
- Verify the key matches your environment (test vs live)

**PayPal/Venmo button not appearing**
- Ensure `PAYPAL_CLIENT_ID` is configured
- Check browser console for SDK loading errors
- Venmo only works for US PayPal accounts

**Webhook signature verification failed**
- Verify `STRIPE_WEBHOOK_SECRET` matches the endpoint
- Ensure raw body parsing for Stripe webhooks

**Emails not sending**
- Check SMTP credentials
- For Gmail, use an App Password (not regular password)
- Verify EMAIL_HOST and EMAIL_PORT settings

---

## Files Changed

### New Files

| File | Purpose |
|------|---------|
| `server/package.json` | Node.js dependencies |
| `server/index.js` | Express server |
| `server/.env.example` | Environment template |
| `server/routes/stripe.js` | Stripe endpoints |
| `server/routes/venmo.js` | PayPal/Venmo endpoints |
| `server/webhooks/stripe-webhook.js` | Stripe event handlers |
| `server/webhooks/paypal-webhook.js` | PayPal event handlers |
| `server/db/schema.sql` | Database schema |
| `server/db/donors.js` | Database operations |
| `server/utils/email.js` | Email templates |
| `docs/payment-integration.md` | This documentation |

### Modified Files

| File | Changes |
|------|---------|
| `index.html` | Added payment form UI, modal, Stripe.js script |
| `styles.css` | Added payment form and modal styles |
| `script.js` | Added payment system JavaScript |
