import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  getWorkspace,
  listWorkspaceAnalyses,
  inviteWorkspaceMember,
  removeWorkspaceMember,
  deleteWorkspace,
  transferWorkspaceOwnership,
} from '../api/repoApi';

export default function WorkspaceDashboard() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [workspace, setWorkspace] = useState(null);
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviteError, setInviteError] = useState(null);

  useEffect(() => {
    fetchWorkspaceData();
  }, [workspaceId]);

  const fetchWorkspaceData = async () => {
    try {
      setLoading(true);
      const wsRes = await getWorkspace(workspaceId);
      if (wsRes.success) setWorkspace(wsRes.workspace);

      const analysesRes = await listWorkspaceAnalyses(workspaceId);
      if (analysesRes.success) setAnalyses(analysesRes.analyses);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load workspace');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    setInviteError(null);
    try {
      const res = await inviteWorkspaceMember(workspaceId, { email: inviteEmail, role: inviteRole });
      if (res.success) {
        setWorkspace({ ...workspace, members: res.members });
        setShowInviteModal(false);
        setInviteEmail('');
      }
    } catch (err) {
      setInviteError(err.response?.data?.message || 'Failed to invite user');
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!confirm('Are you sure you want to remove this member?')) return;
    try {
      const res = await removeWorkspaceMember(workspaceId, memberId);
      if (res.success) {
        setWorkspace({ ...workspace, members: res.members });
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove member');
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!confirm('Are you sure you want to completely delete this workspace? All associated analyses will be unlinked.')) return;
    try {
      const res = await deleteWorkspace(workspaceId);
      if (res.success) {
        navigate('/workspaces');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete workspace');
    }
  };

  const handleTransferOwnership = async (newOwnerId) => {
    if (!confirm('Are you sure you want to transfer ownership to this user? You will lose owner privileges.')) return;
    try {
      const res = await transferWorkspaceOwnership(workspaceId, newOwnerId);
      if (res.success) {
        setWorkspace({ ...workspace, ownerId: res.workspace.ownerId, members: res.members });
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to transfer ownership');
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex justify-center py-20">
        <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !workspace) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-red-900/20 text-red-400 p-6 rounded-xl border border-red-500/30 text-center">
          <h2 className="text-xl font-bold mb-2">Error</h2>
          <p>{error || 'Workspace not found'}</p>
          <button onClick={() => navigate('/workspaces')} className="mt-4 px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20">
            Back to Workspaces
          </button>
        </div>
      </div>
    );
  }

  const currentUserRole = workspace.members.find(m => m.userId?._id === user?.id)?.role;
  const isAdmin = currentUserRole === 'admin';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <nav className="bg-white/10 backdrop-blur-lg border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/workspaces')} className="text-gray-400 hover:text-white transition">
              ← Back
            </button>
            <div className="w-8 h-8 rounded bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white font-bold">
              {workspace.name.charAt(0).toUpperCase()}
            </div>
            <h1 className="text-2xl font-bold text-white">{workspace.name}</h1>
            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${workspace.plan === 'pro' ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white' : 'bg-white/10 text-gray-300'}`}>
              {workspace.plan.toUpperCase()}
            </span>
          </div>
          <div className="flex gap-3 items-center">
            {workspace.ownerId === user?.id && (
              <button onClick={handleDeleteWorkspace} className="px-4 py-2 bg-red-600/80 hover:bg-red-500 text-white rounded-lg transition font-medium text-sm">
                Delete Workspace
              </button>
            )}
            <button onClick={() => navigate('/dashboard')} className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition">
              My Dashboard
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Content - Analyses */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center bg-white/5 p-6 rounded-xl border border-white/10">
            <div>
              <h2 className="text-xl font-bold text-white mb-1">Shared Analyses</h2>
              <p className="text-gray-400 text-sm">Repositories analyzed and shared within this workspace.</p>
            </div>
            <button onClick={() => navigate('/analyze')} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition text-sm font-medium">
              + Analyze Repo
            </button>
          </div>

          {analyses.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center">
              <span className="text-5xl mb-4 block">📊</span>
              <h3 className="text-lg font-bold text-white mb-2">No analyses shared yet</h3>
              <p className="text-gray-400 text-sm mb-6">Analyze a repository or assign an existing one to this workspace.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {analyses.map(a => (
                <div key={a._id} onClick={() => navigate(`/results/${a._id}`)} className="bg-white/10 border border-white/20 hover:border-purple-500/50 rounded-xl p-5 cursor-pointer transition">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-2xl">📦</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${a.status === 'completed' ? 'bg-green-500/20 text-green-300 border-green-500/40' : 'bg-blue-500/20 text-blue-300 border-blue-500/40'}`}>
                      {a.status}
                    </span>
                  </div>
                  <h4 className="text-white font-bold truncate">{a.repoFullName}</h4>
                  <p className="text-gray-400 text-xs mt-1 truncate">{a.repoUrl}</p>
                  <p className="text-gray-500 text-xs mt-3">Analyzed {new Date(a.analyzedAt).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar - Members */}
        <div className="space-y-6">
          <div className="bg-white/5 rounded-xl border border-white/10 p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white">Members ({workspace.members.length})</h3>
              {isAdmin && (
                <button onClick={() => setShowInviteModal(true)} className="text-purple-400 hover:text-purple-300 text-sm font-medium">
                  + Invite
                </button>
              )}
            </div>
            
            <div className="space-y-4">
              {workspace.members.map(m => {
                const isOwner = workspace.ownerId === m.userId?._id;
                return (
                  <div key={m._id || m.userId?._id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-teal-500 flex items-center justify-center text-white text-xs font-bold">
                        {m.userId?.name?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">{m.userId?.name || 'Unknown User'}</p>
                        <p className="text-gray-500 text-xs">{m.userId?.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${m.role === 'admin' ? 'bg-purple-500/20 text-purple-400' : 'bg-white/10 text-gray-400'}`}>
                        {isOwner ? 'Owner' : m.role}
                      </span>
                      {workspace.ownerId === user?.id && !isOwner && (
                        <button onClick={() => handleTransferOwnership(m.userId?._id)} className="text-indigo-400 hover:text-indigo-300 ml-2 text-[10px] uppercase font-bold" title="Make Owner">
                          Make Owner
                        </button>
                      )}
                      {isAdmin && !isOwner && (
                        <button onClick={() => handleRemoveMember(m.userId?._id)} className="text-gray-500 hover:text-red-400 ml-2" title="Remove Member">
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 rounded-xl border border-indigo-500/30 p-6">
            <h3 className="text-lg font-bold text-white mb-2">Annotations & Comments</h3>
            <p className="text-gray-300 text-sm leading-relaxed mb-4">
              Team members can highlight specific lines of code, functions, or insights within shared analyses and leave comments.
            </p>
            <p className="text-purple-300 text-sm font-medium">
              Open any shared analysis to start collaborating.
            </p>
          </div>
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md border border-white/10">
            <h2 className="text-2xl font-bold text-white mb-4">Invite Team Member</h2>
            {inviteError && <div className="mb-4 p-3 bg-red-900/30 border border-red-500/30 rounded-lg text-red-400 text-sm">{inviteError}</div>}
            
            <form onSubmit={handleInvite}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">User Email</label>
                  <input
                    required
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-white"
                    placeholder="colleague@company.com"
                  />
                  <p className="text-xs text-gray-500 mt-1">User must have an existing EDAI account.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-white"
                  >
                    <option value="member">Member (Can analyze and comment)</option>
                    <option value="viewer">Viewer (Read-only access)</option>
                    <option value="admin">Admin (Can manage workspace)</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setShowInviteModal(false)} className="px-4 py-2 text-gray-400 hover:text-white">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition">
                  Send Invite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
