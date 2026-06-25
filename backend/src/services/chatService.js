
const Groq = require('groq-sdk');
const { searchSimilarChunks, buildContext } = require('./ragService');
const Chunk = require('../models/Chunk.model');

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are an elite senior software engineer and the world's best codebase guide.
Your job: help developers understand ANY codebase instantly, like having the original author sitting next to them.

## HOW YOU ANSWER

### For "show me / what is the code for X" questions:
- Show the COMPLETE function code in a properly fenced code block with language tag
- Point out the exact file path and line numbers
- Briefly explain what each major section does (1 line per section)
- Mention any important parameters, return values, or side effects

### For "how does X work" questions:
- Give a clear 2–3 sentence overview first
- Then walk through the code step by step, referencing exact function names and file paths
- Use code snippets (not full functions) to illustrate specific points
- End with: what calls this? what does this call?

### For "where should I edit X" questions:
- Name the exact file(s) to edit
- Name the exact function(s) to modify
- Show the relevant code section
- Warn about anything that could break

### For architecture / "how does the whole X work" questions:
- Describe the flow from entry point to completion
- Reference each file in order of the flow
- Use a numbered list for the steps

## WHEN CODE ISN'T DIRECTLY RELEVANT
Some questions are about the PURPOSE or BEHAVIOR of the application, not specific code.
For these questions:
- Use the file summaries and function names in context to INFER what the app does
- Describe what the application produces/does based on the code structure you see
- Example: "what does this app do?" → look at route files, controller names, model names and describe the app's purpose
- Example: "what output does user get?" → look at what the API returns, what the frontend renders, what data flows out
- Never say you can't answer just because there's no exact code match
- Always give your best answer based on available context
- If asked about features, benefits, or user experience — infer from the codebase structure

## STRICT RULES
1. ALWAYS use fenced code blocks with language tags: \`\`\`javascript ... \`\`\`
2. ALWAYS reference exact file paths like \`src/controllers/auth.controller.js\`
3. ALWAYS show line numbers when they are in the context: "line 42–67"
4. NEVER say "I don't have access to the code" if you have relevant chunks
5. NEVER make up code — only show code that is literally in the provided context
6. If the code for a function is in the context, SHOW IT IN FULL — do not summarize it
7. If you only have partial info, say "Based on what I can see..." and show what you have
8. Keep answers focused — no filler, no "Great question!", no unnecessary preamble

## FOLLOW-UP QUESTIONS
You have the full conversation history. Use it.
- If asked "what calls it?" refer back to the function just discussed
- If asked "show me the code" after an explanation, show the actual code block
- If asked to "go deeper", expand on the specific part they're asking about`;

const classifyQuestion = (question) => {
  const q = question.toLowerCase();
  if (q.includes('show me') || q.includes('what is the code') || q.includes('give me the code') || q.includes('source code') || q.includes('implementation of')) {
    return { temperature: 0.1, maxTokens: 2000 };
  }
  if (q.includes('how does') || q.includes('how is') || q.includes('explain') || q.includes('walk me through')) {
    return { temperature: 0.2, maxTokens: 2000 };
  }
  if (q.includes('architecture') || q.includes('overview') || q.includes('structure') || q.includes('entry point') || q.includes('flow')) {
    return { temperature: 0.3, maxTokens: 2000 };
  }
  return { temperature: 0.2, maxTokens: 1800 };
};

const trimHistory = (history, maxTokens = 3000) => {
  if (!history || history.length === 0) return [];
  let tokenCount = 0;
  const trimmed = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const estimated = Math.ceil((history[i].content || '').length / 4);
    if (tokenCount + estimated > maxTokens) break;
    trimmed.unshift(history[i]);
    tokenCount += estimated;
  }
  return trimmed;
};

const answerQuestion = async (analysisId, repoFullName, question, history = []) => {
  console.log(`\n💬 [Chat] "${question}"`);

  // Try semantic search first with low threshold
  let relevantChunks = await searchSimilarChunks(analysisId, question, 12, 0.10);

  // If still nothing found, fall back to file summaries so AI can always answer
  if (relevantChunks.length === 0) {
    console.log(`⚠️  [Chat] No semantic matches — falling back to file summaries`);
    const fallbackChunks = await Chunk.find({ analysisId, chunkType: 'file_summary' })
      .limit(12)
      .lean();

    if (fallbackChunks.length === 0) {
      return {
        answer: "The codebase hasn't been indexed yet. Please wait for embeddings to finish processing, then try again.",
        sources: [],
        chunksUsed: 0,
      };
    }

    // Add a score field so buildContext works
    relevantChunks = fallbackChunks.map((c) => ({ ...c, score: 0.1 }));
  }

  const context = buildContext(relevantChunks);
  const { temperature, maxTokens } = classifyQuestion(question);
  const recentHistory = trimHistory(history, 3000);

  const messages = [
    {
      role: 'system',
      content: SYSTEM_PROMPT,
    },
    {
      role: 'user',
      content: `Repository: **${repoFullName}**

Below are the most relevant code sections retrieved for the question. These are REAL code from the actual repository — use them to answer accurately.

${context}

---
Use the code sections above to answer the question. Show full code blocks when relevant.
For general questions about what the app does or what users get — infer from the file names, function names, and structure visible in the context.`,
    },
    {
      role: 'assistant',
      content: `Understood. I have the code context for ${repoFullName} loaded. I'll answer using only the actual code shown above, with exact file paths and line numbers.`,
    },
    ...recentHistory,
    {
      role: 'user',
      content: question,
    },
  ];

  console.log(`🤖 [Chat] Calling Groq | chunks: ${relevantChunks.length} | temp: ${temperature}`);

  const response = await client.chat.completions.create({
    model:      'llama-3.3-70b-versatile',
    messages,
    temperature,
    max_tokens: maxTokens,
  });

  const answer = response.choices[0].message.content.trim();

  const sources = relevantChunks
    .filter((c) => c.score > 0.15)
    .slice(0, 8)
    .map((chunk) => ({
      filePath:     chunk.filePath,
      fileName:     chunk.fileName,
      chunkType:    chunk.chunkType,
      functionName: chunk.functionName || null,
      startLine:    chunk.startLine || null,
      endLine:      chunk.endLine || null,
      relevance:    Math.round(chunk.score * 100),
    }));

  console.log(`✅ [Chat] Done | sources: ${sources.length}`);
  return { answer, sources, chunksUsed: relevantChunks.length };
};

module.exports = { answerQuestion };