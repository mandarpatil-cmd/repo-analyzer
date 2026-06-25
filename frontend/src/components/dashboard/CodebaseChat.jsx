import { useState, useEffect, useRef, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const getAuthHeader = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

const chatAPI = {
  getStatus:      (id) => fetch(`${API_BASE}/chat/${id}/status`,     { headers: getAuthHeader() }).then(r => r.json()),
  getSuggestions: (id) => fetch(`${API_BASE}/chat/${id}/suggestions`, { headers: getAuthHeader() }).then(r => r.json()),
  ask: (id, question, history) => fetch(`${API_BASE}/chat/${id}`, {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify({ question, history }),
  }).then(r => r.json()),
};

// ─── Copy Button ──────────────────────────────────────────────────────────────
const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} style={{
      position: 'absolute', top: 8, right: 8,
      background: copied ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.1)',
      border: `1px solid ${copied ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.15)'}`,
      borderRadius: 6, padding: '3px 10px',
      color: copied ? '#4ade80' : 'rgba(255,255,255,0.6)',
      fontSize: 11, cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'inherit',
    }}>
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  );
};

// ─── Markdown Renderer ────────────────────────────────────────────────────────
const MarkdownRenderer = ({ content }) => {
  const segments = [];
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: content.slice(lastIndex, match.index) });
    }
    segments.push({ type: 'code', lang: match[1] || 'text', content: match[2].trim() });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    segments.push({ type: 'text', content: content.slice(lastIndex) });
  }
  if (segments.length === 0) {
    segments.push({ type: 'text', content });
  }

  const renderInline = (text) => {
    const parts = [];
    const inlineRegex = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g;
    let last = 0, m;
    while ((m = inlineRegex.exec(text)) !== null) {
      if (m.index > last) parts.push(text.slice(last, m.index));
      if (m[0].startsWith('**')) {
        parts.push(<strong key={m.index} style={{ color: '#fff', fontWeight: 700 }}>{m[2]}</strong>);
      } else if (m[0].startsWith('*')) {
        parts.push(<em key={m.index} style={{ color: '#d8b4fe' }}>{m[3]}</em>);
      } else {
        const isPath = m[4].includes('/') || m[4].includes('.js') || m[4].includes('.jsx') || m[4].includes('.ts');
        parts.push(
          <code key={m.index} style={{
            background: isPath ? 'rgba(99,102,241,0.2)' : 'rgba(168,85,247,0.15)',
            border: `1px solid ${isPath ? 'rgba(99,102,241,0.3)' : 'rgba(168,85,247,0.2)'}`,
            borderRadius: 4, padding: '1px 5px', fontSize: '0.88em',
            color: isPath ? '#a5b4fc' : '#d8b4fe', fontFamily: 'monospace',
          }}>{m[4]}</code>
        );
      }
      last = m.index + m[0].length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts.length > 0 ? parts : text;
  };

  const renderText = (text) => {
    const lines = text.split('\n');
    const elements = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (line.startsWith('## ')) {
        elements.push(<h4 key={i} style={{ color: '#e2d4ff', margin: '16px 0 8px', fontSize: 14, fontWeight: 700, borderBottom: '1px solid rgba(168,85,247,0.2)', paddingBottom: 4 }}>{renderInline(line.slice(3))}</h4>);
        i++; continue;
      }
      if (line.startsWith('### ')) {
        elements.push(<h5 key={i} style={{ color: '#c4b5fd', margin: '12px 0 6px', fontSize: 13, fontWeight: 600 }}>{renderInline(line.slice(4))}</h5>);
        i++; continue;
      }
      if (/^\d+\.\s/.test(line)) {
        const items = [];
        while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
          items.push(<li key={i} style={{ marginBottom: 4 }}>{renderInline(lines[i].replace(/^\d+\.\s/, ''))}</li>);
          i++;
        }
        elements.push(<ol key={`ol-${i}`} style={{ margin: '8px 0', paddingLeft: 20, color: '#e0d0ff' }}>{items}</ol>);
        continue;
      }
      if (line.startsWith('- ') || line.startsWith('* ')) {
        const items = [];
        while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) {
          items.push(<li key={i} style={{ marginBottom: 4 }}>{renderInline(lines[i].slice(2))}</li>);
          i++;
        }
        elements.push(<ul key={`ul-${i}`} style={{ margin: '8px 0', paddingLeft: 20, color: '#e0d0ff' }}>{items}</ul>);
        continue;
      }
      if (line.trim() === '---') {
        elements.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)', margin: '12px 0' }} />);
        i++; continue;
      }
      if (line.trim() === '') {
        elements.push(<div key={i} style={{ height: 6 }} />);
        i++; continue;
      }
      elements.push(<p key={i} style={{ margin: '3px 0', lineHeight: 1.65, color: '#eee' }}>{renderInline(line)}</p>);
      i++;
    }
    return elements;
  };

  return (
    <div style={{ fontSize: 14, lineHeight: 1.65, color: '#e5e5e5' }}>
      {segments.map((seg, idx) => {
        if (seg.type === 'code') {
          return (
            <div key={idx} style={{ position: 'relative', margin: '12px 0' }}>
              {seg.lang && (
                <div style={{
                  background: 'rgba(168,85,247,0.15)',
                  borderBottom: '1px solid rgba(168,85,247,0.2)',
                  padding: '4px 12px', fontSize: 11, color: '#a855f7',
                  borderRadius: '8px 8px 0 0', fontFamily: 'monospace',
                }}>
                  {seg.lang}
                </div>
              )}
              <div style={{
                background: '#0d0d1a',
                borderRadius: seg.lang ? '0 0 8px 8px' : 8,
                border: '1px solid rgba(168,85,247,0.15)',
                borderTop: seg.lang ? 'none' : undefined,
                padding: '14px 16px', overflowX: 'auto', position: 'relative',
              }}>
                <CopyButton text={seg.content} />
                <pre style={{
                  margin: 0,
                  fontFamily: "'Fira Code','Cascadia Code','Consolas',monospace",
                  fontSize: 13, lineHeight: 1.6, color: '#e2e8f0',
                  whiteSpace: 'pre', paddingRight: 60,
                }}>
                  {seg.content}
                </pre>
              </div>
            </div>
          );
        }
        return <div key={idx}>{renderText(seg.content)}</div>;
      })}
    </div>
  );
};

