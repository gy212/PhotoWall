import React from 'react';

type ErrorDetails = {
  name: string;
  message: string;
  stack?: string;
};

type ErrorBoundaryProps = {
  children: React.ReactNode;
  onError?: (error: Error, info: React.ErrorInfo) => void;
};

type ErrorBoundaryState = {
  error: ErrorDetails | null;
  componentStack?: string | null;
};

function toErrorDetails(error: unknown): ErrorDetails {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { name: 'UnknownError', message: String(error), stack: undefined };
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: toErrorDetails(error) };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ componentStack: info.componentStack });
    this.props.onError?.(error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    const { error, componentStack } = this.state;
    return (
      <div
        style={{
          padding: 16,
          fontFamily:
            'ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial',
        }}
      >
        <h1 style={{ margin: '0 0 12px 0', fontSize: 18 }}>PhotoWall 运行时错误</h1>
        <div style={{ opacity: 0.8, marginBottom: 12 }}>
          UI 渲染过程中发生错误，已进入保护模式。
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              background: '#111827',
              color: '#f9fafb',
              cursor: 'pointer',
            }}
          >
            重启应用
          </button>
        </div>
        <pre
          style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            background: '#111827',
            color: '#f9fafb',
            padding: 12,
            borderRadius: 8,
            overflow: 'auto',
          }}
        >
{`${error.name}: ${error.message}
${error.stack ?? ''}
${componentStack ? `\nComponent stack:\n${componentStack}` : ''}`}
        </pre>
      </div>
    );
  }
}
