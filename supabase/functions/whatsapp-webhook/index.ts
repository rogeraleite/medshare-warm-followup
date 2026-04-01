import { createClient } from 'jsr:@supabase/supabase-js@2'
import { extractFirstName, renderTemplate, type Lead } from '../_shared/templates.ts'

const LEAD_TRIGGER_PREFIX = 'Potencial Lead:'
const SEQUENCE_DELAYS_DAYS = [0, 1, 3, 7, 14]

// ─── Phone helpers ────────────────────────────────────────────────────────────

function normalizePhone(raw: string): string {
  const trimmed = raw.trim()
  let digits = trimmed.startsWith('+') ? trimmed.slice(1).replace(/\D/g, '') : trimmed.replace(/\D/g, '')
  // Brazilian mobile: 55 + 2-digit area code + 8 digits = 12 digits -> add 9th digit
  if (digits.startsWith('55') && digits.length === 12) {
    digits = digits.slice(0, 4) + '9' + digits.slice(4)
  }
  return digits
}


// ─── Zapster send ─────────────────────────────────────────────────────────────

async function sendWhatsAppText(phone: string, text: string): Promise<{ ok: boolean; status: number; body: string }> {
  const url = `${Deno.env.get('ZAPSTER_API_URL')}/wa/messages`
  const body = {
    recipient: phone,
    text,
    instance_id: Deno.env.get('ZAPSTER_INSTANCE_ID'),
    link_preview: true,
  }
  console.log(`Zapster send to ${phone}:`, JSON.stringify(body))
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
  return { ok: res.ok, status: res.status, body: resText }
}

// ─── CSV parser ───────────────────────────────────────────────────────────────

function parseLeadCsv(csv: string): Record<string, string> {
  const parts = csv.split(',')
  return {
    name: parts[0]?.trim() ?? '',
    phone: parts[1]?.trim() ?? '',
    role: parts[2]?.trim() ?? '',
    procedures_per_month: parts[3]?.trim() ?? '',
    problems: parts.slice(4).join(',').trim(),
  }
}

// ─── Lead registration ────────────────────────────────────────────────────────

async function registerLead(
  supabase: ReturnType<typeof createClient>,
  csv: string
): Promise<void> {
  const { name, phone, role, procedures_per_month, problems } = parseLeadCsv(csv)

  if (!name || !phone) {
    console.warn('Potencial Lead: missing name or phone, skipping')
    return
  }

  const normalizedPhone = normalizePhone(phone)

  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .upsert(
      { name, phone: normalizedPhone, role: role || null, procedures_per_month: procedures_per_month || null, problems: problems || null, status: 'active' },
      { onConflict: 'phone', ignoreDuplicates: false }
    )
    .select('id, name, phone, role, procedures_per_month, problems')
    .single()

  if (leadError || !lead) {
    console.error('Error upserting lead:', leadError)
    return
  }

  // Remove ALL existing messages and approvals to avoid unique constraint on re-registration
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
    return
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
    `*Novo Lead MedShare!* 🎯\n\n` +
    `*Nome:* ${lead.name}\n` +
    `*WhatsApp:* +${normalizedPhone}\n` +
    `*Cargo:* ${lead.role ?? 'não informado'}\n` +
    `*Volume:* ${lead.procedures_per_month ?? 'não informado'}\n` +
    `*Problemas:* ${lead.problems ?? 'não informado'}\n\n` +
    `*Mensagem sugerida:*\n` +
    `─────────────────\n` +
    `${suggestedMessage}\n` +
    `─────────────────\n\n` +
    `Responda *sim* para enviar essa mensagem, ou escreva outra mensagem para enviar no lugar.`

  await sendWhatsAppText(ownerPhone, notification)

  console.log(`Lead ${extractFirstName(lead.name)} (${normalizedPhone}) registered. Owner notified for approval.`)
}

// ─── Owner approval flow ──────────────────────────────────────────────────────