// ─── Message Bubble ───────────────────────────────────────────────────────────
const MessageBubble = ({ msg }) => {
  const isUser = msg.role === 'user';
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 20, gap: 10, alignItems: 'flex-start' }}>
      {!isUser && (
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #a855f7, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0, marginTop: 2 }}>🤖</div>
      )}
      <div style={{ maxWidth: isUser ? '75%' : '88%' }}>
        <div style={{
          background: isUser ? 'linear-gradient(135deg, #7c3aed, #6366f1)' : 'rgba(255,255,255,0.05)',
          border: isUser ? 'none' : '1px solid rgba(255,255,255,0.08)',
          borderRadius: isUser ? '18px 18px 4px 18px' : '4px 18px 18px 18px',
          padding: isUser ? '10px 16px' : '14px 18px',
          color: '#f0f0f0', fontSize: 14, wordBreak: 'break-word',
        }}>
          {isUser
            ? <span style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{msg.content}</span>
            : <MarkdownRenderer content={msg.content} />
          }
        </div>
        {msg.sources && msg.sources.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: '0 0 5px 4px' }}>
              {msg.sources.length} source{msg.sources.length !== 1 ? 's' : ''} referenced:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {msg.sources.map((src, i) => (
                <div key={i} title={`${src.filePath}${src.startLine ? ` · Lines ${src.startLine}–${src.endLine}` : ''}`} style={{
                  background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)',
                  borderRadius: 6, padding: '3px 9px', fontSize: 11, color: '#a5b4fc',
                  cursor: 'default', display: 'flex', alignItems: 'center', gap: 5,
                  maxWidth: 220, overflow: 'hidden',
                }}>
                  <span style={{ opacity: 0.6, flexShrink: 0 }}>
                    {src.chunkType === 'function' ? '⚡' : src.chunkType === 'file_source' ? '📋' : '📄'}
                  </span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {src.functionName ? `${src.functionName}()` : src.fileName}
                  </span>
                  <span style={{ opacity: 0.45, fontSize: 10, flexShrink: 0 }}>{src.relevance}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {isUser && (
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0, marginTop: 2 }}>👤</div>
      )}
    </div>
  );
};

