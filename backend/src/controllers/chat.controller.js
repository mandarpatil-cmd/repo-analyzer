/**
 * chat.controller.js
 *
 * HTTP handlers for the Codebase Chat feature.
 *
 * Routes:
 *  POST /api/chat/:analysisId        → send a message, get an answer
 *  GET  /api/chat/:analysisId/status → check if embeddings are ready
 *  DELETE /api/chat/:analysisId/history → clear chat (frontend handles history,
 *                                         but this is here for future DB storage)
 */

const Analysis = require('../models/Analysis.model');
const Chunk = require('../models/Chunk.model');
const { answerQuestion } = require('../services/chatService');

// ─── POST /api/chat/:analysisId ───────────────────────────────────────────────
/**
 * Main chat endpoint.
 * Accepts the user's question + optional conversation history.
 * Returns AI answer + source file references.
 */
exports.chat = async (req, res) => {
  try {
    const { analysisId } = req.params;
    const { question, history = [] } = req.body;

    // Validate input
    if (!question || question.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Question is required.',
      });
    }

    if (question.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Question too long. Max 1000 characters.',
      });
    }

    // Load analysis — check it exists and belongs to this user
    const analysis = await Analysis.findById(analysisId).select(
      'userId repoFullName status embeddingsStatus chunkCount'
    );

    if (!analysis) {
      return res.status(404).json({
        success: false,
        message: 'Analysis not found.',
      });
    }

    if (analysis.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this analysis.',
      });
    }

    // Analysis must be complete
    if (analysis.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: `Analysis is not ready yet. Current status: ${analysis.status}`,
      });
    }

    // Embeddings must be ready for chat to work
    if (analysis.embeddingsStatus !== 'ready') {
      const statusMessages = {
        none:    'Embeddings have not been generated yet.',
        pending: 'Embeddings are still being generated. Please wait a moment and try again.',
        failed:  'Embedding generation failed. Please re-analyze the repository.',
      };

      return res.status(400).json({
        success: false,
        embeddingsStatus: analysis.embeddingsStatus,
        message: statusMessages[analysis.embeddingsStatus] || 'Embeddings not ready.',
      });
    }

    // Answer the question
    const result = await answerQuestion(
      analysisId,
      analysis.repoFullName,
      question.trim(),
      history
    );

    res.status(200).json({
      success: true,
      question: question.trim(),
      answer:   result.answer,
      sources:  result.sources,
      meta: {
        repoFullName:  analysis.repoFullName,
        chunksUsed:    result.chunksUsed,
        totalChunks:   analysis.chunkCount,
      },
    });

  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to get answer.',
    });
  }
};

// ─── GET /api/chat/:analysisId/status ─────────────────────────────────────────
/**
 * Check if this analysis is ready for chat.
 * Frontend polls this before showing the chat UI.
 */
exports.getChatStatus = async (req, res) => {
  try {
    const { analysisId } = req.params;

    const analysis = await Analysis.findById(analysisId).select(
      'userId repoFullName status embeddingsStatus chunkCount'
    );

    if (!analysis) {
      return res.status(404).json({ success: false, message: 'Analysis not found.' });
    }

    if (analysis.userId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    const isReady = analysis.embeddingsStatus === 'ready';

    res.status(200).json({
      success: true,
      repoFullName:     analysis.repoFullName,
      analysisStatus:   analysis.status,
      embeddingsStatus: analysis.embeddingsStatus,
      chunkCount:       analysis.chunkCount,
      chatReady:        isReady,
      message: isReady
        ? `Chat ready! ${analysis.chunkCount} code chunks indexed.`
        : 'Chat not ready yet.',
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET /api/chat/:analysisId/suggestions ────────────────────────────────────
/**
 * Return smart question suggestions based on what's in this repo.
 * Helps new users know what to ask.
 */
exports.getSuggestions = async (req, res) => {
  try {
    const { analysisId } = req.params;

    const analysis = await Analysis.findById(analysisId).select(
      'userId repoFullName parsedFiles embeddingsStatus'
    );

    if (!analysis) {
      return res.status(404).json({ success: false, message: 'Analysis not found.' });
    }

    if (analysis.userId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    // Build suggestions from actual function names and file names in this repo
    const files = analysis.parsedFiles || [];

    // Get unique file types / layers present
    const controllers = files.filter((f) => f.fileName?.includes('Controller') || f.relativePath?.includes('controller'));
    const models      = files.filter((f) => f.fileName?.includes('model') || f.fileName?.includes('Model') || f.relativePath?.includes('models'));
    const routes      = files.filter((f) => f.fileName?.includes('route') || f.relativePath?.includes('routes'));
    const services    = files.filter((f) => f.relativePath?.includes('service') || f.relativePath?.includes('services'));

    // Build dynamic suggestions
    const suggestions = [
      // Always useful
      `How does authentication work in this project?`,
      `What is the overall architecture of this codebase?`,
      `Where is the entry point of this application?`,
    ];

    if (controllers.length > 0) {
      const ctrl = controllers[0].fileName;
      suggestions.push(`What does ${ctrl} do and when should I edit it?`);
    }

    if (models.length > 0) {
      const model = models[0].fileName;
      suggestions.push(`Explain the ${model} data model and its fields.`);
    }

    if (routes.length > 0) {
      suggestions.push(`What API routes are available in this project?`);
    }

    if (services.length > 0) {
      const svc = services[0].fileName;
      suggestions.push(`What does ${svc} do?`);
    }

    // Always add these generic but useful ones
    suggestions.push(
      `Which files should a new developer read first?`,
      `How is error handling done in this project?`,
      `What external APIs or services does this project use?`
    );

    // Return max 8 suggestions, deduplicated
    const unique = [...new Set(suggestions)].slice(0, 8);

    res.status(200).json({
      success: true,
      repoFullName: analysis.repoFullName,
      suggestions: unique,
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};