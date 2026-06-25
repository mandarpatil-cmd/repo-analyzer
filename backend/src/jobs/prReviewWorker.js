const { Worker } = require('bullmq');
const { getRedisConnection } = require('../config/redis');
const PRReview = require('../models/PRReview.model');
const { parsePRUrl, fetchPRMetadata, fetchPRFiles } = require('../services/githubService');
const { generatePRReview } = require('../services/aiService');
const { buildPRFileInputs } = require('../services/prReviewService');
const { Octokit } = require('@octokit/rest');

function buildCommentMarkdown(reviewResult) {
  const findingsRows = (reviewResult.findings || []).map(f => {
    let icon = '🔵';
    if (f.severity === 'critical') icon = '🔴';
    else if (f.severity === 'high') icon = '🟠';
    else if (f.severity === 'medium') icon = '🟡';
    
    return `| ${icon} ${f.severity.charAt(0).toUpperCase() + f.severity.slice(1)} | ${f.file}:${f.line} | ${f.issue} |`;
  }).join('\n');

  const suggestionsList = (reviewResult.suggestions || []).slice(0, 3).map(s => `- ${s}`).join('\n');

  return `## 🤖 EDAI AI PR Review

**Summary:** ${reviewResult.summary || 'PR reviewed by EDAI AI.'}

### Findings

| Severity | File | Issue |
|----------|------|-------|
${findingsRows || '| - | - | No significant issues found. |'}

${suggestionsList ? `### Suggestions\n${suggestionsList}\n` : ''}
---
*Powered by EDAI · [Configure or disable](/integrations)*`;
}

async function postReviewCommentToGitHub(reviewResult, prNumber, repoFullName, githubToken) {
  const [owner, repo] = repoFullName.split('/');
  const octokit = new Octokit({ auth: githubToken });

  const body = buildCommentMarkdown(reviewResult);

  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: prNumber,
    body,
  });
}

const processPRReviewJob = async (job) => {
  const { reviewId, prUrl } = job.data;
  console.log(`\n🔎 [PRReviewWorker] Starting review for: ${prUrl}`);

  const review = await PRReview.findById(reviewId);
  if (!review) throw new Error(`PRReview not found: ${reviewId}`);

  await PRReview.findByIdAndUpdate(reviewId, {
    status: 'processing',
    progress: { step: 'Fetching PR metadata...', percent: 15 },
  });

  try {
    const parsed = parsePRUrl(prUrl);
    const prMetadata = await fetchPRMetadata(prUrl);

    await PRReview.findByIdAndUpdate(reviewId, {
      repoFullName: prMetadata.repoFullName || `${parsed.owner}/${parsed.repo}`,
      pullNumber: prMetadata.number,
      prMetadata,
      progress: { step: 'Fetching PR files...', percent: 35 },
    });

    const files = await fetchPRFiles(prUrl);

    await PRReview.findByIdAndUpdate(reviewId, {
      progress: { step: 'Preparing diffs for AI...', percent: 55 },
    });

    const { filesForAI, summary: filesSummary } = buildPRFileInputs(files);

    const prContext = {
      number: prMetadata.number,
      title: prMetadata.title,
      body: prMetadata.body || '',
      author: prMetadata.user,
      state: prMetadata.state,
      merged: prMetadata.merged,
      baseRef: prMetadata.baseRef,
      headRef: prMetadata.headRef,
      additions: prMetadata.additions,
      deletions: prMetadata.deletions,
      changedFiles: prMetadata.changedFiles,
      url: prMetadata.url,
      repoFullName: prMetadata.repoFullName || `${parsed.owner}/${parsed.repo}`,
      filesIncluded: filesSummary.filesIncluded,
      filesOmitted: filesSummary.filesOmitted,
      filesSkipped: filesSummary.filesSkipped,
      diffTotals: filesSummary.totals,
    };

    await PRReview.findByIdAndUpdate(reviewId, {
      filesSummary,
      progress: { step: 'Generating AI review...', percent: 75 },
    });

    const reviewResult = await generatePRReview(prContext, filesForAI);

    await PRReview.findByIdAndUpdate(reviewId, {
      status: 'completed',
      summary: reviewResult.summary,
      overallRiskScore: reviewResult.overallRiskScore,
      findings: reviewResult.findings,
      reviewedAt: new Date(),
      progress: { step: 'Completed', percent: 100 },
    });

    if (job.data.postComment) {
      console.log(`\n💬 [PRReviewWorker] Posting comment to GitHub...`);
      try {
        await postReviewCommentToGitHub(
          reviewResult,
          job.data.prNumber || prMetadata.number,
          job.data.repoFullName || prMetadata.repoFullName || `${parsed.owner}/${parsed.repo}`,
          job.data.githubToken
        );
      } catch (commentErr) {
        console.error(`❌ [PRReviewWorker] Failed to post comment to GitHub: ${commentErr.message}`);
      }
    }

    console.log(`✅ [PRReviewWorker] Review complete: ${prMetadata.repoFullName}#${prMetadata.number}`);
    return { success: true, reviewId };
  } catch (err) {
    console.error(`❌ [PRReviewWorker] Failed: ${err.message}`);
    await PRReview.findByIdAndUpdate(reviewId, {
      status: 'failed',
      errorMessage: err.message,
      progress: { step: 'Failed', percent: 0 },
    });
    throw err;
  }
};

let _workerInstance = null;

const startPRReviewWorker = () => {
  if (_workerInstance) return _workerInstance;
  const worker = new Worker('pr-review', processPRReviewJob, {
    connection: getRedisConnection(),
    concurrency: 1,
  });

  worker.on('completed', (job) => {
    console.log(`✔️  [PRReviewWorker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`✖️  [PRReviewWorker] Job ${job?.id} failed: ${err.message}`);
  });

  console.log('🔎 PR review worker started');
  _workerInstance = worker;
  return worker;
};

module.exports = { startPRReviewWorker };
