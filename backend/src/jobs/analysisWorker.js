const { Worker } = require('bullmq');
const { getRedisConnection } = require('../config/redis');

const { fetchRepoMetadata, fetchCommitActivity } = require('../services/githubService');
const { cloneRepository, extractCommitHistory, getAllCodeFiles } = require('../services/gitService');
const { parseRepository } = require('../services/parserService');
const { buildKnowledgeGraph } = require('../services/graphService');
const { generateSecurityReport } = require('../services/securityService');
const Analysis = require('../models/Analysis.model');
const {
  updateProgress,
  markFailed,
  saveAnalysisResult,
} = require('../services/analysisCache.service');

const { embeddingQueue } = require('./queue');

const processAnalysisJob = async (job) => {
  const { analysisId, repoUrl, userEmail } = job.data;
  console.log(`\n🔍 [Worker] Starting analysis for: ${repoUrl}`);
  console.log(`👤 [Worker] User: ${userEmail}`);

  try {
    // Step 1: GitHub metadata
    await updateProgress(analysisId, 'Fetching GitHub metadata...', 10);
    const [metadata, commitActivity] = await Promise.all([
      fetchRepoMetadata(repoUrl),
      fetchCommitActivity(repoUrl),
    ]);

    // Step 2: Clone
    await updateProgress(analysisId, 'Cloning repository...', 25);
    const repoDir = await cloneRepository(metadata.cloneUrl);

    // Step 3: Commits + files
    await updateProgress(analysisId, 'Extracting commits & files...', 45);
    const [commits, codeFiles] = await Promise.all([
      extractCommitHistory(repoDir),
      getAllCodeFiles(repoDir),
    ]);

    // Step 4: Parse
    await updateProgress(analysisId, 'Parsing code with Tree-Sitter...', 65);
    const { parsedFiles, stats: parseStats } = await parseRepository(codeFiles);

    // Step 5: Knowledge graph
    await updateProgress(analysisId, 'Building knowledge graph...', 85);
    try {
      await buildKnowledgeGraph(metadata, parsedFiles, commits, metadata.contributors);
    } catch (err) {
      console.warn(`⚠️ [Worker] Skipping Neo4j knowledge graph (connection failed): ${err.message}`);
    }

    // Build maps & index
    const dependencyMap = {};
    for (const file of parsedFiles) {
      dependencyMap[file.relativePath] = {
        imports: file.imports.map((i) => i.path),
        dependencies: file.dependencies.map((d) => d.path),
      };
    }

    const functionIndex = parsedFiles.flatMap((file) =>
      file.functions.map((fn) => ({
        file: file.relativePath,
        language: file.language,
        name: fn.name,
        params: fn.params,
        startLine: fn.startLine,
        endLine: fn.endLine,
        lineCount: fn.lineCount,
        bodySnippet: fn.bodySnippet,
      }))
    );

    // Save to MongoDB
    await updateProgress(analysisId, 'Saving results...', 95);
    await saveAnalysisResult(analysisId, {
      metadata,
      commitActivity,
      commits: commits.slice(0, 200),
      parsedFiles: parsedFiles.map((f) => ({
        relativePath: f.relativePath,
        fileName: f.fileName,
        language: f.language,
        totalLines: f.totalLines,
        functionCount: f.functionCount,
        classCount: f.classCount,
        dependencyCount: f.dependencyCount,
        functions: f.functions,
        classes: f.classes,
        imports: f.imports,
        dependencies: f.dependencies,
      })),
      dependencyMap,
      functionIndex,
      summary: {
        repoName: metadata.name,
        totalCommits: commits.length,
        totalFiles: codeFiles.length,
        parsedFiles: parseStats.parsedFiles,
        totalFunctions: parseStats.totalFunctions,
        totalClasses: parseStats.totalClasses,
        totalImports: parseStats.totalImports,
        languageBreakdown: parseStats.byLanguage,
        ...metadata.stats,
      },
      embeddingsStatus: 'pending',
    });

    // Run security scan after analysis is saved
    const analysis = await Analysis.findById(analysisId);
    if (analysis) {
      analysis.securityReport.status = 'running';
      await analysis.save();

      try {
        const report = await generateSecurityReport(repoDir, codeFiles);
        analysis.securityReport.score = report.score;
        analysis.securityReport.summary = report.summary || { critical: 0, high: 0, medium: 0, low: 0 };
        analysis.securityReport.findings = report.findings || [];
        analysis.securityReport.dependencyAudit = report.dependencyAudit || { raw: '', vulnerableCount: 0, packages: [] };
        analysis.securityReport.status = 'completed';
        analysis.securityReport.scannedAt = new Date();
      } catch (err) {
        analysis.securityReport.status = 'failed';
        console.error(`❌ [Worker] Security scan failed: ${err.message}`);
      }

      await analysis.save();
    }


    // Queue embeddings generation (Phase 1)
    await embeddingQueue.add('generate', { analysisId });

    console.log(`✅ [Worker] Analysis complete: ${metadata.fullName}`);
    return { success: true, analysisId };
  } catch (err) {
    console.error(`❌ [Worker] Analysis failed: ${err.message}`);
    await markFailed(analysisId, err.message);
    throw err;
  }
};

// Boot the worker
const startAnalysisWorker = () => {
  const worker = new Worker('repo-analysis', processAnalysisJob, {
    connection: getRedisConnection(),
    concurrency: 2, // process 2 jobs in parallel
  });

  worker.on('completed', (job) => {
    console.log(`✔️  [Worker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`✖️  [Worker] Job ${job?.id} failed: ${err.message}`);
  });

  console.log('🛠️  Analysis worker started');
  return worker;
};

module.exports = { startAnalysisWorker };