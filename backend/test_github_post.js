const { Octokit } = require('@octokit/rest');
require('dotenv').config();

async function run() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("No GITHUB_TOKEN in .env");
    process.exit(1);
  }

  const octokit = new Octokit({ auth: token });
  try {
    const res = await octokit.rest.issues.createComment({
      owner: 'mandaratcode',
      repo: 'demo-repo',
      issue_number: 1, // Using PR #1 for demo
      body: "## 🤖 EDAI Test Comment\n\nThis is a test to verify that the GitHub integration is successfully authorized to post comments on your repository!\n\n_Powered by EDAI_"
    });
    console.log("✅ Successfully posted comment!");
    console.log("Comment URL:", res.data.html_url);
  } catch (err) {
    console.error("❌ Failed to post comment:", err.message);
  }
}

run();
