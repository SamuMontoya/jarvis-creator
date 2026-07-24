import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

async function addConstraint() {
  console.log('Adding unique constraint via raw SQL...');
  
  // Use the Supabase REST API to execute raw SQL
  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SUPABASE_SECRET_KEY}`,
      'apikey': process.env.SUPABASE_SECRET_KEY,
    },
    body: JSON.stringify({ 
      sql: `ALTER TABLE respuestas ADD CONSTRAINT unique_idea_question UNIQUE (idea_id, generic_question_id);` 
    }),
  });
  
  console.log('Status:', response.status);
  const data = await response.json();
  console.log('Response:', data);
}

addConstraint().catch(console.error);
