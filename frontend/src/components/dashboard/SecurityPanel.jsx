import { useState, useEffect } from 'react';
import { getSecurityReport, triggerSecurityRescan } from '../../api/repoApi';

export default function SecurityPanel({ analysisId }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rescanning, setRescanning] = useState(false);
  const [error, setError] = useState(null);

  const fetchReport = async () => {
    try {
      const res = await getSecurityReport(analysisId);
      if (res.success) {
        setReport(res.report || { status: res.status });
      } else {
        setError(res.message);
      }
    } catch (err) {
      setError('Failed to fetch security report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (analysisId) fetchReport();
  }, [analysisId]);

  const handleRescan = async () => {
    setRescanning(true);
    try {
      const res = await triggerSecurityRescan(analysisId);
      if (res.success) {
        setReport({ ...report, status: 'running' });
      }
    } catch (err) {
      setError('Rescan failed');
    } finally {
      setRescanning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-10 h-10 border-4 border-purple-500/30 border-t-purple-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-400 bg-red-900/20 p-4 rounded-lg">{error}</div>;
  }

  if (!report || report.status === 'pending') {
    return (
      <div className="text-center py-20 bg-white/5 rounded-xl border border-white/10">
        <h3 className="text-xl text-white font-bold mb-2">Security Scan Pending</h3>
        <p className="text-gray-400 mb-6">A security scan has not been run for this repository yet.</p>
        <button
          onClick={handleRescan}
          disabled={rescanning}
          className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg disabled:opacity-50"
        >
          {rescanning ? 'Starting...' : 'Run Security Scan'}
        </button>
      </div>
    );
  }

  if (report.status === 'running') {
    return (
      <div className="text-center py-20 bg-white/5 rounded-xl border border-white/10">
        <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-400 rounded-full animate-spin mx-auto mb-4" />
        <h3 className="text-xl text-white font-bold">Scan in progress...</h3>
        <p className="text-gray-400 mt-2">Checking for secrets and vulnerable patterns. Please refresh later.</p>
      </div>
    );
  }

  const { score, summary = {}, findings = [], dependencyAudit = {} } = report;

  // 80–100 = green, 60–79 = yellow, 40–59 = orange, 0–39 = red
  let scoreColor = 'text-green-400';
  if (score < 80) scoreColor = 'text-yellow-400';
  if (score < 60) scoreColor = 'text-orange-400';
  if (score < 40) scoreColor = 'text-red-500';

  return (
    <div className="space-y-6">
      {/* Header / Score */}
      <div className="flex flex-col md:flex-row gap-6 items-start">
        <div className="bg-white/5 rounded-xl border border-white/10 p-6 flex-1 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Security Score</h2>
            <p className="text-gray-400 mt-1">Based on secrets, patterns, and dependencies.</p>
          </div>
          <div className={`text-6xl font-black ${scoreColor}`}>
            {score !== null ? score : '-'}
          </div>
        </div>
        
        {/* Summary Bar */}
        <div className="bg-white/5 rounded-xl border border-white/10 p-6 flex-1 w-full">
          <h3 className="text-lg font-bold text-white mb-4">Findings Summary</h3>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div className="bg-red-900/30 border border-red-500/20 rounded-lg py-3">
              <div className="text-2xl font-bold text-red-400">{summary.critical || 0}</div>
              <div className="text-xs text-red-300 uppercase mt-1">Critical</div>
            </div>
            <div className="bg-orange-900/30 border border-orange-500/20 rounded-lg py-3">
              <div className="text-2xl font-bold text-orange-400">{summary.high || 0}</div>
              <div className="text-xs text-orange-300 uppercase mt-1">High</div>
            </div>
            <div className="bg-yellow-900/30 border border-yellow-500/20 rounded-lg py-3">
              <div className="text-2xl font-bold text-yellow-400">{summary.medium || 0}</div>
              <div className="text-xs text-yellow-300 uppercase mt-1">Medium</div>
            </div>
            <div className="bg-blue-900/30 border border-blue-500/20 rounded-lg py-3">
              <div className="text-2xl font-bold text-blue-400">{summary.low || 0}</div>
              <div className="text-xs text-blue-300 uppercase mt-1">Low</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
         <button
            onClick={handleRescan}
            disabled={rescanning}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition disabled:opacity-50"
          >
            {rescanning ? 'Scanning...' : 'Rescan Repository'}
          </button>
      </div>

      {/* Findings List */}
      <div>
        <h3 className="text-xl font-bold text-white mb-4">Code Findings</h3>
        {findings.length === 0 ? (
          <div className="bg-white/5 rounded-xl p-8 border border-white/10 text-center text-gray-400">
            No security vulnerabilities found in the codebase.
          </div>
        ) : (
          <div className="space-y-4">
            {findings.map((f, i) => (
              <div key={i} className="bg-white/5 rounded-xl border border-white/10 p-5">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase
                    ${f.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                      f.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                      f.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                    {f.severity}
                  </span>
                  <h4 className="text-white font-bold">{f.title}</h4>
                  <span className="text-gray-500 text-xs ml-auto font-mono">
                    {f.file}:{f.line}
                  </span>
                </div>
                <p className="text-gray-300 text-sm mb-3">{f.description}</p>
                {f.snippet && (
                  <pre className="bg-black/50 p-3 rounded-lg text-xs text-gray-300 overflow-x-auto mb-3 border border-white/5">
                    {f.snippet}
                  </pre>
                )}
                <div className="flex justify-between items-center text-xs">
                  <span className="text-purple-400 font-mono bg-purple-500/10 px-2 py-1 rounded">
                    {f.cwe || 'Unknown CWE'}
                  </span>
                  <span className="text-gray-400 text-right w-2/3 truncate" title={f.remediation}>
                    💡 {f.remediation}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dependency Audit */}
      <div>
        <h3 className="text-xl font-bold text-white mb-4">Dependency Audit</h3>
        {(!dependencyAudit.packages || dependencyAudit.packages.length === 0) ? (
          <div className="bg-white/5 rounded-xl p-8 border border-white/10 text-center text-gray-400">
            No vulnerable dependencies found.
          </div>
        ) : (
          <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="px-4 py-3 font-semibold">Package</th>
                  <th className="px-4 py-3 font-semibold">Severity</th>
                  <th className="px-4 py-3 font-semibold">Path (Via)</th>
                  <th className="px-4 py-3 font-semibold">Fix Available</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {dependencyAudit.packages.map((pkg, i) => (
                  <tr key={i} className="hover:bg-white/5">
                    <td className="px-4 py-3 font-medium text-white">{pkg.name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase
                        ${pkg.severity === 'critical' ? 'text-red-400 bg-red-500/10' :
                          pkg.severity === 'high' ? 'text-orange-400 bg-orange-500/10' :
                          pkg.severity === 'moderate' || pkg.severity === 'medium' ? 'text-yellow-400 bg-yellow-500/10' :
                          'text-blue-400 bg-blue-500/10'
                        }`}>
                        {pkg.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 max-w-xs truncate">
                      {(pkg.via || []).join(' > ')}
                    </td>
                    <td className="px-4 py-3">
                      {pkg.fixAvailable ? <span className="text-green-400">Yes</span> : <span className="text-gray-500">No</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
