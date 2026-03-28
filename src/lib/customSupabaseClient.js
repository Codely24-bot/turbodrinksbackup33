import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vfcgdastakbdidlpbdqb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmY2dkYXN0YWtiZGlkbHBiZHFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzYwODEsImV4cCI6MjA4NjUxMjA4MX0.cn5reJab8fsf4R0e54ZUncuzTuxjV0zj5fuqmGQakyA';

const customSupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

export default customSupabaseClient;

export { 
    customSupabaseClient,
    customSupabaseClient as supabase,
};
