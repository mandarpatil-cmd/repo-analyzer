const mongoose = require('mongoose');

const prReviewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    prUrl: {
      type: String,
      required: true,
      index: true,
    },
    repoFullName: {
      type: String,
      required: true,
      index: true,
    },
    pullNumber: {
      type: Number,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['queued', 'processing', 'completed', 'failed'],
      default: 'queued',
      index: true,
    },
    progress: {
      step: { type: String, default: '' },
      percent: { type: Number, default: 0 },
    },
    errorMessage: { type: String, default: null },
    jobId: { type: String, default: null },

    prMetadata: { type: mongoose.Schema.Types.Mixed, default: null },
    filesSummary: { type: mongoose.Schema.Types.Mixed, default: null },

    summary: { type: String, default: '' },
    overallRiskScore: { type: Number, default: 0 },
    findings: { type: mongoose.Schema.Types.Mixed, default: [] },

    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

prReviewSchema.index({ userId: 1, repoFullName: 1, pullNumber: 1 });

module.exports = mongoose.model('PRReview', prReviewSchema);
