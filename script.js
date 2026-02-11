// ========================================
// Kappa Pi Kappa - Website JavaScript
// ========================================

document.addEventListener('DOMContentLoaded', function() {
    // ========================================
    // Navigation Scroll Effect
    // ========================================
    const navbar = document.getElementById('navbar');

    function handleNavScroll() {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    }

    window.addEventListener('scroll', handleNavScroll);
    handleNavScroll(); // Check initial state

    // ========================================
    // Mobile Navigation Toggle
    // ========================================
    const navToggle = document.getElementById('navToggle');
    const navMenu = document.getElementById('navMenu');

    navToggle.addEventListener('click', function() {
        navMenu.classList.toggle('active');
        this.classList.toggle('active');
    });

    // Close mobile menu when clicking a link
    document.querySelectorAll('.nav-menu a').forEach(link => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('active');
            navToggle.classList.remove('active');
        });
    });

    // ========================================
    // Leadership Tabs
    // ========================================
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');

            // Remove active class from all buttons and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Add active class to clicked button and corresponding content
            this.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
        });
    });

    // ========================================
    // Smooth Scroll for Anchor Links
    // ========================================
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                const navHeight = navbar.offsetHeight;
                const targetPosition = targetElement.offsetTop - navHeight;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });

    // ========================================
    // Animate Elements on Scroll
    // ========================================
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe elements for animation
    const animateElements = document.querySelectorAll(
        '.value-card, .timeline-item, .member-card, .donate-card, .level-card, .alumni-card'
    );

    animateElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        observer.observe(el);
    });

    // Add animation class styles
    const style = document.createElement('style');
    style.textContent = `
        .animate-in {
            opacity: 1 !important;
            transform: translateY(0) !important;
        }
    `;
    document.head.appendChild(style);

    // ========================================
    // Active Navigation Highlight
    // ========================================
    const sections = document.querySelectorAll('section[id]');

    function highlightNav() {
        const scrollPos = window.scrollY + 100;

        sections.forEach(section => {
            const sectionTop = section.offsetTop - navbar.offsetHeight - 50;
            const sectionBottom = sectionTop + section.offsetHeight;
            const sectionId = section.getAttribute('id');
            const navLink = document.querySelector(`.nav-menu a[href="#${sectionId}"]`);

            if (navLink) {
                if (scrollPos >= sectionTop && scrollPos < sectionBottom) {
                    document.querySelectorAll('.nav-menu a').forEach(link => {
                        link.classList.remove('active');
                    });
                    navLink.classList.add('active');
                }
            }
        });
    }

    window.addEventListener('scroll', highlightNav);

    // ========================================
    // Timeline Animation
    // ========================================
    const timelineItems = document.querySelectorAll('.timeline-item');

    const timelineObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.classList.add('animate-in');
                }, index * 100);
                timelineObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.2 });

    timelineItems.forEach(item => {
        item.style.opacity = '0';
        item.style.transform = 'translateX(-20px)';
        item.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        timelineObserver.observe(item);
    });

    // ========================================
    // Payment System
    // ========================================
    initPaymentSystem();
});

// ========================================
// Payment System Implementation
// ========================================

const API_BASE_URL = 'http://localhost:3001/api';

// Payment state
const paymentState = {
    amount: 10000, // cents
    frequency: 'one-time',
    dadPlan: '5yr',
    email: '',
    name: '',
    stripe: null,
    cardElement: null,
    paypalLoaded: false
};

// Dollar-a-Day plan amounts (in cents)
const DAD_AMOUNTS = {
    '5yr': 3042,   // $30.42/month
    '7yr': 6083,   // $60.83/month
    '10yr': 9125   // $91.25/month
};

async function initPaymentSystem() {
    // Initialize Stripe
    await initStripe();

    // Set up event listeners
    setupAmountSelector();
    setupFrequencySelector();
    setupDollarADayOptions();
    setupDonorInfoForm();
    setupSubmitButton();
    setupModal();

    // Update initial summary
    updateSummary();
}

async function initStripe() {
    try {
        // Fetch Stripe publishable key from server
        const response = await fetch(`${API_BASE_URL}/stripe/config`);
        const { publishableKey } = await response.json();

        if (!publishableKey) {
            console.warn('Stripe publishable key not configured');
            return;
        }

        paymentState.stripe = Stripe(publishableKey);

        // Create card element
        const elements = paymentState.stripe.elements();
        paymentState.cardElement = elements.create('card', {
            style: {
                base: {
                    fontSize: '16px',
                    color: '#374151',
                    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                    '::placeholder': {
                        color: '#9ca3af'
                    }
                },
                invalid: {
                    color: '#ef4444',
                    iconColor: '#ef4444'
                }
            }
        });

        paymentState.cardElement.mount('#stripe-card-element');

        // Handle card errors
        paymentState.cardElement.on('change', (event) => {
            const displayError = document.getElementById('card-errors');
            if (event.error) {
                displayError.textContent = event.error.message;
            } else {
                displayError.textContent = '';
            }
        });
    } catch (error) {
        console.error('Failed to initialize Stripe:', error);
    }
}

