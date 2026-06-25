
// backend/src/services/aiService.js
// Uses Groq - FREE, no credit card needed
// 1. Sign up at console.groq.com
// 2. Create API key
// 3. Add to .env: GROQ_API_KEY=your_key_here
// 4. Run: npm install groq-sdk

const Groq = require('groq-sdk');
const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─── Helper: call Groq ────────────────────────────────────────────────────────
async function askAI(prompt) {
  try {
    const res = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 1000,
    });
    return res.choices[0].message.content.trim();
  } catch (err) {
    console.error('Groq AI error:', err.message);
    return null;
  }
}

// ─── Helper: safely parse JSON ────────────────────────────────────────────────
function safeParseJSON(raw, fallback) {
  if (!raw) return fallback;
  try {
    const cleaned = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return { ...fallback, summary: raw };
  }
}

function mergeWithFallback(value, fallback) {
  if (Array.isArray(fallback)) {
    return Array.isArray(value) && value.length > 0 ? value : fallback;
  }

  if (fallback && typeof fallback === 'object') {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const merged = { ...fallback };

    for (const key of Object.keys(fallback)) {
      merged[key] = mergeWithFallback(source[key], fallback[key]);
    }

    return merged;
  }

  if (typeof fallback === 'string') {
    return typeof value === 'string' && value.trim() ? value : fallback;
  }

  return value ?? fallback;
}

// ─── 1. Explain a single function ────────────────────────────────────────────
async function explainFunction(funcName, code, fileName) {
  const prompt = `You are a senior software engineer writing onboarding docs for a new employee.

Function name: ${funcName}
File: ${fileName}
Code:
\`\`\`javascript
${(code || '').slice(0, 1500)}
\`\`\`

Respond ONLY in this exact JSON (no markdown, no code fences, no extra text):
{"summary":"one sentence what it does","purpose":"why it exists","howItWorks":"step by step logic","inputs":"what params it takes","outputs":"what it returns","newEmployeeTip":"practical tip for new dev"}`;

  const raw = await askAI(prompt);
  const fallback = {
    summary: `Handles ${funcName}`,
    purpose: `Supports the behavior implemented in ${fileName}`,
    howItWorks: `Read through ${funcName} in ${fileName} to follow the control flow step by step.`,
    inputs: 'Review the function parameters in the source code.',
    outputs: 'Check the return value and any side effects in the file.',
    newEmployeeTip: `Trace ${funcName} together with its callers before changing its behavior.`,
  };

  return mergeWithFallback(safeParseJSON(raw, fallback), fallback);
}

// ─── 2. Explain a whole file ──────────────────────────────────────────────────
async function explainFile(fileName, code, functionNames) {
  const prompt = `You are a senior engineer writing onboarding docs for a new employee.

File: ${fileName}
Functions: ${(functionNames || []).join(', ') || 'none'}
Code:
\`\`\`javascript
${(code || '').slice(0, 2000)}
\`\`\`

Respond ONLY in this exact JSON (no markdown, no code fences, no extra text):
{"role":"file role in app","layer":"ONE OF: Controller|Service|Model|Route|Middleware|Config|Utility","keyResponsibilities":["resp1","resp2","resp3"],"dependencies":"what it depends on","whoShouldEdit":"when to edit this file","newEmployeeWarning":"must know before editing"}`;

  const raw = await askAI(prompt);
  const fallback = {
    role: `Handles ${fileName} logic`,
    layer: 'Utility',
    keyResponsibilities: [
      `Inspect ${fileName} before changing related routes or services.`,
      'Follow the import and call chain to understand dependencies.',
    ],
    dependencies: `Review the helpers, services, and modules imported by ${fileName}.`,
    whoShouldEdit: 'Edit this file when its API, data flow, or responsibility changes.',
    newEmployeeWarning: 'Check the nearby controller/service boundary before making edits here.',
  };

  return mergeWithFallback(safeParseJSON(raw, fallback), fallback);
}

// ─── 3. Repo-level summary ────────────────────────────────────────────────────
async function generateRepoSummary(repoName, fileNames, languages, totalFunctions) {
  const prompt = `You are a senior engineer writing an onboarding doc for a new employee starting today.

Repo: ${repoName}
Languages: ${Object.keys(languages || {}).join(', ') || 'JavaScript'}
Total files: ${(fileNames || []).length}
Total functions: ${totalFunctions}
Key files: ${(fileNames || []).slice(0, 20).join(', ')}

Respond ONLY in this exact JSON (no markdown, no code fences, no extra text):
{"projectOverview":"what the project does in plain english","techStack":"technologies used and why","architectureStyle":"MVC or REST API etc","folderStructureExplained":"walk through key folders","whereToStart":"which file to read first and why","criticalFlows":["flow1","flow2"],"firstWeekGuide":"what new employee should focus on first week"}`;

  const raw = await askAI(prompt);
  const fallback = {
    projectOverview: `${repoName} is a software project`,
    techStack: 'Review the package manifests and imported libraries to confirm the stack.',
    architectureStyle: 'Follow the entry point, routes, services, and data layer to understand the architecture.',
    folderStructureExplained: 'Use the top-level folders to trace the main application flow from entry point to storage.',
    whereToStart: 'Start with the application entry point, then follow the main request path into the service layer.',
    criticalFlows: ['Trace the primary request path from API entry point to persistence.'],
    firstWeekGuide: 'Read the entry point, then follow one complete feature flow end to end before editing code.',
  };

  return mergeWithFallback(safeParseJSON(raw, fallback), fallback);
}

