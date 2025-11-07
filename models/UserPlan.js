const mongoose = require('mongoose');

const userPlanSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
    required: true
  },
  creditsAllocated: {
    type: Number,
    required: true
  },
  creditsUsed: {
    type: Number,
    default: 0
  },
  purchaseDate: {
    type: Date,
    default: Date.now
  },
  expiryDate: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'consumed'],
    default: 'active'
  },
  paymentDetails: {
    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String,
    amount: Number,
    currency: String
  }
});

userPlanSchema.index({ userId: 1, purchaseDate: -1 });

module.exports = mongoose.model('UserPlan', userPlanSchema);