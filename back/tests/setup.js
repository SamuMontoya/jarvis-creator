import { vi } from 'vitest';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

// Route modules build their Supabase/Groq clients at import time. These
// fallbacks keep construction from throwing when no real credentials exist,
// without overriding a developer's real .env.
process.env.SUPABASE_URL ||= 'http://supabase.test';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';
process.env.GROQ_API_KEY ||= 'test-groq-key';

vi.setConfig({ testTimeout: 15000 });