// ─── 4. Explain a commit ─────────────────────────────────────────────────────
async function explainCommit(commitMessage, sha, filesChanged) {
  const prompt = `You are explaining a Git commit to a new developer.

SHA: ${sha}
Message: "${commitMessage}"
Files changed: ${(filesChanged || []).join(', ') || 'unknown'}

Respond ONLY in this exact JSON (no markdown, no code fences, no extra text):
{"whatChanged":"what changed in plain english","whyItMatters":"why this change was important","impact":"what parts of app are affected"}`;

  const raw = await askAI(prompt);
  return safeParseJSON(raw, { whatChanged: commitMessage, whyItMatters: '', impact: '' });
}

// ─── 5. Generate PR review findings ───────────────────────────────────────
async function generatePRReview(prContext, fileDiffs) {
  const prompt = `You are a senior engineer performing a PR review.

Analyze ONLY the changed files and diffs below. Ignore lock files, minified files, and generated artifacts.
Focus on security, reliability, performance, and maintainability risks.

PR context:
${JSON.stringify(prContext, null, 2)}

Changed files (with unified diffs when available):
${JSON.stringify(fileDiffs, null, 2)}

Return ONLY valid JSON in this exact shape (no markdown, no extra text):
{
  "summary": "2-4 sentences",
  "overallRiskScore": 0,
  "findings": [
    {
      "severity": "low|medium|high",
      "category": "security|reliability|performance|maintainability",
      "filePath": "path",
      "line": "line or range if known",
      "title": "short title",
      "explanation": "why this is a risk",
      "suggestedFix": "concise fix",
      "confidence": "low|medium|high"
    }
  ]
}`;

  const raw = await askAI(prompt);
  const fallback = {
    summary: 'PR review generated. Please validate findings before merging.',
    overallRiskScore: 0,
    findings: [],
  };

  const parsed = mergeWithFallback(safeParseJSON(raw, fallback), fallback);
  if (typeof parsed.overallRiskScore !== 'number') {
    parsed.overallRiskScore = 0;
  }
  if (!Array.isArray(parsed.findings)) {
    parsed.findings = [];
  }
  return parsed;
}

// ─── 5. Review a pull request ─────────────────────────────────────────────
async function reviewPullRequest(prContext, fileDiffs) {
  const prompt = `You are a senior engineer performing a PR review.

PR metadata:
${JSON.stringify(prContext, null, 2)}

Changed files (with patches when available):
${JSON.stringify(fileDiffs, null, 2)}

Return ONLY valid JSON in this exact shape (no markdown, no extra text):
{
  "overallSummary": "2-4 sentences about what changed and why it matters",
  "blockingIssues": [{"severity":"high|medium|low","title":"...","details":"...","files":["path"],"recommendation":"..."}],
  "risks": [{"severity":"high|medium|low","title":"...","details":"...","files":["path"],"recommendation":"..."}],
  "security": [{"severity":"high|medium|low","title":"...","details":"...","files":["path"],"recommendation":"..."}],
  "missingTests": ["..."],
  "errorHandling": ["..."],
  "fileFindings": [{"filePath":"path","notes":["..."]}],
  "questions": ["..."],
  "confidence": "high|medium|low"
}`;

  const raw = await askAI(prompt);
  const fallback = {
    overallSummary: 'PR review generated. Please review the findings carefully.',
    blockingIssues: [],
    risks: [],
    security: [],
    missingTests: [],
    errorHandling: [],
    fileFindings: [],
    questions: [],
    confidence: 'low',
  };

  return mergeWithFallback(safeParseJSON(raw, fallback), fallback);
}

// ─── 6. Filter Security Findings (False Positive Removal) ────────────────────
async function filterSecurityFindings(rawFindings) {
  if (!rawFindings || rawFindings.length === 0) return [];
  
  const prompt = `You are an expert Application Security Engineer.
Review the following static analysis security findings.
Many of these might be FALSE POSITIVES (e.g. dummy test keys, weak hashes used for non-security purposes, eval in build scripts).

Raw Findings:
${JSON.stringify(rawFindings.map(f => ({ id: f.id, title: f.title, snippet: f.snippet })), null, 2)}

Return a JSON array of the finding IDs that are TRUE POSITIVES (real security risks).
If they are all false positives, return an empty array [].
Respond ONLY with a valid JSON array of strings: ["id1", "id2"]`;

  const raw = await askAI(prompt);
  try {
    const validIds = safeParseJSON(raw, []);
    if (Array.isArray(validIds)) {
      return rawFindings.filter(f => validIds.includes(f.id));
    }
    return rawFindings;
  } catch (err) {
    return rawFindings; // Fallback to returning all if parsing fails
  }
}

module.exports = {
  explainFunction,
  explainFile,
  generateRepoSummary,
  explainCommit,
  generatePRReview,
  reviewPullRequest,
  filterSecurityFindings,
};