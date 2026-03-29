import { createClient } from 'jsr:@supabase/supabase-js@2'
import { extractFirstName, renderTemplate, type Lead } from '../_shared/templates.ts'

const SEQUENCE_DELAYS_DAYS = [0, 1, 3, 7, 14]

function normalizePhone(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.startsWith('+')) return trimmed.slice(1).replace(/\D/g, '')
  return trimmed.replace(/\D/g, '')
}

async function sendWhatsAppText(phone: string, text: string): Promise<void> {
  const url = `${Deno.env.get('ZAPSTER_API_URL')}/wa/messages`
  const body = {
    recipient: phone,
    text,
    instance_id: Deno.env.get('ZAPSTER_INSTANCE_ID'),
    link_preview: true,
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('ZAPSTER_TOKEN')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const resText = await res.text()
  console.log(`Zapster response ${res.status}:`, resText)
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const contentType = req.headers.get('content-type') ?? ''
  let name: string, phone: string, role: string, procedures_per_month: string, problems: string

  if (contentType.includes('application/json')) {
    let body: Record<string, string>
    try {
      body = await req.json()
    } catch {
      return new Response('Invalid JSON body', { status: 400, headers: CORS_HEADERS })
    }
    ;({ name, phone, role, procedures_per_month, problems } = body)
    console.log('Raw payload:', JSON.stringify(body))
  } else {
    return new Response('Content-Type must be application/json', { status: 415, headers: CORS_HEADERS })
  }

  if (!name || !phone) {
    return new Response('Missing required fields: name, phone', { status: 400, headers: CORS_HEADERS })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const normalizedPhone = normalizePhone(phone)

  // Check if lead already exists
  const { data: existing } = await supabase
    .from('leads')
    .select('id')
    .eq('phone', normalizedPhone)
    .single()

  const isReturning = !!existing

  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .upsert(
      {
        name,
        phone: normalizedPhone,
        role: role || null,
        procedures_per_month: procedures_per_month || null,
        problems: problems || null,
        status: 'active',
      },
      { onConflict: 'phone', ignoreDuplicates: false }
    )
    .select('id, name, phone, role, procedures_per_month, problems')
    .single()

  if (leadError || !lead) {
    console.error('Error upserting lead:', leadError)
    return new Response('Failed to save lead', { status: 500, headers: CORS_HEADERS })
  }

  // Remove ALL existing messages and approvals (including sent) to avoid unique constraint on re-registration
  await supabase.from('pending_approvals').delete().eq('lead_id', lead.id)
  await supabase.from('sequence_messages').delete().eq('lead_id', lead.id)

  const now = new Date()

  // Step 1: awaiting_approval (first contact, held until owner approves)
  const { data: step1, error: step1Error } = await supabase
    .from('sequence_messages')
    .insert({ lead_id: lead.id, step: 1, scheduled_at: now.toISOString(), status: 'awaiting_approval' })
    .select('id')
    .single()

  if (step1Error || !step1) {
    console.error('Error creating step 1:', step1Error)
    return new Response('Failed to schedule step 1', { status: 500, headers: CORS_HEADERS })
  }

  // Steps 2-5: scheduled normally
  const followups = SEQUENCE_DELAYS_DAYS.slice(1).map((delayDays, i) => {
    const scheduledAt = new Date(now)
    scheduledAt.setDate(scheduledAt.getDate() + delayDays)
    return { lead_id: lead.id, step: i + 2, scheduled_at: scheduledAt.toISOString(), status: 'pending' }
  })

  await supabase.from('sequence_messages').insert(followups)

  // Generate suggested step 1 message
  const { data: template } = await supabase
    .from('message_templates')
    .select('body')
    .eq('step', 1)
    .single()

  const suggestedMessage = template ? renderTemplate(template.body, lead as Lead) : ''

  // Store pending approval
  await supabase.from('pending_approvals').insert({
    sequence_message_id: step1.id,
    lead_id: lead.id,
    suggested_message: suggestedMessage,
  })

  // Notify owner
  const ownerPhone = Deno.env.get('OWNER_PHONE')!
  const notification =
    (isReturning ? `*Lead voltou ao formulario!* 🔄\n\n` : `*Novo Lead MedShare!* 🎯\n\n`) +
    `*Nome:* ${lead.name}\n` +
    `*WhatsApp:* +${normalizedPhone}\n` +
    `*Cargo:* ${lead.role ?? 'nao informado'}\n` +
    `*Volume:* ${lead.procedures_per_month ?? 'nao informado'}\n` +
    `*Problemas:* ${lead.problems ?? 'nao informado'}\n\n` +
    `*Mensagem sugerida:*\n` +
    `-----------------\n` +
    `${suggestedMessage}\n` +
    `-----------------\n\n` +
    `Responda *sim* para enviar essa mensagem, ou escreva outra mensagem para enviar no lugar.`

  await sendWhatsAppText(ownerPhone, notification)

  console.log(`Lead ${extractFirstName(lead.name)} (${normalizedPhone}) registered. Owner notified for approval.`)

  return new Response(
    JSON.stringify({ success: true, lead_id: lead.id }),
    { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
  )
})
