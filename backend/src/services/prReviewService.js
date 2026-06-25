const DEFAULT_MAX_FILES = parseInt(process.env.PR_REVIEW_MAX_FILES || '30', 10);
const DEFAULT_MAX_PATCH_CHARS = parseInt(process.env.PR_REVIEW_MAX_PATCH_CHARS || '2000', 10);

const IGNORED_FILE_NAMES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  'composer.lock',
  'poetry.lock',
  'pipfile.lock',
  'gemfile.lock',
  'cargo.lock',
  'go.sum',
]);

const IGNORED_PATH_PARTS = [
  '/node_modules/',
  '/dist/',
  '/build/',
  '/vendor/',
  '/.next/',
  '/.cache/',
  '/coverage/',
  '/target/',
];

const IGNORED_EXTENSIONS = new Set([
  '.min.js',
  '.min.css',
  '.map',
]);

const isIgnoredFile = (filePath) => {
  const lower = filePath.toLowerCase();
  if (IGNORED_FILE_NAMES.has(lower.split('/').pop())) return true;
  if (IGNORED_PATH_PARTS.some((part) => lower.includes(part))) return true;
  if ([...IGNORED_EXTENSIONS].some((ext) => lower.endsWith(ext))) return true;
  return false;
};

const buildPRFileInputs = (files, options = {}) => {
  const maxFiles = options.maxFiles || DEFAULT_MAX_FILES;
  const maxPatchChars = options.maxPatchChars || DEFAULT_MAX_PATCH_CHARS;

  const included = [];
  const skipped = [];

  for (const file of files || []) {
    const filePath = file.filename || file.filePath || '';

    if (!filePath) {
      skipped.push({ filePath: '', reason: 'missing_file_path' });
      continue;
    }

    if (isIgnoredFile(filePath)) {
      skipped.push({ filePath, reason: 'ignored_file' });
      continue;
    }

    if (!file.patch || !file.patch.trim()) {
      skipped.push({ filePath, reason: 'missing_patch' });
      continue;
    }

    included.push({
      filePath,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes,
      patch: file.patch.slice(0, maxPatchChars),
    });
  }

  const filesForAI = included.slice(0, maxFiles);
  const omittedCount = Math.max(included.length - filesForAI.length, 0);

  const totals = filesForAI.reduce(
    (acc, f) => {
      acc.additions += f.additions || 0;
      acc.deletions += f.deletions || 0;
      acc.files += 1;
      return acc;
    },
    { additions: 0, deletions: 0, files: 0 }
  );

  return {
    filesForAI,
    summary: {
      filesIncluded: filesForAI.length,
      filesOmitted: omittedCount,
      filesSkipped: skipped.length,
      skipped,
      totals,
    },
  };
};

module.exports = {
  buildPRFileInputs,
  isIgnoredFile,
};
