import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listIntegrations, createIntegration, deleteIntegration } from '../api/repoApi';

export default function Integrations() {
  const navigate = useNavigate();
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ repoFullName: '', githubToken: '', postComments: true });

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const fetchIntegrations = async () => {
    try {
      const res = await listIntegrations();
      if (res.success) setIntegrations(res.integrations);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await createIntegration(formData);
      if (res.success) {
        setShowModal(false);
        setFormData({ repoFullName: '', githubToken: '', postComments: true });
        fetchIntegrations();
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this integration?')) return;
    try {
      await deleteIntegration(id);
      fetchIntegrations();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <nav className="bg-white/10 backdrop-blur-lg border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">EDAI Integrations</h1>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-gray-300 hover:text-white transition"
          >
            ← Back to Dashboard
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">GitHub Integrations</h1>
            <p className="text-gray-400">Manage GitHub webhooks and API keys for automated PR reviews.</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition font-medium"
          >
            + Add GitHub Integration
          </button>
        </div>

      {loading ? (
        <div className="text-white">Loading...</div>
      ) : integrations.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center text-gray-400">
          No integrations found. Add one to enable automated PR reviews.
        </div>
      ) : (
        <div className="grid gap-4">
          {integrations.map((intg) => (
            <div key={intg._id} className="bg-white/10 border border-white/20 rounded-xl p-5 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-white">{intg.repoFullName}</h3>
                <p className="text-sm text-gray-400 font-mono mt-1">Webhook URL: <span className="text-purple-300">http://localhost:5000/api/webhook/github-action?apiKey={intg.apiKey}</span></p>
                <div className="mt-2 text-xs text-gray-500">
                  <span className={`inline-block w-2 h-2 rounded-full mr-1 ${intg.githubToken ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  GitHub Token: {intg.githubToken ? 'Configured' : 'Missing (Cannot post comments)'} | Post Comments: {intg.postComments ? 'Yes' : 'No'}
                </div>
              </div>
              <button
                onClick={() => handleDelete(intg._id)}
                className="text-red-400 hover:text-red-300 p-2"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md border border-white/10">
            <h2 className="text-2xl font-bold text-white mb-4">New GitHub Integration</h2>
            <form onSubmit={handleCreate}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">GitHub Repository Full Name</label>
                  <input
                    required
                    type="text"
                    value={formData.repoFullName}
                    onChange={(e) => setFormData({ ...formData, repoFullName: e.target.value })}
                    className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-white"
                    placeholder="e.g. facebook/react"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">GitHub Personal Access Token (Optional)</label>
                  <input
                    type="password"
                    value={formData.githubToken}
                    onChange={(e) => setFormData({ ...formData, githubToken: e.target.value })}
                    className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-white"
                    placeholder="ghp_..."
                  />
                  <p className="text-xs text-gray-500 mt-1">Required if you want the bot to post review comments on the PR.</p>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="postComments"
                    checked={formData.postComments}
                    onChange={(e) => setFormData({ ...formData, postComments: e.target.checked })}
                    className="w-4 h-4 text-purple-600 bg-black/30 border-white/10 rounded"
                  />
                  <label htmlFor="postComments" className="ml-2 text-sm text-gray-300">
                    Post AI findings as comments on the PR
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
