const RESET = '\x1b[0m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const GRAY = '\x1b[90m';

type Meta = Record<string, unknown>;

function format(level: string, color: string, msg: string, meta?: Meta): string {
  const ts = new Date().toISOString();
  const metaStr = meta && Object.keys(meta).length > 0 ? ' ' + JSON.stringify(meta) : '';
  return `${color}[${ts}] [${level}]${RESET} ${msg}${metaStr}`;
}

class Logger {
  info(msg: string, meta?: Meta): void {
    console.log(format('INFO ', CYAN, msg, meta));
  }

  warn(msg: string, meta?: Meta): void {
    console.warn(format('WARN ', YELLOW, msg, meta));
  }

  error(msg: string, meta?: Meta): void {
    console.error(format('ERROR', RED, msg, meta));
  }

  debug(msg: string, meta?: Meta): void {
    if (process.env['LOG_LEVEL'] === 'debug') {
      console.log(format('DEBUG', GRAY, msg, meta));
    }
  }
}

const logger = new Logger();
export default logger;
