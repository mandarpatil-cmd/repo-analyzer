import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { startAnalysis } from '../api/repoApi';

export default function Analyze() {
  const navigate = useNavigate();
  const [repoUrl, setRepoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const validateGithubUrl = (url) => {
    const pattern = /^https?:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/;
    return pattern.test(url.replace(/\.git$/, '').trim());
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    setError('');

    if (!repoUrl.trim()) {
      setError('Please enter a GitHub repository URL');
      return;
    }
    if (!validateGithubUrl(repoUrl)) {
      setError('Please enter a valid GitHub URL (e.g. https://github.com/owner/repo)');
      return;
    }

    setLoading(true);
    try {
      const response = await startAnalysis(repoUrl);

      if (response.success && response.analysisId) {
        // Navigate to Results page with analysisId — Results will handle polling/fetching
        navigate(`/results/${response.analysisId}`, {
          state: {
            cached: response.cached,
            initialStatus: response.status,
          },
        });
      } else {
        setError(response.message || 'Failed to start analysis');
      }
    } catch (err) {
      console.error('Analyze error:', err);
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Navbar */}
      <nav className="bg-white/10 backdrop-blur-lg border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">🚀 EDAI Code Analyzer</h1>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition"
          >
            ← Dashboard
          </button>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-bold text-white mb-4">
            Analyze Any GitHub Repository
          </h1>
          <p className="text-gray-400 text-lg">
            Get deep AI insights, dependency graphs, and onboarding docs in seconds
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
          <form onSubmit={handleAnalyze} className="space-y-5">
            <div>
              <label className="block text-white font-medium mb-2">
                GitHub Repository URL
              </label>
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/facebook/react"
                disabled={loading}
                className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 disabled:opacity-50"
              />
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500/40 text-red-300 px-4 py-3 rounded-lg text-sm">
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-lg font-semibold text-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Starting analysis...
                </>
              ) : (
                <>✨ Analyze Repository</>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-gray-400 text-sm mb-3">Try these popular repos:</p>
            <div className="flex flex-wrap gap-2">
              {[
                'https://github.com/expressjs/express',
                'https://github.com/axios/axios',
                'https://github.com/vercel/swr',
              ].map((url) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setRepoUrl(url)}
                  disabled={loading}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 rounded-lg text-xs transition disabled:opacity-50"
                >
                  {url.replace('https://github.com/', '')}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}