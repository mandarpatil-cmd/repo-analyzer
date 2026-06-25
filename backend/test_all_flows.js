const axios = require('axios');

const API_URL = 'http://localhost:5000/api';
let token = '';
let workspaceId = '';
let analysisId = '';

const testRepoUrl = 'https://github.com/expressjs/express'; // Fast, popular, small-ish repo for quick testing

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  try {
    console.log('🧪 Starting E2E Tests...');

    // 1. Auth: Register
    const email = `testuser_${Date.now()}@example.com`;
    console.log(`\n1️⃣ Testing Registration (${email})...`);
    const regRes = await axios.post(`${API_URL}/auth/register`, {
      name: 'Test User',
      email: email,
      password: 'password123',
    });
    console.log('✅ Registration successful!');
    token = regRes.data.token;
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    // 2. Workspaces: Create
    console.log('\n2️⃣ Testing Workspace Creation...');
    const wsRes = await axios.post(`${API_URL}/workspaces`, {
      name: 'Test Workspace',
      description: 'A workspace for E2E testing',
    });
    workspaceId = wsRes.data.workspace._id;
    console.log(`✅ Workspace created (ID: ${workspaceId})`);

    // 3. Repo: Submit for Analysis
    console.log(`\n3️⃣ Submitting Repository (${testRepoUrl})...`);
    const analyzeRes = await axios.post(`${API_URL}/repo/analyze`, {
      repoUrl: testRepoUrl,
      workspaceId: workspaceId,
    });
    analysisId = analyzeRes.data.analysisId;
    console.log(`✅ Analysis started (ID: ${analysisId})`);

    // 4. Polling for Completion
    console.log('\n4️⃣ Polling for Analysis Completion...');
    let isComplete = false;
    let attempts = 0;
    while (!isComplete && attempts < 120) { // Max 2 minutes
      const statusRes = await axios.get(`${API_URL}/repo/status/${analysisId}`);
      const responseData = statusRes.data;
      const status = responseData.status;
      
      process.stdout.write(`\r   Status: [Overall: ${status}] [AI: ${responseData.progress?.aiInsights}] [Embeddings: ${responseData.embeddingsStatus}]`);
      
      if (status === 'completed' && responseData.embeddingsStatus === 'ready') {
        isComplete = true;
        console.log('\n✅ Analysis and Embeddings completed successfully!');
        break;
      } else if (status === 'failed') {
        console.log('\n❌ Analysis failed!');
        console.error(statusRes.data);
        process.exit(1);
      }
      
      await sleep(2000); // Poll every 2 seconds
      attempts++;
    }

    if (!isComplete) {
      console.log('\n⏳ Polling timed out (2 minutes). Last status:', statusRes?.data);
      process.exit(1);
    }

    // 5. Chat: Test RAG Endpoint
    console.log('\n5️⃣ Testing Codebase Chat (RAG)...');
    const chatRes = await axios.post(`${API_URL}/chat/${analysisId}`, {
      question: 'What does this project do?',
      history: []
    });
    console.log('✅ Chat Response received');

    // 6. Test Integration Creation
    console.log('\n6️⃣ Testing GitHub Integration Creation...');
    const intgRes = await axios.post(`${API_URL}/integrations/github-action`, {
      repoFullName: 'expressjs/express',
      githubToken: 'ghp_fake_token_for_testing'
    });
    console.log(`✅ Integration created with API Key: ${intgRes.data.apiKey}`);

    // 7. Test Security Rescan Trigger
    console.log('\n7️⃣ Testing Security Rescan Trigger...');
    const secRes = await axios.post(`${API_URL}/repo/${analysisId}/security/rescan`);
    console.log(`✅ Security Rescan started: ${secRes.data.message}`);

    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉\n');

  } catch (error) {
    console.error('\n❌ TEST FAILED:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

runTests();
