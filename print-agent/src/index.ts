import { loadConfig } from './config.js';
import { log } from './logger.js';
import { PrintWorker } from './worker.js';

try {
  const config = loadConfig();
  const worker = new PrintWorker(config);

  const shutdown = (signal: string) => {
    log('info', 'agent_stopping', { signal });
    worker.stop();
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));

  await worker.run();
  log('info', 'agent_stopped');
} catch (error) {
  log('error', 'agent_fatal', {
    message: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
}
