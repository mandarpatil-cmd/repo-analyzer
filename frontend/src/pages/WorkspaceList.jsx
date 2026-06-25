import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listMyWorkspaces, createWorkspace, deleteWorkspace } from '../api/repoApi';

export default function WorkspaceList() {
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const fetchWorkspaces = async () => {
    try {
      const res = await listMyWorkspaces();
      if (res.success) setWorkspaces(res.workspaces);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await createWorkspace(newWorkspaceName);
      if (res.success) {
        setShowModal(false);
        setNewWorkspaceName('');
        fetchWorkspaces();
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <nav className="bg-white/10 backdrop-blur-lg border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Workspaces</h1>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition"
          >
            ← Dashboard
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <p className="text-gray-400">Collaborate with your team on repository analyses.</p>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition font-medium"
          >
            + New Workspace
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-400 rounded-full animate-spin" />
          </div>
        ) : workspaces.length === 0 ? (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 border border-white/20 text-center">
            <span className="text-7xl mb-4 block">🏢</span>
            <h2 className="text-2xl text-white font-bold mb-3">No workspaces yet</h2>
            <p className="text-gray-400 mb-6">Create a workspace to start collaborating with your team.</p>
            <button
              onClick={() => setShowModal(true)}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-semibold transition"
            >
              Create Workspace
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workspaces.map((ws) => (
              <div
                key={ws._id}
                onClick={() => navigate(`/workspaces/${ws._id}`)}
                className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 hover:border-purple-500/50 hover:bg-white/15 transition cursor-pointer flex flex-col"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white font-bold text-xl">
                    {ws.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{ws.name}</h3>
                    <p className="text-xs text-gray-400">{ws.members.length} members</p>
                  </div>
                </div>
                <div className="mt-auto pt-4 border-t border-white/10 flex justify-between items-center text-sm">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${ws.plan === 'pro' ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white' : 'bg-white/10 text-gray-300'}`}>
                    {ws.plan.toUpperCase()} PLAN
                  </span>
                  <span className="text-gray-500">
                    Created {new Date(ws.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md border border-white/10">
            <h2 className="text-2xl font-bold text-white mb-4">Create Workspace</h2>
            <form onSubmit={handleCreate}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-1">Workspace Name</label>
                <input
                  required
                  type="text"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-white"
                  placeholder="e.g. Acme Corp Engineering"
                />
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
  );
}
