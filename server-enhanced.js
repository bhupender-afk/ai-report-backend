const path = require('path');
const http = require('http');

// Load environment variables from backend/.env or project root .env
const localEnv = require('dotenv').config({ path: path.resolve(__dirname, '.env') });
if (localEnv.error) {
  require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
}

const MONGODB_URI = process.env.MONGODB_URI;
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

// Import services and middleware
const websocketService = require('./services/websocket.service');
const { authMiddleware, optionalAuth } = require('./auth/auth.middleware');

// Import controllers
const authController = require('./auth/auth.controller');
const subscriptionController = require('./controllers/subscription.controller');
const reportController = require('./controllers/report.controller');

// Import models
const Plan = require('./models/Plan');

const log = (...args) => {
  const message = [`[${new Date().toISOString()}][enhanced-backend]`, ...args].join(' ');
  console.log(message);
};

const logError = (...args) => {
  const message = [`[${new Date().toISOString()}][enhanced-backend]`, ...args].join(' ');
  console.error(message);
};

if (!MONGODB_URI) {
  logError('❌ MONGODB_URI is not set. Please define it in backend/.env or project .env');
  process.exit(1);
}

// Import existing models for compatibility
const Submission = require('./models/Submission');
const Assessment = require('./models/Assessment');

const STATUS_PROGRESS = {
  queued: 25,
  processing: 75,
  done: 100,
  error: 0,
};

const getProgressForStatus = (status) => STATUS_PROGRESS[status] ?? 0;

log('ℹ️ MONGODB_URI configured');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5001;

// Initialize WebSocket
websocketService.initialize(server);

// Middleware
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:3002',
    'https://zuvomo.com',
    'https://www.zuvomo.com',
    'http://zuvomo.com',
    'http://www.zuvomo.com'
  ],
  credentials: true
}));

