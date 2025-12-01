const esbuild = require("esbuild")
const fs = require("fs")
const path = require("path")

const production = process.argv.includes("--production")
const watch = process.argv.includes("--watch")

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
  name: "esbuild-problem-matcher",

  setup(build) {
    build.onStart(() => {
      console.log("[watch] build started")
    })
    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`)
        console.error(`    ${location.file}:${location.line}:${location.column}:`)
      })
      console.log("[watch] build finished")
    })
  },
}

/**
 * Copy static assets to dist directory
 */
function copyStaticAssets() {
  const srcDir = path.join(__dirname, "src", "components", "webview")
  const distDir = path.join(__dirname, "dist", "components", "webview")

  // Create dist directory structure
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true })
  }

  // Copy templates directory
  const templatesSrc = path.join(srcDir, "templates")
  const templatesDist = path.join(distDir, "templates")
  if (fs.existsSync(templatesSrc)) {
    if (!fs.existsSync(templatesDist)) {
      fs.mkdirSync(templatesDist, { recursive: true })
    }
    const files = fs.readdirSync(templatesSrc)
    files.forEach((file) => {
      fs.copyFileSync(path.join(templatesSrc, file), path.join(templatesDist, file))
    })
  }

  // Copy styles directory
  const stylesSrc = path.join(srcDir, "styles")
  const stylesDist = path.join(distDir, "styles")
  if (fs.existsSync(stylesSrc)) {
    if (!fs.existsSync(stylesDist)) {
      fs.mkdirSync(stylesDist, { recursive: true })
    }
    const files = fs.readdirSync(stylesSrc)
    files.forEach((file) => {
      fs.copyFileSync(path.join(stylesSrc, file), path.join(stylesDist, file))
    })
  }

  // Copy scripts directory
  const scriptsSrc = path.join(srcDir, "scripts")
  const scriptsDist = path.join(distDir, "scripts")
  if (fs.existsSync(scriptsSrc)) {
    if (!fs.existsSync(scriptsDist)) {
      fs.mkdirSync(scriptsDist, { recursive: true })
    }
    const files = fs.readdirSync(scriptsSrc)
    files.forEach((file) => {
      fs.copyFileSync(path.join(scriptsSrc, file), path.join(scriptsDist, file))
    })
  }

  // Copy React build output (dist directory)
  const webviewDistSrc = path.join(srcDir, "dist")
  const webviewDistDist = path.join(distDir, "dist")
  if (fs.existsSync(webviewDistSrc)) {
    if (!fs.existsSync(webviewDistDist)) {
      fs.mkdirSync(webviewDistDist, { recursive: true })
    }
    const files = fs.readdirSync(webviewDistSrc)
    files.forEach((file) => {
      const srcPath = path.join(webviewDistSrc, file)
      const distPath = path.join(webviewDistDist, file)
      if (fs.statSync(srcPath).isDirectory()) {
        // Recursively copy directories
        if (!fs.existsSync(distPath)) {
          fs.mkdirSync(distPath, { recursive: true })
        }
        const subFiles = fs.readdirSync(srcPath)
        subFiles.forEach((subFile) => {
          fs.copyFileSync(path.join(srcPath, subFile), path.join(distPath, subFile))
        })
      } else {
        fs.copyFileSync(srcPath, distPath)
      }
    })
  }
}

async function main() {
  // Copy static assets first
  copyStaticAssets()

  const ctx = await esbuild.context({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    format: "cjs",
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: "node",
    outfile: "dist/extension.js",
    external: ["vscode"],
    logLevel: "silent",
    mainFields: ["module", "main"],
    conditions: ["import", "require"],
    plugins: [
      /* add to the end of plugins array */
      esbuildProblemMatcherPlugin,
    ],
  })
  if (watch) {
    await ctx.watch()
  } else {
    await ctx.rebuild()
    await ctx.dispose()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
