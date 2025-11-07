const Plan = require('../models/Plan');
const User = require('../models/User');
const UserPlan = require('../models/UserPlan');
const Transaction = require('../models/Transaction');
const razorpayService = require('../services/mock-razorpay.service');
const emailService = require('../services/email.service');

class SubscriptionController {
  async getPlans(req, res) {
    try {
      const plans = await Plan.find({ isActive: true }).sort('price');

      res.status(200).json({
        success: true,
        plans: plans.map(plan => ({
          id: plan._id,
          name: plan.name,
          displayName: plan.displayName,
          credits: plan.credits,
          price: plan.price,
          currency: plan.currency,
          features: plan.features,
          description: plan.description
        }))
      });
    } catch (error) {
      console.error('Get Plans Error:', error);
      res.status(500).json({
        error: 'Failed to fetch plans',
        details: error.message
      });
    }
  }

  async createOrder(req, res) {
    try {
      const { planId } = req.body;
      const userId = req.user._id;

      if (!planId) {
        return res.status(400).json({
          error: 'Plan ID is required'
        });
      }

      const plan = await Plan.findById(planId);
      if (!plan || !plan.isActive) {
        return res.status(404).json({
          error: 'Plan not found or inactive'
        });
      }

      const order = await razorpayService.createOrder(plan.price, plan.currency, {
        userId: userId.toString(),
        planId: planId,
        planName: plan.name,
        credits: plan.credits
      });

      const transaction = new Transaction({
        userId,
        planId,
        razorpayOrderId: order.id,
        amount: plan.price,
        currency: plan.currency,
        status: 'created'
      });

      await transaction.save();

      res.status(200).json({
        success: true,
        order: {
          id: order.id,
          amount: order.amount,
          currency: order.currency,
          key: process.env.RAZORPAY_KEY_ID,
          name: 'Report Generation Platform',
          description: plan.displayName,
          prefill: {
            email: req.user.email
          }
        }
      });
    } catch (error) {
      console.error('Create Order Error:', error);
      res.status(500).json({
        error: 'Failed to create payment order',
        details: error.message
      });
    }
  }

  async verifyPayment(req, res) {
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        test_mode
      } = req.body;

      const userId = req.user._id;

      console.log(`🔍 Verifying payment for user ${userId}:`, {
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        hasSignature: !!razorpay_signature,
        testMode: test_mode
      });

      // Validate required fields
      if (!razorpay_order_id || !razorpay_payment_id) {
        console.log('❌ Missing payment verification details');
        return res.status(400).json({
          error: 'Missing payment verification details'
        });
      }

      // Handle signature verification based on mode
      let isValid = true;
      if (test_mode) {
        console.log('🧪 Test mode detected - skipping signature verification');
        // In test mode, we skip signature verification
        isValid = true;
      } else if (!razorpay_signature) {
        console.log('❌ Production mode requires signature');
        return res.status(400).json({
          error: 'Missing payment signature for production mode'
        });
      } else {
        console.log('🔐 Production mode - verifying signature');
        isValid = razorpayService.verifyPaymentSignature(
          razorpay_order_id,
          razorpay_payment_id,
          razorpay_signature
        );
      }

      if (!isValid) {
        console.log('❌ Payment signature verification failed');
        return res.status(400).json({
          error: 'Invalid payment signature'
        });
      }

      const transaction = await Transaction.findOne({
        razorpayOrderId: razorpay_order_id
      }).populate('planId');

      if (!transaction) {
        return res.status(404).json({
          error: 'Transaction not found'
        });
      }

      if (transaction.status === 'success') {
        return res.status(400).json({
          error: 'Payment already processed'
        });
      }

      transaction.razorpayPaymentId = razorpay_payment_id;
      transaction.razorpaySignature = razorpay_signature || ''; // Empty for test mode
      transaction.status = 'success';
      transaction.testMode = test_mode; // Track if this was a test mode payment
      await transaction.save();

      const plan = transaction.planId;
      const user = await User.findById(userId);

      user.credits += plan.credits;
      user.activePlan = plan._id;

      const userPlan = new UserPlan({
        userId,
        planId: plan._id,
        creditsAllocated: plan.credits,
        creditsUsed: 0,
        paymentDetails: {
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
          amount: transaction.amount,
          currency: transaction.currency
        }
      });

      await userPlan.save();

      user.planHistory.push(userPlan._id);
      await user.save();

      // Send confirmation email (skip in test mode if desired)
      try {
        await emailService.sendPurchaseConfirmation(user.email, plan, transaction);
      } catch (emailError) {
        console.warn('⚠️ Failed to send confirmation email:', emailError.message);
        // Don't fail the payment verification due to email issues
      }

      console.log(`✅ Payment verified successfully for user ${userId}, plan: ${plan.name}, test_mode: ${test_mode}`);

      res.status(200).json({
        success: true,
        message: 'Payment verified successfully',
        credits: user.credits,
        plan: {
          name: plan.displayName,
          credits: plan.credits
        },
        testMode: test_mode
      });
    } catch (error) {
      console.error('Verify Payment Error:', error);
      res.status(500).json({
        error: 'Failed to verify payment',
        details: error.message
      });
    }
  }

  async getPurchaseHistory(req, res) {
    try {
      const userId = req.user._id;

      const transactions = await Transaction.find({
        userId,
        status: 'success'
      })
        .populate('planId')
        .sort('-createdAt')
        .limit(20);

      const userPlans = await UserPlan.find({ userId })
        .populate('planId')
        .sort('-purchaseDate')
        .limit(20);

      res.status(200).json({
        success: true,
        transactions: transactions.map(t => ({
          id: t._id,
          plan: t.planId.displayName,
          credits: t.planId.credits,
          amount: t.amount,
          currency: t.currency,
          paymentId: t.razorpayPaymentId,
          date: t.createdAt
        })),
        plans: userPlans.map(up => ({
          id: up._id,
          plan: up.planId.displayName,
          creditsAllocated: up.creditsAllocated,
          creditsUsed: up.creditsUsed,
          creditsRemaining: up.creditsAllocated - up.creditsUsed,
          purchaseDate: up.purchaseDate,
          status: up.status
        }))
      });
    } catch (error) {
      console.error('Get Purchase History Error:', error);
      res.status(500).json({
        error: 'Failed to fetch purchase history',
        details: error.message
      });
    }
  }

  async getCredits(req, res) {
    try {
      const user = await User.findById(req.user._id)
        .populate('activePlan')
        .select('email credits activePlan');

      res.status(200).json({
        success: true,
        credits: user.credits,
        activePlan: user.activePlan ? {
          name: user.activePlan.displayName,
          credits: user.activePlan.credits
        } : null
      });
    } catch (error) {
      console.error('Get Credits Error:', error);
      res.status(500).json({
        error: 'Failed to fetch credits',
        details: error.message
      });
    }
  }
}

module.exports = new SubscriptionController();