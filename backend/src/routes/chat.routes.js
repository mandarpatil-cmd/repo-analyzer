/**
 * chat.routes.js
 *
 * All routes for the Codebase Chat feature.
 * All routes are protected — user must be logged in.
 */

const express = require('express');
const router  = express.Router();
const chatController = require('../controllers/chat.controller');
const verifyToken    = require('../middleware/verifyToken');

// All chat routes require authentication
router.use(verifyToken);

/**
 * POST /api/chat/:analysisId
 * Send a question, receive an AI answer with source references.
 *
 * Body: { question: string, history: [{role, content}] }
 */
router.post('/:analysisId', chatController.chat);

/**
 * GET /api/chat/:analysisId/status
 * Check if chat is ready for this analysis (embeddings done?).
 * Frontend polls this after analysis completes.
 */
router.get('/:analysisId/status', chatController.getChatStatus);

/**
 * GET /api/chat/:analysisId/suggestions
 * Get smart question suggestions based on this repo's content.
 * Called when chat UI first opens.
 */
router.get('/:analysisId/suggestions', chatController.getSuggestions);

module.exports = router;