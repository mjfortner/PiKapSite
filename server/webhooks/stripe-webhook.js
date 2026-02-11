const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { donors, subscriptions } = require('../db/donors');
const { sendReceipt, sendSubscriptionConfirmation } = require('../utils/email');
const { getRecognitionLevel } = require('../routes/stripe');

/**
 * Stripe webhook handler
 * POST /api/webhooks/stripe
 */
router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    try {
        switch (event.type) {
            case 'payment_intent.succeeded':
                await handlePaymentIntentSucceeded(event.data.object);
                break;

            case 'payment_intent.payment_failed':
                await handlePaymentIntentFailed(event.data.object);
                break;

            case 'invoice.paid':
                await handleInvoicePaid(event.data.object);
                break;

            case 'invoice.payment_failed':
                await handleInvoicePaymentFailed(event.data.object);
                break;

            case 'customer.subscription.created':
                await handleSubscriptionCreated(event.data.object);
                break;

            case 'customer.subscription.updated':
                await handleSubscriptionUpdated(event.data.object);
                break;

            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(event.data.object);
                break;

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }
    } catch (error) {
        console.error(`Error handling ${event.type}:`, error);
        return res.status(500).json({ error: 'Webhook handler failed' });
    }

    res.json({ received: true });
});

/**
 * Handle successful one-time payment
 */
async function handlePaymentIntentSucceeded(paymentIntent) {
    console.log(`PaymentIntent succeeded: ${paymentIntent.id}`);

    // Update donor record
    donors.updateByPaymentId(paymentIntent.id, {
        status: 'completed',
        name: paymentIntent.metadata.donor_name || null,
        metadata: {
            recognitionLevel: getRecognitionLevel(paymentIntent.amount),
            chargeId: paymentIntent.latest_charge
        }
    });

    // Get donor info for receipt
    const donor = donors.getByPaymentId(paymentIntent.id);

    if (donor) {
        // Send receipt email
        await sendReceipt({
            email: donor.email,
            name: donor.name,
            amount: paymentIntent.amount,
            donationType: donor.donation_type,
            paymentMethod: 'Credit Card',
            transactionId: paymentIntent.id,
            recognitionLevel: getRecognitionLevel(paymentIntent.amount)
        });
    }
}

/**
 * Handle failed payment
 */
async function handlePaymentIntentFailed(paymentIntent) {
    console.log(`PaymentIntent failed: ${paymentIntent.id}`);

    donors.updateByPaymentId(paymentIntent.id, {
        status: 'failed',
        metadata: {
            failureMessage: paymentIntent.last_payment_error?.message
        }
    });
}

/**
 * Handle paid invoice (subscription payment)
 */
async function handleInvoicePaid(invoice) {
    console.log(`Invoice paid: ${invoice.id}`);

    // This handles both initial subscription payment and renewals
    const subscriptionId = invoice.subscription;

    if (subscriptionId) {
        const sub = subscriptions.getByStripeId(subscriptionId);

        if (sub) {
            // Update subscription period
            subscriptions.updatePeriod(
                subscriptionId,
                new Date(invoice.period_start * 1000).toISOString(),
                new Date(invoice.period_end * 1000).toISOString()
            );

            // For renewals, create a new donation record
            if (invoice.billing_reason === 'subscription_cycle') {
                const donor = donors.getById(sub.donor_id);

                if (donor) {
                    donors.create({
                        email: donor.email,
                        name: donor.name,
                        amount: invoice.amount_paid,
                        paymentMethod: 'stripe',
                        paymentId: invoice.payment_intent,
                        donationType: sub.plan_type,
                        status: 'completed',
                        metadata: {
                            subscriptionId: subscriptionId,
                            invoiceId: invoice.id
                        }
                    });

                    // Send renewal receipt
                    await sendReceipt({
                        email: donor.email,
                        name: donor.name,
                        amount: invoice.amount_paid,
                        donationType: sub.plan_type,
                        paymentMethod: 'Credit Card (Subscription)',
                        transactionId: invoice.id,
                        isRenewal: true
                    });
                }
            }
        }
    }
}

/**
 * Handle failed invoice payment
 */
async function handleInvoicePaymentFailed(invoice) {
    console.log(`Invoice payment failed: ${invoice.id}`);

    const subscriptionId = invoice.subscription;

    if (subscriptionId) {
        const sub = subscriptions.getByStripeId(subscriptionId);

        if (sub) {
            subscriptions.updateStatus(subscriptionId, 'past_due');
        }
    }
}

/**
 * Handle subscription created
 */
async function handleSubscriptionCreated(subscription) {
    console.log(`Subscription created: ${subscription.id}`);

    const existingSub = subscriptions.getByStripeId(subscription.id);

    if (!existingSub) {
        // Get customer email
        const customer = await stripe.customers.retrieve(subscription.customer);

        const donor = donors.create({
            email: customer.email,
            name: customer.name,
            amount: subscription.items.data[0].price.unit_amount,
            paymentMethod: 'stripe',
            paymentId: subscription.id,
            donationType: subscription.metadata.plan_type || 'monthly',
            status: subscription.status === 'active' ? 'completed' : 'pending'
        });

        subscriptions.create({
            donorId: donor.id,
            stripeSubscriptionId: subscription.id,
            planType: subscription.metadata.plan_type || 'monthly',
            amount: subscription.items.data[0].price.unit_amount,
            status: subscription.status,
            currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString()
        });
    }
}

/**
 * Handle subscription updated
 */
async function handleSubscriptionUpdated(subscription) {
    console.log(`Subscription updated: ${subscription.id}`);

    subscriptions.updateStatus(subscription.id, subscription.status);

    // Also update donor status if subscription becomes active
    if (subscription.status === 'active') {
        donors.updateByPaymentId(subscription.id, { status: 'completed' });

        // Send confirmation email for newly active subscriptions
        const sub = subscriptions.getByStripeId(subscription.id);
        if (sub) {
            const donor = donors.getById(sub.donor_id);
            if (donor) {
                await sendSubscriptionConfirmation({
                    email: donor.email,
                    name: donor.name,
                    amount: sub.amount,
                    planType: sub.plan_type,
                    nextBillingDate: new Date(subscription.current_period_end * 1000)
                });
            }
        }
    }
}

/**
 * Handle subscription deleted/canceled
 */
async function handleSubscriptionDeleted(subscription) {
    console.log(`Subscription deleted: ${subscription.id}`);

    subscriptions.cancel(subscription.id);
}

module.exports = router;
