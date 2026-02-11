const nodemailer = require('nodemailer');

// Create reusable transporter
let transporter = null;

function getTransporter() {
    if (transporter) return transporter;

    transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT || '587'),
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    return transporter;
}

/**
 * Format amount from cents to dollars
 */
function formatAmount(cents) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(cents / 100);
}

/**
 * Get donation type display name
 */
function getDonationTypeDisplay(type) {
    const types = {
        'one-time': 'One-Time Donation',
        'monthly': 'Monthly Donation',
        'dollar-a-day-5yr': 'Dollar-a-Day (5 Year)',
        'dollar-a-day-7yr': 'Dollar-a-Day (7 Year)',
        'dollar-a-day-10yr': 'Dollar-a-Day (10 Year)'
    };
    return types[type] || type;
}

/**
 * Send donation receipt email
 */
async function sendReceipt(options) {
    const {
        email,
        name,
        amount,
        donationType,
        paymentMethod,
        transactionId,
        recognitionLevel,
        isRenewal
    } = options;

    const displayName = name || 'Valued Donor';
    const formattedAmount = formatAmount(amount);
    const donationTypeDisplay = getDonationTypeDisplay(donationType);
    const date = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const subject = isRenewal
        ? `Kappa Pi Kappa - Recurring Donation Receipt`
        : `Kappa Pi Kappa - Thank You for Your Donation`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #374151; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; padding: 30px 0; border-bottom: 2px solid #2d7a68;">
        <h1 style="color: #2d7a68; font-size: 32px; margin: 0; font-family: Georgia, serif;">KΠK</h1>
        <p style="color: #6b7280; margin: 5px 0 0 0; font-size: 14px;">Kappa Pi Kappa Society</p>
    </div>

    <div style="padding: 30px 0;">
        <h2 style="color: #1f2937; margin-top: 0;">Thank you, ${displayName}!</h2>

        <p>Your generous ${isRenewal ? 'recurring ' : ''}donation to Kappa Pi Kappa has been successfully processed. Your support helps preserve our 180+ year legacy and supports future brothers.</p>

        <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h3 style="margin-top: 0; color: #2d7a68;">Donation Receipt</h3>
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Amount:</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 600;">${formattedAmount}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Date:</td>
                    <td style="padding: 8px 0; text-align: right;">${date}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Type:</td>
                    <td style="padding: 8px 0; text-align: right;">${donationTypeDisplay}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Payment Method:</td>
                    <td style="padding: 8px 0; text-align: right;">${paymentMethod}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Transaction ID:</td>
                    <td style="padding: 8px 0; text-align: right; font-size: 12px; font-family: monospace;">${transactionId}</td>
                </tr>
            </table>
        </div>

        ${recognitionLevel ? `
        <div style="background: linear-gradient(135deg, #2d7a68 0%, #1a4d40 100%); color: white; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center;">
            <p style="margin: 0 0 5px 0; font-size: 14px; opacity: 0.9;">Recognition Level Achieved</p>
            <p style="margin: 0; font-size: 20px; font-weight: 600;">${recognitionLevel}</p>
        </div>
        ` : ''}

        <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
            <p style="font-size: 14px; color: #6b7280;">
                <strong>Tax Information:</strong> Kappa Pi Kappa is a registered 501(c)(7) organization. Donations may be tax-deductible to the extent allowed by law. Please consult with your tax advisor regarding the deductibility of your contribution.
            </p>
        </div>

        <p style="margin-top: 30px;">With gratitude,</p>
        <p style="margin: 0;"><strong>Kappa Pi Kappa Society</strong><br>
        Est. 1842 at Dartmouth College</p>
    </div>

    <div style="text-align: center; padding: 20px 0; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
        <p style="margin: 0;">1 Webster Ave, Hanover, NH 03755</p>
        <p style="margin: 5px 0 0 0;">Questions? Contact brett.szalapski@gmail.com</p>
    </div>
</body>
</html>
`;

    const textContent = `
Thank you, ${displayName}!

Your generous ${isRenewal ? 'recurring ' : ''}donation to Kappa Pi Kappa has been successfully processed.

DONATION RECEIPT
----------------
Amount: ${formattedAmount}
Date: ${date}
Type: ${donationTypeDisplay}
Payment Method: ${paymentMethod}
Transaction ID: ${transactionId}
${recognitionLevel ? `\nRecognition Level: ${recognitionLevel}` : ''}

TAX INFORMATION
Kappa Pi Kappa is a registered 501(c)(7) organization. Donations may be tax-deductible to the extent allowed by law. Please consult with your tax advisor regarding the deductibility of your contribution.

With gratitude,
Kappa Pi Kappa Society
Est. 1842 at Dartmouth College

1 Webster Ave, Hanover, NH 03755
Questions? Contact brett.szalapski@gmail.com
`;

    try {
        const transport = getTransporter();

        await transport.sendMail({
            from: `"Kappa Pi Kappa" <${process.env.EMAIL_USER || 'donations@kappapikappa.org'}>`,
            to: email,
            subject,
            text: textContent,
            html: htmlContent
        });

        console.log(`Receipt email sent to ${email}`);
        return true;
    } catch (error) {
        console.error('Error sending receipt email:', error);
        return false;
    }
}

/**
 * Send subscription confirmation email
 */
async function sendSubscriptionConfirmation(options) {
    const {
        email,
        name,
        amount,
        planType,
        nextBillingDate
    } = options;

    const displayName = name || 'Valued Donor';
    const formattedAmount = formatAmount(amount);
    const planTypeDisplay = getDonationTypeDisplay(planType);
    const nextDate = nextBillingDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const subject = `Kappa Pi Kappa - Subscription Confirmed`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #374151; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; padding: 30px 0; border-bottom: 2px solid #2d7a68;">
        <h1 style="color: #2d7a68; font-size: 32px; margin: 0; font-family: Georgia, serif;">KΠK</h1>
        <p style="color: #6b7280; margin: 5px 0 0 0; font-size: 14px;">Kappa Pi Kappa Society</p>
    </div>

    <div style="padding: 30px 0;">
        <h2 style="color: #1f2937; margin-top: 0;">Subscription Confirmed!</h2>

        <p>Thank you, ${displayName}! Your recurring donation to Kappa Pi Kappa has been set up successfully.</p>

        <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h3 style="margin-top: 0; color: #2d7a68;">Subscription Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Plan:</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 600;">${planTypeDisplay}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Monthly Amount:</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 600;">${formattedAmount}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Next Billing Date:</td>
                    <td style="padding: 8px 0; text-align: right;">${nextDate}</td>
                </tr>
            </table>
        </div>

        <p>You will receive a receipt each time your subscription renews. If you need to modify or cancel your subscription, please contact us.</p>

        <p style="margin-top: 30px;">With gratitude,</p>
        <p style="margin: 0;"><strong>Kappa Pi Kappa Society</strong><br>
        Est. 1842 at Dartmouth College</p>
    </div>

    <div style="text-align: center; padding: 20px 0; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
        <p style="margin: 0;">1 Webster Ave, Hanover, NH 03755</p>
        <p style="margin: 5px 0 0 0;">Questions? Contact brett.szalapski@gmail.com</p>
    </div>
</body>
</html>
`;

    const textContent = `
Subscription Confirmed!

Thank you, ${displayName}! Your recurring donation to Kappa Pi Kappa has been set up successfully.

SUBSCRIPTION DETAILS
--------------------
Plan: ${planTypeDisplay}
Monthly Amount: ${formattedAmount}
Next Billing Date: ${nextDate}

You will receive a receipt each time your subscription renews. If you need to modify or cancel your subscription, please contact us.

With gratitude,
Kappa Pi Kappa Society
Est. 1842 at Dartmouth College

1 Webster Ave, Hanover, NH 03755
Questions? Contact brett.szalapski@gmail.com
`;

    try {
        const transport = getTransporter();

        await transport.sendMail({
            from: `"Kappa Pi Kappa" <${process.env.EMAIL_USER || 'donations@kappapikappa.org'}>`,
            to: email,
            subject,
            text: textContent,
            html: htmlContent
        });

        console.log(`Subscription confirmation sent to ${email}`);
        return true;
    } catch (error) {
        console.error('Error sending subscription confirmation:', error);
        return false;
    }
}

module.exports = {
    sendReceipt,
    sendSubscriptionConfirmation
};
