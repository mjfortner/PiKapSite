const express = require('express');
const router = express.Router();
const paypal = require('@paypal/checkout-server-sdk');
const { donors } = require('../db/donors');
const { sendReceipt } = require('../utils/email');

// PayPal environment setup
function getPayPalClient() {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

    // Use sandbox for testing, live for production
    const environment = process.env.NODE_ENV === 'production'
        ? new paypal.core.LiveEnvironment(clientId, clientSecret)
        : new paypal.core.SandboxEnvironment(clientId, clientSecret);

    return new paypal.core.PayPalHttpClient(environment);
}

/**
 * Create PayPal/Venmo order
 * POST /api/venmo/create-order
 */
router.post('/create-order', async (req, res) => {
    try {
        const { amount, email, name, donationType = 'one-time' } = req.body;

        if (!amount || amount < 100) {
            return res.status(400).json({ error: 'Minimum donation is $1.00' });
        }

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const client = getPayPalClient();

        // Convert cents to dollars for PayPal
        const amountDollars = (amount / 100).toFixed(2);

        const request = new paypal.orders.OrdersCreateRequest();
        request.prefer('return=representation');
        request.requestBody({
            intent: 'CAPTURE',
            purchase_units: [{
                amount: {
                    currency_code: 'USD',
                    value: amountDollars
                },
                description: 'Donation to Kappa Pi Kappa',
                custom_id: JSON.stringify({
                    email,
                    name,
                    donationType
                })
            }],
            payment_source: {
                venmo: {
                    experience_context: {
                        brand_name: 'Kappa Pi Kappa',
                        shipping_preference: 'NO_SHIPPING',
                        user_action: 'PAY_NOW',
                        return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/donate/success`,
                        cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/donate/cancel`
                    }
                }
            }
        });

        const order = await client.execute(request);

        // Create pending donor record
        donors.create({
            email,
            name,
            amount,
            paymentMethod: 'venmo',
            paymentId: order.result.id,
            donationType,
            status: 'pending'
        });

        res.json({
            orderId: order.result.id,
            status: order.result.status
        });
    } catch (error) {
        console.error('Error creating PayPal order:', error);
        res.status(500).json({
            error: 'Failed to create payment order',
            details: error.message
        });
    }
});

/**
 * Capture PayPal/Venmo order after approval
 * POST /api/venmo/capture-order
 */
router.post('/capture-order', async (req, res) => {
    try {
        const { orderId } = req.body;

        if (!orderId) {
            return res.status(400).json({ error: 'Order ID is required' });
        }

        const client = getPayPalClient();

        const request = new paypal.orders.OrdersCaptureRequest(orderId);
        request.requestBody({});

        const capture = await client.execute(request);

        if (capture.result.status === 'COMPLETED') {
            const captureDetails = capture.result.purchase_units[0].payments.captures[0];

            // Parse custom data from the order
            let customData = {};
            try {
                customData = JSON.parse(capture.result.purchase_units[0].custom_id);
            } catch (e) {
                console.log('Could not parse custom_id');
            }

            // Update donor record
            donors.updateByPaymentId(orderId, {
                status: 'completed',
                metadata: {
                    captureId: captureDetails.id,
                    payerEmail: capture.result.payer?.email_address,
                    payerName: capture.result.payer?.name?.given_name
                }
            });

            // Get donor for receipt
            const donor = donors.getByPaymentId(orderId);

            if (donor) {
                // Send receipt
                await sendReceipt({
                    email: donor.email,
                    name: donor.name || customData.name,
                    amount: donor.amount,
                    donationType: donor.donation_type,
                    paymentMethod: 'Venmo',
                    transactionId: captureDetails.id
                });
            }

            res.json({
                success: true,
                captureId: captureDetails.id,
                status: capture.result.status
            });
        } else {
            res.status(400).json({
                success: false,
                status: capture.result.status,
                error: 'Payment was not completed'
            });
        }
    } catch (error) {
        console.error('Error capturing PayPal order:', error);

        // Update donor record as failed
        if (req.body.orderId) {
            donors.updateByPaymentId(req.body.orderId, {
                status: 'failed',
                metadata: { error: error.message }
            });
        }

        res.status(500).json({
            error: 'Failed to capture payment',
            details: error.message
        });
    }
});

/**
 * Get PayPal client ID for frontend
 * GET /api/venmo/config
 */
router.get('/config', (req, res) => {
    res.json({
        clientId: process.env.PAYPAL_CLIENT_ID
    });
});

module.exports = router;