// Increased limit to 10mb to handle base64-encoded documents
app.use(express.json({ limit: '10mb' }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB Connection
mongoose.connect(MONGODB_URI)
.then(async () => {
  log('✅ MongoDB Connected');

  // Initialize default plans if they don't exist
  await initializeDefaultPlans();

  // Existing change stream for compatibility
  try {
    const changeStream = Submission.watch();
    changeStream.on('change', async (change) => {
      if (change.operationType === 'update') {
        const updatedFields = change.updateDescription?.updatedFields || {};
        if (updatedFields.status) {
          log('📈 Change stream status update', change.documentKey._id.toString(), updatedFields.status);
          const progress = getProgressForStatus(updatedFields.status);
          await Submission.updateOne({ _id: change.documentKey._id }, {
            $set: {
              progress,
              updatedAt: new Date()
            }
          });

          if (updatedFields.status === 'error') {
            logError('⚠️ N8N workflow failed for', change.documentKey._id.toString());
          }
        }
      }
    });

    changeStream.on('error', (err) => {
      logError('Change stream error:', err.message);
    });
  } catch (err) {
    log('⚠️ Submission change stream not available:', err.message);
  }
})
.catch(err => logError('❌ MongoDB Connection Error:', err));

// Initialize default plans
async function initializeDefaultPlans() {
  try {
    const existingPlans = await Plan.countDocuments();

    if (existingPlans === 0) {
      const defaultPlans = [
        {
          name: 'single_report',
          displayName: 'Single Report',
          credits: 1,
          price: 499,
          currency: 'INR',
          features: [
            'Comprehensive business analysis',
            'Market research insights',
            'SWOT analysis',
            'Competitor analysis',
            'Email delivery',
            'PDF & JSON export'
          ],
          description: 'Perfect for trying out our platform'
        },
        {
          name: 'basic_plan',
          displayName: '10 Reports Bundle',
          credits: 10,
          price: 3999,
          currency: 'INR',
          features: [
            'All Single Report features',
            '10 comprehensive reports',
            'Priority processing',
            'Extended support'
          ],
          description: 'Great for small businesses'
        },
        {
          name: 'premium_plan',
          displayName: '20 Reports Bundle',
          credits: 20,
          price: 6999,
          currency: 'INR',
          features: [
            'All Basic Plan features',
            '20 comprehensive reports',
            'Fastest processing',
            'Premium support',
            'Custom branding options'
          ],
          description: 'Best value for growing businesses'
        }
      ];

      await Plan.insertMany(defaultPlans);
      log('✅ Default plans initialized');
    }
  } catch (error) {
    logError('❌ Failed to initialize plans:', error.message);
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Enhanced Report Generation API is running',
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

// =============================================================================
// AUTHENTICATION ROUTES
// =============================================================================
app.post('/api/auth/send-otp', authController.sendOTP);
app.post('/api/auth/verify-otp', authController.verifyOTP);
app.post('/api/auth/refresh', authController.refreshToken);
app.get('/api/auth/profile', authMiddleware, authController.getProfile);
app.post('/api/auth/logout', authMiddleware, authController.logout);

// =============================================================================
// SUBSCRIPTION ROUTES
// =============================================================================
app.get('/api/plans', subscriptionController.getPlans);
app.post('/api/subscription/create-order', authMiddleware, subscriptionController.createOrder);
app.post('/api/subscription/verify-payment', authMiddleware, subscriptionController.verifyPayment);
app.get('/api/subscription/history', authMiddleware, subscriptionController.getPurchaseHistory);
app.get('/api/subscription/credits', authMiddleware, subscriptionController.getCredits);

// =============================================================================
// ENHANCED REPORT ROUTES
// =============================================================================
app.post('/api/reports/generate',
  authMiddleware,
  reportController.upload.any(),  // Accept any field names for files
  reportController.generateReport
);

app.get('/api/reports/:reportId', authMiddleware, reportController.getReport);
app.get('/api/reports/status/:requestId', reportController.getReportStatus);
app.get('/api/reports', authMiddleware, reportController.getUserReports);
app.get('/api/reports/:reportId/download', authMiddleware, reportController.downloadReport);

// =============================================================================
// WEBHOOK ROUTES
// =============================================================================
app.post('/api/webhook/razorpay', (req, res) => {
  try {
    // Razorpay webhook handling for payment status updates
    const signature = req.headers['x-razorpay-signature'];

    // Verify webhook signature (implementation depends on requirements)
    log('📧 Razorpay webhook received');

    res.status(200).json({ success: true });
  } catch (error) {
    logError('Webhook error:', error);
    res.status(400).json({ error: 'Webhook processing failed' });
  }
});

// =============================================================================
// EXISTING LEGACY ROUTES (for backward compatibility)
// =============================================================================

// Legacy submission endpoint (kept for compatibility)
app.post('/api/submit', async (req, res) => {
  try {
    const { url, submittedBy, model, formData } = req.body;

    // Validate URL
    if (!url) {
      return res.status(400).json({
        error: 'URL is required'
      });
    }

    try {
      new URL(url);
    } catch (err) {
      return res.status(400).json({
        error: 'Invalid URL format'
      });
    }

    // Validate model
    const validModels = ['sonar', 'sonar-pro', 'sonar-deep-research'];
    const selectedModel = model || 'sonar';
    if (!validModels.includes(selectedModel)) {
      return res.status(400).json({
        error: 'Invalid model. Must be one of: sonar, sonar-pro, sonar-deep-research'
      });
    }

    // Generate unique request ID
    const requestId = uuidv4();

    // Create submission (formData is optional)
    const submission = new Submission({
      requestId,
      url,
      submittedBy: submittedBy || 'anonymous',
      model: selectedModel,
      formData: formData || {},
      status: 'queued',
      progress: getProgressForStatus('queued'),
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await submission.save();
    const hasFormData = formData && Object.keys(formData).length > 0;
    log('📝 Legacy submission saved', requestId, 'model=' + selectedModel, 'formData=' + (hasFormData ? 'yes' : 'no'), 'status=queued');

    // Trigger n8n webhook (if configured)
    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        const fetch = require('node-fetch');
        const webhookPayload = {
          requestId,
          url,
          submittedBy: submittedBy || 'anonymous',
          model: selectedModel,
          formData: formData || {},
          createdAt: submission.createdAt.toISOString()
        };

        log('🔔 Triggering n8n webhook', requestId, hasFormData ? '(with form data)' : '(no form data)');
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(webhookPayload)
        });

        if (!response.ok) {
          throw new Error(`Webhook returned status ${response.status}`);
        }

        log('✅ Webhook triggered successfully', requestId);
      } catch (webhookError) {
        logError('⚠️ Webhook trigger failed:', webhookError.message);
      }
    }

    res.status(201).json({
      success: true,
      requestId,
      status: 'queued',
      progress: getProgressForStatus('queued'),
      model: selectedModel,
      message: 'Submission queued for analysis. Check status with requestId.',
      estimatedTime: '2-5 minutes'
    });

  } catch (error) {
    logError('Submit Error:', error);
    res.status(500).json({
      error: 'Failed to submit request',
      details: error.message
    });
  }
});

// Legacy status endpoint
app.get('/api/status/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;

    const submission = await Submission.findOne({ requestId });

    if (!submission) {
      return res.status(404).json({
        error: 'Request not found',
        requestId
      });
    }

    log('📡 Status request', requestId, '→', submission.status, 'progress=', submission.progress);
    res.json({
      requestId: submission.requestId,
      status: submission.status,
      progress: submission.progress ?? getProgressForStatus(submission.status),
      url: submission.url,
      submittedBy: submission.submittedBy,
      createdAt: submission.createdAt,
      updatedAt: submission.updatedAt
    });

  } catch (error) {
    logError('Status Check Error:', error);
    res.status(500).json({
      error: 'Failed to check status',
      details: error.message
    });
  }
});

