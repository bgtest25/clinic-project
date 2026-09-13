import { useState } from 'react';
import { apiFetch } from '../api/client';

interface ClinicalQAProps {
  token: string;
  encounterId: string;
  noteContext?: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const QUICK_QUESTIONS = [
  'What are the differential diagnoses to consider?',
  'Are there any drug interactions I should check?',
  'What follow-up tests might be appropriate?',
  'What patient education points should I cover?',
];

export function ClinicalQA({ token, encounterId, noteContext }: ClinicalQAProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(question: string) {
    if (!question.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: question.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const response = await apiFetch<{ answer: string }>(
        `/encounters/${encounterId}/note/clinical-qa`,
        token,
        {
          method: 'POST',
          body: JSON.stringify({
            question: question.trim(),
            context: noteContext,
          }),
        }
      );

      const assistantMessage: Message = { role: 'assistant', content: response.answer };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get response');
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }

  function handleQuickQuestion(question: string) {
    handleSubmit(question);
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        className="clinical-qa-toggle"
        onClick={() => setIsOpen(true)}
      >
        <span className="clinical-qa-toggle-icon">💬</span>
        Clinical Q&A
      </button>
    );
  }

  return (
    <div className="clinical-qa">
      <div className="clinical-qa-header">
        <h3>Clinical Q&A Assistant</h3>
        <button
          type="button"
          className="clinical-qa-close"
          onClick={() => setIsOpen(false)}
        >
          ×
        </button>
      </div>

      <div className="clinical-qa-messages">
        {messages.length === 0 ? (
          <div className="clinical-qa-empty">
            <p>Ask clinical questions about this encounter. The AI assistant has context from your note.</p>
            <div className="clinical-qa-quick">
              <span className="clinical-qa-quick-label">Quick questions:</span>
              {QUICK_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  type="button"
                  className="clinical-qa-quick-btn"
                  onClick={() => handleQuickQuestion(q)}
                  disabled={loading}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`clinical-qa-message clinical-qa-${msg.role}`}>
              <span className="clinical-qa-role">
                {msg.role === 'user' ? 'You' : 'Assistant'}
              </span>
              <p className="clinical-qa-content">{msg.content}</p>
            </div>
          ))
        )}
        {loading && (
          <div className="clinical-qa-message clinical-qa-assistant">
            <span className="clinical-qa-role">Assistant</span>
            <p className="clinical-qa-content clinical-qa-loading">Thinking...</p>
          </div>
        )}
      </div>

      {error && <p className="clinical-qa-error">{error}</p>}

      <form
        className="clinical-qa-input"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit(input);
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a clinical question..."
          disabled={loading}
        />
        <button type="submit" className="btn btn-primary btn-sm" disabled={loading || !input.trim()}>
          Ask
        </button>
      </form>

      <p className="clinical-qa-disclaimer">
        AI suggestions are for reference only. Always verify with clinical guidelines.
      </p>
    </div>
  );
}
