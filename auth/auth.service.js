const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';
const OTP_EXPIRY_MINUTES = 10;

class AuthService {
  generateOTP() {
    return crypto.randomInt(100000, 999999).toString();
  }

  generateJWT(userId, email) {
    return jwt.sign(
      {
        userId,
        email,
        timestamp: Date.now()
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );
  }

  verifyJWT(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  async saveOTP(email, otp) {
    console.log(`🔐 Generated OTP for ${email}: ${otp}`);
    const otpExpiry = new Date();
    otpExpiry.setMinutes(otpExpiry.getMinutes() + OTP_EXPIRY_MINUTES);

    let user = await User.findOne({ email });

    if (!user) {
      user = new User({
        email,
        otp,
        otpExpiry,
        credits: 0
      });
    } else {
      user.otp = otp;
      user.otpExpiry = otpExpiry;
    }

    await user.save();
    return user;
  }

  async verifyOTP(email, otp) {
    const user = await User.findOne({ email });

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.otp || user.otp !== otp) {
      throw new Error('Invalid OTP');
    }

    if (user.otpExpiry < new Date()) {
      throw new Error('OTP has expired');
    }

    user.otp = null;
    user.otpExpiry = null;
    user.lastLogin = new Date();
    await user.save();

    const token = this.generateJWT(user._id, user.email);

    return {
      token,
      user: {
        id: user._id,
        email: user.email,
        credits: user.credits,
        activePlan: user.activePlan
      }
    };
  }

  async refreshToken(oldToken) {
    try {
      const decoded = jwt.verify(oldToken, JWT_SECRET, { ignoreExpiration: true });

      const user = await User.findById(decoded.userId);
      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      const token = this.generateJWT(user._id, user.email);

      return {
        token,
        user: {
          id: user._id,
          email: user.email,
          credits: user.credits,
          activePlan: user.activePlan
        }
      };
    } catch (error) {
      throw new Error('Failed to refresh token');
    }
  }
}

module.exports = new AuthService();