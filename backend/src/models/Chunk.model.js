const mongoose = require('mongoose');

/**
 * A "chunk" is one piece of code (a function, a file summary, an import block)
 * stored with its vector embedding so we can do similarity search.
 *
 * Each Analysis has many Chunks — one per function/file section.
 */
const chunkSchema = new mongoose.Schema(
  {
    // ─── Which analysis this belongs to ──────────────────────
    analysisId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Analysis',
      required: true,
      index: true,
    },

    // ─── Source info ──────────────────────────────────────────
    filePath:  { type: String, required: true },  // e.g. "backend/controllers/authController.js"
    fileName:  { type: String, required: true },  // e.g. "authController.js"
    language:  { type: String, default: 'javascript' },

    // ─── Chunk type ───────────────────────────────────────────
    chunkType: {
      type: String,
      enum: ['function', 'file_summary', 'imports', 'class'],
      default: 'function',
    },

    // ─── The actual text that was embedded ───────────────────
    // Format: "File: x.js | Function: loginUser | Code: ..."
    text: { type: String, required: true },

    // ─── Metadata for displaying results ─────────────────────
    functionName: { type: String, default: null },  // if chunkType === 'function'
    startLine:    { type: Number, default: null },
    endLine:      { type: Number, default: null },
    params:       { type: [String], default: [] },

    // ─── The vector embedding (384 dimensions for all-MiniLM-L6-v2) ──
    embedding: {
      type: [Number],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index already declared on field with `index: true`
// We do cosine similarity in JS (no Atlas needed)
// So no special vector index required here

module.exports = mongoose.model('Chunk', chunkSchema);