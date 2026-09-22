import React, { useState, useRef } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { API_URL } from "../config.js";
import {
  Check,
  Send,
  X,
  Bot,
  Paperclip,
} from "lucide-react";

export function AssistantPanel() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Hi, I am Ana. Ask me about route deviation, rainfall risk, TPA queue, dispatch priority, or waste forecast spikes. You can also upload a photo or PDF for analysis.",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [attachedFile, setAttachedFile] = useState(null);
  const fileInputRef = useRef(null);

  function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    const isPdf = file.type === "application/pdf";
    const fileType = isPdf ? "pdf" : "image";
    const reader = new FileReader();
    reader.onload = () => {
      let dataUrl = reader.result;
      if (isPdf && dataUrl instanceof ArrayBuffer) {
        const bytes = new Uint8Array(dataUrl);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        dataUrl = "data:application/pdf;base64," + btoa(binary);
      }
      setAttachedFile({ data: dataUrl, type: fileType, name: file.name });
    };
    if (isPdf) reader.readAsArrayBuffer(file);
    else reader.readAsDataURL(file);
    event.target.value = "";
  }

  async function askAssistant(promptOverride) {
    const prompt = (promptOverride || question).trim();
    if ((!prompt && !attachedFile) || loading) return;
    const fileMeta = attachedFile ? ` [${attachedFile.name}]` : "";
    setMessages((current) => [...current, { role: "user", text: (prompt || "Analyze this file") + fileMeta }]);
    const currentFile = attachedFile;
    setQuestion("");
    setAttachedFile(null);
    setLoading(true);
    try {
      const body = {
        question: prompt || "Analyze this file/image and tell me what you see related to JWIS waste operations.",
        history: messages.slice(-8).map((m) => ({ role: m.role, content: m.text })),
      };
      if (currentFile) {
        body.file_data = currentFile.data;
        body.file_type = currentFile.type;
      }
      const response = await fetch(`${API_URL}/assistant/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            text: `Ana tidak dapat menjawab saat ini. AI gateway error: ${data.detail || "unknown"}`,
            provider: "error",
          },
        ]);
        return;
      }
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: data.answer || "No answer returned.",
          provider: data.provider || "unknown",
          model: data.model || "",
          toolsUsed: data.tools_used || [],
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: "Assistant fallback unavailable. Check the API server, then retry the operational query.",
          provider: "offline",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function humanizeAssistantAnswer(text) {
    if (!text) return text;
    const humanPhrases = {
      is_damaged: "truck damage confirmed",
      off_corridor: "off the assigned corridor",
      far_off_corridor: "far off the assigned corridor",
    };
    return text
      .replace(/flags\s*:\s*([^\n]+)/gi, (match, list) => {
        const cleaned = list
          .split(",")
          .map((item) => item.trim().replace(/^`|`$/g, "").trim())
          .filter(Boolean)
          .map((key) => humanPhrases[key] || key)
          .join(", ");
        return `Risks: ${cleaned}`;
      })
      .replace(/`?([a-z_]+)\s*:\s*(?:true|false|yes|no)`?/gi, (match, key) => humanPhrases[key] || match);
  }

  function renderAssistantText(text) {
    if (!text) return null;
    const rawHtml = marked.parse(humanizeAssistantAnswer(text), { gfm: true, breaks: true });
    return DOMPurify.sanitize(rawHtml, {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ["style", "script", "iframe", "form", "input"],
    });
  }

  return (
    <section className="assistant-panel assistant-chat-shell">
      <header className="assistant-chat-header">
        <span className="assistant-chat-mark" aria-hidden="true">
          <Bot size={16} />
        </span>
        <div>
          <h2>Ana</h2>
          <p>Live command guide for routing, weather risk, and dispatch decisions.</p>
        </div>
      </header>

      <div className="assistant-message-list" role="log" aria-live="polite">
        {messages.map((message, index) => (
          <article className={`assistant-message ${message.role}`} key={`${message.role}-${index}`}>
            <span className="assistant-message-avatar" aria-hidden="true">
              {message.role === "assistant" ? "AI" : "ME"}
            </span>
            <div className="assistant-bubble">
              <div className="assistant-formatted-answer" dangerouslySetInnerHTML={{ __html: renderAssistantText(message.text) }} />
            </div>
          </article>
        ))}
        {loading && (
          <article className="assistant-message assistant">
            <span className="assistant-message-avatar" aria-hidden="true">AI</span>
            <div className="assistant-bubble assistant-thinking">
              <span />
              <span />
              <span />
            </div>
          </article>
        )}
      </div>

      <div className="assistant-quick-prompts" aria-label="Suggested assistant prompts">
        <button type="button" onClick={() => askAssistant("What is the highest operational risk today?")}>
          Highest risk today
        </button>
        <button type="button" onClick={() => askAssistant("Which truck should be dispatched first and why?")}>
          Dispatch priority
        </button>
      </div>

      <form
        className="assistant-chat-input"
        onSubmit={(event) => {
          event.preventDefault();
          askAssistant();
        }}
      >
        {attachedFile && (
          <div className="assistant-file-chip">
            <Paperclip size={14} />
            <span>{attachedFile.name}</span>
            <button type="button" aria-label="Remove file" onClick={() => setAttachedFile(null)}>
              <X size={14} />
            </button>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          onChange={handleFileSelect}
          style={{ display: "none" }}
        />
        <button
          type="button"
          className="assistant-upload-button"
          title="Upload image or PDF"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Attach photo or PDF"
        >
          <Paperclip size={18} />
        </button>
        <label className="sr-only" htmlFor="assistant-question">Ask Ana anything</label>
        <input
          id="assistant-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={attachedFile ? "Ask about this file..." : "Ask Ana anything..."}
          autoComplete="off"
        />
        <button className="primary-button" type="submit" aria-label="Send message" disabled={loading || (!question.trim() && !attachedFile)}>
          <Send size={16} />
        </button>
      </form>
    </section>
  );
}
