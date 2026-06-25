const { nanoid } = require('nanoid');
const Integration = require('../models/Integration.model');
const PRReview = require('../models/PRReview.model');
const { enqueuePRReview } = require('../jobs/queue');

const buildWorkflowYaml = (apiBaseUrl) => `name: EDAI AI PR Review

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  ai-review:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger EDAI PR Review
        run: |
          curl -X POST ${apiBaseUrl}/api/webhook/github-action \\
            -H "Content-Type: application/json" \\
            -d '{
              "apiKey": "$` + `{{ secrets.EDAI_API_KEY }}",
              "prUrl": "$` + `{{ github.event.pull_request.html_url }}",
              "prNumber": $` + `{{ github.event.pull_request.number }},
              "repoFullName": "$` + `{{ github.repository }}",
              "headSha": "$` + `{{ github.event.pull_request.head.sha }}"
            }'`;

exports.createIntegration = async (req, res) => {
  try {
    const { repoFullName, githubToken, postComments } = req.body || {};
    if (!repoFullName || !githubToken) {
      return res.status(400).json({ success: false, message: 'repoFullName and githubToken are required' });
    }

    const apiKey = nanoid(32);
    const integration = await Integration.create({
      userId: req.user.id,
      repoFullName,
      apiKey,
      githubToken,
      postComments: postComments !== undefined ? postComments : true,
      active: true,
    });

    const baseUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    const instructions = buildWorkflowYaml(baseUrl);

    res.status(201).json({
      success: true,
      apiKey,
      repoFullName: integration.repoFullName,
      instructions,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.listIntegrations = async (req, res) => {
  try {
    const integrations = await Integration.find({ userId: req.user.id }).select(
      'repoFullName active createdAt lastTriggeredAt triggerCount apiKey githubToken postComments'
    );
    res.status(200).json({ success: true, integrations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteIntegration = async (req, res) => {
  try {
    const { integrationId } = req.params;
    const integration = await Integration.findOneAndDelete({
      _id: integrationId,
      userId: req.user.id,
    });

    if (!integration) {
      return res.status(404).json({ success: false, message: 'Integration not found' });
    }

    res.status(200).json({ success: true, message: 'Integration deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.handleGitHubActionWebhook = async (req, res) => {
  try {
    console.log("📥 Received Webhook Payload:", req.body);
    const { apiKey, prUrl, repoFullName, prNumber, headSha } = req.body || {};
    if (!apiKey || !prUrl || !repoFullName || !prNumber) {
      return res.status(400).json({ success: false, message: 'Missing webhook payload fields' });
    }

    const allIntegrations = await Integration.find({});
    console.log(`🔍 Total integrations in DB: ${allIntegrations.length}`);
    if (allIntegrations.length > 0) {
      console.log(`🔍 First integration in DB: apiKey='${allIntegrations[0].apiKey}', repoFullName='${allIntegrations[0].repoFullName}'`);
    }

    const integration = await Integration.findOne({ apiKey, repoFullName, active: true });
    if (!integration) {
      console.log(`❌ findOne returned null for apiKey=${apiKey}, repoFullName=${repoFullName}`);
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    integration.lastTriggeredAt = new Date();
    integration.triggerCount = (integration.triggerCount || 0) + 1;
    await integration.save();

    const review = await PRReview.create({
      userId: integration.userId,
      prUrl,
      repoFullName,
      pullNumber: prNumber,
      status: 'queued',
      progress: { step: 'Queued for review', percent: 0 },
    });

    const jobId = await enqueuePRReview(review._id, prUrl, integration.userId, 'integration', {
      postComment: integration.postComments,
      prNumber,
      repoFullName,
      githubToken: integration.githubToken,
      headSha,
    });

    review.jobId = jobId;
    await review.save();

    res.status(202).json({ success: true, message: 'PR review queued' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
