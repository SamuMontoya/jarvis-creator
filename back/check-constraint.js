import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

async function checkConstraints() {
  // Try to query information_schema
  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SUPABASE_SECRET_KEY}`,
      'apikey': process.env.SUPABASE_SECRET_KEY,
    },
    body: JSON.stringify({
      query: `SELECT * FROM information_schema.table_constraints WHERE table_name = 'respuestas' AND constraint_type = 'UNIQUE';`
    }),
  });
  
  const data = await response.json();
  console.log('Constraints:', data);
}

checkConstraints().catch(console.error);