async function initPayPal() {
    if (paymentState.paypalLoaded) return;

    try {
        // Fetch PayPal client ID from server
        const response = await fetch(`${API_BASE_URL}/venmo/config`);
        const { clientId } = await response.json();

        if (!clientId) {
            console.warn('PayPal client ID not configured');
            return;
        }

        // Load PayPal SDK dynamically
        const script = document.createElement('script');
        script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&enable-funding=venmo&currency=USD`;
        script.onload = () => {
            paymentState.paypalLoaded = true;
            renderPayPalButton();
        };
        document.head.appendChild(script);
    } catch (error) {
        console.error('Failed to initialize PayPal:', error);
    }
}

function renderPayPalButton() {
    const container = document.getElementById('venmo-button-container');
    if (!container || !window.paypal) return;

    // Clear existing buttons
    container.innerHTML = '';

    paypal.Buttons({
        fundingSource: paypal.FUNDING.VENMO,
        style: {
            layout: 'vertical',
            color: 'blue',
            shape: 'rect',
            label: 'pay'
        },
        createOrder: async () => {
            const amount = getEffectiveAmount();
            const email = document.getElementById('donor-email').value;
            const name = document.getElementById('donor-name').value;

            if (!email) {
                showModal('error', 'Please enter your email address');
                throw new Error('Email required');
            }

            const response = await fetch(`${API_BASE_URL}/venmo/create-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount,
                    email,
                    name,
                    donationType: paymentState.frequency
                })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error);
            return data.orderId;
        },
        onApprove: async (data) => {
            try {
                const response = await fetch(`${API_BASE_URL}/venmo/capture-order`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderId: data.orderID })
                });

                const result = await response.json();
                if (result.success) {
                    showModal('success', {
                        amount: getEffectiveAmount(),
                        frequency: paymentState.frequency,
                        method: 'Venmo',
                        transactionId: result.captureId
                    });
                } else {
                    showModal('error', result.error || 'Payment failed');
                }
            } catch (error) {
                showModal('error', error.message);
            }
        },
        onError: (err) => {
            console.error('PayPal error:', err);
            showModal('error', 'Payment failed. Please try again.');
        }
    }).render('#venmo-button-container');
}

function setupAmountSelector() {
    const amountBtns = document.querySelectorAll('.amount-btn');
    const customInput = document.getElementById('custom-amount');

    amountBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Clear custom input
            customInput.value = '';

            // Update selection
            amountBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');

            paymentState.amount = parseInt(btn.dataset.amount);
            updateSummary();
        });
    });

    customInput.addEventListener('input', () => {
        // Clear button selection
        amountBtns.forEach(b => b.classList.remove('selected'));

        const value = parseFloat(customInput.value);
        if (value && value > 0) {
            paymentState.amount = Math.round(value * 100); // Convert to cents
        }
        updateSummary();
    });

    customInput.addEventListener('focus', () => {
        amountBtns.forEach(b => b.classList.remove('selected'));
    });
}

function setupFrequencySelector() {
    const frequencyBtns = document.querySelectorAll('.frequency-btn');
    const dadOptions = document.getElementById('dad-options');

    frequencyBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            frequencyBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');

            paymentState.frequency = btn.dataset.freq;

            // Show/hide Dollar-a-Day options
            if (btn.dataset.freq === 'dollar-a-day') {
                dadOptions.style.display = 'block';
            } else {
                dadOptions.style.display = 'none';
            }

            updateSummary();

            // Re-render PayPal button if loaded (to update amount)
            if (paymentState.paypalLoaded) {
                renderPayPalButton();
            }
        });
    });
}

function setupDollarADayOptions() {
    const dadRadios = document.querySelectorAll('input[name="dad-plan"]');

    dadRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            paymentState.dadPlan = radio.value;
            updateSummary();
        });
    });
}

function setupDonorInfoForm() {
    const emailInput = document.getElementById('donor-email');
    const nameInput = document.getElementById('donor-name');

    emailInput.addEventListener('input', () => {
        paymentState.email = emailInput.value;
    });

    nameInput.addEventListener('input', () => {
        paymentState.name = nameInput.value;
    });

    // Initialize PayPal when user starts entering info
    emailInput.addEventListener('focus', () => {
        if (!paymentState.paypalLoaded) {
            initPayPal();
        }
    });
}

function setupSubmitButton() {
    const submitBtn = document.getElementById('submit-payment');

    submitBtn.addEventListener('click', async () => {
        const email = document.getElementById('donor-email').value;

        if (!email) {
            document.getElementById('donor-email').focus();
            showModal('error', 'Please enter your email address');
            return;
        }

        if (!paymentState.stripe || !paymentState.cardElement) {
            showModal('error', 'Payment system not initialized. Please refresh the page.');
            return;
        }

        // Show loading state
        setLoading(true);

        try {
            const amount = getEffectiveAmount();
            const name = document.getElementById('donor-name').value;

            if (paymentState.frequency === 'one-time') {
                await processOneTimePayment(amount, email, name);
            } else {
                await processSubscription(amount, email, name);
            }
        } catch (error) {
            console.error('Payment error:', error);
            showModal('error', error.message || 'Payment failed. Please try again.');
        } finally {
            setLoading(false);
        }
    });
}

