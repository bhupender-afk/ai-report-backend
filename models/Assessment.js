const mongoose = require('mongoose');

const assessmentSchema = new mongoose.Schema({
  requestId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  projectUrl: String,
  projectDomain: String,
  coinId: String,
  parameters: {
    type: Map,
    of: {
      value: String,
      score: Number,
      evidence: String
    }
  },
  categoryScores: {
    team: Number,
    whitepaper_product: Number,
    tokenomics: Number,
    regulations: Number,
    valuation: Number,
    auditing: Number,
    github: Number,
    industry: Number
  },
  totalScore: Number,
  decisionBand: {
    type: String,
    enum: ['Green', 'Yellow', 'Red']
  },
  supplementaryReport: String,
  fraud_flags: {
    scam_mentions: Number,
    severity: String
  },
  sources: [String],
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
    documentFile: String,        // Base64 encoded PDF (TEMPORARY - deleted by n8n after AI processing, should NOT appear here)
    documentFileName: String,
    documentFileSize: Number,
    documentContent: String,     // AI-generated summary from PDF (1-2KB structured JSON)
    documentProcessedAt: Date,   // Timestamp when PDF was processed
    documentProcessingStatus: String,  // 'success' or 'failed'
    additionalContext: String
  },
  createdAt: Date,
  updatedAt: Date
}, {
  strict: false,  // Allow additional fields from n8n
  collection: 'project_assessments'
});

module.exports = mongoose.model('Assessment', assessmentSchema);
