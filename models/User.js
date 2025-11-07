const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  otp: {
    type: String,
    default: null
  },
  otpExpiry: {
    type: Date,
    default: null
  },
  credits: {
    type: Number,
    default: 0,
    min: 0
  },
  activePlan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
    default: null
  },
  planHistory: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserPlan'
  }],
  reportHistory: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Report'
  }],
  lastLogin: {
    type: Date,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

userSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

userSchema.methods.hasCredits = function() {
  return this.credits > 0;
};

userSchema.methods.deductCredit = async function(amount = 1) {
  if (this.credits < amount) {
    throw new Error('Insufficient credits');
  }
  this.credits -= amount;
  await this.save();
  return this.credits;
};

userSchema.methods.addCredits = async function(amount) {
  this.credits += amount;
  await this.save();
  return this.credits;
};

module.exports = mongoose.model('User', userSchema);