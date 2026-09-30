require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const rawUrl = process.env.SUPABASE_URL || '';
const supabaseUrl = rawUrl.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
const serviceKey = (process.env.SUPABASE_SERVICE_KEY || '').trim();
const anonKey = (process.env.SUPABASE_ANON_KEY || '').trim();

if (!supabaseUrl) {
  console.error('Error: SUPABASE_URL is missing in .env');
  process.exit(1);
}

const keyToUse = serviceKey || anonKey;
const supabase = createClient(supabaseUrl, keyToUse);

const TABLES_TO_CHECK = [
  'users',
  'rooms',
  'room_members',
  'code_history',
  'room_activity_log',
  'view_active_rooms',
  'view_room_summary',
];

async function verifyAll() {
  console.log('====================================================');
  console.log('CODEO SUPABASE DATABASE TABLES VERIFICATION');
  console.log('====================================================');
  console.log(`Connected to: ${supabaseUrl}`);
  console.log(`Using Key: ${serviceKey ? 'Service Role Key (Admin)' : 'Anon Key'}\n`);

  let allExist = true;

  for (const table of TABLES_TO_CHECK) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(1);

      if (error) {
        if (error.message.includes('Could not find the table') || error.code === '42P01') {
          console.log(`❌ Table/View '${table}': NOT FOUND (Run SQL migration in Supabase SQL Editor)`);
          allExist = false;
        } else {
          // Table exists but maybe empty or RLS policy blocked anon
          console.log(`⚠️  Table/View '${table}': EXISTS (Note: ${error.message})`);
        }
      } else {
        console.log(`✅ Table/View '${table}': READY & ACCESSIBLE (Rows: ${data.length})`);
      }
    } catch (err) {
      console.log(`❌ Table/View '${table}': Error: ${err.message}`);
      allExist = false;
    }
  }

  console.log('\n----------------------------------------------------');
  if (allExist) {
    console.log('🎉 ALL TABLES & VIEWS ARE VERIFIED AND OPERATIONAL!');
  } else {
    console.log('ℹ️  Action required: Copy and run supabase_schema.sql in the Supabase SQL Editor.');
  }
  console.log('====================================================');
}

verifyAll();
