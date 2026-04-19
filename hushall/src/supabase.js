import { createClient } from '@supabase/supabase-js'

const URL = 'https://amvsdkrgjshesdxdbwmq.supabase.co'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtdnNka3JnanNoZXNkeGRid21xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MTUzOTQsImV4cCI6MjA5MjE5MTM5NH0.QwD8A08-nDBoz4ExDsa3JdC6JdeUBFpErXMAX1ZRDcY'

export const supabase = createClient(URL, KEY)

export async function loadAllData() {
  const { data, error } = await supabase
    .from('budget')
    .select('*')
    .eq('id', 1)
    .single()
  if (error || !data) return { monthData: {}, yearData: null }
  return {
    monthData: data.month_data || {},
    yearData: data.year_data || null
  }
}

export async function saveAllData(monthData, yearData) {
  await supabase.from('budget').upsert({
    id: 1,
    month_data: monthData,
    year_data: yearData,
    updated_at: new Date().toISOString()
  })
}
