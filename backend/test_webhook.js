async function run() {
  try {
    const res = await fetch('http://localhost:5000/api/webhook/github-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: "u2WtWMCdwKF3xe5EWls2keCorfp-TlVZ",
        prUrl: "https://github.com/mandaratcode/demo-repo/pull/1",
        prNumber: 1,
        repoFullName: "https://github.com/mandaratcode/demo-repo",
        headSha: "dummy-sha"
      })
    });
    const data = await res.json();
    console.log("STATUS:", res.status);
    console.log("SUCCESS:", data);
  } catch (err) {
    console.log("ERROR:", err.message);
  }
}

run();
