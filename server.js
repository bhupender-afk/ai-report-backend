const path = require('path');

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

const log = (...args) => {
  const message = [`[${new Date().toISOString()}][backend]`, ...args].join(' ');
  console.log(message);
};

const logError = (...args) => {
  const message = [`[${new Date().toISOString()}][backend]`, ...args].join(' ');
  console.error(message);
};

if (!MONGODB_URI) {
  logError('❌ MONGODB_URI is not set. Please define it in backend/.env or project .env');
  process.exit(1);
}

const STATUS_PROGRESS = {
  queued: 25,
  processing: 75,
  done: 100,
  error: 0,
};

const getProgressForStatus = (status) => STATUS_PROGRESS[status] ?? 0;

log('ℹ️ MONGODB_URI configured');
const Submission = require('./models/Submission');
const Assessment = require('./models/Assessment');

const updateSubmissionProgress = async (requestId, status) => {
  const progress = getProgressForStatus(status);
  await Submission.updateOne({ requestId }, {
    $set: {
      progress,
      updatedAt: new Date()
    }
  });
};

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
// Increased limit to 10mb to handle base64-encoded documents (5MB file = ~6.7MB base64)
app.use(express.json({ limit: '10mb' }));

// MongoDB Connection
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  log('✅ MongoDB Connected');

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
          
          // If n8n workflow failed, log it
          if (updatedFields.status === 'error') {
            logError('⚠️ N8N workflow failed for', change.documentKey._id.toString());
            logError('   This usually means: CoinGecko API failed, Extract Coin ID error, or AI credentials missing');
            logError('   Check n8n execution logs for details');
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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Crypto DD API is running',
    timestamp: new Date().toISOString()
  });
});

// POST /api/submit - Submit new crypto project URL
app.post('/api/submit', async (req, res) => {
  try {
    const { url, submittedBy, model, formData } = req.body;

    // Validate URL
    if (!url) {
      return res.status(400).json({
        error: 'URL is required'
      });
    }

    // Basic URL validation
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
    log('📝 Submission saved', requestId, 'model=' + selectedModel, 'formData=' + (hasFormData ? 'yes' : 'no'), 'status=queued');

    // Trigger n8n webhook
    const webhookUrl = process.env.N8N_WEBHOOK_URL || 'https://fissiparous-subintentional-kaidence.ngrok-free.dev/webhook/zuvomo-assessment';
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
      logError('   The submission is saved in DB but workflow was not triggered');
      logError('   Manual trigger may be required');
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

// GET /api/status/:requestId - Get submission status
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

// GET /api/results/:requestId - Get assessment results
app.get('/api/results/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;

    // Check if assessment exists
    const assessment = await Assessment.findOne({ requestId }).lean();

    if (!assessment) {
      // Check if submission exists and is still processing
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

    // Convert Map to Object for JSON serialization
    if (assessment.parameters instanceof Map) {
      assessment.parameters = Object.fromEntries(assessment.parameters);
    }

    log('📄 Returning results', requestId);
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

// GET /api/recent - Get recent assessments (for testing/demo)
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

// GET /api/projects - Get all unique project domains with statistics
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

// GET /api/projects/:domain/history - Get historical assessments for a specific project domain
app.get('/api/projects/:domain/history', async (req, res) => {
  try {
    const { domain } = req.params;
    const { startDate, endDate } = req.query;

    // Build query
    const query = { projectDomain: domain };

    // Add date filters if provided
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
app.listen(PORT, () => {
  log(`🚀 Server running on http://localhost:${PORT}`);
  log(`📊 API endpoints:`);
  log(`   POST   /api/submit`);
  log(`   GET    /api/status/:requestId`);
  log(`   GET    /api/results/:requestId`);
  log(`   GET    /api/recent`);
  log(`   GET    /api/projects`);
  log(`   GET    /api/projects/:domain/history`);
  log(`   GET    /api/health`);
});
