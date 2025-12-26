import { invoke } from '@tauri-apps/api/core';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private async log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>
  ) {
    const formatted = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`;
    console[level](formatted, context || '');

    invoke('log_frontend', { level, message, context }).catch(() => {});
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
