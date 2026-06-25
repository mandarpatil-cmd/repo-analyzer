const simpleGit = require('simple-git');
const fse = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

/**
 * Generate a unique folder name for each repo clone
 */
const getCloneDir = (repoUrl) => {
  const hash = crypto.createHash('md5').update(repoUrl).digest('hex').slice(0, 8);
  const baseDir = path.resolve(process.env.CLONE_DIR || './temp');
  return path.join(baseDir, `repo_${hash}`);
};

/**
 * Clone a repository locally
 * Skips cloning if already cloned (cache)
 */
const cloneRepository = async (cloneUrl, onProgress = null) => {
  const cloneDir = getCloneDir(cloneUrl);

  // If already cloned, skip
  const alreadyExists = await fse.pathExists(cloneDir);
  if (alreadyExists) {
    console.log(`📁 Repo already cloned at: ${cloneDir}`);
    return cloneDir;
  }

  await fse.ensureDir(cloneDir);

  const git = simpleGit({
    progress({ method, stage, progress }) {
      if (onProgress) onProgress({ method, stage, progress });
    },
  });

  console.log(`⬇️  Cloning ${cloneUrl}...`);

  await git.clone(cloneUrl, cloneDir, [
    '--depth=200',       // Last 200 commits — deep enough for analysis
    '--single-branch',   // Only default branch
    '--no-tags',         // Skip tags to speed up
  ]);

  console.log(`✅ Cloned to: ${cloneDir}`);
  return cloneDir;
};

/**
 * Extract full commit history with file changes
 */
const extractCommitHistory = async (repoDir) => {
  const git = simpleGit(repoDir);

  try {
    // Get commits using raw git command
    // Using pipe as delimiter since messages are unlikely to contain it
    const rawLog = await git.raw([
      'log',
      '--format=%H|%an|%ae|%at|%s',
      '-500'
    ]);

    const commits = [];
    const lines = rawLog.trim().split('\n').filter(line => line.trim());
    
    console.log(`📊 Extracted ${lines.length} commit lines`);

    // Process each commit line
    for (const line of lines) {
      const parts = line.split('|');
      if (parts.length < 5) continue;
      
      const hash = parts[0].trim();
      const authorName = parts[1].trim();
      const authorEmail = parts[2].trim();
      const timestamp = parts[3].trim();
      // Message might contain pipes, so rejoin remaining parts
      const message = parts.slice(4).join('|').trim();

      if (!hash) continue;

      // Get files changed in this commit
      let filesChanged = [];
      try {
        const diffStat = await git.raw([
          'diff-tree',
          '--no-commit-id',
          '-r',
          '--name-status',
          hash,
        ]);
        filesChanged = diffStat
          .trim()
          .split('\n')
          .filter(Boolean)
          .map((line) => {
            const [status, ...fileParts] = line.split('\t');
            return { status: status.trim(), filePath: fileParts.join('\t').trim() };
          });
      } catch {
        filesChanged = [];
      }

      commits.push({
        hash,
        shortHash: hash.slice(0, 7),
        authorName: authorName || 'Unknown',
        authorEmail: authorEmail || '',
        timestamp: new Date(parseInt(timestamp) * 1000).toISOString(),
        message: message || '(no message)',
        filesChanged,
        filesChangedCount: filesChanged.length,
      });
    }

    console.log(`✅ Extracted ${commits.length} commits from ${lines.length} lines`);
    if (commits.length > 0) {
      console.log(`   First: ${commits[0].hash.slice(0,7)} - "${commits[0].message.substring(0, 40)}"`);
      console.log(`   Last:  ${commits[commits.length - 1].hash.slice(0,7)} - "${commits[commits.length - 1].message.substring(0, 40)}"`);
    }
    return commits;
  } catch (err) {
    console.error('❌ Error extracting commits:', err.message);
    return [];
  }
};

/**
 * Get all files in repo (excluding unwanted dirs)
 */
const EXCLUDED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next',
  'coverage', '.cache', 'vendor', '__pycache__', '.venv',
]);

const SUPPORTED_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.c', '.cpp',
  '.cs', '.go', '.rb', '.rs', '.php', '.swift', '.kt', '.scala',
  '.vue', '.svelte', '.html', '.css', '.scss',
]);

const getAllCodeFiles = async (repoDir) => {
  const results = [];

  const walk = async (dir, relativePath = '') => {
    const entries = await fse.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);
      const relPath = path.join(relativePath, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath, relPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (!SUPPORTED_EXTENSIONS.has(ext)) continue;

        const stats = await fse.stat(fullPath);

        // Skip files over 500KB (minified/generated)
        if (stats.size > 512000) continue;

        results.push({
          absolutePath: fullPath,
          relativePath: relPath.replace(/\\/g, '/'), // Normalize for Windows
          fileName: entry.name,
          extension: ext,
          sizeBytes: stats.size,
        });
      }
    }
  };

  await walk(repoDir);
  return results;
};

/**
 * Cleanup cloned repo from disk
 */
const deleteClonedRepo = async (repoDir) => {
  try {
    await fse.remove(repoDir);
    console.log(`🗑️  Cleaned up: ${repoDir}`);
  } catch (err) {
    console.error(`⚠️  Cleanup failed: ${err.message}`);
  }
};

module.exports = {
  getCloneDir,
  cloneRepository,
  extractCommitHistory,
  getAllCodeFiles,
  deleteClonedRepo,
};