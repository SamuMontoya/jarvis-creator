import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler, sendDbError } from '../errorHandler.js';
import { logger } from '../logger.js';
import { firstValidationMessage, ideaSchema } from '../validators.js';
import { MESSAGES } from '../config.js';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

const appWith = (route) => {
  const app = express();
  app.get('/boom', route);
  app.use(errorHandler);
  return app;
};

describe('errorHandler', () => {
  it('oculta el mensaje de errores no tipados', async () => {
    const app = appWith(() => {
      throw new Error('connection string: postgres://user:pass@host');
    });

    const res = await request(app).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body.message).toBe(MESSAGES.DB_ERROR);
    expect(res.body.message).not.toContain('postgres://');
  });

  it('respeta el mensaje de errores con status explícito', async () => {
    const app = appWith((req, res, next) => {
      const err = new Error('Idea no encontrada');
      err.status = 404;
      next(err);
    });

    const res = await request(app).get('/boom');

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Idea no encontrada');
  });

  it('registra el error para que quede rastro en el servidor', async () => {
    const app = appWith(() => {
      throw new Error('fallo interno');
    });

    await request(app).get('/boom');

    expect(console.error).toHaveBeenCalled();
  });
});

describe('sendDbError', () => {
  it('loguea la causa real pero responde genérico', () => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    sendDbError(res, { message: 'RLS policy violation', code: '42501' }, 'GET /ideas');

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ status: 'error', message: MESSAGES.DB_ERROR });
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('GET /ideas'),
      expect.objectContaining({ code: '42501' })
    );
  });
});

describe('logger', () => {
  it('incluye nivel y timestamp', () => {
    logger.info('arrancando');

    expect(console.log).toHaveBeenCalledWith(
      expect.stringMatching(/^\[INFO\] \d{4}-\d{2}-\d{2}T.*- arrancando$/),
      ''
    );
  });

  it('adjunta el payload cuando se pasa', () => {
    logger.error('falló', { code: 'X' });

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('falló'), { code: 'X' });
  });

  it('silencia debug salvo que DEBUG esté activo', () => {
    const original = process.env.DEBUG;

    delete process.env.DEBUG;
    logger.debug('oculto');
    expect(console.log).not.toHaveBeenCalled();

    process.env.DEBUG = '1';
    logger.debug('visible');
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('visible'), '');

    if (original === undefined) delete process.env.DEBUG;
    else process.env.DEBUG = original;
  });
});

describe('firstValidationMessage', () => {
  it('extrae el mensaje de zod v4 desde .issues', () => {
    const result = ideaSchema.safeParse({ texto_idea: 'corta' });

    expect(firstValidationMessage(result.error)).toMatch(/al menos 10 caracteres/);
  });

  it('cae al mensaje genérico si el error no tiene forma de zod', () => {
    expect(firstValidationMessage(undefined)).toBe(MESSAGES.INVALID_INPUT);
    expect(firstValidationMessage({})).toBe(MESSAGES.INVALID_INPUT);
  });
});
