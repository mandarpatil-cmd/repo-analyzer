const mongoose = require('mongoose');
const Integration = require('./src/models/Integration.model');
const fetch = require('node-fetch'); // we use global fetch since node 22
require('dotenv').config();

async function run() {
  try {
    console.log("🚀 Simulating End-to-End GitHub Integration Workflow...");
    
    // 1. Connect to DB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Get the first user (we just need a valid userId)
    const User = require('./src/models/User.model');
    const user = await User.findOne();
    if (!user) throw new Error("No users found in database");

    const validToken = process.env.GITHUB_TOKEN;
    const testRepo = "mandaratcode/demo-repo";

    // 2. Clean up old test integrations for this repo
    await Integration.deleteMany({ repoFullName: testRepo });
    console.log(`🧹 Cleared old integrations for ${testRepo}`);

    // 3. Create a perfect Integration record
    const integration = await Integration.create({
      userId: user._id,
      repoFullName: testRepo,
      apiKey: "edai_automated_test_key_123",
      githubToken: validToken,
      postComments: true,
      active: true,
    });
    console.log("✅ Created pristine Integration record with 'postComments: true'");

    // 4. Trigger the Webhook
    console.log("📡 Firing Webhook simulation payload...");
    const res = await fetch('http://localhost:5000/api/webhook/github-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: "edai_automated_test_key_123",
        prUrl: `https://github.com/${testRepo}/pull/2`,
        prNumber: 2,
        repoFullName: testRepo,
        headSha: "dummy-sha"
      })
    });

    const data = await res.json();
    console.log(`STATUS: ${res.status}`);
    console.log(`RESPONSE:`, data);
    
    if (res.status === 202) {
      console.log("\n🎉 Webhook accepted! The AI Worker is now reviewing the PR.");
      console.log("👉 Watch your backend console! Once it finishes, it will post a REAL comment to:");
      console.log(`🔗 https://github.com/${testRepo}/pull/1`);
    }

    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

run();
