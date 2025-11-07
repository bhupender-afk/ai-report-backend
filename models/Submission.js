const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  requestId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  url: {
    type: String,
    required: true
  },
  submittedBy: {
    type: String,
    default: 'anonymous'
  },
  model: {
    type: String,
    enum: ['sonar', 'sonar-pro', 'sonar-deep-research'],
    default: 'sonar'
  },
  status: {
    type: String,
    enum: ['queued', 'processing', 'done', 'error'],
    default: 'queued',
    index: true
  },
  progress: {
    type: Number,
    default: 0
  },
  formData: {
    teamInfo: String,
    vcBacking: String,
    fundingStage: String,
    valuation: Number,
    vestingMonths: Number,
    tokenUtility: String,
    burnMechanism: String,
    auditStatus: String,
    auditProvider: String,
    legalEntity: String,
    whitepaperUrl: String,
    githubUrl: String,
    documentType: String,
    documentFile: String,        // Base64 encoded PDF (TEMPORARY - deleted by n8n after AI processing)
    documentFileName: String,
    documentFileSize: Number,
    documentContent: String,     // AI-generated summary from PDF (1-2KB, populated by n8n)
    documentProcessedAt: Date,   // Timestamp when PDF was processed
    documentProcessingStatus: String,  // 'success' or 'failed'
    additionalContext: String
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

module.exports = mongoose.model('Submission', submissionSchema, 'incoming_requests');
