import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { requestJson } from "../services/http.js";
import Icon from "./Icon.jsx";
import { errorMessage } from "../utils/format.js";
import { AI_CONTEXT_LIMITS, AI_HISTORY_LIMITS } from "../../shared/limits.js";

function Answer({ text }) {
  return (
    <div className="code-help-answer">
      {text.split(/(```[\s\S]*?```)/g).map((part, index) =>
        part.startsWith("```") ? (
          <pre key={index}>
            <code>
              {part
                .replace(/^```[^\n]*\n?/, "")
                .replace(/```$/, "")
                .trimEnd()}
            </code>
          </pre>
        ) : (
          <div key={index}>{part}</div>
        ),
      )}
    </div>
  );
}

export default function CodeHelp({
  language,
  code,
  input,
  output,
  open,
  onOpen,
  onClose,
}) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const pending = useRef(null);
  const dialog = useRef(null);
  const launcher = useRef(null);
  const conversation = useRef(null);
  const composer = useRef(null);
  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => {
    if (open && !dialog.current.open) {
      dialog.current.show();
      composer.current?.focus();
    } else if (!open && dialog.current.open) {
      dialog.current.close();
      launcher.current?.focus();
    }
    if (!open) return;
    const escape = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [open, onClose]);
  useEffect(() => {
    if (conversation.current)
      conversation.current.scrollTop = conversation.current.scrollHeight;
  }, [messages, loading, error]);

  function newChat() {
    pending.current?.abort();
    pending.current = null;
    setMessages([]);
    setQuestion("");
    setError("");
    setLoading(false);
    composer.current?.focus();
  }

  async function ask(event) {
    event.preventDefault();
    if (pending.current || !question.trim() || !code.trim()) return;
    const context = { code, question, input, output };
    for (const [field, limit] of Object.entries(AI_CONTEXT_LIMITS)) {
      const value = context[field];
      if (value.length > limit) {
        setError(
          `Keep ${field} below ${limit.toLocaleString()} characters for AI help.`,
        );
        return;
      }
    }
    const currentQuestion = question.trim();
    const history = [];
    let remaining = AI_HISTORY_LIMITS.total;
    for (const message of messages
      .slice(-AI_HISTORY_LIMITS.messages)
      .reverse()) {
      if (remaining <= 0) break;
      const content = message.content
        .trim()
        .slice(0, Math.min(AI_HISTORY_LIMITS.perMessage, remaining))
        .trim();
      if (!content) continue;
      history.unshift({ role: message.role, content });
      remaining -= content.length;
    }
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true);
    setError("");
    setMessages((current) => [
      ...current,
      { role: "user", content: currentQuestion },
    ]);
    setQuestion("");
    try {
      const result = await requestJson(
        "/api/ai/help",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            language,
            code,
            question: currentQuestion,
            input,
            output,
            history,
          }),
        },
        50000,
      );
      if (controller.signal.aborted || pending.current !== controller) return;
      if (typeof result.answer !== "string" || !result.answer.trim())
        throw new Error("AI returned an empty answer. Please try again.");
      setMessages((current) => [
        ...current,
        { role: "assistant", content: result.answer },
      ]);
    } catch (failure) {
      if (!controller.signal.aborted && pending.current === controller) {
        setError(errorMessage(failure));
        setQuestion(currentQuestion);
        setMessages((current) => current.slice(0, -1));
      }
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setLoading(false);
        requestAnimationFrame(() => {
          if (dialog.current?.open) composer.current?.focus();
        });
      }
    }
  }

  return createPortal(
    <>
      <button
        ref={launcher}
        type="button"
        className="ai-launcher"
        aria-label="Ask AI"
        aria-expanded={open}
        aria-controls="code-help"
        onClick={open ? onClose : onOpen}
      >
        <Icon name="chat" size={22} />
        <span>AI</span>
      </button>
      <dialog
        ref={dialog}
        id="code-help"
        className="code-help"
        aria-labelledby="code-help-title"
      >
        <header className="code-help-header">
          <div>
            <h2 id="code-help-title">Ask AI</h2>
            <p>{language} · Current code attached</p>
          </div>
          <div className="code-help-controls">
            <button
              type="button"
              className="code-help-new-chat"
              onClick={newChat}
              aria-label="Start new chat"
              title="Start new chat"
            >
              New chat
            </button>
            <button
              type="button"
              className="code-help-close"
              onClick={onClose}
              aria-label="Close AI chat"
            >
              ×
            </button>
          </div>
        </header>
        <div
          ref={conversation}
          className="code-help-messages"
          role="log"
          aria-label="AI conversation"
          aria-live="polite"
          aria-relevant="additions text"
        >
          {messages.map((message, index) => (
            <article
              className={`code-help-message is-${message.role}`}
              key={index}
            >
              <span className="code-help-speaker">
                {message.role === "user" ? "You" : "AI"}
              </span>
              {message.role === "assistant" ? (
                <Answer text={message.content} />
              ) : (
                <p>{message.content}</p>
              )}
            </article>
          ))}
          {loading && (
            <p className="code-help-thinking" role="status">
              Thinking…
            </p>
          )}
          {error && (
            <p className="code-help-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <form className="code-help-composer" onSubmit={ask}>
          <label className="sr-only" htmlFor="code-question">
            Message AI
          </label>
          <textarea
            ref={composer}
            id="code-question"
            rows={2}
            maxLength={AI_CONTEXT_LIMITS.question}
            placeholder="Ask about your code…"
            value={question}
            onChange={(event) => {
              setQuestion(event.target.value);
            }}
            disabled={loading}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                ask(event);
              }
            }}
          />
          <div className="code-help-actions">
            <button
              type="submit"
              className="button button-small"
              aria-busy={loading}
              disabled={loading || !code.trim() || !question.trim()}
            >
              {loading ? "Thinking…" : "Send"}
            </button>
          </div>
          <p className="code-help-disclosure">
            Code, input, and output are shared with Groq when you send.
          </p>
        </form>
      </dialog>
    </>,
    document.body,
  );
}
