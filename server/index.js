require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration
const corsOptions = {
    origin: process.env.FRONTEND_URL || ['http://localhost:3000', 'http://127.0.0.1:5500'],
    credentials: true
};

// Middleware
app.use(cors(corsOptions));

// Stripe webhook needs raw body - must be before express.json()
const stripeWebhook = require('./webhooks/stripe-webhook');
app.use('/api/webhooks/stripe', stripeWebhook);

// Parse JSON for all other routes
app.use(express.json());

// PayPal webhook
const paypalWebhook = require('./webhooks/paypal-webhook');
app.use('/api/webhooks/paypal', paypalWebhook);

// API Routes
const stripeRoutes = require('./routes/stripe');
const venmoRoutes = require('./routes/venmo');

app.use('/api/stripe', stripeRoutes);
app.use('/api/venmo', venmoRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../')));

    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../index.html'));
    });
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`
========================================
  Kappa Pi Kappa Payment Server
========================================
  Port: ${PORT}
  Environment: ${process.env.NODE_ENV || 'development'}
  Stripe: ${process.env.STRIPE_SECRET_KEY ? 'Configured' : 'Not configured'}
  PayPal: ${process.env.PAYPAL_CLIENT_ID ? 'Configured' : 'Not configured'}
  Email: ${process.env.EMAIL_USER ? 'Configured' : 'Not configured'}
========================================
    `);
});

module.exports = app;
