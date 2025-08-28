# Auto Translate Action

Automatically translate English documentation to Chinese using GitHub Actions.

## Features

- 🚀 **Auto-trigger**: Automatically triggers translation when English docs are updated
- 🤖 **AI-powered**: Uses Claude AI for high-quality translation
- 📝 **Smart detection**: Automatically detects document changes (added, modified, deleted)
- 🔄 **Branch management**: Creates independent translation branches without affecting main branch
- 📋 **PR creation**: Automatically creates translation PRs for human review
- 🌏 **Multi-language support**: Supports multiple language pairs (currently English → Chinese)

## Usage

### 1. Reference in workflow

```yaml
name: Auto Translate

on:
  push:
    branches: [dev]
    paths:
      - 'packages/web/src/content/docs/docs/**/*.mdx'
      - 'packages/web/src/content/docs/docs/**/*.md'

jobs:
  translate:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
      id-token: write
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          ref: dev
          fetch-depth: 0
          
      - name: Run translation
        uses: ./auto-translate
        with:
          model: anthropic/claude-sonnet-4-20250514
          source_lang: 'en'
          target_lang: 'zh'
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

### 2. Configure environment variables

Add to repository Secrets:
- `ANTHROPIC_API_KEY`: Anthropic API key

### 3. Configure permissions

Ensure workflow has sufficient permissions:
- `contents: write`: Update Chinese documentation
- `pull-requests: write`: Create translation PRs
- `id-token: write`: Generate JWT token

## Workflow

1. **Trigger detection**: Monitors English doc changes pushed to dev branch
2. **Change analysis**: Analyzes added, modified, and deleted documents
3. **AI translation**: Calls Claude AI for document translation
4. **Branch creation**: Creates independent translation branch
5. **File updates**: Updates corresponding Chinese documentation
6. **Commit & push**: Commits translation results and pushes to remote
7. **PR creation**: Automatically creates translation PR for review

## Input Parameters

| Parameter | Description | Required | Default |
|-----------|-------------|----------|---------|
| `model` | AI model | Yes | `anthropic/claude-sonnet-4-20250514` |
| `source_lang` | Source language | Yes | `en` |
| `target_lang` | Target language | Yes | `zh` |
| `token` | GitHub token | No | `GITHUB_TOKEN` |

## Output

- Automatically creates translation branch
- Updates Chinese documentation files
- Creates translation PR
- Detailed execution logs

## Technical Architecture

```
Workflow → Action → Business Logic
├── Trigger condition check
├── Environment configuration
├── Dependency installation
├── Document change detection
├── AI translation call
├── Git operations
└── PR creation
```

## Requirements

- Node.js 18+
- Bun 1.0+
- GitHub Actions v4

## Notes

- Translation quality requires human review
- Ensure API key security configuration
- Recommend testing in test environment before deploying to production

## Troubleshooting

### Common Issues

1. **Insufficient permissions**: Check workflow permission configuration
2. **API call failure**: Verify API key is correct
3. **Git operation failure**: Confirm repository access permissions
4. **Poor translation quality**: Adjust translation prompts or use better models

### Log Viewing

View detailed execution logs in GitHub Actions page, including:
- Document change detection results
- AI translation call status
- Git operation execution
- Error messages and stack traces

## Contributing

Welcome to submit Issues and Pull Requests to improve this Action!

## License

MIT License
