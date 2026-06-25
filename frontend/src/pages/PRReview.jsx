import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createPRReview, getPRReview } from '../api/repoApi';

export default function PRReview() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialId = searchParams.get('id');

  const [prUrl, setPrUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reviewId, setReviewId] = useState(initialId || null);
  const [status, setStatus] = useState(null);
  const [progress, setProgress] = useState(null);
  const [review, setReview] = useState(null);

  useEffect(() => {
    if (initialId) {
      setReviewId(initialId);
    }
  }, [initialId]);

  const validatePrUrl = (url) => {
    const pattern = /^https?:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+\/?$/;
    return pattern.test(url.trim());
  };

  const handleReview = async (e) => {
    e.preventDefault();
    setError('');
    setReview(null);
    setReviewId(null);
    setStatus(null);
    setProgress(null);

    if (!prUrl.trim()) {
      setError('Please enter a GitHub pull request URL.');
      return;
    }
    if (!validatePrUrl(prUrl)) {
      setError('Use a valid PR URL, e.g. https://github.com/owner/repo/pull/123');
      return;
    }

    setLoading(true);
    try {
      const res = await createPRReview(prUrl);
      if (res.success && res.reviewId) {
        setReviewId(res.reviewId);
        setStatus(res.status || 'queued');
      } else {
        setError(res.message || 'PR review failed');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'PR review failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!reviewId) return undefined;

    let isActive = true;
    const poll = async () => {
      try {
        const res = await getPRReview(reviewId);
        if (!isActive) return;

        if (res.success) {
          setStatus(res.status);
          setProgress(res.progress || null);
          if (res.review) {
            setReview(res.review);
          }
          if (res.status === 'failed' && res.errorMessage) {
            setError(res.errorMessage);
          }
        } else {
          setError(res.message || 'Failed to fetch PR review');
        }
      } catch (err) {
        if (isActive) {
          setError(err.response?.data?.message || 'Failed to fetch PR review');
        }
      }
    };

    poll();
    const intervalId = setInterval(poll, 3000);

    return () => {
      isActive = false;
      clearInterval(intervalId);
    };
  }, [reviewId]);

  const groupedFindings = useMemo(() => {
    const groups = { security: [], reliability: [], performance: [], maintainability: [], other: [] };
    (review?.findings || []).forEach((f) => {
      const key = groups[f.category] ? f.category : 'other';
      groups[key].push(f);
    });
    return groups;
  }, [review]);

  const severityBadgeClass = (severity) => {
    switch (severity) {
      case 'high':
        return 'bg-red-500/20 text-red-300 border-red-500/40';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
      case 'low':
      default:
        return 'bg-green-500/20 text-green-300 border-green-500/40';
    }
  };

  const renderFindings = (items) => {
    if (!items || items.length === 0) return <p className="text-gray-400 text-sm">No findings.</p>;
    return (
      <div className="space-y-3">
        {items.map((f, idx) => (
          <div key={idx} className="bg-white/5 border border-white/10 rounded-lg p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-white text-sm font-semibold">{f.title || 'Finding'}</div>
                <div className="text-gray-400 text-xs mt-1">{f.filePath}{f.line ? ` • ${f.line}` : ''}</div>
              </div>
              <span className={`px-2 py-0.5 text-xs uppercase border rounded-full ${severityBadgeClass(f.severity)}`}>
                {f.severity || 'low'}
              </span>
            </div>
            <p className="text-gray-300 text-sm mt-2">{f.explanation || ''}</p>
            {f.suggestedFix && (
              <p className="text-emerald-300 text-xs mt-2">Suggested fix: {f.suggestedFix}</p>
            )}
            {f.confidence && (
              <p className="text-gray-500 text-xs mt-1">Confidence: {f.confidence}</p>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900">
      <nav className="bg-white/10 backdrop-blur-lg border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">PR Review Assistant</h1>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition"
          >
            Back to Dashboard
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 mb-8">
          <form onSubmit={handleReview} className="space-y-4">
            <div>
              <label className="block text-white font-medium mb-2">GitHub PR URL</label>
              <input
                type="text"
                value={prUrl}
                onChange={(e) => setPrUrl(e.target.value)}
                placeholder="https://github.com/owner/repo/pull/123"
                disabled={loading}
                className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-400 disabled:opacity-50"
              />
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500/40 text-red-300 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Queueing review...' : 'Review Pull Request'}
            </button>
          </form>
        </div>

        {reviewId && status && status !== 'completed' && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-white font-semibold">Review Status</h2>
                <p className="text-gray-400 text-sm mt-1">
                  {progress?.step || 'Working on review...'}
                </p>
              </div>
              <span className="px-2 py-0.5 rounded-full text-xs border border-white/20 text-gray-200">
                {status}
              </span>
            </div>
            {typeof progress?.percent === 'number' && (
              <div className="mt-4 bg-white/10 rounded-full h-2 overflow-hidden">
                <div
                  className="h-2 bg-emerald-400"
                  style={{ width: `${Math.min(progress.percent, 100)}%` }}
                />
              </div>
            )}
          </div>
        )}

        {review && (
          <div className="space-y-6">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <h2 className="text-xl text-white font-bold mb-2">Summary</h2>
              <p className="text-gray-300 text-sm leading-relaxed">{review.summary}</p>
              <div className="text-gray-500 text-xs mt-3">
                Risk score: {review.overallRiskScore || 0}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-5 border border-white/20">
                <h3 className="text-white font-semibold mb-3">Security</h3>
                {renderFindings(groupedFindings.security)}
              </div>
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-5 border border-white/20">
                <h3 className="text-white font-semibold mb-3">Reliability</h3>
                {renderFindings(groupedFindings.reliability)}
              </div>
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-5 border border-white/20">
                <h3 className="text-white font-semibold mb-3">Performance</h3>
                {renderFindings(groupedFindings.performance)}
              </div>
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-5 border border-white/20">
                <h3 className="text-white font-semibold mb-3">Maintainability</h3>
                {renderFindings(groupedFindings.maintainability)}
              </div>
            </div>

            {groupedFindings.other.length > 0 && (
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                <h3 className="text-white font-semibold mb-3">Other</h3>
                {renderFindings(groupedFindings.other)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
