import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Service role: bypasses RLS, used only in server-side API routes
export const supabase = createClient(url, key)
