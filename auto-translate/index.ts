#!/usr/bin/env bun

import { $ } from "bun"
import * as path from "node:path"
import { Octokit } from "@octokit/rest"
import * as core from "@actions/core"
import * as github from "@actions/github"
import * as fs from "fs"
import { createOpencodeClient } from "@opencode-ai/sdk"
import { spawn } from "node:child_process"

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

interface DocChange {
  path: string
  changeType: "added" | "modified" | "deleted"
  sourcePath: string
  targetPath: string
}

async function main() {
  try {
    console.log("🚀 Starting auto-translation workflow...")
    console.log(`📚 Source language: ${SOURCE_LANG}`)
    console.log(`🌏 Target language: ${TARGET_LANG}`)
    console.log(`🤖 AI Model: ${MODEL}`)
    console.log(`🔑 GitHub Token available: ${!!process.env.TOKEN}`)
    console.log(`🔑 Anthropic API Key available: ${!!process.env.ANTHROPIC_API_KEY}`)
    console.log(`📁 Current working directory: ${process.cwd()}`)
    console.log(`📁 Auto-translate path: ${__dirname}`)
    console.log(`📁 SOURCE_DOCS_PATH: ${SOURCE_DOCS_PATH}`)
    console.log(`📁 TARGET_DOCS_PATH: ${TARGET_DOCS_PATH}`)

    // Initialize GitHub API client with workflow token
    octokit = new Octokit({ auth: process.env.TOKEN })
    console.log(`🔑 GitHub token initialized`)

    // Setup opencode session (exactly like opencode implementation)
    console.log("📝 Setting up opencode session...")
    session = await client.session.create<true>().then((r: any) => r.data)
    console.log(`✅ Opencode session created: ${session.id}`)
    console.log(`📝 Session title: ${session.title}`)
    console.log(`📝 Session version: ${session.version}`)

    // 1. Detect document changes
    console.log("🔍 Step 1: Detecting document changes...")
    const changes = await detectDocChanges()
    if (changes.length === 0) {
      console.log("✅ No documentation changes detected, skipping translation")
      return
    }

    console.log(`📝 Detected ${changes.length} document changes:`)
    changes.forEach((change, index) => {
      console.log(`  ${index + 1}. ${change.changeType}: ${change.path}`)
      console.log(`     Source: ${change.sourcePath}`)
      console.log(`     Target: ${change.targetPath}`)
    })

    // 2. Create translation branch
    console.log("🌿 Step 2: Creating translation branch...")
    const branchName = await createTranslationBranch()
    console.log(`✅ Created translation branch: ${branchName}`)

    // 3. Process each document change
    console.log("📝 Step 3: Processing document changes...")
    for (let i = 0; i < changes.length; i++) {
      const change = changes[i]
      console.log(`\n🔄 Processing change ${i + 1}/${changes.length}: ${change.path}`)
      await processDocChange(change)
    }

    // 4. Commit and push translation results
    console.log("\n💾 Step 4: Committing and pushing translation results...")
    await commitAndPushTranslations(branchName)

    // 5. Create PR
    console.log("🔗 Step 5: Creating pull request...")
    const prNumber = await createTranslationPR(branchName)
    console.log(`✅ Created translation PR: #${prNumber}`)

    console.log("\n🎉 Auto-translation workflow completed successfully!")
    console.log(`📋 Summary:`)
    console.log(`   - Documents processed: ${changes.length}`)
    console.log(`   - Translation branch: ${branchName}`)
    console.log(`   - Pull request: #${prNumber}`)

  } catch (error) {
    console.error("❌ Auto-translation workflow failed:", error)
    core.setFailed(error instanceof Error ? error.message : String(error))
  } finally {
    // Close opencode server (exactly like opencode implementation)
    console.log("🔌 Closing opencode server...")
    server.close()
    console.log("✅ Opencode server closed")
  }
}

