import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en back/.env. Ver SETUP.md.'
  );
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
