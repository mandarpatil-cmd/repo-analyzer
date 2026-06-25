let octokit = null;

const initOctokit = async () => {
  if (octokit) return octokit;
  const { Octokit } = await import('@octokit/rest');
  octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
    userAgent: 'EDAI-CodeAnalyzer/1.0',
  });
  return octokit;
};

/**
 * Parse owner and repo name from GitHub URL
 * Handles: https://github.com/owner/repo or https://github.com/owner/repo.git
 */
const parseRepoUrl = (repoUrl) => {
  const cleaned = repoUrl.replace(/\.git$/, '').trim();
  const match = cleaned.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) throw new Error('Invalid GitHub repository URL');
  return { owner: match[1], repo: match[2] };
};

/**
 * Parse owner, repo, and PR number from a GitHub PR URL
 * Handles: https://github.com/owner/repo/pull/123
 */
const parsePullRequestUrl = (prUrl) => {
  const cleaned = prUrl.replace(/\.git$/, '').trim();
  const match = cleaned.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) throw new Error('Invalid GitHub pull request URL');
  return { owner: match[1], repo: match[2], pullNumber: parseInt(match[3], 10) };
};

// Alias with the required name for PR review flow
const parsePRUrl = (prUrl) => parsePullRequestUrl(prUrl);

/**
 * Fetch all core repository metadata from GitHub API
 */
const fetchRepoMetadata = async (repoUrl) => {
  const { owner, repo } = parseRepoUrl(repoUrl);
  const client = await initOctokit();

  // Run all fetches in parallel for speed
  const [repoInfo, languages, contributors, issues, pullRequests, releases] =
    await Promise.allSettled([
      client.repos.get({ owner, repo }),
      client.repos.listLanguages({ owner, repo }),
      client.repos.listContributors({ owner, repo, per_page: 50 }),
      client.issues.listForRepo({
        owner,
        repo,
        state: 'all',
        per_page: 100,
        filter: 'all',
      }),
      client.pulls.list({
        owner,
        repo,
        state: 'all',
        per_page: 100,
      }),
      client.repos.listReleases({ owner, repo, per_page: 10 }),
    ]);

  // Helper to safely extract values from allSettled
  const getValue = (result, fallback = []) =>
    result.status === 'fulfilled' ? result.value.data : fallback;

  const repoData = getValue(repoInfo, null);
  if (!repoData) throw new Error('Repository not found or is private');

  // Separate real issues from PRs (GitHub mixes them)
  const allIssues = getValue(issues);
  const realIssues = allIssues.filter((i) => !i.pull_request);
  const allPRs = getValue(pullRequests);

  // Build language percentage breakdown
  const rawLanguages = getValue(languages, {});
  const totalBytes = Object.values(rawLanguages).reduce((a, b) => a + b, 0);
  const languageBreakdown = Object.entries(rawLanguages).map(([lang, bytes]) => ({
    language: lang,
    bytes,
    percentage: totalBytes > 0 ? ((bytes / totalBytes) * 100).toFixed(2) : '0',
  }));

  // Format contributors
  const formattedContributors = getValue(contributors).map((c) => ({
    login: c.login,
    avatarUrl: c.avatar_url,
    profileUrl: c.html_url,
    contributions: c.contributions,
    type: c.type,
  }));

  // Format issues with labels
  const formattedIssues = realIssues.map((i) => ({
    number: i.number,
    title: i.title,
    state: i.state,
    labels: i.labels.map((l) => l.name),
    createdAt: i.created_at,
    closedAt: i.closed_at,
    author: i.user?.login,
    body: i.body?.substring(0, 500) || '', // truncate for storage
    url: i.html_url,
  }));

  // Format pull requests
  const formattedPRs = allPRs.map((pr) => ({
    number: pr.number,
    title: pr.title,
    state: pr.state,
    merged: pr.merged_at !== null,
    mergedAt: pr.merged_at,
    createdAt: pr.created_at,
    author: pr.user?.login,
    labels: pr.labels.map((l) => l.name),
    url: pr.html_url,
    changedFiles: pr.changed_files,
    additions: pr.additions,
    deletions: pr.deletions,
  }));

  return {
    name: repoData.name,
    fullName: repoData.full_name,
    description: repoData.description,
    owner: {
      login: repoData.owner.login,
      avatarUrl: repoData.owner.avatar_url,
      type: repoData.owner.type,
    },
    url: repoData.html_url,
    cloneUrl: repoData.clone_url,
    defaultBranch: repoData.default_branch,
    isPrivate: repoData.private,
    stars: repoData.stargazers_count,
    forks: repoData.forks_count,
    watchers: repoData.watchers_count,
    openIssuesCount: repoData.open_issues_count,
    size: repoData.size, // KB
    createdAt: repoData.created_at,
    updatedAt: repoData.updated_at,
    pushedAt: repoData.pushed_at,
    topics: repoData.topics || [],
    license: repoData.license?.name || null,
    languageBreakdown,
    primaryLanguage: repoData.language,
    contributors: formattedContributors,
    issues: formattedIssues,
    pullRequests: formattedPRs,
    releases: getValue(releases).map((r) => ({
      tagName: r.tag_name,
      name: r.name,
      publishedAt: r.published_at,
      prerelease: r.prerelease,
    })),
    stats: {
      totalContributors: formattedContributors.length,
      totalIssues: realIssues.length,
      openIssues: realIssues.filter((i) => i.state === 'open').length,
      closedIssues: realIssues.filter((i) => i.state === 'closed').length,
      totalPRs: allPRs.length,
      mergedPRs: allPRs.filter((pr) => pr.merged_at).length,
      totalLanguages: languageBreakdown.length,
    },
  };
};

