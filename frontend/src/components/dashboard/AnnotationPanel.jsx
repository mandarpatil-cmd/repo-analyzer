import { useState, useEffect } from 'react';
import { listAnnotations, createAnnotation, addAnnotationReply, resolveAnnotation } from '../../api/repoApi';

export default function AnnotationPanel({ workspaceId, analysisId }) {
  const [annotations, setAnnotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [replyText, setReplyText] = useState({});

  useEffect(() => {
    if (workspaceId && analysisId) fetchAnnotations();
  }, [workspaceId, analysisId]);

  const fetchAnnotations = async () => {
    try {
      const res = await listAnnotations(workspaceId, analysisId);
      if (res.success) setAnnotations(res.annotations);
    } catch (err) {
      console.error('Failed to fetch annotations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      const res = await createAnnotation(workspaceId, analysisId, {
        target: { type: 'general' },
        body: newComment,
      });
      if (res.success) {
        setAnnotations([...annotations, res.annotation]);
        setNewComment('');
      }
    } catch (err) {
      alert('Failed to post comment');
    }
  };

  const handleReply = async (annotId, e) => {
    e.preventDefault();
    if (!replyText[annotId]?.trim()) return;
    try {
      const res = await addAnnotationReply(workspaceId, analysisId, annotId, { body: replyText[annotId] });
      if (res.success) {
        setAnnotations(annotations.map(a => a._id === annotId ? res.annotation : a));
        setReplyText({ ...replyText, [annotId]: '' });
      }
    } catch (err) {
      alert('Failed to post reply');
    }
  };

  const handleResolve = async (annotId, resolved) => {
    try {
      const res = await resolveAnnotation(workspaceId, analysisId, annotId, { resolved });
      if (res.success) {
        setAnnotations(annotations.map(a => a._id === annotId ? res.annotation : a));
      }
    } catch (err) {
      alert('Failed to update status');
    }
  };

  if (!workspaceId) return null;

  return (
    <div className="bg-slate-800 rounded-xl border border-white/10 flex flex-col h-full max-h-[800px]">
      <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
        <h3 className="font-bold text-white flex items-center gap-2">
          <span>💬</span> Team Comments
        </h3>
        <span className="bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded text-xs font-bold">
          {annotations.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="text-gray-400 text-center text-sm">Loading comments...</div>
        ) : annotations.length === 0 ? (
          <div className="text-gray-500 text-center text-sm py-8">
            No comments yet. Start the conversation!
          </div>
        ) : (
          annotations.map(a => (
            <div key={a._id} className={`bg-white/5 border ${a.resolved ? 'border-green-500/30' : 'border-white/10'} rounded-lg p-3`}>
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs font-bold">
                    {a.authorId?.name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <p className="text-white text-sm font-semibold">{a.authorId?.name}</p>
                    <p className="text-gray-500 text-[10px]">{new Date(a.createdAt).toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {a.target?.type && a.target.type !== 'general' && (
                    <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">
                      {a.target.type}: {a.target.identifier}
                    </span>
                  )}
                  <button
                    onClick={() => handleResolve(a._id, !a.resolved)}
                    className={`text-[10px] px-1.5 py-0.5 rounded ${a.resolved ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-white/10 text-gray-400 hover:text-white'}`}
                  >
                    {a.resolved ? 'Resolved ✓' : 'Resolve'}
                  </button>
                </div>
              </div>
              <p className={`text-sm ${a.resolved ? 'text-gray-500 line-through' : 'text-gray-300'} mb-3`}>
                {a.body}
              </p>
              
              {/* Replies */}
              {a.replies?.length > 0 && (
                <div className="ml-4 pl-3 border-l-2 border-white/10 space-y-2 mb-3 mt-2">
                  {a.replies.map((r, i) => (
                    <div key={i} className="bg-black/20 rounded p-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white text-xs font-semibold">{r.authorId?.name}</span>
                        <span className="text-gray-500 text-[10px]">{new Date(r.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-gray-400 text-xs">{r.body}</p>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Reply Input */}
              {!a.resolved && (
                <form onSubmit={(e) => handleReply(a._id, e)} className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={replyText[a._id] || ''}
                    onChange={(e) => setReplyText({ ...replyText, [a._id]: e.target.value })}
                    placeholder="Reply..."
                    className="flex-1 bg-black/30 border border-white/10 rounded px-2 py-1 text-xs text-white"
                  />
                  <button type="submit" className="text-xs bg-white/10 hover:bg-white/20 text-white px-2 rounded transition">
                    Send
                  </button>
                </form>
              )}
            </div>
          ))
        )}
      </div>

      <div className="p-4 border-t border-white/10 bg-black/20">
        <form onSubmit={handleCreate} className="flex gap-2">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment to this analysis..."
            className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50"
          />
          <button type="submit" disabled={!newComment.trim()} className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold transition">
            Post
          </button>
        </form>
      </div>
    </div>
  );
}
