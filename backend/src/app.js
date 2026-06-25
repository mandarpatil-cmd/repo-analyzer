require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const { connectNeo4j } = require('./config/neo4j');
const { getRedisConnection } = require('./config/redis');

const authRoutes = require('./routes/auth.routes');
const { repoRouter, integrationRouter, webhookRouter } = require('./routes/repo.routes');
const workspaceRoutes = require('./routes/workspace.routes');
const verifyToken = require('./middleware/verifyToken');
const errorHandler = require('./middleware/errorHandler');

const repoController = require('./controllers/repo.controller');
const path = require('path');

const { startAnalysisWorker } = require('./jobs/analysisWorker');
const { startEmbeddingWorker } = require('./jobs/embeddingWorker');
const chatRoutes = require('./routes/chat.routes');

const app = express();

// Connect databases
connectDB();
connectNeo4j();
getRedisConnection(); // initializes redis

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/repo', repoRouter);
app.use('/api/integrations', verifyToken, integrationRouter);
app.use('/api/webhook', webhookRouter);
app.use('/api/workspaces', verifyToken, workspaceRoutes);
app.use('/api/chat', chatRoutes);

// Serve generated exports (PDFs)
app.use('/exports', express.static(path.join(__dirname, '..', 'temp', 'exports')));

// Public share view (no auth)
app.get('/share/:token', repoController.getPublicShare);

app.get('/', (req, res) => {
  res.json({ message: '🚀 EDAI Backend is running!' });
});

// Start background workers (once only)
startAnalysisWorker();
startEmbeddingWorker();

// Error handler (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});