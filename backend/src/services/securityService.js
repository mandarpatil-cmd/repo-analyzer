const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { execFile } = require('child_process');
const { nanoid } = require('nanoid');

const execFileAsync = promisify(execFile);

// Expanded exclusions including test directories
const EXCLUDED_PATHS = ['node_modules', '.git', 'dist', 'build', 'tests', 'test', '__tests__', 'coverage'];

// Binary extensions to skip
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.pdf', '.zip', '.tar', '.gz', 
  '.mp3', '.mp4', '.avi', '.mov', '.woff', '.woff2', '.ttf', '.eot', '.jar', '.class', 
  '.dll', '.exe', '.bin', '.db', '.sqlite', '.sqlite3', '.pyc'
]);

// Expanded secret patterns
const SECRET_PATTERNS = [
  { id: 'aws-key', pattern: /AKIA[0-9A-Z]{16}/, title: 'AWS Access Key', severity: 'critical', cwe: 'CWE-798' },
  { id: 'generic-api', pattern: /api[_-]?key\s*=\s*['"][a-zA-Z0-9]{16,}/i, title: 'Generic API Key', severity: 'high', cwe: 'CWE-798' },
  { id: 'private-key', pattern: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/, title: 'Private Key in Code', severity: 'critical', cwe: 'CWE-321' },
  { id: 'jwt-secret', pattern: /jwt[_-]?secret\s*=\s*['"][^'"]{8,}/i, title: 'JWT Secret Hardcoded', severity: 'high', cwe: 'CWE-798' },
  { id: 'db-password', pattern: /password\s*=\s*['"][^'"]{4,}/i, title: 'Hardcoded DB Password', severity: 'high', cwe: 'CWE-259' },
  { id: 'github-token', pattern: /(ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36}/, title: 'GitHub Token', severity: 'critical', cwe: 'CWE-798' },
  { id: 'stripe-key', pattern: /sk_live_[a-zA-Z0-9]{24}/, title: 'Stripe Live Secret Key', severity: 'critical', cwe: 'CWE-798' },
  { id: 'slack-token', pattern: /xox[baprs]-[0-9a-zA-Z]{10,48}/, title: 'Slack Token', severity: 'critical', cwe: 'CWE-798' },
  { id: 'gcp-key', pattern: /AIza[0-9A-Za-z-_]{35}/, title: 'Google Cloud API Key', severity: 'high', cwe: 'CWE-798' },
  { id: 'discord-webhook', pattern: /https:\/\/discord\.com\/api\/webhooks\/[0-9]+\/[a-zA-Z0-9_-]+/, title: 'Discord Webhook', severity: 'high', cwe: 'CWE-798' },
];

const CODE_PATTERNS = [
  { id: 'eval-usage', pattern: /\beval\s*\(/, title: 'eval() Usage', severity: 'high', cwe: 'CWE-95' },
  { id: 'exec-usage', pattern: /child_process.*exec\s*\(/, title: 'child_process.exec Usage', severity: 'medium', cwe: 'CWE-78' },
  { id: 'sql-concat', pattern: /query\s*=\s*['"`].*\+\s*(req\.|user|input)/, title: 'SQL Injection Risk', severity: 'high', cwe: 'CWE-89' },
  { id: 'innerhtml', pattern: /\.innerHTML\s*=/, title: 'innerHTML XSS Risk', severity: 'medium', cwe: 'CWE-79' },
  { id: 'dangerously-html', pattern: /dangerouslySetInnerHTML/, title: 'React dangerouslySetInnerHTML', severity: 'medium', cwe: 'CWE-79' },
  { id: 'no-tls-verify', pattern: /rejectUnauthorized\s*:\s*false/, title: 'TLS Verification Disabled', severity: 'high', cwe: 'CWE-295' },
  { id: 'weak-crypto', pattern: /(md5|sha1)\(/i, title: 'Weak Cryptography (MD5/SHA1)', severity: 'medium', cwe: 'CWE-327' },
];

const MAX_FILE_BYTES = 1024 * 1024; // 1MB

const normalizePath = (value) => value.replace(/\\/g, '/');

const shouldExcludePath = (filePath) => {
  const lower = normalizePath(filePath).toLowerCase();
  const parts = lower.split('/');
  
  // Specific file exclusions
  if (parts.includes('.env.example') || lower.endsWith('.min.js') || lower.endsWith('.lock')) {
    return true;
  }
  
  // Directory exclusions
  return EXCLUDED_PATHS.some(dir => parts.includes(dir));
};

const isBinaryFile = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
};

const buildSnippet = (lines, lineIndex) => {
  const start = Math.max(0, lineIndex - 1);
  const end = Math.min(lines.length - 1, lineIndex + 1);
  return lines.slice(start, end + 1).join('\n');
};

const scanFileForPatterns = async (fileEntry, patterns) => {
  const findings = [];
  try {
    const content = await fs.promises.readFile(fileEntry.absolutePath, 'utf8');
    const lines = content.split(/\r?\n/);

    lines.forEach((line, index) => {
      patterns.forEach((patternInfo) => {
        const testRegex = new RegExp(patternInfo.pattern.source, patternInfo.pattern.flags);
        if (!testRegex.test(line)) return;

        findings.push({
          id: nanoid(),
          severity: patternInfo.severity,
          category: patternInfo.category,
          title: patternInfo.title,
          description: `Detected ${patternInfo.title} in source code.`,
          file: normalizePath(fileEntry.relativePath || fileEntry.absolutePath),
          line: index + 1,
          snippet: buildSnippet(lines, index),
          cwe: patternInfo.cwe,
          remediation: 'Remove the hardcoded value and load it from a secure secret store or environment variable.',
        });
      });
    });
  } catch (err) {
    // Ignore file read errors
  }
  return findings;
};

const scanForSecrets = async (fileEntries) => {
  const patterns = SECRET_PATTERNS.map((p) => ({ ...p, category: 'secret' }));
  const scanPromises = [];

  for (const entry of fileEntries) {
    if (!entry?.absolutePath) continue;
    if (shouldExcludePath(entry.relativePath || entry.absolutePath)) continue;
    if (isBinaryFile(entry.absolutePath)) continue;
    if (entry.sizeBytes && entry.sizeBytes > MAX_FILE_BYTES) continue;

    scanPromises.push(scanFileForPatterns(entry, patterns));
  }

  const results = await Promise.all(scanPromises);
  return results.flat();
};

const scanForDangerousPatterns = async (fileEntries) => {
  const patterns = CODE_PATTERNS.map((p) => ({ ...p, category: 'pattern' }));
  const scanPromises = [];

  for (const entry of fileEntries) {
    if (!entry?.absolutePath) continue;
    if (shouldExcludePath(entry.relativePath || entry.absolutePath)) continue;
    if (isBinaryFile(entry.absolutePath)) continue;
    if (entry.sizeBytes && entry.sizeBytes > MAX_FILE_BYTES) continue;

    scanPromises.push(scanFileForPatterns(entry, patterns));
  }

  const results = await Promise.all(scanPromises);
  return results.flat();
};

const runDependencyAudit = async (repoRoot) => {
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const packageLockPath = path.join(repoRoot, 'package-lock.json');
  const yarnLockPath = path.join(repoRoot, 'yarn.lock');

  if (!fs.existsSync(packageJsonPath)) {
    return { raw: '', vulnerableCount: 0, packages: [] };
  }

  // npm audit requires a lock file
  if (!fs.existsSync(packageLockPath) && !fs.existsSync(yarnLockPath)) {
    return { raw: '{"message":"No lock file found, skipping audit."}', vulnerableCount: 0, packages: [] };
  }

  try {
    const { stdout } = await execFileAsync('npm', ['audit', '--json'], {
      cwd: repoRoot,
      maxBuffer: 1024 * 1024 * 5,
    });
    return parseNpmAudit(stdout);
  } catch (err) {
    const output = err?.stdout || err?.output?.join('') || '';
    if (output) {
      return parseNpmAudit(output);
    }
    return { raw: '', vulnerableCount: 0, packages: [] };
  }
};

const parseNpmAudit = (raw) => {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { raw, vulnerableCount: 0, packages: [] };
  }

  const packages = [];
  let vulnerableCount = 0;

  if (data.vulnerabilities) {
    for (const [name, vuln] of Object.entries(data.vulnerabilities)) {
      const severity = vuln.severity || 'low';
      const via = (vuln.via || []).map((v) => (typeof v === 'string' ? v : v.title || v.source || 'unknown'));
      const fixAvailable = Boolean(vuln.fixAvailable);
      packages.push({ name, severity, via, fixAvailable });
    }
    vulnerableCount = packages.length;
  } else if (data.advisories) {
    for (const advisory of Object.values(data.advisories)) {
      packages.push({
        name: advisory.module_name,
        severity: advisory.severity || 'low',
        via: [advisory.title],
        fixAvailable: Boolean(advisory.fix_available),
      });
    }
    vulnerableCount = packages.length;
  }

  return { raw: JSON.stringify(data), vulnerableCount, packages };
};

const calculateSecurityScore = (findings, dependencyAudit) => {
  let score = 100;
  const deductions = { critical: 15, high: 8, medium: 4, low: 1 };

  (findings || []).forEach((finding) => {
    score -= deductions[finding.severity] || 0;
  });

  if (dependencyAudit?.packages) {
    dependencyAudit.packages.forEach((pkg) => {
      if (pkg.severity === 'critical') score -= 10;
      else if (pkg.severity === 'high') score -= 5;
      else if (pkg.severity === 'moderate') score -= 2;
      else if (pkg.severity === 'medium') score -= 2;
    });
  }

  return Math.max(0, score);
};

const summarizeFindings = (findings) => {
  const summary = { critical: 0, high: 0, medium: 0, low: 0 };
  (findings || []).forEach((finding) => {
    if (summary[finding.severity] !== undefined) summary[finding.severity] += 1;
  });
  return summary;
};

const generateSecurityReport = async (repoRoot, fileEntries) => {
  const secrets = await scanForSecrets(fileEntries);
  const patterns = await scanForDangerousPatterns(fileEntries);
  const dependencyAudit = await runDependencyAudit(repoRoot);

  const rawFindings = [...secrets, ...patterns];
  let findings = rawFindings;

  // Attempt to filter false positives using AI if any findings exist
  if (rawFindings.length > 0) {
    try {
      const { filterSecurityFindings } = require('./aiService');
      const filtered = await filterSecurityFindings(rawFindings);
      if (filtered && Array.isArray(filtered)) {
        findings = filtered;
      }
    } catch (err) {
      console.warn('⚠️ AI Security Filter failed, using raw regex findings:', err.message);
    }
  }

  const summary = summarizeFindings(findings);
  const score = calculateSecurityScore(findings, dependencyAudit);

  return {
    score,
    summary,
    findings,
    dependencyAudit,
  };
};

module.exports = {
  scanForSecrets,
  scanForDangerousPatterns,
  runDependencyAudit,
  calculateSecurityScore,
  generateSecurityReport,
};
