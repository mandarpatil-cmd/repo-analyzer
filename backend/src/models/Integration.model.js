const mongoose = require('mongoose');

const IntegrationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    repoFullName: { type: String, required: true },
    apiKey: { type: String, required: true },
    githubToken: { type: String, required: true },
    active: { type: Boolean, default: true },
    postComments: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    lastTriggeredAt: { type: Date, default: null },
    triggerCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

IntegrationSchema.index({ userId: 1, repoFullName: 1 });
IntegrationSchema.index({ apiKey: 1 });

module.exports = mongoose.model('Integration', IntegrationSchema);