/**
 * Fetch commit activity per week (for timeline chart)
 */
const fetchCommitActivity = async (repoUrl) => {
  const { owner, repo } = parseRepoUrl(repoUrl);
  const client = await initOctokit();
  try {
    const { data } = await client.repos.getCommitActivityStats({ owner, repo });
    return (data || []).map((week) => ({
      weekTimestamp: week.week,
      totalCommits: week.total,
      days: week.days,
    }));
  } catch {
    return [];
  }
};

/**
 * Fetch code frequency stats (additions/deletions over time)
 */
const fetchCodeFrequency = async (repoUrl) => {
  const { owner, repo } = parseRepoUrl(repoUrl);
  const client = await initOctokit();
  try {
    const { data } = await client.repos.getCodeFrequencyStats({ owner, repo });
    return (data || []).map(([timestamp, additions, deletions]) => ({
      timestamp,
      additions,
      deletions,
    }));
  } catch {
    return [];
  }
};

const fetchPRMetadata = async (prUrl) => {
  const { owner, repo, pullNumber } = parsePRUrl(prUrl);
  const client = await initOctokit();
  const { data: pr } = await client.pulls.get({
    owner,
    repo,
    pull_number: pullNumber,
  });

  return {
    number: pr.number,
    title: pr.title,
    body: pr.body || '',
    state: pr.state,
    merged: pr.merged || false,
    user: pr.user?.login || 'unknown',
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
    baseRef: pr.base?.ref,
    headRef: pr.head?.ref,
    additions: pr.additions,
    deletions: pr.deletions,
    changedFiles: pr.changed_files,
    url: pr.html_url,
    repoFullName: pr.base?.repo?.full_name || `${owner}/${repo}`,
  };
};

const fetchPRFiles = async (prUrl) => {
  const { owner, repo, pullNumber } = parsePRUrl(prUrl);
  const client = await initOctokit();
  const files = [];
  const perPage = 100;
  let page = 1;

  while (true) {
    const { data } = await client.pulls.listFiles({
      owner,
      repo,
      pull_number: pullNumber,
      per_page: perPage,
      page,
    });

    files.push(...(data || []));
    if (!data || data.length < perPage) break;
    page += 1;
  }

  return files.map((f) => ({
    filename: f.filename,
    status: f.status,
    additions: f.additions,
    deletions: f.deletions,
    changes: f.changes,
    patch: f.patch || '',
  }));
};

const fetchPullRequestDetails = async (prUrl) => {
  const { owner, repo, pullNumber } = parsePullRequestUrl(prUrl);
  const client = await initOctokit();

  const { data: pr } = await client.pulls.get({
    owner,
    repo,
    pull_number: pullNumber,
  });

  const files = [];
  const perPage = 100;
  let page = 1;

  while (true) {
    const { data } = await client.pulls.listFiles({
      owner,
      repo,
      pull_number: pullNumber,
      per_page: perPage,
      page,
    });

    files.push(...(data || []));
    if (!data || data.length < perPage) break;
    page += 1;
  }

  return {
    pull: {
      number: pr.number,
      title: pr.title,
      body: pr.body || '',
      state: pr.state,
      merged: pr.merged || false,
      user: pr.user?.login || 'unknown',
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      baseRef: pr.base?.ref,
      headRef: pr.head?.ref,
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changed_files,
      url: pr.html_url,
    },
    files: files.map((f) => ({
      filename: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      changes: f.changes,
      patch: f.patch || '',
    })),
  };
};

module.exports = {
  parseRepoUrl,
  parsePRUrl,
  parsePullRequestUrl,
  fetchRepoMetadata,
  fetchCommitActivity,
  fetchCodeFrequency,
  fetchPRMetadata,
  fetchPRFiles,
  fetchPullRequestDetails,
};