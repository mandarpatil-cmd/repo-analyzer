

const {
  fetchRepoMetadata,
  fetchCommitActivity,
  fetchCodeFrequency,
  parseRepoUrl,
  parsePRUrl,
  fetchPullRequestDetails,
} = require('../services/githubService');
const {
  explainFunction,
  explainFile,
  generateRepoSummary,
  explainCommit,
  reviewPullRequest,
} = require('../services/aiService');
const Analysis = require('../models/Analysis.model');
const PRReview = require('../models/PRReview.model');
const User = require('../models/User.model');
const {
  findFreshAnalysis,
  createPendingAnalysis,
} = require('../services/analysisCache.service');
const { enqueueAnalysis, enqueuePRReview } = require('../jobs/queue');
const { generateSecurityReport } = require('../services/securityService');
const { getCloneDir, getAllCodeFiles, cloneRepository } = require('../services/gitService');

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ─── Full HTML renderer used by export and public share ───────────────────────
function renderFullInsightsHtml(analysis) {
  const escapeHtml = (unsafe) => {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const insights = analysis.aiInsights || {};
  const summary = insights.repoSummary || {};
  const files = insights.fileInsights || [];
  const commits = insights.commitInsights || [];

  const repoSummaryHtml = Object.keys(summary).map((k) => `
    <h4 style="margin-bottom:6px">${escapeHtml(k)}</h4>
    <p style="margin-top:0;margin-bottom:12px">${escapeHtml(summary[k])}</p>
  `).join('');

  const filesHtml = files.map((f) => {
    const fi = f.fileInsight || {};
    const funcs = f.functionInsights || [];
    return `
      <section style="margin-bottom:18px">
        <h3>${escapeHtml(f.fileName)} <small style="color:#666">(${escapeHtml(f.language || '')})</small></h3>
        <p><strong>Lines:</strong> ${escapeHtml(f.totalLines)} • <strong>Functions:</strong> ${escapeHtml(f.functionCount)}</p>
        <div style="padding:8px;background:#f8fafc;border-radius:6px;margin-top:8px">
          <h4>File Insight</h4>
          <p><strong>Role:</strong> ${escapeHtml(fi.role || '')}</p>
          <p><strong>Layer:</strong> ${escapeHtml(fi.layer || '')}</p>
          <p><strong>Who should edit:</strong> ${escapeHtml(fi.whoShouldEdit || '')}</p>
          <p><strong>Dependencies:</strong> ${escapeHtml(fi.dependencies || '')}</p>
          ${Array.isArray(fi.keyResponsibilities) && fi.keyResponsibilities.length>0 ? `<ul>${fi.keyResponsibilities.map(r=>`<li>${escapeHtml(r)}</li>`).join('')}</ul>` : ''}
          <p style="color:#7c3aed"><strong>Warning:</strong> ${escapeHtml(fi.newEmployeeWarning || '')}</p>
        </div>
        <div style="margin-top:10px">
          <h4>Functions</h4>
          ${funcs.map(fn=>`
            <div style="padding:10px;border:1px solid #eee;border-radius:6px;margin-bottom:8px">
              <h5>${escapeHtml(fn.name || 'anonymous')} <small style="color:#666">Lines ${escapeHtml(fn.startLine)}–${escapeHtml(fn.endLine)}</small></h5>
              <p><strong>Params:</strong> ${escapeHtml((fn.params||[]).join(', '))}</p>
              <div style="background:#fff;padding:8px;border-radius:4px;margin-top:6px">
                <p><strong>Summary:</strong></p>
                <p>${escapeHtml(fn.insight?.summary || '')}</p>
                <p><strong>Purpose:</strong></p>
                <p>${escapeHtml(fn.insight?.purpose || '')}</p>
                <p><strong>How it works:</strong></p>
                <p>${escapeHtml(fn.insight?.howItWorks || '')}</p>
                <p><strong>Inputs:</strong> ${escapeHtml(fn.insight?.inputs || '')}</p>
                <p><strong>Outputs:</strong> ${escapeHtml(fn.insight?.outputs || '')}</p>
                <p><strong>Dev Tip:</strong> ${escapeHtml(fn.insight?.newEmployeeTip || '')}</p>
              </div>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }).join('');

  const commitsHtml = commits.map((c) => `
    <li style="margin-bottom:10px">
      <strong>${escapeHtml(c.sha?.slice(0,7) || c.shortHash || '')}</strong> — ${escapeHtml(c.message || '')}
      <div style="margin-top:6px;padding:8px;background:#f3f4f6;border-radius:6px">
        <p><strong>Author:</strong> ${escapeHtml(c.author || c.authorName || '')} • <strong>Date:</strong> ${escapeHtml(c.date || c.timestamp || '')}</p>
        <p><strong>Files changed:</strong> ${escapeHtml((c.filesChanged||[]).join(', '))}</p>
        <p><strong>What changed:</strong></p>
        <p>${escapeHtml(c.insight?.whatChanged || '')}</p>
        <p><strong>Why it matters:</strong></p>
        <p>${escapeHtml(c.insight?.whyItMatters || '')}</p>
        <p><strong>Impact:</strong></p>
        <p>${escapeHtml(c.insight?.impact || '')}</p>
      </div>
    </li>
  `).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><title>Onboarding: ${escapeHtml(analysis.repoFullName)}</title>
    <style>body{font-family:Inter,Arial,Helvetica,sans-serif;color:#111;padding:28px;line-height:1.45}h1{color:#111;margin-bottom:6px}h2{color:#111;margin-top:22px}h3{margin-top:16px}pre{background:#f4f4f6;padding:8px;border-radius:6px}</style>
    </head><body>
    <h1>Onboarding — ${escapeHtml(analysis.repoFullName)}</h1>
    <p><em>Generated: ${escapeHtml(new Date().toLocaleString())}</em></p>
    <h2>Repository Summary</h2>
    ${repoSummaryHtml}

    <h2>Files (${files.length})</h2>
    ${filesHtml}

    <h2>Recent Commits (${commits.length})</h2>
    <ul style="list-style:disc;margin-left:18px">${commitsHtml}</ul>

    <footer style="margin-top:28px;color:#666"><small>Exported from EDAI</small></footer>
    </body></html>`;
}

// ─── Get Metadata (unchanged) ─────────────────────────────────────────────────
exports.getMetadata = async (req, res) => {
  try {
    const { repoUrl } = req.body;
    if (!repoUrl) return res.status(400).json({ message: 'repoUrl is required' });

    const [metadata, commitActivity, codeFrequency] = await Promise.all([
      fetchRepoMetadata(repoUrl),
      fetchCommitActivity(repoUrl),
      fetchCodeFrequency(repoUrl),
    ]);

    res.status(200).json({
      success: true,
      data: { ...metadata, commitActivity, codeFrequency },
    });
  } catch (err) {
    console.error('Metadata error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Analyze: Now async + cached ──────────────────────────────────────────────
exports.analyzeRepo = async (req, res) => {
  try {
    const { repoUrl, forceRefresh = false } = req.body;
    if (!repoUrl) return res.status(400).json({ message: 'repoUrl is required' });

    const { owner, repo } = parseRepoUrl(repoUrl);
    const repoFullName = `${owner}/${repo}`;
    const userId = req.user.id;

    // 1️⃣ Check cache first
    if (!forceRefresh) {
      const cached = await findFreshAnalysis(userId, repoFullName);
      if (cached) {
        console.log(`💾 Cache HIT for ${repoFullName}`);
        return res.status(200).json({
          success: true,
          cached: true,
          analysisId: cached._id,
          status: cached.status,
          data: cached,
        });
      }
    }

    // 2️⃣ Create pending analysis record
    const analysis = await createPendingAnalysis(userId, repoUrl, repoFullName);

    // 3️⃣ Queue background job
    const jobId = await enqueueAnalysis(analysis._id, repoUrl, userId, req.user.email);
    analysis.jobId = jobId;
    await analysis.save();

    // 4️⃣ Save to user's repo list (avoid duplicates)
    await User.updateOne(
      { _id: userId, 'savedRepos.repoFullName': { $ne: repoFullName } },
      {
        $push: {
          savedRepos: {
            repoUrl,
            repoFullName,
            analysisId: analysis._id,
            analyzedAt: new Date(),
          },
        },
      }
    );

    // 5️⃣ Return immediately — frontend will poll
    res.status(202).json({
      success: true,
      cached: false,
      analysisId: analysis._id,
      status: 'queued',
      message: 'Analysis started. Poll /api/repo/status/:analysisId for progress.',
    });
  } catch (err) {
    console.error('Analyze error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── NEW: Get analysis status (for polling) ───────────────────────────────────
exports.getAnalysisStatus = async (req, res) => {
  try {
    const { analysisId } = req.params;
    const analysis = await Analysis.findById(analysisId);

    if (!analysis) {
      return res.status(404).json({ success: false, message: 'Analysis not found' });
    }

    if (analysis.userId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    res.status(200).json({
      success: true,
      status: analysis.status,
      progress: analysis.progress,
      errorMessage: analysis.errorMessage,
      embeddingsStatus: analysis.embeddingsStatus,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── NEW: Get complete analysis result ────────────────────────────────────────
exports.getAnalysisResult = async (req, res) => {
  try {
    const { analysisId } = req.params;
    const analysis = await Analysis.findById(analysisId);

    if (!analysis) {
      return res.status(404).json({ success: false, message: 'Analysis not found' });
    }

    if (analysis.userId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    if (analysis.status !== 'completed') {
      return res.status(202).json({
        success: false,
        status: analysis.status,
        progress: analysis.progress,
        message: 'Analysis not yet complete',
      });
    }

    res.status(200).json({ success: true, data: analysis });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── NEW: Get security report ───────────────────────────────────────────────
exports.getSecurityReport = async (req, res) => {
  try {
    const { analysisId } = req.params;
    const analysis = await Analysis.findById(analysisId).select('userId securityReport');

    if (!analysis) {
      return res.status(404).json({ success: false, message: 'Analysis not found' });
    }

    if (analysis.userId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    if (!analysis.securityReport || analysis.securityReport.status === 'pending') {
      return res.status(200).json({ success: true, status: 'pending' });
    }

    res.status(200).json({ success: true, report: analysis.securityReport });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── NEW: Trigger security rescan ───────────────────────────────────────────
exports.triggerSecurityRescan = async (req, res) => {
  try {
    const { analysisId } = req.params;
    const analysis = await Analysis.findById(analysisId);

    if (!analysis) {
      return res.status(404).json({ success: false, message: 'Analysis not found' });
    }

    if (analysis.userId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    if (!analysis.securityReport) analysis.securityReport = {};
    analysis.securityReport.status = 'running';
    await analysis.save();

    setImmediate(async () => {
      try {
        const repoRoot = getCloneDir(analysis.repoUrl);
        const fse = require('fs-extra');
        let exists = await fse.pathExists(repoRoot);
        if (!exists) {
          console.log(`⚠️ Repo not found in cache for rescan. Re-cloning ${analysis.repoUrl}...`);
          await cloneRepository(analysis.repoUrl);
          exists = await fse.pathExists(repoRoot);
          if (!exists) throw new Error('Failed to re-clone repository for security scan');
        }

        const codeFiles = await getAllCodeFiles(repoRoot);
        const report = await generateSecurityReport(repoRoot, codeFiles);
        analysis.securityReport = {
          ...report,
          status: 'completed',
          scannedAt: new Date(),
        };
      } catch (err) {
        console.error('Security rescan failed:', err.message);
        if (!analysis.securityReport) analysis.securityReport = {};
        analysis.securityReport.status = 'failed';
      }

      await analysis.save();
    });

    res.status(202).json({ success: true, message: 'Security scan started' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── NEW: List user's analyses ───────────────────────────────────────────────
exports.listMyAnalyses = async (req, res) => {
  try {
    const analyses = await Analysis.find({ userId: req.user.id })
      .select('repoUrl repoFullName status analyzedAt summary.repoName metadata.stars metadata.primaryLanguage')
      .sort({ analyzedAt: -1 })
      .limit(50);

    res.status(200).json({ success: true, analyses });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── AI Insights (now cached in Analysis doc) ─────────────────────────────────
exports.generateAIInsights = async (req, res) => {
  try {
    const { analysisId } = req.body;
    if (!analysisId) {
      return res.status(400).json({ success: false, message: 'analysisId is required' });
    }

    const analysis = await Analysis.findById(analysisId);
    if (!analysis) return res.status(404).json({ success: false, message: 'Analysis not found' });
    if (analysis.userId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    // Return cached if exists
    if (analysis.aiInsights && analysis.aiInsights.repoSummary) {
      console.log(`💾 AI Insights cache HIT for ${analysis.repoFullName}`);
      return res.status(200).json({ success: true, cached: true, insights: analysis.aiInsights });
    }

    console.log(`\n🤖 Generating AI Insights for: ${analysis.repoFullName}`);

    const { parsedFiles, commits, summary } = analysis;
    const repoName = analysis.repoFullName;
    // languageBreakdown comes from parser stats (object), not metadata (array)
const languageBreakdown = summary?.languageBreakdown || {};

    const results = { repoSummary: null, fileInsights: [], commitInsights: [] };

    // Repo summary
    const allFileNames = parsedFiles.map((f) => f.relativePath || f.fileName);
    const totalFunctions = parsedFiles.reduce((s, f) => s + (f.functionCount || 0), 0);
    results.repoSummary = await generateRepoSummary(repoName, allFileNames, languageBreakdown, totalFunctions);
    await sleep(500);

    // File + function insights
    const filesToAnalyze = parsedFiles.slice(0, 15);
    for (const file of filesToAnalyze) {
      const fileName = file.relativePath || file.fileName;
      const funcNames = (file.functions || []).map((fn) => fn.name);
      const fileCodeSample = (file.functions || [])
        .map((fn) => `// ${fn.name}\n${fn.bodySnippet || ''}`)
        .join('\n\n').slice(0, 2000);

      const fileInsight = await explainFile(fileName, fileCodeSample, funcNames);
      await sleep(400);

      const functionInsights = [];
      for (const fn of (file.functions || []).slice(0, 5)) {
        const code = fn.bodySnippet || `function ${fn.name}(${(fn.params || []).join(', ')}) {}`;
        const insight = await explainFunction(fn.name, code, fileName);
        functionInsights.push({
          name: fn.name, startLine: fn.startLine, endLine: fn.endLine,
          lineCount: fn.lineCount, params: fn.params, insight,
        });
        await sleep(400);
      }

      results.fileInsights.push({
        fileName, language: file.language, totalLines: file.totalLines,
        functionCount: file.functionCount, fileInsight, functionInsights,
      });
      await sleep(600);
    }

    // Commit insights
    if (commits && commits.length > 0) {
      for (const commit of commits.slice(0, 10)) {
        const insight = await explainCommit(
          commit.message || 'No message',
          commit.hash || commit.shortHash,
          commit.filesChanged || []
        );
        results.commitInsights.push({
          sha: commit.hash || commit.shortHash,
          message: commit.message,
          author: commit.authorName,
          date: commit.timestamp,
          insight,
        });
        await sleep(400);
      }
    }

    // Cache in DB
    analysis.aiInsights = { ...results, generatedAt: new Date() };
    await analysis.save();

    console.log(`✅ AI Insights complete for: ${repoName}`);
    res.status(200).json({ success: true, cached: false, insights: results });
  } catch (err) {
    console.error('AI Insights error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Single function/file explain (unchanged) ────────────────────────────────
exports.explainSingleFunction = async (req, res) => {
  try {
    const { funcName, code, fileName } = req.body;
    if (!funcName || !code) {
      return res.status(400).json({ success: false, message: 'funcName and code are required' });
    }
    const insight = await explainFunction(funcName, code, fileName || 'unknown');
    res.status(200).json({ success: true, insight });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.explainSingleFile = async (req, res) => {
  try {
    const { fileName, code, functionNames } = req.body;
    if (!fileName) {
      return res.status(400).json({ success: false, message: 'fileName is required' });
    }
    const insight = await explainFile(fileName, code || '', functionNames || []);
    res.status(200).json({ success: true, insight });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Export analysis to PDF (authenticated) ─────────────────────────────────
exports.exportAnalysisPdf = async (req, res) => {
  try {
    const { analysisId } = req.body;
    if (!analysisId) return res.status(400).json({ success: false, message: 'analysisId is required' });

    const analysis = await Analysis.findById(analysisId).lean();
    if (!analysis) return res.status(404).json({ success: false, message: 'Analysis not found' });
    if (analysis.userId.toString() !== req.user.id) return res.status(403).json({ success: false, message: 'Forbidden' });

    // Lazy require to avoid startup penalty
    const path = require('path');
    const fs = require('fs-extra');
    const puppeteer = require('puppeteer');
    const exportsDir = path.join(__dirname, '..', '..', 'temp', 'exports');
    await fs.ensureDir(exportsDir);

    const html = renderFullInsightsHtml(analysis);
    const filename = `${analysisId}-${Date.now()}.pdf`;
    const outPath = path.join(exportsDir, filename);

    const os = require('os');
    const defaultWinPath = path.join(os.homedir(), '.cache', 'puppeteer', 'chrome', 'win64-121.0.6167.85', 'chrome-win64', 'chrome.exe');
    const launchOptions = { args: ['--no-sandbox', '--disable-setuid-sandbox'] };
    if (fs.existsSync(defaultWinPath)) {
      launchOptions.executablePath = defaultWinPath;
    }

    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.pdf({ path: outPath, format: 'A4', printBackground: true });
    await browser.close();

    const host = process.env.BACKEND_URL || `http://localhost:${process.env.PORT||5000}`;
    const url = `${host}/exports/${filename}`;
    res.status(200).json({ success: true, url });
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Create a shareable read-only link for an analysis (authenticated)
exports.createShareLink = async (req, res) => {
  try {
    const { analysisId, expiresDays = 7 } = req.body;
    if (!analysisId) return res.status(400).json({ success: false, message: 'analysisId is required' });

    const analysis = await Analysis.findById(analysisId);
    if (!analysis) return res.status(404).json({ success: false, message: 'Analysis not found' });
    if (analysis.userId.toString() !== req.user.id) return res.status(403).json({ success: false, message: 'Forbidden' });

    const { nanoid } = require('nanoid');
    const token = nanoid(12);
    const expiresAt = new Date(Date.now() + (parseInt(expiresDays, 10) || 7) * 24 * 60 * 60 * 1000);

    const link = { token, createdAt: new Date(), expiresAt, createdBy: req.user.id };
    analysis.shareLinks = analysis.shareLinks || [];
    analysis.shareLinks.push(link);
    await analysis.save();

    const host = process.env.BACKEND_URL || `http://localhost:${process.env.PORT||5000}`;
    const url = `${host}/share/${token}`;
    res.status(200).json({ success: true, url, token, expiresAt });
  } catch (err) {
    console.error('Create share link error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Public share view (no auth) ───────────────────────────────────────────
exports.getPublicShare = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) return res.status(400).send('Bad token');

    const analysis = await Analysis.findOne({ 'shareLinks.token': token }).lean();
    if (!analysis) return res.status(404).send('Not found');

    const link = (analysis.shareLinks || []).find((l) => l.token === token);
    if (!link) return res.status(404).send('Not found');
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) return res.status(410).send('Link expired');

    // Use the full renderer so public shares include every AI insight field
    const html = renderFullInsightsHtml(analysis);
    res.set('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    console.error('Public share error:', err);
    res.status(500).send('Server error');
  }
};

// ─── PR Review: create review job ──────────────────────────────────────────
exports.createPRReview = async (req, res) => {
  try {
    const { prUrl } = req.body;
    if (!prUrl) {
      return res.status(400).json({ success: false, message: 'prUrl is required' });
    }

    const parsed = parsePRUrl(prUrl);
    const repoFullName = `${parsed.owner}/${parsed.repo}`;

    const review = await PRReview.create({
      userId: req.user.id,
      prUrl,
      repoFullName,
      pullNumber: parsed.pullNumber,
      status: 'queued',
      progress: { step: 'Queued for review', percent: 0 },
    });

    const jobId = await enqueuePRReview(review._id, prUrl, req.user.id, req.user.email);
    review.jobId = jobId;
    await review.save();

    res.status(202).json({
      success: true,
      reviewId: review._id,
      status: review.status,
      message: 'PR review queued. Poll /api/repo/pr-review/:id for status.',
    });
  } catch (err) {
    console.error('Create PR review error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PR Review: get review result ─────────────────────────────────────────
exports.getPRReview = async (req, res) => {
  try {
    const { id } = req.params;
    const review = await PRReview.findById(id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'PR review not found' });
    }

    if (review.userId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    res.status(200).json({
      success: true,
      status: review.status,
      progress: review.progress,
      errorMessage: review.errorMessage,
      review: review.status === 'completed'
        ? {
          summary: review.summary,
          overallRiskScore: review.overallRiskScore,
          findings: review.findings,
          prMetadata: review.prMetadata,
          filesSummary: review.filesSummary,
          reviewedAt: review.reviewedAt,
        }
        : null,
    });
  } catch (err) {
    console.error('Get PR review error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── NEW: List user's PR reviews ──────────────────────────────────────────
exports.listMyPRReviews = async (req, res) => {
  try {
    const reviews = await PRReview.find({ userId: req.user.id })
      .select('repoFullName pullNumber status prUrl createdAt')
      .sort({ createdAt: -1 })
      .limit(50);
    res.status(200).json({ success: true, reviews });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PR Review (no full repo analysis) ────────────────────────────────────
exports.reviewPullRequest = async (req, res) => {
  try {
    const { prUrl } = req.body;
    if (!prUrl) {
      return res.status(400).json({ success: false, message: 'prUrl is required' });
    }

    const { pull, files } = await fetchPullRequestDetails(prUrl);

    const MAX_FILES = 30;
    const MAX_PATCH_CHARS = 2000;

    const filesToAnalyze = files.slice(0, MAX_FILES).map((f) => ({
      filePath: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      changes: f.changes,
      patch: (f.patch || '').slice(0, MAX_PATCH_CHARS),
    }));

    const filesOmitted = Math.max(files.length - filesToAnalyze.length, 0);
    const totals = files.reduce(
      (acc, f) => {
        acc.additions += f.additions || 0;
        acc.deletions += f.deletions || 0;
        return acc;
      },
      { additions: 0, deletions: 0 }
    );

    const prContext = {
      number: pull.number,
      title: pull.title,
      author: pull.user,
      state: pull.state,
      merged: pull.merged,
      baseRef: pull.baseRef,
      headRef: pull.headRef,
      createdAt: pull.createdAt,
      updatedAt: pull.updatedAt,
      changedFiles: pull.changedFiles,
      additions: pull.additions,
      deletions: pull.deletions,
      url: pull.url,
      body: pull.body || '',
      filesAnalyzed: filesToAnalyze.length,
      filesOmitted,
      diffTotals: totals,
    };

    const review = await reviewPullRequest(prContext, filesToAnalyze);

    res.status(200).json({
      success: true,
      pr: prContext,
      review,
    });
  } catch (err) {
    console.error('PR review error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};