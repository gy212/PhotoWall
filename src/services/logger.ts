type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function getCircularReplacer() {
  const seen = new WeakSet<object>();
  return (_key: string, value: unknown) => {
    if (value instanceof Error) {
      return { name: value.name, message: value.message, stack: value.stack };
    }
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value as object)) return '[Circular]';
      seen.add(value as object);
    }
    return value;
  };
}

function toJsonValue(value: unknown): unknown | undefined {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(JSON.stringify(value, getCircularReplacer()));
  } catch {
    return undefined;
  }
}

class Logger {
  private async log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>
  ) {
    const formatted = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`;
    console[level](formatted, context || '');

    try {
      const { invoke, isTauri } = await import('@tauri-apps/api/core');
      if (!isTauri()) return;
      await invoke('log_frontend', { level, message, context: toJsonValue(context) });
    } catch {
      // ignore
    }
  }

  debug(msg: string, ctx?: Record<string, unknown>) {
    this.log('debug', msg, ctx);
  }

  info(msg: string, ctx?: Record<string, unknown>) {
    this.log('info', msg, ctx);
  }

  warn(msg: string, ctx?: Record<string, unknown>) {
    this.log('warn', msg, ctx);
  }

  error(msg: string, err?: Error, ctx?: Record<string, unknown>) {
    const errorCtx = err
      ? { ...ctx, error: err.message, stack: err.stack }
      : ctx;
    this.log('error', msg, errorCtx);
  }
}

export const logger = new Logger();
