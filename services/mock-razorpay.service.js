const crypto = require('crypto');

class MockRazorpayService {
  constructor() {
    this.mockMode = process.env.NODE_ENV === 'development' || process.env.MOCK_PAYMENTS === 'true';
  }

  async createOrder(amount, currency = 'INR', notes = {}) {
    if (this.mockMode) {
      // Create a mock order for testing
      const mockOrder = {
        id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        entity: 'order',
        amount: amount * 100,
        amount_paid: 0,
        amount_due: amount * 100,
        currency,
        receipt: `receipt_${Date.now()}`,
        status: 'created',
        attempts: 0,
        notes,
        created_at: Math.floor(Date.now() / 1000)
      };

      console.log('🎭 Mock Razorpay Order Created:', mockOrder);
      return mockOrder;
    }

    // Real Razorpay integration would go here
    const Razorpay = require('razorpay');
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    try {
      const options = {
        amount: amount * 100,
        currency,
        receipt: `receipt_${Date.now()}`,
        notes
      };

      const order = await razorpay.orders.create(options);
      return order;
    } catch (error) {
      console.error('Razorpay order creation failed:', error);
      throw new Error('Failed to create payment order');
    }
  }

  verifyPaymentSignature(orderId, paymentId, signature) {
    if (this.mockMode) {
      // Mock verification - always return true for testing
      console.log('🎭 Mock Payment Verification:', { orderId, paymentId, signature });
      return true;
    }

    // Real signature verification
    const text = `${orderId}|${paymentId}`;
    const generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(text)
      .digest('hex');

    return generated_signature === signature;
  }

  async fetchPayment(paymentId) {
    if (this.mockMode) {
      // Mock payment details
      return {
        id: paymentId,
        entity: 'payment',
        amount: 49900, // ₹499
        currency: 'INR',
        status: 'captured',
        method: 'card',
        captured: true,
        created_at: Math.floor(Date.now() / 1000)
      };
    }

    // Real Razorpay fetch would go here
    const Razorpay = require('razorpay');
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    try {
      const payment = await razorpay.payments.fetch(paymentId);
      return payment;
    } catch (error) {
      console.error('Failed to fetch payment:', error);
      throw new Error('Failed to fetch payment details');
    }
  }

  async refundPayment(paymentId, amount = null) {
    if (this.mockMode) {
      // Mock refund
      return {
        id: `rfnd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        entity: 'refund',
        amount: amount ? amount * 100 : 49900,
        currency: 'INR',
        payment_id: paymentId,
        status: 'processed',
        created_at: Math.floor(Date.now() / 1000)
      };
    }

    // Real refund would go here
    const Razorpay = require('razorpay');
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    try {
      const refundOptions = {};
      if (amount) {
        refundOptions.amount = amount * 100;
      }

      const refund = await razorpay.payments.refund(paymentId, refundOptions);
      return refund;
    } catch (error) {
      console.error('Refund failed:', error);
      throw new Error('Failed to process refund');
    }
  }
}

module.exports = new MockRazorpayService();