async function detectDocChanges(): Promise<DocChange[]> {
  console.log("🔍 Detecting document changes...")
  console.log(`📁 Current branch: ${github.context.ref}`)
  console.log(`📁 Current SHA: ${github.context.sha}`)
  
  try {
    // Get current branch name
    const currentBranch = github.context.ref.replace('refs/heads/', '')
    console.log(`📁 Working on branch: ${currentBranch}`)
    
    // Get commits for the current branch
    const commits = await octokit.rest.repos.listCommits({
      ...github.context.repo,
      sha: currentBranch,
      per_page: 10,
    })
    
    console.log(`📝 Found ${commits.data.length} commits on branch ${currentBranch}`)
    
    if (commits.data.length === 0) {
      console.log("⚠️ No commits found, skipping change detection")
      return []
    }
    
    // Get the latest commit SHA
    const latestCommit = commits.data[0]
    console.log(`📝 Latest commit: ${latestCommit.sha} - ${latestCommit.commit.message}`)
    
    // Get the previous commit SHA (if available)
    const previousCommit = commits.data[1]
    if (previousCommit) {
      console.log(`📝 Previous commit: ${previousCommit.sha} - ${previousCommit.commit.message}`)
    }
    
    // Get file changes between the latest and previous commit
    const comparison = await octokit.rest.repos.compareCommits({
      ...github.context.repo,
      base: previousCommit?.sha || latestCommit.sha,
      head: latestCommit.sha,
    })
    
    console.log(`📝 File comparison result:`)
    console.log(`   - Status: ${comparison.data.status}`)
    console.log(`   - Files changed: ${comparison.data.files?.length || 0}`)
    
    const changes: DocChange[] = []
    
    if (comparison.data.files) {
      for (const file of comparison.data.files) {
        console.log(`   📄 File: ${file.filename} (${file.status})`)
        
        if (isDocFile(file.filename)) {
          const changeType = getChangeType(file.status)
          const sourcePath = path.join(process.cwd(), file.filename)
          const targetPath = getTargetPath(file.filename)
          
          console.log(`     ✅ Document file detected:`)
          console.log(`        Change type: ${changeType}`)
          console.log(`        Source path: ${sourcePath}`)
          console.log(`        Target path: ${targetPath}`)
          
          changes.push({
            path: file.filename,
            changeType,
            sourcePath,
            targetPath,
          })
        }
      }
    }
    
    console.log(`📝 Total document changes detected: ${changes.length}`)
    return changes
    
  } catch (error) {
    console.error("❌ Error detecting document changes:", error)
    throw error
  }
}

function isDocFile(filename: string): boolean {
  const isDoc = filename.startsWith(SOURCE_DOCS_PATH) && 
                (filename.endsWith('.mdx') || filename.endsWith('.md'))
  
  if (isDoc) {
    console.log(`     ✅ Document file: ${filename}`)
  } else {
    console.log(`     ❌ Not a document file: ${filename}`)
  }
  
  return isDoc
}

function getChangeType(status: string): "added" | "modified" | "deleted" {
  let changeType: "added" | "modified" | "deleted"
  
  switch (status) {
    case "added":
      changeType = "added"
      break
    case "modified":
      changeType = "modified"
      break
    case "removed":
      changeType = "deleted"
      break
    default:
      changeType = "modified"
      console.log(`⚠️ Unknown file status '${status}', defaulting to 'modified'`)
  }
  
  console.log(`     📝 Change type: ${status} -> ${changeType}`)
  return changeType
}

function getTargetPath(sourcePath: string): string {
  // Replace the source docs path with target docs path
  const relativePath = sourcePath.replace(SOURCE_DOCS_PATH, '')
  const targetPath = path.join(TARGET_DOCS_PATH, relativePath)
  
  console.log(`     🔄 Path mapping:`)
  console.log(`        Source: ${sourcePath}`)
  console.log(`        Target: ${targetPath}`)
  
  return targetPath
}