// ─── Typing Indicator ─────────────────────────────────────────────────────────
const TypingIndicator = () => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 16 }}>
    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #a855f7, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🤖</div>
    <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px 18px 18px 18px', padding: '14px 18px', display: 'flex', gap: 5, alignItems: 'center' }}>
      {[0,1,2].map(i => (
        <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#a855f7', animation: 'bounce 1.2s infinite', animationDelay: `${i * 0.2}s` }} />
      ))}
    </div>
  </div>
);

// ─── Suggestion Pill ──────────────────────────────────────────────────────────
const SuggestionPill = ({ text, onClick }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button onClick={() => onClick(text)} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{
      background: hovered ? 'rgba(168,85,247,0.18)' : 'rgba(255,255,255,0.04)',
      border: `1px solid ${hovered ? 'rgba(168,85,247,0.45)' : 'rgba(255,255,255,0.1)'}`,
      borderRadius: 20, padding: '8px 15px',
      color: hovered ? '#e9d5ff' : 'rgba(255,255,255,0.65)',
      fontSize: 13, cursor: 'pointer', transition: 'all 0.18s', textAlign: 'left', lineHeight: 1.4,
    }}>
      {text}
    </button>
  );
};

// ─── Not Ready Screen ─────────────────────────────────────────────────────────
const NotReadyScreen = ({ embStatus }) => (
  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 48, textAlign: 'center' }}>
    <div style={{ fontSize: 48, marginBottom: 16 }}>{embStatus === 'failed' ? '❌' : '⚙️'}</div>
    <h3 style={{ color: '#fff', margin: '0 0 10px', fontSize: 20, fontWeight: 600 }}>
      {embStatus === 'failed' ? 'Chat Setup Failed' : 'Indexing your codebase...'}
    </h3>
    <p style={{ color: 'rgba(255,255,255,0.5)', margin: '0 0 20px', fontSize: 14, lineHeight: 1.6 }}>
      {embStatus === 'failed' ? 'Embeddings could not be generated. Try re-analyzing the repository.' : 'Building semantic search index. Takes 1–2 minutes after analysis.'}
    </p>
    {embStatus !== 'failed' && (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#a855f7', animation: 'pulse 1.5s infinite' }} />
        <span style={{ color: '#a855f7', fontSize: 13 }}>Generating embeddings...</span>
      </div>
    )}
    <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
  </div>
);

