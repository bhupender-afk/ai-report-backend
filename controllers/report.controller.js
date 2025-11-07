const Report = require('../models/Report');
const User = require('../models/User');
const emailService = require('../services/email.service');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const fetch = require('node-fetch');

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'documents');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|doc|docx|png|jpg|jpeg|xls|xlsx/;
    console.log("File filter check for file:", file);
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    console.log("Uploading file:", file.originalname, "MIME type:", file.mimetype);
    console.log("extname file:", extname, "MIME type:", mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, PNG, and Excel files are allowed.'));
    }
  }
});

class ReportController {
  async generateReport(req, res) {
    try {
      const userId = req.user._id;
      const {
        name,
        organization,
        industry,
        websiteUrl,
        role,
        heardFrom,
        competitors,
        usp,
        teamSize,
        partners
      } = req.body;
      console.log("Generate Report Request Body:", req.body);

      if (!name || !organization || !websiteUrl) {
        return res.status(400).json({
          error: 'Name, organization, and website URL are required'
        });
      }

      const user = await User.findById(userId).populate('activePlan');

      // Check if user has an active subscription
      // If they have a subscription, check credits and deduct if available
      // If no subscription or no credits, still allow report generation
      const hasActiveSubscription = user.activePlan !== null;
      const shouldDeductCredit = hasActiveSubscription && user.credits > 0;

      const requestId = uuidv4();

      const report = new Report({
        userId,
        requestId,
        name,
        organization,
        industry: Array.isArray(industry) ? industry : [industry].filter(Boolean),
        websiteUrl,
        role,
        heardFrom,
        competitors: Array.isArray(competitors) ? competitors : [competitors].filter(Boolean),
        usp,
        teamSize,
        partners: Array.isArray(partners) ? partners : [partners].filter(Boolean),
        status: 'queued',
        progress: 0,
        documents: []
      });

      // Handle files from any field name (req.files will be an array when using .any())
      if (req.files && req.files.length > 0) {
        report.documents = req.files.map(file => ({
          type: path.extname(file.originalname).substring(1),
          url: `/uploads/documents/${file.filename}`,
          originalName: file.originalname,
          uploadDate: new Date(),
          size: file.size,
          fieldName: file.fieldname  // Store the field name for debugging
        }));
      }

      await report.save();

      // Only deduct credit if user has an active subscription and credits available
      if (shouldDeductCredit) {
        await user.deductCredit(1);
      }

      user.reportHistory.push(report._id);
      await user.save();

      console.log('Report saved with requestId:', requestId);

      // Trigger n8n webhook if configured
      const webhookUrl = process.env.N8N_WEBHOOK_URL;
      let webhookSuccess = false;
      const formData = {
        reportId: report._id.toString(),
        name,
        organization,
        url:websiteUrl,
        industry: Array.isArray(industry) ? industry : [industry].filter(Boolean),
        role: role || '',
        heardFrom: heardFrom || '',
        competitors: Array.isArray(competitors) ? competitors : [competitors].filter(Boolean),
        usp: usp || '',
        teamSize: teamSize || '',
        partners: Array.isArray(partners) ? partners : [partners].filter(Boolean),
        userId: userId.toString(),
        userEmail: user.email,
      };

      if (webhookUrl) {
        try {
          const webhookPayload = {
            requestId,
            url: websiteUrl,
            submittedBy: user.name || user.email,
            model: 'sonar',
            formData: formData,
            createdAt: new Date().toISOString()
          };

          console.log('🔔 Triggering n8n webhook for reportId:', report._id);

          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(webhookPayload)
          });

          if (!response.ok) {
            throw new Error(`Webhook returned status ${response.status}`);
          }

          const webhookResponse = await response.json().catch(() => ({}));
          console.log('✅ Webhook triggered successfully for reportId:', report._id);

          // Update report status to processing since webhook succeeded
          report.status = 'processing';
          report.webhookTriggered = true;
          report.webhookResponse = webhookResponse;
          await report.save();

          webhookSuccess = true;

          // Process report asynchronously only if webhook succeeds
          setImmediate(async () => {
            try {
              const reportController = require('../controllers/report.controller');
              await reportController.processReport(report._id);
            } catch (error) {
              console.error('Background report processing error:', error);
              // Update report status to failed if processing fails
              await Report.findByIdAndUpdate(report._id, {
                status: 'failed',
                error: {
                  message: error.message,
                  occurredAt: new Date()
                }
              });
            }
          });

        } catch (webhookError) {
          console.error('⚠️ Webhook trigger failed:', webhookError.message);

          // Update report status to failed if webhook fails
          report.status = 'failed';
          report.webhookTriggered = false;
          report.error = {
            message: `Webhook failed: ${webhookError.message}`,
            occurredAt: new Date()
          };
          await report.save();

          return res.status(500).json({
            success: false,
            error: 'Report generation failed',
            message: 'Failed to trigger processing webhook',
            requestId,
            reportId: report._id
          });
        }
      } else {
        // No webhook configured, process normally
        console.log('No webhook URL configured, processing report locally');

        report.status = 'processing';
        await report.save();

        setImmediate(async () => {
          try {
            const reportController = require('../controllers/report.controller');
            await reportController.processReport(report._id);
          } catch (error) {
            console.error('Background report processing error:', error);
            await Report.findByIdAndUpdate(report._id, {
              status: 'failed',
              error: {
                message: error.message,
                occurredAt: new Date()
              }
            });
          }
        });

        webhookSuccess = true; // Consider it success if no webhook is needed
      }

