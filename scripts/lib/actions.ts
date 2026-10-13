import { appendFileSync, writeFileSync } from 'node:fs'

/**
 * Sets a step output when running in GitHub Actions. Values are single-line strings the scripts
 * built from validated input.
 */
export function setOutput({ name, value }: { name: string; value: string }): void {
  if (/[\r\n]/.test(value)) throw new Error(`output ${name} must be a single line`)
  const file = process.env.GITHUB_OUTPUT
  if (!file) return console.log(`${name}=${value}`)
  appendFileSync(file, `${name}=${value}\n`)
}

/**
 * Writes Markdown to the file named by an environment variable, or prints it when the variable is unset.
 */
export function writeMarkdown({ envName, markdown }: { envName: string; markdown: string }): void {
  const file = process.env[envName]
  if (!file) return console.log(markdown)
  writeFileSync(file, markdown)
}