// ─── Welcome Screen ───────────────────────────────────────────────────────────
const WelcomeScreen = ({ suggestions, onSuggestionClick, chunkCount, repoName }) => (
  <div>
    <div style={{ textAlign: 'center', padding: '24px 0 20px', marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🧠</div>
      <h4 style={{ color: '#fff', margin: '0 0 8px', fontSize: 17, fontWeight: 600 }}>Ask anything about this codebase</h4>
      <p style={{ color: 'rgba(255,255,255,0.4)', margin: '0 0 6px', fontSize: 13 }}>
        <span style={{ color: '#a855f7', fontWeight: 600 }}>{chunkCount}</span> code chunks indexed from <span style={{ color: '#c084fc' }}>{repoName}</span>
      </p>
      <p style={{ color: 'rgba(255,255,255,0.3)', margin: 0, fontSize: 12 }}>I've read every file and function. Try one of these:</p>
    </div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
      {suggestions.map((s, i) => <SuggestionPill key={i} text={s} onClick={onSuggestionClick} />)}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
      {[
        { icon: '🔍', title: 'Find anything',  desc: '"Show me the login function code"' },
        { icon: '⚡', title: 'Exact code',      desc: '"What does createUser() do?"' },
        { icon: '🗺️', title: 'Navigate files', desc: '"Which file handles auth?"' },
        { icon: '💬', title: 'Follow-ups',      desc: '"What calls that function?"' },
      ].map(h => (
        <div key={h.title} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 18, marginBottom: 6 }}>{h.icon}</div>
          <div style={{ color: '#fff', fontSize: 12, fontWeight: 600, marginBottom: 3 }}>{h.title}</div>
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>{h.desc}</div>
        </div>
      ))}
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CodebaseChat({ analysisId, repoName }) {
  const [chatReady,   setChatReady]   = useState(false);
  const [embStatus,   setEmbStatus]   = useState('checking');
  const [messages,    setMessages]    = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [input,       setInput]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [chunkCount,  setChunkCount]  = useState(0);

  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);
  const pollRef        = useRef(null);
  const textareaRef    = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (!analysisId) return;
    const checkStatus = async () => {
      try {
        const data = await chatAPI.getStatus(analysisId);
        setEmbStatus(data.embeddingsStatus || 'pending');
        setChunkCount(data.chunkCount || 0);
        if (data.chatReady) {
          setChatReady(true);
          clearInterval(pollRef.current);
          const sugData = await chatAPI.getSuggestions(analysisId);
          if (sugData.success) setSuggestions(sugData.suggestions || []);
        }
      } catch (e) { console.error('Status check failed', e); }
    };
    checkStatus();
    pollRef.current = setInterval(checkStatus, 5000);
    return () => clearInterval(pollRef.current);
  }, [analysisId]);

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  }, []);

  const sendMessage = async (questionText) => {
    const q = (questionText || input).trim();
    if (!q || loading) return;
    setInput('');
    setError(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    setMessages(prev => [...prev, { role: 'user', content: q }]);
    setLoading(true);

    const history = messages.map(({ role, content }) => ({ role, content }));
    try {
      const data = await chatAPI.ask(analysisId, q, history);
      if (!data.success) throw new Error(data.message || 'Failed to get answer');
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer, sources: data.sources || [] }]);
    } catch (err) {
      setError(err.message);
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  if (!chatReady) return <NotReadyScreen embStatus={embStatus} />;

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: 680 }}>

      {/* Header */}
      <div style={{ padding: '13px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(168,85,247,0.07)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #a855f7, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>💬</div>
          <div>
            <h3 style={{ margin: 0, color: '#fff', fontSize: 15, fontWeight: 600 }}>Codebase Chat</h3>
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{chunkCount} chunks · {repoName}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
            <span style={{ color: '#4ade80', fontSize: 11 }}>Ready</span>
          </div>
          {messages.length > 0 && (
            <button onClick={() => { setMessages([]); setError(null); }} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '5px 12px', color: 'rgba(255,255,255,0.45)', fontSize: 12, cursor: 'pointer' }}>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', scrollbarWidth: 'thin', scrollbarColor: 'rgba(168,85,247,0.3) transparent' }}>
        {messages.length === 0 && (
          <WelcomeScreen suggestions={suggestions} onSuggestionClick={sendMessage} chunkCount={chunkCount} repoName={repoName} />
        )}
        {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
        {loading && <TypingIndicator />}
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', color: '#fca5a5', fontSize: 13, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>⚠️</span><span>{error}</span>
            <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: 14 }}>✕</button>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 16px 14px', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0, background: 'rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '10px 14px' }}>
          <textarea
            ref={(el) => { textareaRef.current = el; inputRef.current = el; }}
            value={input}
            onChange={(e) => { setInput(e.target.value); resizeTextarea(); }}
            onKeyDown={handleKeyDown}
            placeholder='Ask anything: "Show me the auth middleware code" or "How does login work?"'
            disabled={loading}
            rows={1}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#f0f0f0', fontSize: 14, resize: 'none', lineHeight: 1.5, maxHeight: 140, overflow: 'auto', fontFamily: 'inherit', paddingTop: 2 }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            style={{
              background: !input.trim() || loading ? 'rgba(168,85,247,0.12)' : 'linear-gradient(135deg, #7c3aed, #6366f1)',
              border: 'none', borderRadius: 10, width: 38, height: 38,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: !input.trim() || loading ? 'not-allowed' : 'pointer',
              flexShrink: 0, transition: 'all 0.2s', fontSize: 17,
              color: !input.trim() || loading ? 'rgba(168,85,247,0.35)' : '#fff',
            }}
          >
            {loading ? '⏳' : '↑'}
          </button>
        </div>
        <p style={{ margin: '5px 0 0 2px', fontSize: 11, color: 'rgba(255,255,255,0.18)' }}>
          Enter to send · Shift+Enter for new line
        </p>
      </div>

      <style>{`
        @keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>
    </div>
  );
}