const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');

const rawUrl = process.env.SUPABASE_URL || '';
const supabaseUrl = rawUrl.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
const anonKey = (process.env.SUPABASE_ANON_KEY || '').trim();
const serviceKey = (process.env.SUPABASE_SERVICE_KEY || '').trim();

if (!supabaseUrl) {
  console.warn('⚠️ SUPABASE_URL is not set in backend/.env');
}

// Standard client (subject to RLS)
const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  anonKey || 'placeholder'
);

// Admin client using service role key (bypasses RLS for secure backend tasks)
const supabaseAdmin = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  serviceKey || anonKey || 'placeholder',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

module.exports = {
  supabase,
  supabaseAdmin,
};
