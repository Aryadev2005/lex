import Fastify from 'fastify';
import fastifyHelmet from '@fastify/helmet';
import { registerCors } from './plugins/cors.js';
import { registerJwt } from './plugins/jwt.js';
import { registerSupabase } from './plugins/supabase.js';
import { healthRoutes } from './modules/health/health.route.js';
import { authRoutes } from './modules/auth/auth.route.js';
import { protectedRoutes } from './modules/protected/protected.route.js';
import { testRoutes } from './modules/test/test.route.js';

export function buildApp(opts: { logger?: boolean | object } = {}) {
  const fastify = Fastify({
    logger: opts.logger ?? {
      level: process.env['NODE_ENV'] === 'test' ? 'silent' : 'info',
      transport:
        process.env['NODE_ENV'] !== 'production'
          ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
          : undefined,
    },
  });

  fastify.setErrorHandler((error, _request, reply) => {
    const statusCode = (error as { statusCode?: number }).statusCode ?? 500;

    if (statusCode >= 500) {
      fastify.log.error(error);
    }

    reply.status(statusCode).send({
      success: false,
      error: error.message ?? 'Internal Server Error',
      statusCode,
    });
  });

  // Plugins
  fastify.register(fastifyHelmet);
  fastify.register(registerCors);
  fastify.register(registerJwt);
  fastify.register(registerSupabase);

  // Routes
  fastify.register(healthRoutes);
  fastify.register(authRoutes);
  fastify.register(protectedRoutes);
  fastify.register(testRoutes);

  return fastify;
}
