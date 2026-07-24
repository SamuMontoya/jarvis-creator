import express from 'express';
import dotenv from 'dotenv';
import supabase from './supabaseClient.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

app.get('/api/health', async (req, res) => {
  try {
    const { count, error } = await supabase
      .from('ideas')
      .select('*', { count: 'exact', head: true });

    if (error) {
      return res.status(500).json({ status: 'error', message: error.message });
    }

    res.json({ status: 'ok', connection: 'verified' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ status: 'error', message: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});