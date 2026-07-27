import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import ideasRouter from './routes/ideas.js';
import questionsRouter from './routes/questions.js';
import respuestasRouter from './routes/respuestas.js';
import dynamicQuestionsRouter from './routes/dynamicQuestions.js';
import documentsRouter from './routes/documents.js';
import plansRouter from './routes/plans.js';
import { errorHandler } from './errorHandler.js';
import { HTTP_STATUS } from './config.js';

dotenv.config();

const app = express();

app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      /\.ngrok.*\.app$/,
    ],
  })
);
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', ideasRouter);
app.use('/api', questionsRouter);
app.use('/api', respuestasRouter);
app.use('/api', dynamicQuestionsRouter);
app.use('/api', documentsRouter);
app.use('/api', plansRouter);

app.use((req, res) => {
  res.status(HTTP_STATUS.NOT_FOUND).json({ status: 'error', message: 'Ruta no encontrada' });
});

app.use(errorHandler);

export default app;
