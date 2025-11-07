const authService = require('./auth.service');
const emailService = require('../services/email.service');
const User = require('../models/User');

class AuthController {
  async sendOTP(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          error: 'Email is required'
        });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          error: 'Invalid email format'
        });
      }

      const otp = authService.generateOTP();

      await authService.saveOTP(email.toLowerCase(), otp);

      await emailService.sendOTP(email, otp);

      res.status(200).json({
        success: true,
        message: 'OTP sent successfully',
        email: email.toLowerCase()
      });
    } catch (error) {
      console.error('Send OTP Error:', error);
      res.status(500).json({
        error: 'Failed to send OTP',
        details: error.message
      });
    }
  }

  async verifyOTP(req, res) {
    try {
      const { email, otp } = req.body;

      if (!email || !otp) {
        return res.status(400).json({
          error: 'Email and OTP are required'
        });
      }

      const result = await authService.verifyOTP(email.toLowerCase(), otp);

      res.status(200).json({
        success: true,
        message: 'Login successful',
        token: result.token,
        user: result.user
      });
    } catch (error) {
      console.error('Verify OTP Error:', error);
      res.status(400).json({
        error: 'Failed to verify OTP',
        details: error.message
      });
    }
  }

  async refreshToken(req, res) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return res.status(400).json({
          error: 'Token is required'
        });
      }

      const result = await authService.refreshToken(token);

      res.status(200).json({
        success: true,
        message: 'Token refreshed successfully',
        token: result.token,
        user: result.user
      });
    } catch (error) {
      console.error('Refresh Token Error:', error);
      res.status(401).json({
        error: 'Failed to refresh token',
        details: error.message
      });
    }
  }

  async getProfile(req, res) {
    try {
      const user = await User.findById(req.user.id)
        .populate('activePlan')
        .populate({
          path: 'planHistory',
          populate: {
            path: 'planId',
            model: 'Plan'
          },
          options: {
            sort: { purchaseDate: -1 },
            limit: 10
          }
        })
        .select('-otp -otpExpiry');

      if (!user) {
        return res.status(404).json({
          error: 'User not found'
        });
      }

      res.status(200).json({
        success: true,
        user: {
          id: user._id,
          email: user.email,
          credits: user.credits,
          activePlan: user.activePlan,
          planHistory: user.planHistory,
          reportCount: user.reportHistory.length,
          createdAt: user.createdAt,
          lastLogin: user.lastLogin
        }
      });
    } catch (error) {
      console.error('Get Profile Error:', error);
      res.status(500).json({
        error: 'Failed to fetch profile',
        details: error.message
      });
    }
  }

  async logout(req, res) {
    try {
      res.status(200).json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      console.error('Logout Error:', error);
      res.status(500).json({
        error: 'Failed to logout',
        details: error.message
      });
    }
  }
}

module.exports = new AuthController();