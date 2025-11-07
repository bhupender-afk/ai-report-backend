const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  async sendOTP(email, otp) {
    try {
      // Read the OTP template
      const templatePath = path.join(__dirname, '..', 'templates', 'otp-send.html');
      let htmlTemplate = await fs.readFile(templatePath, 'utf-8');

      // Replace template variables
      htmlTemplate = htmlTemplate
        .replace(/{{otp_code}}/g, otp)
        .replace(/{{otp_expiry_minutes}}/g, '10')
        .replace(/{{website_url}}/g, process.env.FRONTEND_URL || 'https://zuvomo.com');

      const mailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject: 'Your Zuvomo Verification Code',
        html: htmlTemplate
      };

      await this.transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error('Email sending failed:', error);
      throw new Error('Failed to send OTP email');
    }
  }

  async sendReport(email, report, attachments = []) {
    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: `Your Report: ${report.name} - ${report.organization}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #4F46E5; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">Report Generated Successfully</h1>
          </div>
          <div style="padding: 20px; background-color: #f3f4f6;">
            <h2 style="color: #111827;">Report Details</h2>

            <div style="background-color: #fff; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #E5E7EB;"><strong>Name:</strong></td>
                  <td style="padding: 10px; border-bottom: 1px solid #E5E7EB;">${report.name}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #E5E7EB;"><strong>Organization:</strong></td>
                  <td style="padding: 10px; border-bottom: 1px solid #E5E7EB;">${report.organization}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #E5E7EB;"><strong>Industry:</strong></td>
                  <td style="padding: 10px; border-bottom: 1px solid #E5E7EB;">${report.industry.join(', ')}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #E5E7EB;"><strong>Website:</strong></td>
                  <td style="padding: 10px; border-bottom: 1px solid #E5E7EB;"><a href="${report.websiteUrl}">${report.websiteUrl}</a></td>
                </tr>
                <tr>
                  <td style="padding: 10px;"><strong>Status:</strong></td>
                  <td style="padding: 10px;"><span style="color: #10B981; font-weight: bold;">Completed</span></td>
                </tr>
              </table>
            </div>

            <h3 style="color: #111827; margin-top: 30px;">Executive Summary</h3>
            <div style="background-color: #fff; padding: 20px; border-radius: 8px;">
              <p style="color: #6B7280; line-height: 1.6;">
                ${report.generatedReport?.executive_summary || 'Your comprehensive report has been generated and is attached to this email.'}
              </p>
            </div>

            <div style="text-align: center; margin-top: 30px;">
              <a href="${process.env.FRONTEND_URL}/reports/${report.requestId}"
                 style="background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
                View Report Online
              </a>
            </div>

            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">

            <p style="color: #9CA3AF; font-size: 12px; text-align: center;">
              This report was generated on ${new Date().toLocaleString()}<br>
              Your report will be available online for 30 days.
            </p>
          </div>
        </div>
      `,
      attachments
    };

    try {
      await this.transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error('Email sending failed:', error);
      throw new Error('Failed to send report email');
    }
  }

  async sendPurchaseConfirmation(email, plan, transaction) {
    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: `Purchase Confirmation: ${plan.displayName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #10B981; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">Payment Successful!</h1>
          </div>
          <div style="padding: 20px; background-color: #f3f4f6;">
            <h2 style="color: #111827;">Thank you for your purchase</h2>

            <div style="background-color: #fff; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #4F46E5; margin-top: 0;">Plan Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #E5E7EB;"><strong>Plan:</strong></td>
                  <td style="padding: 10px; border-bottom: 1px solid #E5E7EB;">${plan.displayName}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #E5E7EB;"><strong>Credits:</strong></td>
                  <td style="padding: 10px; border-bottom: 1px solid #E5E7EB;">${plan.credits} Reports</td>
                </tr>
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #E5E7EB;"><strong>Amount Paid:</strong></td>
                  <td style="padding: 10px; border-bottom: 1px solid #E5E7EB;">₹${transaction.amount}</td>
                </tr>
                <tr>
                  <td style="padding: 10px;"><strong>Transaction ID:</strong></td>
                  <td style="padding: 10px;">${transaction.razorpayPaymentId}</td>
                </tr>
              </table>
            </div>

            <div style="background-color: #EFF6FF; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="color: #1E40AF; margin: 0;">
                <strong>Credits Added!</strong><br>
                Your account has been credited with ${plan.credits} report generation credits.
              </p>
            </div>

            <div style="text-align: center; margin-top: 30px;">
              <a href="${process.env.FRONTEND_URL}/dashboard"
                 style="background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Go to Dashboard
              </a>
            </div>

            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">

            <p style="color: #9CA3AF; font-size: 12px; text-align: center;">
              Purchase Date: ${new Date().toLocaleString()}<br>
              For support, contact us at support@reportplatform.com
            </p>
          </div>
        </div>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error('Email sending failed:', error);
      throw new Error('Failed to send purchase confirmation');
    }
  }
}

module.exports = new EmailService();