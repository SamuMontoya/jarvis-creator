import { logger } from './logger.js';
import { HTTP_STATUS, MESSAGES } from './config.js';

export const errorHandler = (err, req, res, next) => {
  logger.error(`${req.method} ${req.originalUrl}`, err);

  // Only errors we tagged with a status carry a message safe to show the user;
  // anything else could leak a stack trace or driver internals.
  res.status(err.status || HTTP_STATUS.SERVER_ERROR).json({
    status: 'error',
    message: err.status ? err.message : MESSAGES.DB_ERROR,
  });
};

// Supabase returns errors as values, not throws. Without logging here the real
// cause (missing table, RLS denial, constraint violation) never reaches anyone.
export const sendDbError = (res, error, context) => {
  logger.error(`DB error in ${context}`, error);
  return res
    .status(HTTP_STATUS.SERVER_ERROR)
    .json({ status: 'error', message: MESSAGES.DB_ERROR });
};
