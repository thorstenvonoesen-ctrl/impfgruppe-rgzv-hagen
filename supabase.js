import { createClient } from '@supabase/supabase-js'

const url = 'https://hwwytaqixoniueaogpsl.supabase.co'
const anonKey = sb_publishable_dAs5doDB_-aeOm7zhYu5Sg_ot991BnU

export const hasSupabase = true
export const supabase = createClient(url, anonKey)