async function handleOwnerReply(
  supabase: ReturnType<typeof createClient>,
  replyText: string
): Promise<void> {
  const ownerPhone = Deno.env.get('OWNER_PHONE')!

  // Find oldest pending approval
  const { data: approval } = await supabase
    .from('pending_approvals')
    .select('id, suggested_message, sequence_message_id, leads!inner(name, phone)')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (!approval) return

  // Verify sequence message is still awaiting approval
  const { data: seqMsg } = await supabase
    .from('sequence_messages')
    .select('status')
    .eq('id', approval.sequence_message_id)
    .single()

  if (!seqMsg || seqMsg.status !== 'awaiting_approval') return

  const lead = approval.leads as { name: string; phone: string }
  const firstName = extractFirstName(lead.name)

  // "sim" uses suggested message, anything else is sent as-is
  const contentToSend = replyText.trim().toLowerCase() === 'sim'
    ? approval.suggested_message
    : replyText.trim()

  // Send to lead
  const sendResult = await sendWhatsAppText(lead.phone, contentToSend)

  if (!sendResult.ok) {
    await sendWhatsAppText(ownerPhone, `*Erro ao enviar mensagem para ${lead.name}!*\n\nStatus: ${sendResult.status}\n${sendResult.body}`)
    console.error(`Failed to send to ${lead.phone}: ${sendResult.status} ${sendResult.body}`)
    return
  }

  // Mark as sent
  await supabase
    .from('sequence_messages')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', approval.sequence_message_id)

  // Clean up approval
  await supabase.from('pending_approvals').delete().eq('id', approval.id)

  // Notify owner
  await sendWhatsAppText(ownerPhone, `Mensagem enviada para *${lead.name}* com sucesso! 🚀`)
  console.log(`Step 0 sent to ${firstName} (${lead.phone}) after owner approval.`)
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  let payload: Record<string, unknown>
  try {
    payload = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  console.log('Inbound webhook payload:', JSON.stringify(payload))

  const data = payload?.data as Record<string, unknown> | undefined
  const senderPhone = normalizePhone(
    String(
      (data?.sender as Record<string, unknown>)?.phone_number ??
      payload?.sender ??
      payload?.from ??
      payload?.phone ??
      ''
    )
  )
  const content = data?.content as Record<string, unknown> | undefined
  const messageBody = String(
    content?.text ??
    (content?.reaction as Record<string, unknown>)?.text ??
    payload?.text ??
    payload?.body ??
    payload?.message ??
    ''
  )
  const mediaType = String(content?.type ?? '')
  const mediaUrl = String(content?.url ?? content?.media_url ?? content?.link ?? '')

  if (!senderPhone) {
    console.warn('Could not extract sender phone from webhook payload')
    return new Response('OK', { status: 200 })
  }

  // Ignore outbound echo from MedShare sender
  const medsharePhone = normalizePhone(Deno.env.get('MEDSHARE_SENDER_PHONE') ?? '')
  if (senderPhone === medsharePhone) {
    return new Response('OK', { status: 200 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const ownerPhone = normalizePhone(Deno.env.get('OWNER_PHONE') ?? '')

  // ── Message from owner: handle approval flow ──
  if (senderPhone === ownerPhone) {
    if (messageBody.startsWith(LEAD_TRIGGER_PREFIX)) {
      // Owner can also register a lead manually
      const csv = messageBody.slice(LEAD_TRIGGER_PREFIX.length).trim()
      await registerLead(supabase, csv)
    } else {
      await handleOwnerReply(supabase, messageBody)
    }
    return new Response('OK', { status: 200 })
  }

  // ── "Potencial Lead:" from any other source ──
  if (messageBody.startsWith(LEAD_TRIGGER_PREFIX)) {
    const csv = messageBody.slice(LEAD_TRIGGER_PREFIX.length).trim()
    await registerLead(supabase, csv)
    return new Response('OK', { status: 200 })
  }

  // ── Inbound reply from a lead ──
  const { data: lead } = await supabase
    .from('leads')
    .select('id, name, status')
    .eq('phone', senderPhone)
    .single()

  if (!lead) {
    console.log(`Ignoring message from unknown number: ${senderPhone}`)
    return new Response('OK', { status: 200 })
  }

  await supabase.from('inbound_messages').insert({
    lead_id: lead.id,
    phone: senderPhone,
    body: messageBody,
  })

  const MEDIA_TYPES = ['image', 'audio', 'video', 'document', 'sticker']
  if (MEDIA_TYPES.includes(mediaType)) {
    const label = mediaType === 'image' ? 'Imagem' : mediaType === 'audio' ? 'Audio' : mediaType === 'video' ? 'Video' : mediaType === 'document' ? 'Documento' : 'Midia'
    const mediaNotification =
      `*${lead.name}* enviou um ${label}:\n` +
      (mediaUrl ? mediaUrl : '_sem URL disponivel_')
    await sendWhatsAppText(ownerPhone, mediaNotification)
    console.log(`Media (${mediaType}) from ${lead.name} forwarded to owner.`)
    return new Response('OK', { status: 200 })
  }

  if (lead.status === 'active' || lead.status === 'replied') {
    if (lead.status === 'active') {
      await supabase.from('leads').update({ status: 'replied' }).eq('id', lead.id)

      await supabase
        .from('sequence_messages')
        .update({ status: 'skipped' })
        .eq('lead_id', lead.id)
        .in('status', ['pending', 'awaiting_approval', 'awaiting_confirm'])

      await supabase
        .from('pending_approvals')
        .delete()
        .eq('lead_id', lead.id)
    }

    // Check 5-minute window from first reply after last sent step
    const { data: lastSentMsg } = await supabase
      .from('sequence_messages')
      .select('sent_at')
      .eq('lead_id', lead.id)
      .eq('status', 'sent')
      .order('sent_at', { ascending: false })
      .limit(1)
      .single()

    const afterSentAt = lastSentMsg?.sent_at ?? new Date(0).toISOString()

    const { data: firstCurrentMessage } = await supabase
      .from('inbound_messages')
      .select('created_at')
      .eq('lead_id', lead.id)
      .gte('created_at', afterSentAt)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    const firstReplyAt = firstCurrentMessage ? new Date(firstCurrentMessage.created_at) : new Date()
    const withinWindow = (new Date().getTime() - firstReplyAt.getTime()) <= 5 * 60 * 1000

    if (!withinWindow) {
      console.log(`Lead ${extractFirstName(lead.name)} replied but 5-min window expired. Skipping owner notification.`)
      return new Response('OK', { status: 200 })
    }

    const firstName = extractFirstName(lead.name)

    let notification: string
    if (lead.status === 'active') {
      // First reply: full notification with step info
      const { data: lastSent } = await supabase
        .from('sequence_messages')
        .select('step')
        .eq('lead_id', lead.id)
        .eq('status', 'sent')
        .order('step', { ascending: false })
        .limit(1)
        .single()

      const stepLabel = lastSent ? `Passo ${lastSent.step} de 5` : 'Antes do primeiro envio'
      notification =
        `*Lead respondeu!* 💬\n\n` +
        `*${lead.name}* (+${senderPhone})\n` +
        `*Etapa:* ${stepLabel}\n\n` +
        `_"${messageBody}"_\n\n` +
        `Sequencia pausada. Hora de entrar em contato manualmente!`
    } else {
      // Subsequent replies: simple format
      notification = `*${firstName}:* ${messageBody}`
    }

    await sendWhatsAppText(ownerPhone, notification)
    console.log(`Lead ${firstName} (${senderPhone}) replied. Owner notified.`)
  }

  return new Response('OK', { status: 200 })
})
