const authService = require('./auth.service');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please provide a valid token'
      });
    }

    const decoded = authService.verifyJWT(token);

    const user = await User.findById(decoded.userId)
      .populate('activePlan')
      .select('-otp -otpExpiry');
    // console.log("Authenticated user:", user);
    if (!user || !user.isActive) {
      return res.status(401).json({
        error: 'User not found or inactive'
      });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    return res.status(401).json({
      error: 'Invalid or expired token',
      message: error.message
    });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return next();
    }

    const decoded = authService.verifyJWT(token);
    const user = await User.findById(decoded.userId)
      .populate('activePlan')
      .select('-otp -otpExpiry');

    if (user && user.isActive) {
      req.user = user;
      req.token = token;
    }

    next();
  } catch (error) {
    next();
  }
};

const requireCredits = (creditsNeeded = 1) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    if (req.user.credits < creditsNeeded) {
      return res.status(403).json({
        error: 'Insufficient credits',
        message: `You need ${creditsNeeded} credit(s) to perform this action. You have ${req.user.credits} credit(s).`,
        requiredCredits: creditsNeeded,
        currentCredits: req.user.credits
      });
    }

    next();
  };
};

module.exports = {
  authMiddleware,
  optionalAuth,
  requireCredits
};