#!/usr/bin/env bun

import { $ } from "bun"
import path from "node:path"
import { Octokit } from "@octokit/rest"
import * as core from "@actions/core"
import * as github from "@actions/github"
import { createOpencodeClient } from "@opencode-ai/sdk"
import { spawn } from "node:child_process"
import fs from "node:fs"

// Environment variables
const MODEL = process.env.MODEL || "anthropic/claude-sonnet-4-20250514"
const SOURCE_LANG = process.env.SOURCE_LANG || "en"
const TARGET_LANG = process.env.TARGET_LANG || "zh"

// Path configuration
const DOCS_PATH = "packages/web/src/content/docs"
const SOURCE_DOCS_PATH = path.join(DOCS_PATH, "docs")
const TARGET_DOCS_PATH = path.join(DOCS_PATH, TARGET_LANG, "docs")

// GitHub API client
let octokit: Octokit

// Opencode client and server (exactly like opencode implementation)
const { client, server } = createOpencode()
let session: { id: string; title: string; version: string }
let gitConfig: string
let exitCode = 0

// Document change interface
interface DocChange {
  path: string
  changeType: "added" | "modified" | "deleted"
  sourcePath: string
  targetPath: string
}

try {
  await assertOpencodeConnected()
  
  // Initialize GitHub API client
  octokit = new Octokit({ auth: process.env.TOKEN })
  
  // Configure git
  await configureGit(process.env.TOKEN!)
  
  // Setup opencode session
  session = await client.session.create<true>().then((r: any) => r.data)
  console.log("opencode session", session.id)
  
  // Detect document changes
  const changes = await detectDocChanges()
  if (changes.length === 0) {
    console.log("No documentation changes detected, skipping translation")
    process.exit(0)
  }
  
  // Create translation branch
  const branchName = await createTranslationBranch()
  
  // Process each document change
  for (const change of changes) {
    await processDocChange(change)
  }
  
  // Check if branch is dirty and commit changes
  if (await branchIsDirty()) {
    const summary = await summarize("Documentation translation completed")
    await commitAndPushTranslations(branchName, summary)
    await createTranslationPR(branchName, summary)
  }
  
} catch (e: any) {
  exitCode = 1
  console.error(e)
  let msg = e
  if (e instanceof $.ShellError) {
    msg = e.stderr.toString()
  } else if (e instanceof Error) {
    msg = e.message
  }
  core.setFailed(msg)
} finally {
  server.close()
  await restoreGitConfig()
}
process.exit(exitCode)

function createOpencode() {
  const host = "127.0.0.1"
  const port = 4096
  const url = `http://${host}:${port}`
  const proc = spawn(`opencode`, [`serve`, `--hostname=${host}`, `--port=${port}`])
  const client = createOpencodeClient({ baseUrl: url })

  return {
    server: { url, close: () => proc.kill() },
    client,
  }
}

async function assertOpencodeConnected() {
  let retry = 0
  let connected = false
  do {
    try {
      await client.app.get<true>()
      connected = true
      break
    } catch (e) {}
    await new Promise((resolve) => setTimeout(resolve, 300))
  } while (retry++ < 30)

  if (!connected) {
    throw new Error("Failed to connect to opencode server")
  }
}

async function configureGit(token: string) {
  console.log("Configuring git...")
  const config = "http.https://github.com/.extraheader"
  const ret = await $`git config --local --get ${config}`
  gitConfig = ret.stdout.toString().trim()

  const newCredentials = Buffer.from(`x-access-token:${token}`, "utf8").toString("base64")

  await $`git config --local --unset-all ${config}`
  await $`git config --local ${config} "AUTHORIZATION: basic ${newCredentials}"`
  await $`git config --global user.name "opencode-agent[bot]"`
  await $`git config --global user.email "opencode-agent[bot]@users.noreply.github.com"`
}

async function restoreGitConfig() {
  if (gitConfig === undefined) return
  console.log("Restoring git config...")
  const config = "http.https://github.com/.extraheader"
  await $`git config --local ${config} "${gitConfig}"`
}

async function branchIsDirty() {
  console.log("Checking if branch is dirty...")
  const ret = await $`git status --porcelain`
  return ret.stdout.toString().trim().length > 0
}

async function chat(text: string, files: any[] = []) {
  console.log("Sending message to opencode...")
  const [providerID, ...rest] = MODEL.split("/")
  const modelID = rest.join("/")

  const chat = await client.session.chat<true>({
    path: session,
    body: {
      providerID,
      modelID,
      agent: "build",
      parts: [
        {
          type: "text",
          text,
        },
        ...files.flatMap((f) => [
          {
            type: "file" as const,
            mime: f.mime,
            url: `data:${f.mime};base64,${f.content}`,
            filename: f.filename,
            source: {
              type: "file" as const,
              text: {
                value: f.replacement,
                start: f.start,
                end: f.end,
              },
              path: f.filename,
            },
          },
        ]),
      ],
    },
  })

  // @ts-ignore
  const match = chat.data.parts.findLast((p) => p.type === "text")
  if (!match) throw new Error("Failed to parse the text response")

  return match.text
}

