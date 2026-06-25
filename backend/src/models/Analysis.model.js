const mongoose = require('mongoose');

const analysisSchema = new mongoose.Schema(
  {
    // ─── Ownership ────────────────────────────────────────────
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    repoUrl: {
      type: String,
      required: true,
      index: true,
    },
    repoFullName: {
      type: String,
      required: true,
      index: true, // e.g. "facebook/react"
    },

    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      default: null,
    },

    // ─── Job Status ───────────────────────────────────────────
    status: {
      type: String,
      enum: ['queued', 'processing', 'completed', 'failed'],
      default: 'queued',
      index: true,
    },
    progress: {
      step: { type: String, default: '' }, // e.g. "Parsing files..."
      percent: { type: Number, default: 0 },
    },
    errorMessage: { type: String, default: null },
    jobId: { type: String, default: null }, // BullMQ job id

    // ─── Core Analysis Data ───────────────────────────────────
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },
    commitActivity: { type: mongoose.Schema.Types.Mixed, default: null },
    commits: { type: mongoose.Schema.Types.Mixed, default: [] },
    parsedFiles: { type: mongoose.Schema.Types.Mixed, default: [] },
    dependencyMap: { type: mongoose.Schema.Types.Mixed, default: {} },
    functionIndex: { type: mongoose.Schema.Types.Mixed, default: [] },
    summary: { type: mongoose.Schema.Types.Mixed, default: null },

    // ─── AI Insights (cached) ─────────────────────────────────
    aiInsights: {
      repoSummary: { type: mongoose.Schema.Types.Mixed, default: null },
      fileInsights: { type: mongoose.Schema.Types.Mixed, default: [] },
      commitInsights: { type: mongoose.Schema.Types.Mixed, default: [] },
      generatedAt: { type: Date, default: null },
    },

    securityReport: {
      score: { type: Number, default: null },
      scannedAt: { type: Date, default: null },
      status: {
        type: String,
        enum: ['pending', 'running', 'completed', 'failed'],
        default: 'pending',
      },
      summary: {
        critical: { type: Number, default: 0 },
        high: { type: Number, default: 0 },
        medium: { type: Number, default: 0 },
        low: { type: Number, default: 0 },
      },
      findings: [
        {
          id: { type: String },
          severity: { type: String, enum: ['critical', 'high', 'medium', 'low'] },
          category: { type: String },
          title: { type: String },
          description: { type: String },
          file: { type: String },
          line: { type: Number },
          snippet: { type: String },
          cwe: { type: String },
          remediation: { type: String },
        },
      ],
      dependencyAudit: {
        raw: { type: String },
        vulnerableCount: { type: Number, default: 0 },
        packages: [
          {
            name: String,
            severity: String,
            via: [String],
            fixAvailable: Boolean,
          },
        ],
      },
    },

    // ─── RAG / Chat Support (Phase 1) ─────────────────────────
    embeddingsStatus: {
      type: String,
      enum: ['none', 'pending', 'ready', 'failed'],
      default: 'none',
    },
    chunkCount: { type: Number, default: 0 },

    // ─── Shareable links for read-only public views
    shareLinks: { type: mongoose.Schema.Types.Mixed, default: [] },

    // ─── Cache Control ────────────────────────────────────────
    analyzedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null }, // for auto cleanup later
  },
  { timestamps: true }
);

// Compound index for fast lookup
analysisSchema.index({ userId: 1, repoFullName: 1 });
analysisSchema.index({ repoFullName: 1, status: 1 });

module.exports = mongoose.model('Analysis', analysisSchema);