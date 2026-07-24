import { vi } from 'vitest';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

vi.setConfig({ testTimeout: 10000 });

global.testSetup = {
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SECRET_KEY,
};