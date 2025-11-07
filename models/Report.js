const { string } = require('joi');
const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  requestId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  organization: {
    type: String,
    required: true
  },
  industry: [{
    type: String
  }],
  documents: [{
    type: {
      type: String,
      enum: ['doc', 'png', 'excel', 'pdf','jpg', 'jpeg']
    },
    url: String,
    originalName: String,
    uploadDate: Date,
    size: Number
  }],
  websiteUrl: {
    type: String,
    required: true
  },
  role: {
    type: String
  },
  heardFrom: {
    type: String
  },
  competitors: [{
    type: String
  }],
  usp: {
    type: String
  },
  teamSize: {
    type: String,
    min: 0
  },
  partners: [{
    type: String
  }],
  generatedReport: {
    executive_summary: String,
    market_analysis: {
      market_size: String,
      growth_rate: String,
      key_trends: [String],
      opportunities: [String],
      threats: [String]
    },
    competitive_analysis: {
      main_competitors: [{
        name: String,
        strengths: [String],
        weaknesses: [String],
        market_share: String
      }],
      competitive_advantage: String,
      positioning: String
    },
    swot_analysis: {
      strengths: [String],
      weaknesses: [String],
      opportunities: [String],
      threats: [String]
    },
    recommendations: [{
      title: String,
      description: String,
      priority: String,
      timeline: String
    }],
    financial_projections: {
      revenue_forecast: String,
      growth_metrics: String,
      investment_needed: String
    },
    risk_assessment: [{
      risk: String,
      impact: String,
      likelihood: String,
      mitigation: String
    }],
    conclusion: String
  },
  status: {
    type: String,
    enum: ['queued', 'processing', 'completed', 'failed', 'delivered'],
    default: 'queued'
  },
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  emailSent: {
    type: Boolean,
    default: false
  },
  emailSentAt: {
    type: Date
  },
  downloadCount: {
    type: Number,
    default: 0
  },
  lastDownloadAt: {
    type: Date
  },
  exportFormats: {
    pdf: {
      generated: Boolean,
      url: String,
      generatedAt: Date
    },
    json: {
      available: Boolean
    }
  },
  error: {
    message: String,
    occurredAt: Date
  },
  webhookTriggered: {
    type: Boolean,
    default: false
  },
  webhookResponse: {
    type: mongoose.Schema.Types.Mixed
  },
  processingTime: {
    type: Number,
    default: 0
  },
  creditsUsed: {
    type: Number,
    default: 1
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

reportSchema.index({ userId: 1, createdAt: -1 });
reportSchema.index({ status: 1 });

reportSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Report', reportSchema);