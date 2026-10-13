/** Install commands an overview must not contain: the page already shows how to install. */
const INSTALL_COMMAND = /\b(?:kubb\s+add|npm\s+install|npm\s+i(?=\s|$)|pnpm\s+add|yarn\s+add)\b/i

/**
 * Returns what is wrong with an overview (`docs/overview.md`, a root `OVERVIEW.md`, or a registry
 * overview), empty when it passes. The rest of the content contract is reviewed by a person (REVIEW.md).
 */
export function overviewProblems(overview: string): Array<string> {
  const problems: Array<string> = []
  if (!overview.trim()) problems.push('the overview is empty')
  if (INSTALL_COMMAND.test(overview))
    problems.push('the overview contains an install command (kubb add, npm install, npm i, pnpm add, or yarn add). Remove it.')
  return problems
}
