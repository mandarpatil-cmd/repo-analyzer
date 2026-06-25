const { Queue } = require('bullmq');
const { getRedisConnection } = require('../config/redis');
const { startPRReviewWorker } = require('./prReviewWorker');

// Queue for repo analysis jobs
const analysisQueue = new Queue('repo-analysis', {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 3600 }, // keep 1 hour
    removeOnFail: { age: 24 * 3600 }, // keep 1 day for debugging
  },
});

// Queue for embedding generation (Phase 1)
const embeddingQueue = new Queue('embeddings', {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 2,
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 24 * 3600 },
  },
});

// Queue for PR reviews
const prReviewQueue = new Queue('pr-review', {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 24 * 3600 },
  },
});

/**
 * Add an analysis job to the queue
 */
const enqueueAnalysis = async (analysisId, repoUrl, userId, userEmail) => {
  const job = await analysisQueue.add('analyze', {
    analysisId: analysisId.toString(),
    repoUrl,
    userId: userId.toString(),
    userEmail,
  });
  return job.id;
};

let _prReviewWorkerStarted = false;
const ensurePRReviewWorker = () => {
  if (_prReviewWorkerStarted) return;
  startPRReviewWorker();
  _prReviewWorkerStarted = true;
};

/**
 * Add a PR review job to the queue
 */
const enqueuePRReview = async (reviewId, prUrl, userId, userEmail, options = {}) => {
  ensurePRReviewWorker();
  const job = await prReviewQueue.add('review', {
    reviewId: reviewId.toString(),
    prUrl,
    userId: userId.toString(),
    userEmail,
    ...options
  });
  return job.id;
};

module.exports = {
  analysisQueue,
  embeddingQueue,
  prReviewQueue,
  enqueueAnalysis,
  enqueuePRReview,
};