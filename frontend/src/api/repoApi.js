import api from './index';

// ─── Start analysis (returns analysisId immediately) ───────────────
export const startAnalysis = async (repoUrl, forceRefresh = false) => {
  const { data } = await api.post('/repo/analyze', { repoUrl, forceRefresh });
  return data; // { success, cached, analysisId, status, data? }
};

// ─── Poll analysis status ──────────────────────────────────────────
export const getAnalysisStatus = async (analysisId) => {
  const { data } = await api.get(`/repo/status/${analysisId}`);
  return data; // { success, status, progress, errorMessage, embeddingsStatus }
};

// ─── Fetch full analysis result ────────────────────────────────────
export const getAnalysisResult = async (analysisId) => {
  const { data } = await api.get(`/repo/result/${analysisId}`);
  return data; // { success, data: {...full analysis...} }
};

// ─── List user's previous analyses ─────────────────────────────────
export const listMyAnalyses = async () => {
  const { data } = await api.get('/repo/my-analyses');
  return data; // { success, analyses: [...] }
};

// ─── Generate AI Insights (only needs analysisId) ──────────────────
export const generateAIInsights = async (analysisId) => {
  const { data } = await api.post('/repo/ai-insights', { analysisId });
  return data; // { success, cached, insights }
};

// ─── Export analysis to PDF
export const exportAnalysisPdf = async (analysisId) => {
  const { data } = await api.post('/repo/export-pdf', { analysisId });
  return data; // { success, url }
};

// ─── Create shareable public link
export const createShareLink = async (analysisId, expiresDays = 7) => {
  const { data } = await api.post('/repo/create-share-link', { analysisId, expiresDays });
  return data; // { success, url, token, expiresAt }
};

// ─── Get basic metadata (light call) ───────────────────────────────
export const getRepoMetadata = async (repoUrl) => {
  const { data } = await api.post('/repo/metadata', { repoUrl });
  return data;
};

// ─── Create PR review job ─────────────────────────────────────────
export const createPRReview = async (prUrl) => {
  const res = await api.post('/repo/pr-review', { prUrl });
  return res.data;
};

export const getPRReview = async (reviewId) => {
  const res = await api.get(`/repo/pr-review/${reviewId}`);
  return res.data;
};

export const listMyPRReviews = async () => {
  const res = await api.get('/repo/pr-reviews');
  return res.data;
};

// ─── Security Report ──────────────────────────────────────────────
export const getSecurityReport = async (analysisId) => {
  const { data } = await api.get(`/repo/${analysisId}/security`);
  return data;
};
export const triggerSecurityRescan = async (analysisId) => {
  const { data } = await api.post(`/repo/${analysisId}/security/rescan`);
  return data;
};

// ─── Integrations (GitHub Actions) ────────────────────────────────
export const createIntegration = async (payload) => {
  const { data } = await api.post('/integrations/github-action', payload);
  return data;
};
export const listIntegrations = async () => {
  const { data } = await api.get('/integrations');
  return data;
};
export const deleteIntegration = async (id) => {
  const { data } = await api.delete(`/integrations/${id}`);
  return data;
};

// ─── Workspaces ───────────────────────────────────────────────────
export const listMyWorkspaces = async () => {
  const { data } = await api.get('/workspaces');
  return data;
};
export const getWorkspace = async (id) => {
  const { data } = await api.get(`/workspaces/${id}`);
  return data;
};
export const createWorkspace = async (name) => {
  const { data } = await api.post('/workspaces', { name });
  return data;
};
export const deleteWorkspace = async (id) => {
  const { data } = await api.delete(`/workspaces/${id}`);
  return data;
};
export const inviteWorkspaceMember = async (workspaceId, payload) => {
  const { data } = await api.post(`/workspaces/${workspaceId}/members`, payload);
  return data;
};
export const removeWorkspaceMember = async (workspaceId, memberId) => {
  const { data } = await api.delete(`/workspaces/${workspaceId}/members/${memberId}`);
  return data;
};
export const listWorkspaceAnalyses = async (workspaceId) => {
  const { data } = await api.get(`/workspaces/${workspaceId}/analyses`);
  return data;
};
export const assignAnalysisToWorkspace = async (workspaceId, analysisId) => {
  const { data } = await api.post(`/workspaces/${workspaceId}/analyses/${analysisId}/assign`);
  return data;
};
export const transferWorkspaceOwnership = async (workspaceId, newOwnerId) => {
  const { data } = await api.post(`/workspaces/${workspaceId}/transfer`, { newOwnerId });
  return data;
};

// ─── Annotations ──────────────────────────────────────────────────
export const listAnnotations = async (workspaceId, analysisId, params) => {
  const { data } = await api.get(`/workspaces/${workspaceId}/analyses/${analysisId}/annotations`, { params });
  return data;
};
export const createAnnotation = async (workspaceId, analysisId, payload) => {
  const { data } = await api.post(`/workspaces/${workspaceId}/analyses/${analysisId}/annotations`, payload);
  return data;
};
export const updateAnnotation = async (workspaceId, analysisId, annotId, payload) => {
  const { data } = await api.patch(`/workspaces/${workspaceId}/analyses/${analysisId}/annotations/${annotId}`, payload);
  return data;
};
export const deleteAnnotation = async (workspaceId, analysisId, annotId) => {
  const { data } = await api.delete(`/workspaces/${workspaceId}/analyses/${analysisId}/annotations/${annotId}`);
  return data;
};
export const addAnnotationReply = async (workspaceId, analysisId, annotId, payload) => {
  const { data } = await api.post(`/workspaces/${workspaceId}/analyses/${analysisId}/annotations/${annotId}/reply`, payload);
  return data;
};
export const resolveAnnotation = async (workspaceId, analysisId, annotId, payload) => {
  const { data } = await api.patch(`/workspaces/${workspaceId}/analyses/${analysisId}/annotations/${annotId}/resolve`, payload);
  return data;
};