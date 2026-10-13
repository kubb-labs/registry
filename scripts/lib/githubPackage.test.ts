import { describe, expect, it } from 'vitest'
import { entryTargets, githubPackageProblems } from './githubPackage.ts'
import type { GitHubArtifact } from './types.ts'

const artifact: GitHubArtifact = {
  kind: 'github',
  package: '@acme/kubb-plugin-x',
  version: '1.2.0',
  owner: 'acme',
  repo: 'kubb-plugin-x',
  tag: 'v1.2.0',
  commit: '0123456789abcdef0123456789abcdef01234567',
}

const packageJson = {
  name: '@acme/kubb-plugin-x',
  version: '1.2.0',
  type: 'module',
  exports: { '.': { types: './dist/index.d.ts', import: './dist/index.js' }, './package.json': './package.json' },
  files: ['dist', 'kubb-extension.json'],
  scripts: { compile: 'tsdown', test: 'vitest' },
}
const paths = new Set(['package.json', 'kubb-extension.json', 'dist/index.js', 'dist/index.d.ts', 'src/index.ts'])

function problems(overrides: Record<string, unknown>, files: ReadonlySet<string> = paths) {
  return githubPackageProblems({ artifact, text: JSON.stringify({ ...packageJson, ...overrides }), paths: files, manifest: true })
}

describe('entryTargets', () => {
  it('collects main, module, and every exports condition, without wildcards', () => {
    expect(
      entryTargets({
        main: './dist/index.cjs',
        module: 'dist/index.js',
        exports: { '.': { import: ['./dist/index.js', './dist/fallback.js'], default: './dist/index.cjs' }, './*': './dist/*.js', './internal': null },
      }),
    ).toStrictEqual(['dist/index.cjs', 'dist/index.js', 'dist/fallback.js'])
  })
})

describe('githubPackageProblems', () => {
  it('passes a package that commits its build and lists it in files', () => {
    expect(problems({})).toStrictEqual([])
  })

  it('accepts a files glob that covers the build', () => {
    expect(problems({ files: ['dist/*.js', 'dist/*.d.ts', '*.json'] })).toStrictEqual([])
  })

  it.each(['preinstall', 'install', 'postinstall', 'prepare', 'prepack', 'prepublish', 'publish', 'build'])('rejects a %s script', (script) => {
    expect(problems({ scripts: { [script]: 'tsdown' } })).toStrictEqual([
      `package.json has the ${script} script(s), which make package managers build the package at install. Commit the build and rename or remove them.`,
    ])
  })

  it('rejects workspaces', () => {
    expect(problems({ workspaces: ['packages/*'] })).toStrictEqual(['package.json has "workspaces", which makes npm install the whole workspace at install'])
  })

  it('names a name or version that differs from the artifact', () => {
    expect(problems({ name: '@acme/other', version: '1.1.0' })).toStrictEqual([
      'package.json names "@acme/other", not "@acme/kubb-plugin-x"',
      'package.json has version "1.1.0", not "1.2.0" from tag v1.2.0',
    ])
  })

  it('names entry points that are not committed or leave the package', () => {
    expect(
      problems(
        { exports: { '.': './dist/index.js', './cli': '../cli.js' }, files: ['dist', 'kubb-extension.json', '../cli.js'] },
        new Set(['kubb-extension.json']),
      ),
    ).toStrictEqual(['entry points outside the package: ../cli.js', 'entry points not committed: dist/index.js'])
  })

  it('requires an entry point', () => {
    expect(problems({ exports: undefined })).toStrictEqual(['package.json names no file in "main", "module", or "exports"'])
  })

  it('requires files, and that it covers the manifest and the entry points', () => {
    expect(problems({ files: undefined })).toStrictEqual([
      'package.json has no "files" list. Without one, package managers apply .gitignore and can leave out the committed build.',
    ])
    expect(problems({ files: ['dist/index.js'] })).toStrictEqual(['"files" in package.json leaves out kubb-extension.json, dist/index.d.ts'])
  })

  it('reports a missing or broken package.json', () => {
    expect(githubPackageProblems({ artifact, text: undefined, paths, manifest: true })).toStrictEqual(['the repository root has no package.json'])
    expect(githubPackageProblems({ artifact, text: '{', paths, manifest: true })).toStrictEqual(['package.json is not valid JSON'])
  })
})
