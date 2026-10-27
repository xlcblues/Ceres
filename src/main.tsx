import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./theme";
import "./styles/tokens.css";
import { I18nProvider } from "./lib/i18n";

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            gap: "12px",
            fontFamily: "system-ui, sans-serif",
            color: "#3c4352",
            background: "#f4f6fb",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <h2 style={{ margin: 0 }}>Ceres 遇到了一点问题</h2>
          <p style={{ margin: 0, maxWidth: 560, wordBreak: "break-word" }}>
            {String(this.state.error)}
          </p>
          <button
            type="button"
            onClick={() => {
              this.setState({ error: null });
              window.location.reload();
            }}
            style={{
              padding: "8px 18px",
              border: "none",
              borderRadius: 8,
              background: "#5b6cff",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            重新加载
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <I18nProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </I18nProvider>
    </AppErrorBoundary>
  </React.StrictMode>,
);
