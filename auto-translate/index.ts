#!/usr/bin/env bun

import { $ } from "bun"
import path from "node:path"
import { Octokit } from "@octokit/rest"
import * as core from "@actions/core"
import * as github from "@actions/github"
import { createOpencodeClient } from "@opencode-ai/sdk"
import fs from "node:fs"

// 环境变量
const MODEL = process.env.MODEL || "anthropic/claude-sonnet-4-20250514"
const SOURCE_LANG = process.env.SOURCE_LANG || "en"
const TARGET_LANG = process.env.TARGET_LANG || "zh"

// 路径配置
const DOCS_PATH = "packages/web/src/content/docs"
const SOURCE_DOCS_PATH = path.join(DOCS_PATH, "docs")
const TARGET_DOCS_PATH = path.join(DOCS_PATH, TARGET_LANG, "docs")

// GitHub API客户端（使用JWT token）
const octokit = new Octokit({
  auth: process.env.TOKEN,
})

// Opencode客户端
const opencode = createOpencodeClient({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

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

    // 1. Detect document changes
    const changes = await detectDocChanges()
    if (changes.length === 0) {
      console.log("✅ No documentation changes detected, skipping translation")
      return
    }

    console.log(`📝 Detected ${changes.length} document changes:`)
    changes.forEach(change => {
      console.log(`  - ${change.changeType}: ${change.path}`)
    })

    console.log("🧪 TEST MODE: Stopping after document detection - skipping branch creation, file processing, and PR creation")
    console.log("✅ Document detection test completed successfully!")
    return

    // 2. Create translation branch
    const branchName = await createTranslationBranch()
    console.log(`🌿 Created translation branch: ${branchName}`)

    // 3. Process each document change
    for (const change of changes) {
      await processDocChange(change)
    }

    // 4. Commit and push translation results
    await commitAndPushTranslations(branchName)

    // 5. Create PR
    const prNumber = await createTranslationPR(branchName)
    console.log(`🔗 Created translation PR: #${prNumber}`)

    console.log("✅ Auto-translation workflow completed successfully!")

  } catch (error) {
    console.error("❌ Auto-translation workflow failed:", error)
    core.setFailed(error instanceof Error ? error.message : String(error))
  }
}

async function detectDocChanges(): Promise<DocChange[]> {
  console.log("🔍 Detecting documentation changes...")
  
  const changes: DocChange[] = []
  
  // 获取当前commit和上一个commit的差异
  const { data: commits } = await octokit.rest.repos.listCommits({
    ...github.context.repo,
    per_page: 2,
  })

  if (commits.length < 2) {
    console.log("⚠️ No previous commits found, skipping change detection")
    return changes
  }

  const currentCommit = commits[0].sha
  const previousCommit = commits[1].sha

  console.log(`📝 Current commit: ${currentCommit}`)
  console.log(`📝 Previous commit: ${previousCommit}`)

  // 获取文件差异
  const { data: diff } = await octokit.rest.repos.compareCommits({
    ...github.context.repo,
    base: previousCommit,
    head: currentCommit,
  })

  console.log(`📊 Total files changed: ${diff.files?.length || 0}`)

  // 分析变更的文件
  for (const file of diff.files || []) {
    console.log(`📄 File: ${file.filename} (${file.status})`)
    if (isDocFile(file.filename)) {
      const change: DocChange = {
        path: file.filename,
        changeType: getChangeType(file.status),
        sourcePath: file.filename,
        targetPath: getTargetPath(file.filename),
      }
      changes.push(change)
      console.log(`✅ Added to translation queue: ${file.filename}`)
    }
  }

  return changes
}

function isDocFile(filename: string): boolean {
  return filename.startsWith(SOURCE_DOCS_PATH) && 
         (filename.endsWith('.mdx') || filename.endsWith('.md'))
}

function getChangeType(status: string): "added" | "modified" | "deleted" {
  switch (status) {
    case "added": return "added"
    case "modified": return "modified"
    case "removed": return "deleted"
    default: return "modified"
  }
}

function getTargetPath(sourcePath: string): string {
  const relativePath = path.relative(SOURCE_DOCS_PATH, sourcePath)
  return path.join(TARGET_DOCS_PATH, relativePath)
}