async function summarize(response: string) {
  try {
    return await chat(`Summarize the following in less than 40 characters:\n\n${response}`)
  } catch (e) {
    return `Documentation translation completed`
  }
}

// Custom functions for document translation
async function detectDocChanges(): Promise<DocChange[]> {
  console.log("Detecting document changes...")
  
  const currentBranch = github.context.ref.replace('refs/heads/', '')
  console.log(`Current branch: ${currentBranch}`)
  
  try {
    const commits = await octokit.rest.repos.listCommits({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      sha: currentBranch,
      per_page: 10
    })
    
    if (commits.data.length < 2) {
      console.log("No previous commits to compare")
      return []
    }
    
    const latestCommit = commits.data[0]
    const previousCommit = commits.data[1]
    
    console.log(`Latest commit: ${latestCommit.sha}`)
    console.log(`Previous commit: ${previousCommit.sha}`)
    
    const diff = await octokit.rest.repos.compareCommits({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      base: previousCommit.sha,
      head: latestCommit.sha
    })
    
    const changes: DocChange[] = []
    
    for (const file of diff.data.files || []) {
      if (isDocFile(file.filename)) {
        const changeType = getChangeType(file.status)
        const sourcePath = file.filename
        const targetPath = getTargetPath(file.filename)
        
        changes.push({
          path: file.filename,
          changeType,
          sourcePath,
          targetPath
        })
        
        console.log(`Detected ${changeType}: ${file.filename}`)
      }
    }
    
    return changes
  } catch (error) {
    console.error("Error detecting changes:", error)
    return []
  }
}

function isDocFile(filename: string): boolean {
  return filename.startsWith(SOURCE_DOCS_PATH) && 
         (filename.endsWith('.mdx') || filename.endsWith('.md'))
}

function getChangeType(status: string): "added" | "modified" | "deleted" {
  switch (status) {
    case 'added': return 'added'
    case 'modified': return 'modified'
    case 'deleted': return 'deleted'
    default: return 'modified'
  }
}

function getTargetPath(sourcePath: string): string {
  const relativePath = sourcePath.replace(SOURCE_DOCS_PATH, '')
  return path.join(TARGET_DOCS_PATH, relativePath)
}

async function createTranslationBranch(): Promise<string> {
  console.log("Creating translation branch...")
  const branchName = `auto-translate/${Date.now()}`
  
  await $`git checkout -b ${branchName}`
  console.log(`Created branch: ${branchName}`)
  
  return branchName
}

async function processDocChange(change: DocChange) {
  console.log(`Processing ${change.changeType}: ${change.path}`)
  
  if (change.changeType === 'deleted') {
    // Remove target file if source was deleted
    if (fs.existsSync(change.targetPath)) {
      fs.unlinkSync(change.targetPath)
      console.log(`Deleted: ${change.targetPath}`)
    }
    return
  }
  
  // Read source content
  const sourceContent = fs.readFileSync(change.sourcePath, 'utf-8')
  
  // Build translation prompt
  const prompt = buildTranslationPrompt(sourceContent, change.path)
  
  // Call AI for translation
  const response = await chat(prompt)
  console.log(`Translation completed for: ${change.path}`)
  
  // AI should have modified the file directly via agent: "build"
  // Verify file was created/modified
  if (!fs.existsSync(change.targetPath)) {
    console.log(`Warning: Target file not created: ${change.targetPath}`)
  }
}

function buildTranslationPrompt(content: string, filename: string): string {
  return `You are a professional technical translator. Please translate the following English documentation to Chinese (Simplified Chinese).

File: ${filename}
Source language: English
Target language: Chinese (Simplified Chinese)

Requirements:
1. Maintain the exact same structure and formatting (Markdown syntax, code blocks, tables, etc.)
2. Preserve all technical terms accurately
3. Use professional and natural Chinese expressions
4. Keep all links, file paths, and technical references unchanged
5. Maintain the same heading hierarchy and organization

Please translate the following content:

${content}

Please use the write tool to create/update the Chinese translation file. The target path should be: ${getTargetPath(filename)}

After translation, provide a brief summary of what was translated.`
}

async function commitAndPushTranslations(branchName: string, summary: string) {
  console.log("Committing and pushing translations...")
  
  await $`git add ${TARGET_DOCS_PATH}`
  await $`git commit -m "${summary}"`
  await $`git push -u origin ${branchName}`
  
  console.log(`Pushed branch: ${branchName}`)
}

async function createTranslationPR(branchName: string, summary: string) {
  console.log("Creating translation PR...")
  
  const pr = await octokit.rest.pulls.create({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    head: branchName,
    base: github.context.ref.replace('refs/heads/', ''),
    title: `Auto-translate: ${summary}`,
    body: `This PR contains automatic translations of documentation changes.

**Changes translated:**
- Source language: ${SOURCE_LANG}
- Target language: ${TARGET_LANG}
- AI Model: ${MODEL}

**Summary:** ${summary}

This PR was automatically generated by the auto-translate workflow.`
  })
  
  console.log(`Created PR: #${pr.data.number}`)
  return pr.data.number
}
