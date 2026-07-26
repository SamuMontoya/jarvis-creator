import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const supabaseUrl = process.env.SUPABASE_URL;

// Supabase reemplazó las keys JWT (anon / service_role) por sb_publishable_… y
// sb_secret_…; supabase-js acepta ambos formatos. Se leen los nombres nuevos y
// se cae a los antiguos para no romper entornos sin migrar.
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Faltan SUPABASE_URL y/o SUPABASE_SECRET_KEY en back/.env. Ver SETUP.md.'
  );
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