async function createTranslationBranch(): Promise<string> {
  console.log("🌿 Creating translation branch...")
  
  const timestamp = new Date().toISOString().replace(/[:-]/g, "").replace(/\.\d{3}Z/, "")
  const branchName = `auto-translate/${timestamp}`
  
  console.log(`📝 Branch name: ${branchName}`)
  
  try {
    // Create branch using GitHub API
    const { data: ref } = await octokit.rest.git.createRef({
      ...github.context.repo,
      ref: `refs/heads/${branchName}`,
      sha: github.context.sha,
    })
    
    console.log(`✅ Branch created via GitHub API: ${ref.ref}`)
    
    // Checkout the branch locally
    await $`git checkout -b ${branchName}`
    console.log(`✅ Switched to local branch: ${branchName}`)
    
    // Configure git user for commits
    await $`git config --global user.name "opencode-agent[bot]"`
    await $`git config --global user.email "opencode-agent[bot]@users.noreply.github.com"`
    console.log(`✅ Git user configured for commits`)
    
    return branchName
    
  } catch (error) {
    console.error("❌ Error creating translation branch:", error)
    throw error
  }
}

async function processDocChange(change: DocChange): Promise<void> {
  console.log(`📝 Processing ${change.changeType} document: ${change.path}`)
  
  if (change.changeType === "deleted") {
    console.log(`🗑️ Handling deleted file: ${change.targetPath}`)
    // Delete corresponding target file
    if (fs.existsSync(change.targetPath)) {
      fs.unlinkSync(change.targetPath)
      console.log(`✅ Deleted target file: ${change.targetPath}`)
    } else {
      console.log(`ℹ️ Target file already deleted: ${change.targetPath}`)
    }
    return
  }

  // Ensure target directory exists
  const targetDir = path.dirname(change.targetPath)
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true })
    console.log(`📁 Created target directory: ${targetDir}`)
  } else {
    console.log(`📁 Target directory already exists: ${targetDir}`)
  }

  // Read source document
  const sourceContent = fs.readFileSync(change.sourcePath, 'utf-8')
  console.log(`📖 Read source file: ${change.sourcePath} (${sourceContent.length} characters)`)
  
  // Call AI for translation (AI will directly modify files using build agent)
  console.log(`🤖 Starting AI translation for: ${change.path}`)
  await translateContent(sourceContent, change.sourcePath, change.targetPath)
  
  console.log(`✅ AI translation completed for: ${change.targetPath}`)
}

async function translateContent(sourceContent: string, sourcePath: string, targetPath: string): Promise<void> {
  console.log("🤖 Calling AI for translation...")
  console.log(`📝 Source file: ${sourcePath}`)
  console.log(`📝 Target file: ${targetPath}`)
  console.log(`📝 Content length: ${sourceContent.length} characters`)
  
  try {
    // Build translation prompt
    const prompt = buildTranslationPrompt(sourceContent, sourcePath, targetPath)
    console.log(`📝 Translation prompt built (${prompt.length} characters)`)
    
    // Call opencode for translation (completely following opencode's chat method)
    console.log("🤖 Calling opencode session.chat...")
    const chat = await client.session.chat<true>({
      path: session,
      body: {
        providerID: "anthropic",
        modelID: MODEL.replace("anthropic/", ""),
        agent: "build",
        parts: [
          {
            type: "text",
            text: prompt,
          },
        ],
      },
    })

    console.log("✅ AI Response received from opencode")
    console.log(`📝 Chat response details:`)
    console.log(`   - Response type: ${typeof chat}`)
    console.log(`   - Has data: ${!!chat.data}`)
    
    // With build agent, AI should have already modified the files
    // We just need to verify the file was created/updated
    console.log("🔍 Verifying file modification...")
    if (!fs.existsSync(targetPath)) {
      throw new Error(`Target file was not created by AI: ${targetPath}`)
    }
    
    const stats = fs.statSync(targetPath)
    console.log(`✅ Target file verified:`)
    console.log(`   - Path: ${targetPath}`)
    console.log(`   - Size: ${stats.size} bytes`)
    console.log(`   - Modified: ${stats.mtime}`)
    
    console.log(`✅ AI translation completed for: ${targetPath}`)
    
  } catch (error) {
    console.error("❌ Translation failed:", error)
    throw new Error(`Translation failed for ${sourcePath}: ${error}`)
  }
}