async function processOneTimePayment(amount, email, name) {
    // Create PaymentIntent
    const response = await fetch(`${API_BASE_URL}/stripe/create-payment-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            amount,
            email,
            name,
            donationType: 'one-time'
        })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error);

    // Confirm payment with Stripe
    const { error, paymentIntent } = await paymentState.stripe.confirmCardPayment(
        data.clientSecret,
        {
            payment_method: {
                card: paymentState.cardElement,
                billing_details: {
                    email,
                    name: name || undefined
                }
            }
        }
    );

    if (error) {
        throw new Error(error.message);
    }

    if (paymentIntent.status === 'succeeded') {
        showModal('success', {
            amount,
            frequency: 'one-time',
            method: 'Credit Card',
            transactionId: paymentIntent.id
        });
    }
}

async function processSubscription(amount, email, name) {
    // For subscriptions, we need to use Stripe's subscription API
    // This requires pre-created Price IDs in Stripe Dashboard
    // For now, show a message to contact treasurer for subscriptions

    showModal('error',
        'Recurring donations are being set up. Please contact brett.szalapski@gmail.com to set up a recurring donation, or make a one-time donation now.'
    );
}

function getEffectiveAmount() {
    if (paymentState.frequency === 'dollar-a-day') {
        return DAD_AMOUNTS[paymentState.dadPlan];
    }
    return paymentState.amount;
}

function formatCurrency(cents) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(cents / 100);
}

function updateSummary() {
    const amount = getEffectiveAmount();
    const amountEl = document.getElementById('summary-amount');
    const frequencyEl = document.getElementById('summary-frequency');
    const submitBtn = document.getElementById('submit-payment');
    const btnText = submitBtn.querySelector('.btn-text');

    amountEl.textContent = formatCurrency(amount);

    let frequencyText = 'One-Time';
    let btnAmount = formatCurrency(amount);

    if (paymentState.frequency === 'monthly') {
        frequencyText = 'Monthly';
        btnAmount = `${formatCurrency(amount)}/month`;
    } else if (paymentState.frequency === 'dollar-a-day') {
        const planNames = {
            '5yr': '5 Year Dollar-a-Day',
            '7yr': '7 Year Dollar-a-Day',
            '10yr': '10 Year Dollar-a-Day'
        };
        frequencyText = planNames[paymentState.dadPlan];
        btnAmount = `${formatCurrency(amount)}/month`;
    }

    frequencyEl.textContent = frequencyText;
    btnText.textContent = `Donate ${btnAmount}`;
}

function setLoading(isLoading) {
    const submitBtn = document.getElementById('submit-payment');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoading = submitBtn.querySelector('.btn-loading');

    submitBtn.disabled = isLoading;

    if (isLoading) {
        btnText.style.display = 'none';
        btnLoading.style.display = 'flex';
    } else {
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
    }
}

function setupModal() {
    const modal = document.getElementById('payment-modal');
    const closeBtn = document.getElementById('modal-close');
    const overlay = modal.querySelector('.modal-overlay');

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);

    // Close on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeModal();
        }
    });
}

function showModal(type, data) {
    const modal = document.getElementById('payment-modal');
    const modalBody = document.getElementById('modal-body');

    if (type === 'success') {
        modalBody.innerHTML = `
            <div class="modal-success">
                <div class="success-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </div>
                <h3>Thank You!</h3>
                <p>Your donation has been processed successfully. A receipt has been sent to your email.</p>
                <div class="receipt-details">
                    <div class="receipt-row">
                        <span class="receipt-label">Amount</span>
                        <span class="receipt-value">${formatCurrency(data.amount)}</span>
                    </div>
                    <div class="receipt-row">
                        <span class="receipt-label">Type</span>
                        <span class="receipt-value">${data.frequency === 'one-time' ? 'One-Time' : 'Recurring'}</span>
                    </div>
                    <div class="receipt-row">
                        <span class="receipt-label">Payment Method</span>
                        <span class="receipt-value">${data.method}</span>
                    </div>
                    <div class="receipt-row">
                        <span class="receipt-label">Transaction ID</span>
                        <span class="receipt-value" style="font-size: 11px; font-family: monospace;">${data.transactionId}</span>
                    </div>
                </div>
                <button class="btn btn-primary" onclick="closeModal()">Close</button>
            </div>
        `;
    } else if (type === 'error') {
        const message = typeof data === 'string' ? data : 'An error occurred. Please try again.';
        modalBody.innerHTML = `
            <div class="modal-error">
                <div class="error-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="15" y1="9" x2="9" y2="15"></line>
                        <line x1="9" y1="9" x2="15" y2="15"></line>
                    </svg>
                </div>
                <h3>Payment Issue</h3>
                <p>${message}</p>
                <button class="btn btn-primary" onclick="closeModal()">Try Again</button>
            </div>
        `;
    }

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    const modal = document.getElementById('payment-modal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
}
