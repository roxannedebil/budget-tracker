import { createClient } from "@supabase/supabase-js"
import { supabaseAuthStorage } from "./utils/authStorage"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: supabaseAuthStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
})