async function createTranslationBranch(): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
  const branchName = `auto-translate/${timestamp}`
  
  console.log(`🌿 Creating translation branch: ${branchName}`)
  
  // Get current branch's latest commit
  const { data: ref } = await octokit.rest.git.getRef({
    ...github.context.repo,
    ref: `heads/${github.context.ref.replace('refs/heads/', '')}`,
  })

  console.log(`📝 Base commit for new branch: ${ref.object.sha}`)

  // Create new branch using GitHub API
  await octokit.rest.git.createRef({
    ...github.context.repo,
    ref: `refs/heads/${branchName}`,
    sha: ref.object.sha,
  })

  console.log(`✅ Branch created via GitHub API: ${branchName}`)

  // Checkout the new branch locally
  await $`git checkout -b ${branchName}`
  console.log(`✅ Switched to local branch: ${branchName}`)

  return branchName
}

async function processDocChange(change: DocChange): Promise<void> {
  console.log(`📝 Processing ${change.changeType} document: ${change.path}`)
  
  if (change.changeType === "deleted") {
    // Delete corresponding target file
    if (fs.existsSync(change.targetPath)) {
      fs.unlinkSync(change.targetPath)
      console.log(`🗑️ Deleted target file: ${change.targetPath}`)
    }
    return
  }

      // Ensure target directory exists
    const targetDir = path.dirname(change.targetPath)
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
      console.log(`📁 Created target directory: ${targetDir}`)
    }

    // Read source document
    const sourceContent = fs.readFileSync(change.sourcePath, 'utf-8')
    console.log(`📖 Read source file: ${change.sourcePath} (${sourceContent.length} characters)`)
    
    // For testing, just copy the content instead of calling AI
    const translatedContent = `<!-- TEST MODE: This is a test translation -->\n${sourceContent}`
    
    // Write to target file
    fs.writeFileSync(change.targetPath, translatedContent, 'utf-8')
    console.log(`✅ Test content saved: ${change.targetPath}`)
}

async function translateContent(content: string): Promise<string> {
  console.log("🤖 Calling AI for translation...")
  
  try {
    // Build translation prompt
    const prompt = buildTranslationPrompt(content)
    
    // Call opencode for translation
    const response = await opencode.chat({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: MODEL,
    })

    return response.content[0].text
  } catch (error) {
    console.error("❌ Translation failed:", error)
    // If translation fails, return original content with comment
    return `<!-- Translation failed, showing original content -->\n${content}`
  }
}

function buildTranslationPrompt(content: string): string {
  return `Please translate the following English technical documentation to the target language. Requirements:

1. Maintain the original Markdown format and structure
2. Use professional technical terminology
3. Ensure accurate, fluent, and natural translation
4. Keep code blocks, links, images, and other elements unchanged
5. Only return the translated content, do not add any explanations

English document content:
${content}`
}

async function commitAndPushTranslations(branchName: string): Promise<void> {
  console.log("💾 Committing and pushing translation results...")
  
  // Switch to translation branch
  await $`git checkout ${branchName}`
  
  // Add all changes
  await $`git add .`
  
  // Commit
  await $`git commit -m "test: auto-translate workflow test run

- Test run of auto-translate workflow
- Model: ${MODEL}
- Triggered by: ${github.context.sha}
- Branch: ${branchName}"`
  
  // Push branch
  await $`git push origin ${branchName}`
  
  console.log("✅ Translation results committed and pushed")
}

async function createTranslationPR(branchName: string): Promise<number> {
  console.log("🔗 Creating translation PR...")
  
  const { data: pr } = await octokit.rest.pulls.create({
    ...github.context.repo,
    head: branchName,
    base: github.context.ref.replace('refs/heads/', ''),
    title: `🧪 TEST: Auto-translate workflow test run`,
    body: `## Test Run Summary

This is a test run of the auto-translate workflow to verify the basic functionality.

### Test Details
- Workflow triggered successfully
- Branch created: \`${branchName}\`
- Triggered by commit: \`${github.context.sha}\`
- This is a test run, not actual translation

### Next Steps
After confirming this test works, the workflow will be updated to perform actual AI translation.`,
  })
  
  console.log(`✅ Test PR created: #${pr.number}`)
  return pr.number
}

// Execute main function
if (import.meta.main) {
  main()
}
