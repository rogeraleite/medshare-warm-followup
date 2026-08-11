export type BlogEditorialOption = 'A' | 'B' | 'C' | 'D'

export type ParsedBlogEditorialCommand =
  | { kind: 'not_blog' }
  | { kind: 'invalid' }
  | { kind: 'valid'; option: BlogEditorialOption }

export interface BlogEditorialCycleChoice {
  week_start: string
  selected_option: BlogEditorialOption
}

export function parseBlogEditorialCommand(message: string): ParsedBlogEditorialCommand {
  const normalized = message.trim()

  if (!/^blog(?:\s|$)/i.test(normalized)) {
    return { kind: 'not_blog' }
  }

  const match = normalized.match(/^blog\s+([abcd])$/i)
  if (!match) return { kind: 'invalid' }

  return {
    kind: 'valid',
    option: match[1].toUpperCase() as BlogEditorialOption,
  }
}

function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T12:00:00Z`)
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid date: ${date}`)
  parsed.setUTCDate(parsed.getUTCDate() + days)
  return parsed.toISOString().slice(0, 10)
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(`${date}T12:00:00Z`))
}

export function formatBlogChoiceConfirmation(cycle: BlogEditorialCycleChoice): string {
  const monday = formatDate(cycle.week_start)
  const thursday = formatDate(addDays(cycle.week_start, 3))

  return `Direção BLOG ${cycle.selected_option} registrada para os artigos de ${monday} e ${thursday}. Você pode alterar a escolha até segunda-feira às 12h BRT.`
}

export const INVALID_BLOG_COMMAND_MESSAGE =
  'Comando do blog não reconhecido. Responda BLOG A, BLOG B, BLOG C ou BLOG D.'

export const CLOSED_BLOG_CYCLE_MESSAGE =
  'Não há um ciclo editorial do blog aberto para escolha. A direção desta semana pode já ter sido fechada.'
