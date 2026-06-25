import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import {
  getAnalysisStatus,
  getAnalysisResult,
  generateAIInsights,
  exportAnalysisPdf,
  createShareLink,
} from '../api/repoApi';
import CodebaseChat from '../components/dashboard/CodebaseChat';
import SecurityPanel from '../components/dashboard/SecurityPanel';
import KnowledgeGraph from '../components/graph/KnowledgeGraph';
import AnnotationPanel from '../components/dashboard/AnnotationPanel';

const COLORS = ['#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];

function textOrFallback(value, fallback) {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function RepoSummaryCard({ summary }) {
  if (!summary) return null;
  return (
    <div className="bg-white/5 rounded-2xl p-6 border border-purple-500/30 mb-6">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-4xl">🤖</span>
        <h2 className="text-2xl font-bold text-white flex-1">AI Onboarding Summary</h2>
        <span className="px-3 py-1 bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded-full text-xs font-semibold">
          New Employee Guide
        </span>
      </div>
      <div className="mb-5">
        <h3 className="text-purple-300 font-semibold mb-2">📌 What is this project?</h3>
        <p className="text-gray-300 leading-relaxed">
          {textOrFallback(summary.projectOverview, 'AI did not return a project overview for this analysis yet.')}
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <h4 className="text-white font-semibold text-sm mb-2">🛠 Tech Stack</h4>
          <p className="text-gray-400 text-sm leading-relaxed">
            {textOrFallback(summary.techStack, 'No tech stack summary was generated yet.')}
          </p>
        </div>
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <h4 className="text-white font-semibold text-sm mb-2">🏗 Architecture</h4>
          <p className="text-gray-400 text-sm leading-relaxed">
            {textOrFallback(summary.architectureStyle, 'No architecture summary was generated yet.')}
          </p>
        </div>
      </div>
      <div className="mb-5">
        <h3 className="text-purple-300 font-semibold mb-2">📁 Folder Structure Explained</h3>
        <p className="text-gray-300 text-sm leading-relaxed">
          {textOrFallback(summary.folderStructureExplained, 'No folder structure explanation was generated yet.')}
        </p>
      </div>
      <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-4 mb-5">
        <h4 className="text-green-400 font-semibold text-sm mb-2">🚀 Where to Start Reading</h4>
        <p className="text-gray-300 text-sm leading-relaxed">
          {textOrFallback(summary.whereToStart, 'No starting point was generated yet.')}
        </p>
      </div>
      {summary.criticalFlows?.length > 0 && (
        <div className="mb-5">
          <h3 className="text-purple-300 font-semibold mb-3">🔄 Critical Flows to Understand</h3>
          <ul className="space-y-2">
            {summary.criticalFlows.map((flow, i) => (
              <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                <span className="text-purple-400 mt-0.5">✦</span>
                <span>{flow}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-4">
        <h4 className="text-purple-400 font-semibold text-sm mb-2">📅 Your First Week Guide</h4>
        <p className="text-gray-300 text-sm leading-relaxed">
          {textOrFallback(summary.firstWeekGuide, 'No first-week guide was generated yet.')}
        </p>
      </div>
    </div>
  );
}

function FileInsightCard({ fileData }) {
  const [expanded, setExpanded] = useState(false);
  const [expandedFunc, setExpandedFunc] = useState(null);
  const { fileName, language, totalLines, functionCount, fileInsight, functionInsights } = fileData;

  const layerColors = {
    Controller: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
    Service: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
    Model: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30' },
    Route: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/30' },
    Middleware: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
    Config: { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/30' },
    Utility: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
  };
  const lc = layerColors[fileInsight?.layer] || { bg: 'bg-white/5', text: 'text-gray-400', border: 'border-white/10' };

  return (
    <div className="bg-white/5 rounded-xl border border-white/10 mb-3 overflow-hidden">
      <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-white/5 transition" onClick={() => setExpanded(!expanded)}>
        <span className={`px-2 py-0.5 rounded text-xs font-bold border shrink-0 ${lc.bg} ${lc.text} ${lc.border}`}>
          {fileInsight?.layer || 'File'}
        </span>
        <span className="text-white font-mono text-sm font-semibold flex-1 truncate">{fileName}</span>
        <span className="text-gray-500 text-xs hidden md:block flex-1 truncate">{fileInsight?.role?.slice(0, 70)}...</span>
        <span className="text-gray-400 text-xs shrink-0">{language} • {totalLines} lines • {functionCount} fn</span>
        <span className="text-purple-400 text-xs ml-2">{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <div className="px-5 pb-5 border-t border-white/10 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
              <h4 className="text-white text-sm font-semibold mb-1">🎯 Role in the App</h4>
              <p className="text-gray-400 text-sm leading-relaxed">
                {textOrFallback(fileInsight?.role, 'No file role summary was generated yet.')}
              </p>
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
              <h4 className="text-white text-sm font-semibold mb-1">✏️ When would you edit this?</h4>
              <p className="text-gray-400 text-sm leading-relaxed">
                {textOrFallback(fileInsight?.whoShouldEdit, 'No edit guidance was generated yet.')}
              </p>
            </div>
          </div>
          {fileInsight?.keyResponsibilities?.length > 0 && (
            <div className="mb-4">
              <h4 className="text-white text-sm font-semibold mb-2">📋 Key Responsibilities</h4>
              <ul className="space-y-1">
                {fileInsight.keyResponsibilities.map((r, i) => (
                  <li key={i} className="text-gray-400 text-sm flex items-start gap-2">
                    <span className="text-purple-400">•</span><span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {fileInsight?.dependencies && (
            <div className="bg-white/5 rounded-lg p-3 border border-white/10 mb-4">
              <h4 className="text-white text-sm font-semibold mb-1">🔗 Dependencies</h4>
              <p className="text-gray-400 text-sm">
                {textOrFallback(fileInsight.dependencies, 'No dependency summary was generated yet.')}
              </p>
            </div>
          )}
          {fileInsight?.newEmployeeWarning && (
            <div className="flex gap-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3 mb-4">
              <span className="text-xl shrink-0">⚠️</span>
              <div>
                <p className="text-yellow-400 text-sm font-semibold">Must Know Before Editing</p>
                <p className="text-gray-300 text-sm mt-1 leading-relaxed">{fileInsight.newEmployeeWarning}</p>
              </div>
            </div>
          )}
          {functionInsights?.length > 0 && (
            <div>
              <h4 className="text-purple-300 font-semibold text-sm mb-3">⚡ Functions ({functionInsights.length} analyzed)</h4>
              <div className="space-y-2">
                {functionInsights.map((fn, i) => (
                  <div key={i} className="bg-black/20 rounded-lg border border-white/5 overflow-hidden">
                    <div
                      className="flex items-center gap-3 p-3 cursor-pointer hover:bg-white/5 transition"
                      onClick={() => setExpandedFunc(expandedFunc === i ? null : i)}
                    >
                      <code className="text-purple-300 font-mono text-sm font-bold shrink-0">{fn.name}()</code>
                      <span className="text-gray-500 text-xs flex-1 truncate">
                        {textOrFallback(fn.insight?.summary, 'No summary generated yet.')}
                      </span>
                      <span className="text-xs text-gray-500 shrink-0">Lines {fn.startLine}–{fn.endLine}</span>
                      <span className="text-purple-400 text-xs ml-2">{expandedFunc === i ? '▲' : '▼'}</span>
                    </div>
                    {expandedFunc === i && (
                      <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <p className="text-white text-xs font-semibold mb-1">📥 Inputs / Parameters</p>
                            <p className="text-gray-400 text-xs leading-relaxed">
                              {textOrFallback(fn.insight?.inputs, fn.params?.join(', ') || 'None')}
                            </p>
                          </div>
                          <div>
                            <p className="text-white text-xs font-semibold mb-1">📤 Output / Return</p>
                            <p className="text-gray-400 text-xs leading-relaxed">
                              {textOrFallback(fn.insight?.outputs, 'See code')}
                            </p>
                          </div>
                        </div>
                        <div>
                          <p className="text-white text-xs font-semibold mb-1">⚙️ How it works</p>
                          <p className="text-gray-400 text-xs leading-relaxed">
                            {textOrFallback(fn.insight?.howItWorks, 'No explanation was generated yet.')}
                          </p>
                        </div>
                        <div className="flex gap-2 bg-blue-900/20 border border-blue-500/20 rounded-lg p-3">
                          <span className="text-base shrink-0">💡</span>
                          <div>
                            <p className="text-blue-400 text-xs font-semibold">Dev Tip</p>
                            <p className="text-gray-300 text-xs mt-0.5 leading-relaxed">
                              {textOrFallback(fn.insight?.newEmployeeTip, 'No dev tip was generated yet.')}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AIInsightsTab({ insights, loading, onGenerateClick }) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-5">
        <div className="w-14 h-14 border-4 border-purple-800 border-t-purple-400 rounded-full animate-spin" />
        <p className="text-white text-xl font-semibold">🤖 AI is analyzing your codebase...</p>
        <p className="text-gray-400 text-sm">Generating onboarding documentation for new employees</p>
        <p className="text-gray-500 text-xs">This takes 30–90 seconds depending on repo size</p>
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
        <span className="text-7xl">🤖</span>
        <h3 className="text-white text-2xl font-bold">AI Insights Not Generated Yet</h3>
        <p className="text-gray-400 text-base max-w-md leading-relaxed">
          Generate deep AI-powered explanations of every file and function — perfect for new employees joining your team.
        </p>
        <ul className="text-gray-500 text-sm space-y-1 text-left">
          <li>✅ Plain-English project overview</li>
          <li>✅ Architecture & folder structure explained</li>
          <li>✅ Every file's role & when to edit it</li>
          <li>✅ Every function explained with inputs/outputs</li>
          <li>✅ First-week onboarding guide</li>
          <li>✅ Commit history decoded</li>
        </ul>
        <button
          onClick={onGenerateClick}
          className="mt-2 px-8 py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-lg font-semibold transition"
        >
          ✨ Generate AI Insights
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <RepoSummaryCard summary={insights.repoSummary} />
      {insights.fileInsights?.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-white mb-4">
            📂 File-by-File Breakdown
            <span className="ml-2 text-sm text-gray-400 font-normal">
              ({insights.fileInsights.length} files analyzed — click to expand)
            </span>
          </h2>
          {insights.fileInsights.map((fd, i) => (
            <FileInsightCard key={i} fileData={fd} />
          ))}
        </div>
      )}
      {insights.commitInsights?.length > 0 && (
        <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
          <h2 className="text-xl font-bold text-white mb-5">📝 Commit History Explained</h2>
          <div className="space-y-4">
            {insights.commitInsights.map((c, i) => (
              <div key={i} className="flex gap-4 pb-4 border-b border-white/5 last:border-0">
                <code className="bg-purple-900/30 text-purple-300 rounded px-2 py-1 text-xs font-mono self-start shrink-0">
                  {c.sha?.slice(0, 7)}
                </code>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium mb-1">{c.message}</p>
                  <p className="text-gray-400 text-sm">{c.insight?.whatChanged}</p>
                  {c.insight?.whyItMatters && (
                    <p className="text-purple-400 text-xs mt-1">Why it matters: {c.insight.whyItMatters}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AnalysisProgress({ progress, status }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center px-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-10 border border-white/20 max-w-2xl w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-purple-500/20 rounded-full mb-4">
            <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-400 rounded-full animate-spin" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Analyzing Repository...</h1>
          <p className="text-gray-400">Sit tight — this usually takes 30 seconds to 2 minutes</p>
        </div>
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-purple-300 font-medium">{progress?.step || 'Starting...'}</span>
            <span className="text-white font-bold">{progress?.percent || 0}%</span>
          </div>
          <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500 ease-out"
              style={{ width: `${progress?.percent || 0}%` }}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          {[
            { step: 'Fetching GitHub metadata', threshold: 10 },
            { step: 'Cloning repository', threshold: 25 },
            { step: 'Extracting commits & files', threshold: 45 },
            { step: 'Parsing code with Tree-Sitter', threshold: 65 },
            { step: 'Building knowledge graph', threshold: 85 },
            { step: 'Saving results', threshold: 95 },
          ].map(({ step, threshold }) => (
            <div
              key={step}
              className={`flex items-center gap-2 ${
                (progress?.percent || 0) >= threshold ? 'text-green-400' : 'text-gray-500'
              }`}
            >
              <span>{(progress?.percent || 0) >= threshold ? '✅' : '⏳'}</span>
              <span>{step}</span>
            </div>
          ))}
        </div>
        <p className="text-center text-gray-500 text-xs mt-6">
          Status: <span className="font-mono">{status}</span>
        </p>
      </div>
    </div>
  );
}

const TABS = [
  { id: 'overview',  label: 'Overview' },
  { id: 'files',     label: 'Files' },
  { id: 'functions', label: 'Functions' },
  { id: 'commits',   label: 'Commits' },
  { id: 'security',  label: '🔒 Security' },
  { id: 'ai',        label: '🤖 AI Insights' },
  { id: 'graph',     label: '🕸️ Graph' },
  { id: 'chat',      label: '💬 Chat' },
];

export default function Results() {
  const { analysisId } = useParams();
  const navigate = useNavigate();

  const [activeTab, setActiveTab]   = useState('overview');
  const [repoData, setRepoData]     = useState(null);
  const [status, setStatus]         = useState('queued');
  const [progress, setProgress]     = useState({ step: 'Starting...', percent: 0 });
  const [error, setError]           = useState(null);
  const [aiInsights, setAiInsights] = useState(null);
  const [aiLoading, setAiLoading]   = useState(false);
  const [exporting, setExporting] = useState(false);
  const [shareLink, setShareLink] = useState(null);

  // New states for Workspace integration
  const [workspaces, setWorkspaces] = useState([]);
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);
  const [assigning, setAssigning] = useState(false);

  // Fetch workspaces on load (if user is authenticated)
  useEffect(() => {
    const fetchWS = async () => {
      try {
        const { listMyWorkspaces } = await import('../api/repoApi');
        const res = await listMyWorkspaces();
        if (res.success) setWorkspaces(res.workspaces);
      } catch (err) {
        console.error("Could not fetch workspaces", err);
      }
    };
    fetchWS();
  }, []);

  const handleAssignToWorkspace = async (workspaceId) => {
    setAssigning(true);
    try {
      const { assignAnalysisToWorkspace } = await import('../api/repoApi');
      const res = await assignAnalysisToWorkspace(workspaceId, analysisId);
      if (res.success) {
        setRepoData(prev => ({ ...prev, analysis: res.analysis }));
        setShowWorkspaceModal(false);
        alert('Successfully assigned to workspace!');
      }
    } catch (err) {
      alert('Failed to assign: ' + (err.response?.data?.message || err.message));
    } finally {
      setAssigning(false);
    }
  };

  const pollingRef = useRef(null);

  useEffect(() => {
    if (!analysisId) return;
    let cancelled = false;

    const pollStatus = async () => {
      try {
        const statusRes = await getAnalysisStatus(analysisId);
        if (cancelled) return;

        setStatus(statusRes.status);
        setProgress(statusRes.progress || { step: '', percent: 0 });

        if (statusRes.status === 'completed') {
          const resultRes = await getAnalysisResult(analysisId);
          if (!cancelled && resultRes.success) {
            setRepoData(resultRes.data);
            if (resultRes.data.aiInsights?.repoSummary) {
              setAiInsights(resultRes.data.aiInsights);
            }
          }
          clearInterval(pollingRef.current);
        } else if (statusRes.status === 'failed') {
          setError(statusRes.errorMessage || 'Analysis failed');
          clearInterval(pollingRef.current);
        }
      } catch (err) {
        console.error('Polling error:', err);
        if (!cancelled) {
          setError(err.response?.data?.message || 'Failed to fetch status');
          clearInterval(pollingRef.current);
        }
      }
    };

    pollStatus();
    pollingRef.current = setInterval(pollStatus, 2000);

    return () => {
      cancelled = true;
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [analysisId]);

  const handleGenerateAI = async () => {
    setAiLoading(true);
    try {
      const res = await generateAIInsights(analysisId);
      if (res.success) {
        setAiInsights(res.insights);
      } else {
        alert('AI generation failed: ' + res.message);
      }
    } catch (err) {
      alert('Error: ' + (err.response?.data?.message || err.message));
    } finally {
      setAiLoading(false);
    }
  };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const res = await exportAnalysisPdf(analysisId);
      if (res.success && res.url) {
        // open in new tab
        window.open(res.url, '_blank');
      } else {
        alert('Export failed: ' + (res.message || 'unknown'));
      }
    } catch (err) {
      alert('Export error: ' + (err.response?.data?.message || err.message));
    } finally {
      setExporting(false);
    }
  };

  const handleCreateShare = async () => {
    try {
      const res = await createShareLink(analysisId, 7);
      if (res.success && res.url) {
        setShareLink(res.url);
        navigator.clipboard?.writeText(res.url);
        alert('Share link copied to clipboard');
      } else {
        alert('Create share link failed');
      }
    } catch (err) {
      alert('Error: ' + (err.response?.data?.message || err.message));
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-10 border border-red-500/30 max-w-md text-center">
          <span className="text-6xl mb-4 block">❌</span>
          <h1 className="text-2xl text-white mb-3">Analysis Failed</h1>
          <p className="text-red-300 mb-6">{error}</p>
          <button
            onClick={() => navigate('/analyze')}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition"
          >
            Try Another Repository
          </button>
        </div>
      </div>
    );
  }

  if (!repoData) {
    return <AnalysisProgress progress={progress} status={status} />;
  }

  const { metadata, summary, parsedFiles, commits } = repoData;

  const languageData = (metadata.languageBreakdown || []).map((item) => ({
    name: item.language,
    value: parseFloat(item.percentage),
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">

      <nav className="bg-white/10 backdrop-blur-lg border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">{metadata.name}</h1>
            <p className="text-gray-400 text-sm">{metadata.fullName}</p>
          </div>
          <div className="flex items-center gap-2">
            {repoData.analysis?.workspaceId ? (
              <button
                onClick={() => navigate(`/workspaces/${repoData.analysis.workspaceId}`)}
                className="px-4 py-2 bg-indigo-600/30 text-indigo-300 border border-indigo-500/50 rounded-lg hover:bg-indigo-600/50 transition"
              >
                🏢 View in Workspace
              </button>
            ) : (
              <button
                onClick={() => setShowWorkspaceModal(true)}
                className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition"
              >
                + Assign to Workspace
              </button>
            )}
            <button
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition"
            >
              ← Dashboard
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPdf}
              disabled={exporting}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition"
            >
              {exporting ? 'Exporting...' : 'Export PDF'}
            </button>
            <button
              onClick={handleCreateShare}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition"
            >
              Create Share Link
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {[
            { label: 'Stars',     value: `⭐ ${metadata.stars}` },
            { label: 'Forks',     value: `🍴 ${metadata.forks}` },
            { label: 'Files',     value: `📁 ${summary.totalFiles}` },
            { label: 'Functions', value: `⚡ ${summary.totalFunctions}` },
            { label: 'Commits',   value: `📝 ${summary.totalCommits}` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 text-center">
              <p className="text-gray-400 text-sm">{label}</p>
              <p className="text-3xl font-bold text-white mt-2">{value}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-1 mb-6 bg-white/5 p-1 rounded-lg border border-white/10 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition text-sm whitespace-nowrap ${
                activeTab === tab.id
                  ? tab.id === 'ai'
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                    : tab.id === 'chat'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
                    : 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Chat tab — outside card wrapper, has its own container */}
        {activeTab === 'chat' && (
          <CodebaseChat
            analysisId={analysisId}
            repoName={repoData?.repoFullName || metadata?.fullName || ''}
          />
        )}

        {/* All other tabs — inside glass card */}
        {activeTab !== 'chat' && (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 border border-white/20">

            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-4">Language Breakdown</h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={languageData}
                        cx="50%" cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {languageData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white mb-4">Repository Info</h2>
                  <div className="space-y-3 text-gray-300">
                    <p><span className="text-gray-400">Description: </span>{metadata.description || 'No description'}</p>
                    <p><span className="text-gray-400">Default Branch: </span>{metadata.defaultBranch}</p>
                    <p><span className="text-gray-400">Primary Language: </span>{metadata.primaryLanguage}</p>
                    <p><span className="text-gray-400">License: </span>{metadata.license || 'None'}</p>
                    <p><span className="text-gray-400">Created: </span>{new Date(metadata.createdAt).toLocaleDateString()}</p>
                    <p><span className="text-gray-400">Last Updated: </span>{new Date(metadata.updatedAt).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'files' && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">Code Files ({parsedFiles.length})</h2>
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {parsedFiles.map((file, idx) => (
                    <div key={idx} className="bg-white/5 p-4 rounded-lg hover:bg-white/10 transition">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white font-mono text-sm">{file.relativePath}</p>
                          <p className="text-gray-400 text-xs mt-1">
                            {file.language} • {file.totalLines} lines • {file.functionCount} functions
                          </p>
                        </div>
                        <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-xs">
                          {file.extension}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'functions' && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">Functions ({summary.totalFunctions})</h2>
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {parsedFiles.flatMap((file) =>
                    file.functions.map((fn, idx) => (
                      <div key={`${file.relativePath}-${idx}`} className="bg-white/5 p-4 rounded-lg">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-white font-mono font-semibold">{fn.name}</p>
                            <p className="text-gray-400 text-sm mt-1">
                              in {file.fileName} • Lines {fn.startLine}-{fn.endLine}
                            </p>
                            <p className="text-gray-500 text-xs mt-1">
                              Parameters: {fn.params.join(', ') || 'none'}
                            </p>
                          </div>
                          <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs">
                            {fn.lineCount} lines
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'commits' && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">Recent Commits ({commits?.length || 0})</h2>
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {commits && commits.length > 0 ? (
                    commits.map((commit, idx) => {
                      const commitDate = commit.timestamp 
                        ? new Date(commit.timestamp).toLocaleDateString('en-US', { 
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })
                        : 'No date';
                      
                      return (
                        <div key={idx} className="bg-white/5 p-4 rounded-lg">
                          <p className="text-white font-medium">{commit.message || 'No message'}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                            <span>{commit.authorName || 'Unknown'}</span>
                            <span>•</span>
                            <span>{commitDate}</span>
                            <span>•</span>
                            <span className="font-mono text-xs">{commit.shortHash || commit.hash?.slice(0, 7) || 'N/A'}</span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-gray-400">No commits available</p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'ai' && (
              <AIInsightsTab
                insights={aiInsights}
                loading={aiLoading}
                onGenerateClick={handleGenerateAI}
              />
            )}

            {activeTab === 'security' && (
              <SecurityPanel analysisId={analysisId} />
            )}

            {activeTab === 'graph' && (
              <KnowledgeGraph dependencyMap={repoData.dependencyMap} />
            )}

          </div>
        )}
      </div>

      {repoData.analysis?.workspaceId && (
        <div className="max-w-7xl mx-auto px-4 pb-8">
          <AnnotationPanel workspaceId={repoData.analysis.workspaceId} analysisId={analysisId} />
        </div>
      )}

      {showWorkspaceModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md border border-white/10">
            <h2 className="text-xl font-bold text-white mb-4">Assign to Workspace</h2>
            <p className="text-gray-400 text-sm mb-4">Select a workspace to share this analysis with your team.</p>
            
            <div className="space-y-2 mb-6 max-h-60 overflow-y-auto">
              {workspaces.length === 0 ? (
                <p className="text-gray-500 text-sm">You do not belong to any workspaces.</p>
              ) : (
                workspaces.map(ws => (
                  <button
                    key={ws._id}
                    onClick={() => handleAssignToWorkspace(ws._id)}
                    disabled={assigning}
                    className="w-full text-left px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white transition disabled:opacity-50"
                  >
                    <div className="font-bold">{ws.name}</div>
                    <div className="text-xs text-gray-400">{ws.members.length} members</div>
                  </button>
                ))
              )}
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={() => setShowWorkspaceModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}