

const Chunk = require('../models/Chunk.model');

let _pipeline = null;

const getEmbeddingPipeline = async () => {
  if (_pipeline) return _pipeline;
  console.log('🔄 Loading embedding model...');
  const { pipeline } = await import('@xenova/transformers');
  _pipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { quantized: true });
  console.log('✅ Embedding model loaded');
  return _pipeline;
};

const generateEmbedding = async (text) => {
  const pipe = await getEmbeddingPipeline();
  const truncated = text.slice(0, 4000);
  const output = await pipe(truncated, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
};

const cosineSimilarity = (vecA, vecB) => {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot   += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

const STOP_WORDS = new Set([
  'how','does','the','a','an','is','are','was','were','what','where','which',
  'who','when','why','do','did','can','could','should','would','this','that',
  'these','those','in','of','to','for','with','on','at','by','from','it','its',
  'be','been','have','has','had','not','and','or','but','if','then','than',
  'about','me','show','tell','explain','give','please','work','works','working',
  'code','file','files',
]);

const extractKeywords = (query) => {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
};

const keywordScore = (chunkText, keywords) => {
  if (!keywords.length) return 0;
  const lower = chunkText.toLowerCase();
  const hits = keywords.filter((kw) => lower.includes(kw)).length;
  return hits / keywords.length;
};

const chunkFile = (file) => {
  const chunks = [];
  const filePath = file.relativePath || file.fileName;
  const fileName = file.fileName || filePath.split('/').pop();
  const language = file.language || 'javascript';

  // ── 1. File summary chunk ──
  const importPaths = (file.imports || []).map((i) => i.path).join(', ');
  const depPaths    = (file.dependencies || []).map((d) => d.path).join(', ');
  const funcNames   = (file.functions || []).map((f) => f.name).join(', ');
  const classNames  = (file.classes  || []).map((c) => c.name).join(', ');

  chunks.push({
    filePath, fileName, language,
    chunkType: 'file_summary',
    text: [
      `File: ${filePath}`,
      `Language: ${language}`,
      `Total lines: ${file.totalLines || 0}`,
      `Functions: ${funcNames || 'none'}`,
      `Classes: ${classNames || 'none'}`,
      `Internal imports: ${importPaths || 'none'}`,
      `External dependencies: ${depPaths || 'none'}`,
    ].join('\n'),
    functionName: null, startLine: null, endLine: null, params: [],
  });

  // ── 2. Per-function chunks with FULL CODE ──
  for (const fn of file.functions || []) {
    if (!fn.name || fn.name === '<anonymous>') continue;

    const codeBlock = fn.fullCode || fn.bodySnippet || '';
    const MAX_CODE_CHARS = 6000;
    const displayCode = codeBlock.length > MAX_CODE_CHARS
      ? codeBlock.substring(0, MAX_CODE_CHARS) + '\n// ... (truncated)'
      : codeBlock;

    const fnText = [
      `File: ${filePath}`,
      `Function: ${fn.name}`,
      `Parameters: ${(fn.params || []).join(', ') || 'none'}`,
      `Lines: ${fn.startLine}–${fn.endLine} (${fn.lineCount} lines)`,
      `Language: ${language}`,
      ``,
      `Full source code:`,
      `\`\`\`${language}`,
      displayCode,
      `\`\`\``,
    ].join('\n');

    chunks.push({
      filePath, fileName, language,
      chunkType: 'function',
      text: fnText,
      functionName: fn.name,
      startLine: fn.startLine,
      endLine: fn.endLine,
      params: fn.params || [],
    });
  }

  // ── 3. Full file source for small files (≤150 lines) ──
  if ((file.totalLines || 0) <= 150 && file.sourceCode) {
    chunks.push({
      filePath, fileName, language,
      chunkType: 'file_source',
      text: [
        `File: ${filePath} (complete source)`,
        `Language: ${language}`,
        ``,
        `\`\`\`${language}`,
        file.sourceCode,
        `\`\`\``,
      ].join('\n'),
      functionName: null,
      startLine: 1,
      endLine: file.totalLines,
      params: [],
    });
  }

  return chunks;
};

const chunkAnalysis = (analysis) => {
  const allChunks = [];
  for (const file of analysis.parsedFiles || []) {
    allChunks.push(...chunkFile(file));
  }
  console.log(`📦 Created ${allChunks.length} chunks from ${(analysis.parsedFiles || []).length} files`);
  return allChunks;
};

const storeChunks = async (analysisId, rawChunks) => {
  await Chunk.deleteMany({ analysisId });
  const BATCH_SIZE = 10;
  let stored = 0;

  for (let i = 0; i < rawChunks.length; i += BATCH_SIZE) {
    const batch = rawChunks.slice(i, i + BATCH_SIZE);
    const embeddedChunks = await Promise.all(
      batch.map(async (chunk) => ({
        ...chunk,
        analysisId,
        embedding: await generateEmbedding(chunk.text),
      }))
    );
    await Chunk.insertMany(embeddedChunks);
    stored += embeddedChunks.length;
    const pct = Math.round((stored / rawChunks.length) * 100);
    console.log(`  📥 Stored ${stored}/${rawChunks.length} chunks (${pct}%)`);
  }
  return stored;
};

const searchSimilarChunks = async (analysisId, query, topK = 12, minScore = 0.25) => {
  const queryEmbedding = await generateEmbedding(query);
  const keywords = extractKeywords(query);
  console.log(`🔑 [RAG] Keywords: ${keywords.join(', ') || '(none)'}`);

  const chunks = await Chunk.find({ analysisId }).lean();
  if (chunks.length === 0) return [];

  const scored = chunks.map((chunk) => {
    const semantic = cosineSimilarity(queryEmbedding, chunk.embedding);
    const kw       = keywordScore(chunk.text, keywords);
    const score    = 0.7 * semantic + 0.3 * kw;
    return { ...chunk, score, semanticScore: semantic, keywordScore: kw };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.filter((c) => c.score >= minScore).slice(0, topK);
};

const buildContext = (chunks) => {
  if (!chunks || chunks.length === 0) return 'No relevant code found.';

  const seen = new Map();
  const deduped = [];
  for (const chunk of chunks) {
    const key = `${chunk.filePath}::${chunk.functionName || chunk.chunkType}`;
    if (!seen.has(key)) {
      seen.set(key, true);
      deduped.push(chunk);
    }
  }

  return deduped.map((chunk, i) => {
    const relevance = Math.round(chunk.score * 100);
    const label = chunk.chunkType === 'function'
      ? `FUNCTION: ${chunk.functionName}() in ${chunk.filePath}`
      : chunk.chunkType === 'file_source'
      ? `FILE SOURCE: ${chunk.filePath}`
      : `FILE SUMMARY: ${chunk.filePath}`;

    return [
      `━━━ [${i + 1}] ${label} | Relevance: ${relevance}% ━━━`,
      chunk.text,
      '',
    ].join('\n');
  }).join('\n');
};

module.exports = {
  generateEmbedding,
  chunkAnalysis,
  storeChunks,
  searchSimilarChunks,
  buildContext,
};