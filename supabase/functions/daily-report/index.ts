import { createClient } from 'jsr:@supabase/supabase-js@2'

async function sendWhatsAppText(phone: string, text: string): Promise<void> {
  const url = `${Deno.env.get('ZAPSTER_API_URL')}/wa/messages`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('ZAPSTER_TOKEN')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      recipient: phone,
      text,
      instance_id: Deno.env.get('ZAPSTER_INSTANCE_ID'),
      link_preview: false,
    }),
  })
  const resText = await res.text()
  console.log(`Zapster response ${res.status}:`, resText)
}

Deno.serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Fetch all active leads with their pending/awaiting steps
  const { data: rows, error } = await supabase
    .from('sequence_messages')
    .select('step, scheduled_at, status, leads!inner(name, status)')
    .in('status', ['pending', 'awaiting_approval'])
    .in('leads.status', ['active'])
    .not('leads', 'is', null)
    .order('scheduled_at', { ascending: true })

  if (error) {
    console.error('Error fetching report data:', error)
    return new Response('DB error', { status: 500 })
  }

  if (!rows || rows.length === 0) {
    const ownerPhone = Deno.env.get('OWNER_PHONE')!
    await sendWhatsAppText(ownerPhone, `*Relatorio diario MedShare* 📊\n\nNenhum lead com followup pendente hoje.`)
    return new Response(JSON.stringify({ leads: 0 }), { headers: { 'Content-Type': 'application/json' } })
  }

  // Group by lead name, keep only the next step per lead
  const leadMap = new Map<string, { step: number; scheduled_at: string; status: string }>()
  for (const row of rows) {
    const lead = row.leads as { name: string; status: string }
    if (!leadMap.has(lead.name)) {
      leadMap.set(lead.name, { step: row.step, scheduled_at: row.scheduled_at, status: row.status })
    }
  }

  const today = new Date()
  const todayStr = today.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })

  const toDateStr = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

  const lines: string[] = []
  for (const [name, info] of leadMap) {
    const scheduledDate = new Date(info.scheduled_at)
    const todayDateStr = toDateStr(today)
    const scheduledDateStr = toDateStr(scheduledDate)
    const diffDays = (new Date(scheduledDateStr).getTime() - new Date(todayDateStr).getTime()) / (1000 * 60 * 60 * 24)

    let when: string
    if (info.status === 'awaiting_approval') {
      when = 'aguardando aprovacao'
    } else if (diffDays <= 0) {
      when = 'hoje'
    } else if (diffDays === 1) {
      when = 'amanha'
    } else {
      when = `em ${diffDays} dias`
    }

    lines.push(`*${name}* - Passo ${info.step} ${when}`)
  }

  const ownerPhone = Deno.env.get('OWNER_PHONE')!
  const report =
    `*Relatorio diario MedShare* 📊\n` +
    `${todayStr} - ${leadMap.size} lead(s) em sequencia:\n\n` +
    lines.map((l, i) => `${i + 1}. ${l}`).join('\n')

  await sendWhatsAppText(ownerPhone, report)
  console.log(`Daily report sent with ${leadMap.size} leads.`)

  return new Response(JSON.stringify({ leads: leadMap.size }), { headers: { 'Content-Type': 'application/json' } })
})
