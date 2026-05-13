'use client';

import { Component, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('HMI render error', error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        className="absolute inset-0 z-[200] flex flex-col items-center justify-center text-center px-8"
        style={{ background: 'var(--mila-bg, #1a1a1a)' }}
      >
        <div className="text-6xl mb-6">&#9888;</div>
        <h1 className="text-2xl font-semibold mb-3" style={{ color: 'var(--mila-text, #f5f5f7)' }}>
          Something went wrong
        </h1>
        <p className="text-base max-w-lg mb-2" style={{ color: 'var(--mila-textSecondary, #999)' }}>
          {this.state.error.message}
        </p>
        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={this.reset}
            className="px-5 py-2.5 text-white rounded-xl text-sm font-medium"
            style={{ background: 'var(--mila-accent, #0d9488)' }}
          >
            Retry
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 rounded-xl text-sm font-medium"
            style={{ background: 'var(--mila-surface, #2a2a2a)', color: 'var(--mila-textSecondary, #999)' }}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
