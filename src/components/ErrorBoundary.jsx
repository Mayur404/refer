import { Component } from "react";

export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error("CPSync rendering failed:", error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="fatal-error">
          <p className="eyebrow">SOMETHING WENT WRONG</p>
          <h1>Let’s try that again.</h1>
          <p>
            Your saved profiles and preferences stay on this device. Reloading
            clears unsaved editor code.
          </p>
          <button className="button" onClick={() => window.location.reload()}>
            Reload workspace
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}
