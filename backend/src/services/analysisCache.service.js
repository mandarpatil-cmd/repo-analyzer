const Analysis = require('../models/Analysis.model');

const CACHE_DAYS = parseInt(process.env.ANALYSIS_CACHE_DAYS || '7', 10);

/**
 * Find a cached analysis for this user + repo (if fresh)
 */
const findFreshAnalysis = async (userId, repoFullName) => {
  const cutoff = new Date(Date.now() - CACHE_DAYS * 24 * 60 * 60 * 1000);

  const cached = await Analysis.findOne({
    userId,
    repoFullName,
    status: 'completed',
    analyzedAt: { $gte: cutoff },
  }).sort({ analyzedAt: -1 });

  return cached;
};

/**
 * Find ANY existing analysis (regardless of age) — used for re-analyze
 */
const findAnyAnalysis = async (userId, repoFullName) => {
  return await Analysis.findOne({ userId, repoFullName }).sort({ analyzedAt: -1 });
};

/**
 * Create a new "queued" analysis record
 */
const createPendingAnalysis = async (userId, repoUrl, repoFullName) => {
  return await Analysis.create({
    userId,
    repoUrl,
    repoFullName,
    status: 'queued',
    progress: { step: 'Waiting in queue...', percent: 0 },
  });
};

/**
 * Update progress during job execution
 */
const updateProgress = async (analysisId, step, percent) => {
  await Analysis.findByIdAndUpdate(analysisId, {
    progress: { step, percent },
    status: 'processing',
  });
};

/**
 * Mark analysis as failed
 */
const markFailed = async (analysisId, errorMessage) => {
  await Analysis.findByIdAndUpdate(analysisId, {
    status: 'failed',
    errorMessage,
    progress: { step: 'Failed', percent: 0 },
  });
};

/**
 * Save full analysis result
 */
const saveAnalysisResult = async (analysisId, data) => {
  await Analysis.findByIdAndUpdate(analysisId, {
    ...data,
    status: 'completed',
    analyzedAt: new Date(),
    progress: { step: 'Completed', percent: 100 },
  });
};

module.exports = {
  findFreshAnalysis,
  findAnyAnalysis,
  createPendingAnalysis,
  updateProgress,
  markFailed,
  saveAnalysisResult,
};