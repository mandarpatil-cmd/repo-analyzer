
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listMyAnalyses, listMyPRReviews } from '../api/repoApi';
import { useAuth } from '../hooks/useAuth';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [analyses, setAnalyses] = useState([]);
  const [prReviews, setPrReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [repoRes, prRes] = await Promise.all([
          listMyAnalyses(),
          listMyPRReviews()
        ]);
        if (repoRes.success) setAnalyses(repoRes.analyses);
        if (prRes.success) setPrReviews(prRes.reviews);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  const statusColors = {
    completed: 'bg-green-500/20 text-green-300 border-green-500/40',
    processing: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    queued: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
    failed: 'bg-red-500/20 text-red-300 border-red-500/40',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <nav className="bg-white/10 backdrop-blur-lg border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">🚀 EDAI Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-300 text-sm hidden md:block">👋 {user?.name}</span>
            <button onClick={logout} className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition text-sm">
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Your Repositories</h1>
            <p className="text-gray-400">Previously analyzed repos — click to view insights</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/workspaces')}
              className="px-5 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-semibold transition text-sm"
            >
              🏢 Workspaces
            </button>
            <button
              onClick={() => navigate('/integrations')}
              className="px-5 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-semibold transition text-sm"
            >
              ⚙️ Integrations
            </button>
            <button
              onClick={() => navigate('/pr-review')}
              className="px-5 py-3 bg-emerald-600/80 hover:bg-emerald-500 text-white rounded-lg font-semibold transition"
            >
              PR Review
            </button>
            <button
              onClick={() => navigate('/analyze')}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-lg font-semibold transition"
            >
              Analyze New Repo
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-400 rounded-full animate-spin" />
          </div>
        ) : analyses.length === 0 ? (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 border border-white/20 text-center">
            <span className="text-7xl mb-4 block">📊</span>
            <h2 className="text-2xl text-white font-bold mb-3">No analyses yet</h2>
            <p className="text-gray-400 mb-6">Analyze your first GitHub repository to get started</p>
            <button onClick={() => navigate('/analyze')}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-semibold transition">
              Get Started →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {analyses.map((a) => (
              <div key={a._id}
                onClick={() => navigate(`/results/${a._id}`)}
                className="bg-white/10 backdrop-blur-lg rounded-xl p-5 border border-white/20 hover:border-purple-500/50 hover:bg-white/15 transition cursor-pointer">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-2xl">📦</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[a.status]}`}>
                    {a.status}
                  </span>
                </div>
                <h3 className="text-white font-bold text-lg mb-1 truncate">{a.repoFullName}</h3>
                <p className="text-gray-400 text-xs mb-3 truncate">{a.repoUrl}</p>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  {a.metadata?.stars !== undefined && <span>⭐ {a.metadata.stars}</span>}
                  {a.metadata?.primaryLanguage && <span>• {a.metadata.primaryLanguage}</span>}
                </div>
                <p className="text-gray-500 text-xs mt-3">
                  Analyzed: {new Date(a.analyzedAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}

        {prReviews.length > 0 && (
          <div className="mt-12">
            <h2 className="text-3xl font-bold text-white mb-6">Automated PR Reviews</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {prReviews.map((r) => (
                <div key={r._id}
                  onClick={() => navigate(`/pr-review?id=${r._id}`)}
                  className="bg-white/10 backdrop-blur-lg rounded-xl p-5 border border-white/20 hover:border-purple-500/50 transition relative cursor-pointer">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-2xl">🔍</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[r.status]}`}>
                      {r.status}
                    </span>
                  </div>
                  <h3 className="text-white font-bold text-lg mb-1 truncate">{r.repoFullName}</h3>
                  <p className="text-gray-400 text-sm mb-3">Pull Request #{r.pullNumber}</p>
                  <a href={r.prUrl} target="_blank" rel="noreferrer" className="text-purple-400 hover:text-purple-300 text-xs truncate block mb-3">
                    {r.prUrl}
                  </a>
                  <p className="text-gray-500 text-xs mt-3">
                    Reviewed: {new Date(r.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}