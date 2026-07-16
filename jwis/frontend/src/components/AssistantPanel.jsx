import React, { useState } from "react";
import { Bot, Send } from "lucide-react";
import { StatusPill } from "../ui/StatusPill.jsx";

const API_URL = import.meta.env.VITE_API_URL || "/api";

export function AssistantPanel() {
  const [question, setQuestion] = useState("What is the highest operational risk today?");
  const [answer, setAnswer] = useState("");
  const [provider, setProvider] = useState("");
  const [loading, setLoading] = useState(false);

  async function askAssistant() {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/assistant/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await response.json();
      setAnswer(data.answer || "No answer returned.");
      setProvider(data.provider || "unknown");
    } catch {
      setAnswer("Assistant fallback unavailable. Check API server.");
      setProvider("offline");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel assistant-panel">
      <div className="panel-title">
        <div>
          <h2>Operational AI Assistant</h2>
          <p>Natural language query endpoint; uses OpenAI when OPENAI_API_KEY is configured.</p>
        </div>
        <Bot size={20} />
      </div>
      <label className="field-label" htmlFor="assistant-question">Question</label>
      <textarea
        id="assistant-question"
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        rows={3}
      />
      <button className="primary-button" onClick={askAssistant} disabled={loading}>
        <Send size={16} /> {loading ? "Analyzing..." : "Ask JWIS"}
      </button>
      {answer && (
        <article className="assistant-answer">
          <StatusPill tone={provider === "openai" ? "success" : "warning"}>{provider}</StatusPill>
          <p>{answer}</p>
        </article>
      )}
    </section>
  );
}
