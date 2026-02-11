const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { donors, subscriptions } = require('../db/donors');
const { sendReceipt } = require('../utils/email');

// Recognition levels based on total donations
const RECOGNITION_LEVELS = [
    { name: 'Builder Club', min: 500000, max: 999999 },
    { name: 'Hamilton Chase Club', min: 1000000, max: 2499999 },
    { name: 'Phil McGuinnis Club', min: 2500000, max: 4999999 },
    { name: 'Judge Amos Blandon Club', min: 5000000, max: 9999999 },
    { name: 'Philbrick, Hobart, Nash Club', min: 10000000, max: 24999999 },
    { name: 'Benefactor', min: 25000000, max: 49999999 },
    { name: 'Lifetime Benefactor', min: 50000000, max: Infinity }
];

function getRecognitionLevel(amountCents) {
    for (const level of RECOGNITION_LEVELS) {
        if (amountCents >= level.min && amountCents <= level.max) {
            return level.name;
        }
    }
    return null;
}

/**
 * Create a PaymentIntent for one-time donations
 * POST /api/stripe/create-payment-intent
 */
router.post('/create-payment-intent', async (req, res) => {
    try {
        const { amount, email, name, donationType = 'one-time' } = req.body;

        if (!amount || amount < 100) {
            return res.status(400).json({ error: 'Minimum donation is $1.00' });
        }

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Create PaymentIntent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount, // Amount in cents
            currency: 'usd',
            receipt_email: email,
            metadata: {
                donor_name: name || '',
                donation_type: donationType,
                organization: 'Kappa Pi Kappa'
            }
        });

        // Create pending donor record
        donors.create({
            email,
            name,
            amount,
            paymentMethod: 'stripe',
            paymentId: paymentIntent.id,
            donationType,
            status: 'pending'
        });

        res.json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id
        });
    } catch (error) {
        console.error('Error creating payment intent:', error);
        res.status(500).json({ error: 'Failed to create payment' });
    }
});

/**
 * Create a subscription for recurring donations
 * POST /api/stripe/create-subscription
 */
router.post('/create-subscription', async (req, res) => {
    try {
        const { email, name, priceId, planType } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        if (!priceId) {
            return res.status(400).json({ error: 'Price ID is required' });
        }

        // Check if customer already exists
        const existingCustomers = await stripe.customers.list({
            email: email,
            limit: 1
        });

        let customer;
        if (existingCustomers.data.length > 0) {
            customer = existingCustomers.data[0];
            // Update name if provided
            if (name && customer.name !== name) {
                customer = await stripe.customers.update(customer.id, { name });
            }
        } else {
            customer = await stripe.customers.create({
                email,
                name: name || undefined,
                metadata: {
                    organization: 'Kappa Pi Kappa'
                }
            });
        }

        // Create subscription with incomplete status to collect payment
        const subscription = await stripe.subscriptions.create({
            customer: customer.id,
            items: [{ price: priceId }],
            payment_behavior: 'default_incomplete',
            payment_settings: {
                save_default_payment_method: 'on_subscription'
            },
            expand: ['latest_invoice.payment_intent'],
            metadata: {
                plan_type: planType,
                organization: 'Kappa Pi Kappa'
            }
        });

        // Get price details for amount
        const price = await stripe.prices.retrieve(priceId);

        // Create donor record
        const donor = donors.create({
            email,
            name,
            amount: price.unit_amount,
            paymentMethod: 'stripe',
            paymentId: subscription.id,
            donationType: planType,
            status: 'pending'
        });

        // Create subscription record
        subscriptions.create({
            donorId: donor.id,
            stripeSubscriptionId: subscription.id,
            planType,
            amount: price.unit_amount,
            status: subscription.status
        });

        res.json({
            subscriptionId: subscription.id,
            clientSecret: subscription.latest_invoice.payment_intent.client_secret
        });
    } catch (error) {
        console.error('Error creating subscription:', error);
        res.status(500).json({ error: 'Failed to create subscription' });
    }
});

/**
 * Get Stripe publishable key
 * GET /api/stripe/config
 */
router.get('/config', (req, res) => {
    res.json({
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY
    });
});

/**
 * Get available subscription prices
 * GET /api/stripe/prices
 */
router.get('/prices', async (req, res) => {
    try {
        const prices = await stripe.prices.list({
            active: true,
            type: 'recurring',
            expand: ['data.product']
        });

        const formattedPrices = prices.data.map(price => ({
            id: price.id,
            amount: price.unit_amount,
            currency: price.currency,
            interval: price.recurring.interval,
            intervalCount: price.recurring.interval_count,
            productName: price.product.name,
            productDescription: price.product.description
        }));

        res.json(formattedPrices);
    } catch (error) {
        console.error('Error fetching prices:', error);
        res.status(500).json({ error: 'Failed to fetch prices' });
    }
});

module.exports = router;
module.exports.getRecognitionLevel = getRecognitionLevel;