      res.status(201).json({
        success: true,
        message: webhookSuccess ? 'Report generation started' : 'Report queued',
        requestId,
        reportId: report._id,
        creditsRemaining: user.credits,
        creditDeducted: shouldDeductCredit,
        status: report.status
      });
    } catch (error) {
      console.error('Generate Report Error:', error);
      res.status(500).json({
        error: 'Failed to generate report',
        details: error.message
      });
    }
  }

  async processReport(reportId) {
    try {
      const report = await Report.findById(reportId).populate('userId');

      report.status = 'processing';
      report.progress = 25;
      await report.save();

      global.io?.to(report.userId._id.toString()).emit('report-progress', {
        reportId: report._id,
        progress: 25,
        status: 'processing'
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      report.progress = 50;
      await report.save();

      global.io?.to(report.userId._id.toString()).emit('report-progress', {
        reportId: report._id,
        progress: 50,
        status: 'processing'
      });

      const generatedReport = await this.generateReportContent(report);

      report.generatedReport = generatedReport;
      report.progress = 75;
      await report.save();

      global.io?.to(report.userId._id.toString()).emit('report-progress', {
        reportId: report._id,
        progress: 75,
        status: 'processing'
      });

      report.status = 'completed';
      report.progress = 100;
      report.processingTime = Date.now() - report.createdAt.getTime();
      await report.save();

      global.io?.to(report.userId._id.toString()).emit('report-complete', {
        reportId: report._id,
        progress: 100,
        status: 'completed'
      });

      const pdfBuffer = await this.generatePDF(report);
      const attachments = [{
        filename: `report_${report.organization}_${Date.now()}.pdf`,
        content: pdfBuffer
      }];

      await emailService.sendReport(report.userId.email, report, attachments);

      report.emailSent = true;
      report.emailSentAt = new Date();
      report.status = 'delivered';
      await report.save();

    } catch (error) {
      console.error('Process Report Error:', error);

      const report = await Report.findById(reportId);
      report.status = 'failed';
      report.error = {
        message: error.message,
        occurredAt: new Date()
      };
      await report.save();

      global.io?.to(report.userId._id.toString()).emit('report-error', {
        reportId: report._id,
        error: error.message
      });
    }
  }

  async generateReportContent(report) {
    return {
      executive_summary: `This comprehensive analysis for ${report.organization} operating in the ${report.industry.join(', ')} sector provides strategic insights and recommendations. The organization, with a team size of ${report.teamSize || 'undisclosed'} members, demonstrates ${report.usp || 'unique value propositions'} in a competitive market landscape.`,

      market_analysis: {
        market_size: 'The global market for this industry is valued at $XXX billion',
        growth_rate: '15-20% CAGR expected over the next 5 years',
        key_trends: [
          'Digital transformation acceleration',
          'Sustainability focus',
          'Customer experience enhancement',
          'Data-driven decision making'
        ],
        opportunities: [
          'Emerging market expansion',
          'Product diversification',
          'Strategic partnerships',
          'Technology integration'
        ],
        threats: [
          'Increased competition',
          'Regulatory changes',
          'Economic uncertainty',
          'Technology disruption'
        ]
      },

      competitive_analysis: {
        main_competitors: (report.competitors || ['Competitor A', 'Competitor B']).map(comp => ({
          name: comp,
          strengths: ['Market presence', 'Brand recognition'],
          weaknesses: ['Limited innovation', 'High prices'],
          market_share: 'XX%'
        })),
        competitive_advantage: report.usp || 'Unique positioning in the market',
        positioning: 'Strategic market position with focus on quality and innovation'
      },

      swot_analysis: {
        strengths: [
          'Strong team expertise',
          'Innovative product/service offering',
          'Strategic partnerships',
          report.usp || 'Unique value proposition'
        ],
        weaknesses: [
          'Limited market presence',
          'Resource constraints',
          'Brand awareness'
        ],
        opportunities: [
          'Market expansion potential',
          'Partnership opportunities',
          'Technology advancement'
        ],
        threats: [
          'Competitive pressure',
          'Market volatility',
          'Regulatory challenges'
        ]
      },

      recommendations: [
        {
          title: 'Market Expansion Strategy',
          description: 'Focus on expanding into adjacent markets to increase revenue streams',
          priority: 'High',
          timeline: '6-12 months'
        },
        {
          title: 'Digital Transformation',
          description: 'Implement digital tools and processes to improve operational efficiency',
          priority: 'High',
          timeline: '3-6 months'
        },
        {
          title: 'Partnership Development',
          description: `Leverage partnerships with ${report.partners?.join(', ') || 'strategic partners'} for growth`,
          priority: 'Medium',
          timeline: '6-9 months'
        },
        {
          title: 'Talent Acquisition',
          description: `Expand team from ${report.teamSize || 'current size'} to support growth objectives`,
          priority: 'Medium',
          timeline: '3-12 months'
        }
      ],

      financial_projections: {
        revenue_forecast: 'Expected 30-40% revenue growth over next 2 years',
        growth_metrics: 'User acquisition, retention, and monetization improvements',
        investment_needed: 'Series A funding of $5-10M recommended for expansion'
      },

      risk_assessment: [
        {
          risk: 'Market Competition',
          impact: 'High',
          likelihood: 'Medium',
          mitigation: 'Differentiation through innovation and customer service'
        },
        {
          risk: 'Technology Changes',
          impact: 'Medium',
          likelihood: 'High',
          mitigation: 'Continuous R&D investment and agile development'
        },
        {
          risk: 'Regulatory Compliance',
          impact: 'High',
          likelihood: 'Low',
          mitigation: 'Regular compliance audits and legal consultation'
        }
      ],

      conclusion: `${report.organization} is well-positioned for growth in the ${report.industry.join(', ')} sector. With strategic focus on the recommended areas and leveraging the identified opportunities, the organization can achieve sustainable growth and market leadership.`
    };
  }

  async getReport(req, res) {
    try {
      const { reportId } = req.params;
      const userId = req.user._id;

      const report = await Report.findOne({
        _id: reportId,
        userId
      });

      if (!report) {
        return res.status(404).json({
          error: 'Report not found'
        });
      }

      res.status(200).json({
        success: true,
        report
      });
    } catch (error) {
      console.error('Get Report Error:', error);
      res.status(500).json({
        error: 'Failed to fetch report',
        details: error.message
      });
    }
  }

  async getReportStatus(req, res) {
    try {
      const { requestId } = req.params;

      const report = await Report.findOne({ requestId });

      if (!report) {
        return res.status(404).json({
          error: 'Report not found'
        });
      }

      res.status(200).json({
        success: true,
        status: report.status,
        progress: report.progress,
        reportId: report._id
      });
    } catch (error) {
      console.error('Get Report Status Error:', error);
      res.status(500).json({
        error: 'Failed to fetch report status',
        details: error.message
      });
    }
  }

  async getUserReports(req, res) {
    try {
      const userId = req.user._id;
      const { status, limit = 10, offset = 0 } = req.query;

      const query = { userId };
      if (status) {
        query.status = status;
      }

      const reports = await Report.find(query)
        .sort('-createdAt')
        .limit(parseInt(limit))
        .skip(parseInt(offset))
        .select('-generatedReport');

      const total = await Report.countDocuments(query);

      res.status(200).json({
        success: true,
        reports,
        total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
    } catch (error) {
      console.error('Get User Reports Error:', error);
      res.status(500).json({
        error: 'Failed to fetch reports',
        details: error.message
      });
    }
  }

  async downloadReport(req, res) {
    try {
      const { reportId } = req.params;
      const { format = 'pdf' } = req.query;
      const userId = req.user._id;

      const report = await Report.findOne({
        _id: reportId,
        userId,
        status: { $in: ['completed', 'delivered'] }
      });

      if (!report) {
        return res.status(404).json({
          error: 'Report not found or not yet completed'
        });
      }

      report.downloadCount += 1;
      report.lastDownloadAt = new Date();
      await report.save();

      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="report_${report.organization}_${Date.now()}.json"`);
        res.json(report.generatedReport);
      } else {
        const pdfBuffer = await this.generatePDF(report);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="report_${report.organization}_${Date.now()}.pdf"`);
        res.send(pdfBuffer);
      }
    } catch (error) {
      console.error('Download Report Error:', error);
      res.status(500).json({
        error: 'Failed to download report',
        details: error.message
      });
    }
  }

  async generatePDF(report) {
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument();
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));

    doc.fontSize(20).text(`Report: ${report.organization}`, { align: 'center' });
    doc.moveDown();

    doc.fontSize(14).text(`Generated for: ${report.name}`, { align: 'center' });
    doc.fontSize(12).text(`Date: ${new Date().toLocaleDateString()}`, { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(16).text('Executive Summary', { underline: true });
    doc.fontSize(11).text(report.generatedReport.executive_summary);
    doc.moveDown();

    doc.fontSize(16).text('Market Analysis', { underline: true });
    doc.fontSize(11).text(`Market Size: ${report.generatedReport.market_analysis.market_size}`);
    doc.text(`Growth Rate: ${report.generatedReport.market_analysis.growth_rate}`);
    doc.moveDown();

    doc.fontSize(14).text('Key Trends:');
    report.generatedReport.market_analysis.key_trends.forEach(trend => {
      doc.fontSize(11).text(`• ${trend}`);
    });
    doc.moveDown();

    doc.fontSize(16).text('SWOT Analysis', { underline: true });

    ['strengths', 'weaknesses', 'opportunities', 'threats'].forEach(category => {
      doc.fontSize(14).text(`${category.charAt(0).toUpperCase() + category.slice(1)}:`);
      report.generatedReport.swot_analysis[category].forEach(item => {
        doc.fontSize(11).text(`• ${item}`);
      });
      doc.moveDown();
    });

    doc.fontSize(16).text('Recommendations', { underline: true });
    report.generatedReport.recommendations.forEach(rec => {
      doc.fontSize(13).text(rec.title);
      doc.fontSize(11).text(rec.description);
      doc.text(`Priority: ${rec.priority} | Timeline: ${rec.timeline}`);
      doc.moveDown();
    });

    doc.fontSize(16).text('Conclusion', { underline: true });
    doc.fontSize(11).text(report.generatedReport.conclusion);

    doc.end();

    return new Promise((resolve) => {
      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    });
  }
}

module.exports = new ReportController();
module.exports.upload = upload;