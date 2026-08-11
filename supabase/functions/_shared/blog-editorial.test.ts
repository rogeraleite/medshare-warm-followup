import {
  formatBlogChoiceConfirmation,
  parseBlogEditorialCommand,
} from './blog-editorial.ts'

function assertEquals(actual: unknown, expected: unknown): void {
  const left = JSON.stringify(actual)
  const right = JSON.stringify(expected)
  if (left !== right) throw new Error(`Expected ${right}, received ${left}`)
}

function assertIncludes(actual: string, expected: string): void {
  if (!actual.includes(expected)) {
    throw new Error(`Expected "${actual}" to include "${expected}"`)
  }
}

Deno.test('accepts namespaced editorial options', () => {
  assertEquals(parseBlogEditorialCommand('BLOG A'), { kind: 'valid', option: 'A' })
  assertEquals(parseBlogEditorialCommand(' blog b '), { kind: 'valid', option: 'B' })
  assertEquals(parseBlogEditorialCommand('Blog D'), { kind: 'valid', option: 'D' })
})

Deno.test('consumes invalid BLOG commands without treating other messages as blog commands', () => {
  assertEquals(parseBlogEditorialCommand('BLOG'), { kind: 'invalid' })
  assertEquals(parseBlogEditorialCommand('BLOG E'), { kind: 'invalid' })
  assertEquals(parseBlogEditorialCommand('BLOG A agora'), { kind: 'invalid' })
  assertEquals(parseBlogEditorialCommand('A'), { kind: 'not_blog' })
  assertEquals(parseBlogEditorialCommand('confirmar A'), { kind: 'not_blog' })
  assertEquals(parseBlogEditorialCommand('BLOGUE A'), { kind: 'not_blog' })
})

Deno.test('confirmation identifies the selected option and both publication dates', () => {
  const confirmation = formatBlogChoiceConfirmation({
    week_start: '2026-08-17',
    selected_option: 'C',
  })

  assertIncludes(confirmation, 'BLOG C')
  assertIncludes(confirmation, '17/08')
  assertIncludes(confirmation, '20/08')
})
