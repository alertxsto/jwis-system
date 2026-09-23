import React from "react";

// One failure must never blank the whole command center: wrap each workspace
// so a dead panel leaves navigation and other workspaces usable.
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error("workspace failed:", this.props.name || "unknown", error?.message || String(error), info);
  }

  render() {
    if (this.state.failed) {
      return (
        <div
          role="alert"
          style={{
            margin: "32px auto",
            maxWidth: 520,
            padding: "28px 32px",
            textAlign: "center",
            background: "var(--ui-surface, #fff)",
            border: "1px solid var(--ui-border, #ddd)",
            borderRadius: 16,
          }}
        >
          <p style={{ fontSize: 18, fontWeight: 600, color: "var(--ui-ink, #121212)", margin: "0 0 12px" }}>
            Tampilan ini mengalami gangguan.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              minHeight: 44,
              padding: "10px 28px",
              fontSize: 16,
              fontWeight: 600,
              border: "none",
              borderRadius: 999,
              background: "var(--ui-accent, #176b54)",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Muat ulang
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
