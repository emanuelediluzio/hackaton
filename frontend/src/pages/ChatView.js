import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, ChevronDown, ChevronRight, FileText, Sparkles, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const API_URL = process.env.REACT_APP_BACKEND_URL;

function CitationBadge({ citation, index }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-700/50 rounded-lg overflow-hidden">
      <button
        data-testid={`citation-${index}`}
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-slate-800/50 transition-colors"
      >
        <FileText className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
        <span className="text-slate-300 font-medium">{citation.source_id}</span>
        <span className="text-slate-500 ml-auto">Score: {citation.relevance_score?.toFixed(3)}</span>
        {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
      </button>
      {open && (
        <div className="px-3 py-2 border-t border-slate-700/50 bg-slate-950/30">
          <p className="text-[11px] text-slate-400 leading-relaxed font-mono">{citation.text_excerpt}</p>
        </div>
      )}
    </div>
  );
}

function ReasoningStep({ step, index }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0 text-[10px] font-bold mt-0.5">
        {step.step}
      </div>
      <div>
        <p className="text-slate-300 font-medium">{step.action}</p>
        <p className="text-slate-500 mt-0.5">{step.detail}</p>
      </div>
    </div>
  );
}

export default function ChatView() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => `chat_${Date.now()}`);
  const [showReasoning, setShowReasoning] = useState({});
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: userMsg, session_id: sessionId }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: data.response,
        citations: data.citations,
        reasoning_steps: data.reasoning_steps,
      }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Sorry, an error occurred. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const suggestedQueries = [
    "Which regions in Ghana are medical deserts?",
    "What hospitals have MRI capability?",
    "Find facilities that can handle obstetric emergencies in the Northern region",
    "What are the equipment gaps in Upper West facilities?",
    "Compare teaching hospitals in Ghana",
  ];

  return (
    <div data-testid="chat-page" className="flex flex-col h-[calc(100vh)] bg-[#0B1120]">
      {/* Header */}
      <div className="border-b border-slate-800/50 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="font-heading font-semibold text-white text-lg">IDP AI Agent</h1>
            <p className="text-xs text-slate-400">RAG-powered healthcare facility analysis</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Sparkles className="w-12 h-12 text-sky-400/30 mb-4" />
            <h2 className="font-heading text-xl font-semibold text-white mb-2">Ask about Ghana's Healthcare</h2>
            <p className="text-sm text-slate-400 max-w-md mb-6">
              I can analyze facility data, identify medical deserts, detect capability gaps, and help plan resource allocation.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-2xl w-full">
              {suggestedQueries.map((q, i) => (
                <button
                  key={i}
                  data-testid={`suggested-query-${i}`}
                  onClick={() => { setInput(q); }}
                  className="text-left text-xs px-4 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-300 hover:text-white hover:border-sky-500/30 hover:bg-sky-500/5 transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center flex-shrink-0 mt-1">
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}
            <div className={`max-w-[75%] ${msg.role === 'user' ? 'bg-sky-500/10 border border-sky-500/20' : 'bg-slate-800/50 border border-slate-700/50'} rounded-xl px-4 py-3`}>
              {msg.role === 'user' ? (
                <p className="text-sm text-sky-100">{msg.text}</p>
              ) : (
                <div>
                  <div className="text-sm text-slate-200 leading-relaxed prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>

                  {/* Citations */}
                  {msg.citations?.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-700/30">
                      <p className="text-[11px] text-slate-500 font-medium mb-2">Sources ({msg.citations.length})</p>
                      <div className="space-y-1.5">
                        {msg.citations.map((c, j) => (
                          <CitationBadge key={j} citation={c} index={j} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Reasoning Steps */}
                  {msg.reasoning_steps?.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-700/30">
                      <button
                        data-testid={`reasoning-toggle-${i}`}
                        onClick={() => setShowReasoning(p => ({ ...p, [i]: !p[i] }))}
                        className="flex items-center gap-1.5 text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        {showReasoning[i] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        Agent Reasoning ({msg.reasoning_steps.length} steps)
                      </button>
                      {showReasoning[i] && (
                        <div className="mt-2 space-y-2">
                          {msg.reasoning_steps.map((s, k) => (
                            <ReasoningStep key={k} step={s} index={k} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0 mt-1">
                <User className="w-4 h-4 text-slate-300" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-sky-400 animate-spin" />
              <span className="text-sm text-slate-400">Analyzing facility data...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-800/50 px-6 py-4">
        <div className="flex gap-3 max-w-4xl mx-auto">
          <input
            data-testid="chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Ask about healthcare facilities, medical deserts, or resource gaps..."
            className="flex-1 bg-slate-950/50 border border-slate-700 text-slate-200 rounded-xl px-4 py-3 text-sm placeholder:text-slate-600 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none"
          />
          <button
            data-testid="chat-send-btn"
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="bg-sky-500 hover:bg-sky-600 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl px-5 py-3 transition-all shadow-[0_0_10px_rgba(56,189,248,0.3)] hover:shadow-[0_0_20px_rgba(56,189,248,0.5)] disabled:shadow-none"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