function buildTranslationPrompt(sourceContent: string, sourcePath: string, targetPath: string): string {
  return `You are a professional technical translator specializing in software documentation.

TASK: Translate the following English documentation to Chinese (Simplified).

SOURCE: ${sourcePath}
TARGET: ${targetPath}

INSTRUCTIONS:
1. Use the 'write' tool to create/update the Chinese file at ${targetPath}
2. Maintain exact structure, formatting, and markdown syntax
3. Translate all English text to professional, accurate Chinese
4. Keep technical terms consistent with industry standards
5. Preserve all markdown syntax, code examples, and file paths
6. Ensure the translation reads naturally in Chinese

SOURCE CONTENT:
${sourceContent}

Please proceed with the translation using your tools. After completing the translation, provide a brief summary of what was done.`
}

async function commitAndPushTranslations(branchName: string): Promise<void> {
  console.log("📝 Committing translation changes...")
  
  // Check if there are any changes to commit
  console.log("🔍 Checking if branch is dirty...")
  const isDirty = await branchIsDirty()
  if (!isDirty) {
    console.log("✅ No changes to commit")
    return
  }
  
  console.log("📝 Changes detected, preparing to commit...")
  
  // Add only translation files
  console.log("📁 Adding translation files to git...")
  await $`git add packages/web/src/content/docs/zh/docs/`
  console.log("✅ Translation files added to git")
  
  // Use fixed commit message (similar to opencode's approach)
  const commitMessage = `docs: Auto-translate documentation to Chinese

- Translated English documentation to Chinese (Simplified)
- Maintained original structure and formatting
- Updated Chinese documentation files automatically
- This commit was generated by the auto-translate workflow`
  
  console.log("📝 Committing with message:")
  console.log(commitMessage)
  
  await $`git commit -m "${commitMessage}"`
  console.log("✅ Changes committed locally")
  
  // Push to remote branch
  console.log(`📤 Pushing to remote branch: ${branchName}`)
  await $`git push origin ${branchName}`
  console.log("✅ Translation changes committed and pushed")
}

// Add branchIsDirty function (copied from opencode implementation)
async function branchIsDirty(): Promise<boolean> {
  console.log("🔍 Checking if branch is dirty...")
  const ret = await $`git status --porcelain`
  const isDirty = ret.stdout.toString().trim().length > 0
  console.log(`📝 Branch dirty status: ${isDirty}`)
  if (isDirty) {
    console.log("📝 Git status output:")
    console.log(ret.stdout.toString())
  }
  return isDirty
}

async function createTranslationPR(branchName: string): Promise<number> {
  console.log("🔗 Creating translation pull request...")
  
  const { repo } = github.context
  console.log(`📝 Repository: ${repo.owner}/${repo.repo}`)
  console.log(`📝 Base branch: dev`)
  console.log(`📝 Head branch: ${branchName}`)
  
  const prTitle = "docs: Auto-translate documentation to Chinese"
  const prBody = `## Auto-translation of Documentation

This PR contains automatically translated Chinese documentation files.

### What was done:
- Translated English documentation to Chinese (Simplified)
- Maintained original structure and formatting
- Updated Chinese documentation files automatically

### Technical details:
- AI Model: ${MODEL}
- Source Language: ${SOURCE_LANG}
- Target Language: ${TARGET_LANG}
- Generated by: auto-translate workflow

### Files changed:
The following Chinese documentation files have been updated:
- \`packages/web/src/content/docs/zh/docs/\` - All documentation files

This PR was automatically generated by the auto-translate workflow. Please review the translations for accuracy and completeness.`

  console.log("📝 PR details:")
  console.log(`   - Title: ${prTitle}`)
  console.log(`   - Body length: ${prBody.length} characters`)

  try {
    const pr = await octokit.rest.pulls.create({
      owner: repo.owner,
      repo: repo.repo,
      head: branchName,
      base: "dev",
      title: prTitle,
      body: prBody,
    })

    console.log(`✅ Created translation PR: #${pr.data.number}`)
    console.log(`🔗 PR URL: ${pr.data.html_url}`)
    return pr.data.number
    
  } catch (error) {
    console.error("❌ Error creating PR:", error)
    throw error
  }
}

// Execute main function
if (import.meta.main) {
  main()
}
