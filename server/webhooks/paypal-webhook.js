const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { donors } = require('../db/donors');
const { sendReceipt } = require('../utils/email');

/**
 * Verify PayPal webhook signature
 */
async function verifyWebhookSignature(req) {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;

    if (!webhookId) {
        console.warn('PAYPAL_WEBHOOK_ID not set, skipping signature verification');
        return true; // Skip verification in development
    }

    const transmissionId = req.headers['paypal-transmission-id'];
    const transmissionTime = req.headers['paypal-transmission-time'];
    const certUrl = req.headers['paypal-cert-url'];
    const authAlgo = req.headers['paypal-auth-algo'];
    const transmissionSig = req.headers['paypal-transmission-sig'];

    if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
        return false;
    }

    // In production, you should verify the signature properly
    // This is a simplified check - for full implementation, fetch the cert and verify
    // See: https://developer.paypal.com/api/rest/webhooks/
    return true;
}

/**
 * PayPal webhook handler
 * POST /api/webhooks/paypal
 */
router.post('/', express.json(), async (req, res) => {
    try {
        // Verify webhook signature
        const isValid = await verifyWebhookSignature(req);

        if (!isValid) {
            console.error('Invalid PayPal webhook signature');
            return res.status(401).json({ error: 'Invalid signature' });
        }

        const event = req.body;
        console.log(`PayPal webhook received: ${event.event_type}`);

        switch (event.event_type) {
            case 'PAYMENT.CAPTURE.COMPLETED':
                await handleCaptureCompleted(event.resource);
                break;

            case 'PAYMENT.CAPTURE.DENIED':
                await handleCaptureDenied(event.resource);
                break;

            case 'PAYMENT.CAPTURE.REFUNDED':
                await handleCaptureRefunded(event.resource);
                break;

            case 'CHECKOUT.ORDER.APPROVED':
                await handleOrderApproved(event.resource);
                break;

            default:
                console.log(`Unhandled PayPal event: ${event.event_type}`);
        }

        res.json({ received: true });
    } catch (error) {
        console.error('PayPal webhook error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

/**
 * Handle completed payment capture
 */
async function handleCaptureCompleted(resource) {
    console.log(`Payment capture completed: ${resource.id}`);

    // The resource.custom_id contains our order ID
    // But captures don't always have this, so we need to look up by various IDs

    // Update donor status if we can find the record
    const supplementaryData = resource.supplementary_data;

    if (supplementaryData?.related_ids?.order_id) {
        const orderId = supplementaryData.related_ids.order_id;

        donors.updateByPaymentId(orderId, {
            status: 'completed',
            metadata: {
                captureId: resource.id,
                captureStatus: resource.status
            }
        });

        // Get donor and send receipt if not already sent
        const donor = donors.getByPaymentId(orderId);

        if (donor && !donor.metadata?.receiptSent) {
            await sendReceipt({
                email: donor.email,
                name: donor.name,
                amount: donor.amount,
                donationType: donor.donation_type,
                paymentMethod: 'Venmo',
                transactionId: resource.id
            });

            donors.updateByPaymentId(orderId, {
                metadata: { ...donor.metadata, receiptSent: true }
            });
        }
    }
}

/**
 * Handle denied payment capture
 */
async function handleCaptureDenied(resource) {
    console.log(`Payment capture denied: ${resource.id}`);

    const supplementaryData = resource.supplementary_data;

    if (supplementaryData?.related_ids?.order_id) {
        donors.updateByPaymentId(supplementaryData.related_ids.order_id, {
            status: 'failed',
            metadata: {
                captureId: resource.id,
                failureReason: 'Payment denied'
            }
        });
    }
}

/**
 * Handle refunded payment
 */
async function handleCaptureRefunded(resource) {
    console.log(`Payment refunded: ${resource.id}`);

    // Find donor by capture ID in metadata
    // This is a simplified approach - in production you might need a better lookup
    const supplementaryData = resource.supplementary_data;

    if (supplementaryData?.related_ids?.order_id) {
        donors.updateByPaymentId(supplementaryData.related_ids.order_id, {
            status: 'refunded',
            metadata: {
                refundId: resource.id,
                refundedAt: new Date().toISOString()
            }
        });
    }
}

/**
 * Handle order approved (user approved in Venmo app)
 */
async function handleOrderApproved(resource) {
    console.log(`Order approved: ${resource.id}`);

    // Update donor record to show approval (capture still needed)
    donors.updateByPaymentId(resource.id, {
        metadata: {
            approvedAt: new Date().toISOString(),
            payerEmail: resource.payer?.email_address
        }
    });
}

module.exports = router;