// Legacy results endpoint
app.get('/api/results/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;
    console.log('📄 Fetching legacy results for requestId:', requestId);

    const assessment = await Assessment.findOne({  "formData.reportId" : requestId }).lean();
    console.log('🔍 Assessment found:', assessment);

    if (!assessment) {
      const submission = await Submission.findOne({ requestId });

      if (!submission) {
        return res.status(404).json({
          error: 'Request not found',
          requestId
        });
      }

      if (submission.status !== 'done') {
        return res.status(202).json({
          message: 'Analysis not complete yet',
          status: submission.status,
          requestId
        });
      }

      return res.status(404).json({
        error: 'Assessment not found',
        requestId
      });
    }

    if (assessment.parameters instanceof Map) {
      assessment.parameters = Object.fromEntries(assessment.parameters);
    }

    log('📄 Returning legacy results', requestId);
    res.json({
      success: true,
      data: assessment
    });

  } catch (error) {
    logError('Results Fetch Error:', error);
    res.status(500).json({
      error: 'Failed to fetch results',
      details: error.message
    });
  }
});

// Legacy recent assessments
app.get('/api/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const assessments = await Assessment
      .find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('requestId projectUrl coinId totalScore decisionBand createdAt')
      .lean();

    res.json({
      success: true,
      count: assessments.length,
      data: assessments
    });

  } catch (error) {
    logError('Recent Fetch Error:', error);
    res.status(500).json({
      error: 'Failed to fetch recent assessments',
      details: error.message
    });
  }
});

// Legacy projects endpoints
app.get('/api/projects', async (req, res) => {
  try {
    const projects = await Assessment.aggregate([
      {
        $group: {
          _id: '$projectDomain',
          projectUrl: { $first: '$projectUrl' },
          coinId: { $first: '$coinId' },
          totalSubmissions: { $sum: 1 },
          averageScore: { $avg: '$totalScore' },
          latestAssessment: { $max: '$createdAt' },
          latestScore: { $last: '$totalScore' },
          latestDecisionBand: { $last: '$decisionBand' }
        }
      },
      {
        $sort: { totalSubmissions: -1, latestAssessment: -1 }
      },
      {
        $project: {
          _id: 0,
          domain: '$_id',
          projectUrl: 1,
          coinId: 1,
          totalSubmissions: 1,
          averageScore: { $round: ['$averageScore', 2] },
          latestAssessment: 1,
          latestScore: 1,
          latestDecisionBand: 1
        }
      }
    ]);

    log('📊 Projects list requested - found', projects.length, 'unique projects');
    res.json({
      success: true,
      count: projects.length,
      data: projects
    });

  } catch (error) {
    logError('Projects List Error:', error);
    res.status(500).json({
      error: 'Failed to fetch projects',
      details: error.message
    });
  }
});

app.get('/api/projects/:domain/history', async (req, res) => {
  try {
    const { domain } = req.params;
    const { startDate, endDate } = req.query;

    const query = { projectDomain: domain };

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    const assessments = await Assessment
      .find(query)
      .sort({ createdAt: -1 })
      .select('requestId projectUrl coinId totalScore decisionBand categoryScores createdAt')
      .lean();

    if (assessments.length === 0) {
      return res.status(404).json({
        error: 'No assessments found for this project domain',
        domain
      });
    }

    log('📈 Project history requested for', domain, '- found', assessments.length, 'assessments');
    res.json({
      success: true,
      domain,
      count: assessments.length,
      data: assessments
    });

  } catch (error) {
    logError('Project History Error:', error);
    res.status(500).json({
      error: 'Failed to fetch project history',
      details: error.message
    });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
server.listen(PORT, () => {
  log(`🚀 Enhanced server running on http://localhost:${PORT}`);
  log(`📊 API endpoints:`);
  log(`   === AUTHENTICATION ===`);
  log(`   POST   /api/auth/send-otp`);
  log(`   POST   /api/auth/verify-otp`);
  log(`   POST   /api/auth/refresh`);
  log(`   GET    /api/auth/profile`);
  log(`   POST   /api/auth/logout`);
  log(`   === SUBSCRIPTIONS ===`);
  log(`   GET    /api/plans`);
  log(`   POST   /api/subscription/create-order`);
  log(`   POST   /api/subscription/verify-payment`);
  log(`   GET    /api/subscription/history`);
  log(`   GET    /api/subscription/credits`);
  log(`   === REPORTS ===`);
  log(`   POST   /api/reports/generate`);
  log(`   GET    /api/reports/:reportId`);
  log(`   GET    /api/reports/status/:requestId`);
  log(`   GET    /api/reports`);
  log(`   GET    /api/reports/:reportId/download`);
  log(`   === LEGACY COMPATIBILITY ===`);
  log(`   POST   /api/submit`);
  log(`   GET    /api/status/:requestId`);
  log(`   GET    /api/results/:requestId`);
  log(`   GET    /api/recent`);
  log(`   GET    /api/projects`);
  log(`   GET    /api/projects/:domain/history`);
  log(`   === WEBHOOKS ===`);
  log(`   POST   /api/webhook/razorpay`);
  log(`   === HEALTH ===`);
  log(`   GET    /api/health`);
  log(`🔌 WebSocket enabled for real-time updates`);
});