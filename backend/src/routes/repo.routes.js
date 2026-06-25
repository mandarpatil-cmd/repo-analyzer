const express = require('express');
const router = express.Router();
const integrationRouter = express.Router();
const webhookRouter = express.Router();
const repoController = require('../controllers/repo.controller');
const integrationController = require('../controllers/integration.controller');
const verifyToken = require('../middleware/verifyToken');

// Metadata + Analyze
router.post('/metadata', verifyToken, repoController.getMetadata);
router.post('/analyze',  verifyToken, repoController.analyzeRepo);

// NEW: status polling & result fetching
router.get('/status/:analysisId', verifyToken, repoController.getAnalysisStatus);
router.get('/result/:analysisId', verifyToken, repoController.getAnalysisResult);
router.get('/my-analyses',        verifyToken, repoController.listMyAnalyses);

// Security report
router.get('/:analysisId/security', verifyToken, repoController.getSecurityReport);
router.post('/:analysisId/security/rescan', verifyToken, repoController.triggerSecurityRescan);

// AI insights
router.post('/ai-insights',      verifyToken, repoController.generateAIInsights);
router.post('/explain-function', verifyToken, repoController.explainSingleFunction);
router.post('/explain-file',     verifyToken, repoController.explainSingleFile);
// PR review
router.post('/pr-review',        verifyToken, repoController.createPRReview);
router.get('/pr-review/:id',     verifyToken, repoController.getPRReview);
router.get('/pr-reviews',        verifyToken, repoController.listMyPRReviews);
// Export & sharing
router.post('/export-pdf',       verifyToken, repoController.exportAnalysisPdf);
router.post('/create-share-link',verifyToken, repoController.createShareLink);

// ─── Integrations (mounted at /api/integrations) ───────────────────────────
integrationRouter.post('/github-action', integrationController.createIntegration);
integrationRouter.get('/', integrationController.listIntegrations);
integrationRouter.delete('/:integrationId', integrationController.deleteIntegration);

// ─── Webhook (mounted at /api/webhook) ─────────────────────────────────────
webhookRouter.post('/github-action', integrationController.handleGitHubActionWebhook);

module.exports = {
	repoRouter: router,
	integrationRouter,
	webhookRouter,
};