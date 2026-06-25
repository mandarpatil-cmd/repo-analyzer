/**
 * embeddingWorker.js
 *
 * Listens to the 'embeddings' BullMQ queue.
 * When a repo analysis completes, this worker:
 *   1. Loads the analysis from MongoDB
 *   2. Chunks all parsed files into semantic pieces
 *   3. Generates embeddings for each chunk
 *   4. Stores chunks in the Chunk collection
 *   5. Updates Analysis.embeddingsStatus → 'ready'
 *
 * This runs AFTER analysisWorker completes (it queues embeddingQueue.add('generate', { analysisId }))
 */

const { Worker } = require('bullmq');
const { getRedisConnection } = require('../config/redis');
const Analysis = require('../models/Analysis.model');
const { chunkAnalysis, storeChunks } = require('../services/ragService');

/**
 * Process one embedding job
 */
const processEmbeddingJob = async (job) => {
  const { analysisId } = job.data;
  console.log(`\n🧩 [EmbeddingWorker] Starting embeddings for analysis: ${analysisId}`);

  // 1. Load analysis
  const analysis = await Analysis.findById(analysisId);
  if (!analysis) {
    throw new Error(`Analysis not found: ${analysisId}`);
  }

  if (!analysis.parsedFiles || analysis.parsedFiles.length === 0) {
    console.warn(`⚠️  [EmbeddingWorker] No parsed files found for ${analysisId}`);
    await Analysis.findByIdAndUpdate(analysisId, { embeddingsStatus: 'failed' });
    return;
  }

  // 2. Mark as in-progress
  await Analysis.findByIdAndUpdate(analysisId, {
    embeddingsStatus: 'pending',
  });

  try {
    // 3. Chunk the analysis
    console.log(`📦 [EmbeddingWorker] Chunking ${analysis.parsedFiles.length} files...`);
    const rawChunks = chunkAnalysis(analysis);

    // 4. Generate embeddings + store in MongoDB
    console.log(`🔢 [EmbeddingWorker] Generating embeddings for ${rawChunks.length} chunks...`);
    const storedCount = await storeChunks(analysisId, rawChunks);

    // 5. Mark ready on Analysis document
    await Analysis.findByIdAndUpdate(analysisId, {
      embeddingsStatus: 'ready',
      chunkCount: storedCount,
    });

    console.log(`✅ [EmbeddingWorker] Done! ${storedCount} chunks stored for ${analysis.repoFullName}`);
    return { success: true, chunkCount: storedCount };

  } catch (err) {
    console.error(`❌ [EmbeddingWorker] Failed: ${err.message}`);

    await Analysis.findByIdAndUpdate(analysisId, {
      embeddingsStatus: 'failed',
    });

    throw err;
  }
};

/**
 * Boot the embedding worker
 */
const startEmbeddingWorker = () => {
  const worker = new Worker('embeddings', processEmbeddingJob, {
    connection: getRedisConnection(),
    concurrency: 1, // embeddings are CPU-heavy, run one at a time
  });

  worker.on('completed', (job) => {
    console.log(`✔️  [EmbeddingWorker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`✖️  [EmbeddingWorker] Job ${job?.id} failed: ${err.message}`);
  });

  console.log('🧩 Embedding worker started');
  return worker;
};

module.exports = { startEmbeddingWorker };