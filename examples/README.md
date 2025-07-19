# Example Workflows

This directory contains example GitHub Actions workflows demonstrating different use cases for the Claude Code Base Action.

## Available Examples

### 1. Issue Triage (`issue-triage.yml`)

Automatically triages GitHub issues by analyzing their content and applying appropriate labels.

**Trigger:** When issues are opened
**Features:**
- Uses GitHub MCP server for issue management
- Analyzes issue content and applies relevant labels
- Prevents posting comments (labels only)

### 2. USTA PR Trigger (`usta-pr-trigger.yml`)

Executes USTA specifications when `@usta <specname>` is mentioned in pull request comments or descriptions.

**Trigger:** When PRs are opened/edited or comments contain `@usta`
**Features:**
- Responds with "Tamamdır hacım bi bakayım." 
- Finds and validates the specified USTA spec
- Executes tasks sequentially with real-time progress updates
- Pushes changes to the PR branch after each task
- Updates the comment with task progress and final status
- Handles fork repositories gracefully
- Supports retry logic and error recovery

## Using USTA PR Trigger

### Setup

1. **Copy the workflow** to your repository's `.github/workflows/` directory
2. **Set up secrets** in your repository:
   - `ANTHROPIC_API_KEY`: Your Anthropic API key
3. **Configure permissions** (already included in the workflow):
   - `contents: write` - for git operations
   - `pull-requests: write` - for comment updates

### Usage

1. **Create a USTA spec** in `.usta/specs/<spec-name>/` with:
   - `requirements.md` - Feature requirements and acceptance criteria
   - `design.md` - Technical design and architecture
   - `tasks.md` - Implementation tasks with checkboxes

2. **Trigger execution** by mentioning `@usta <spec-name>` in:
   - Pull request description when creating/editing a PR
   - Pull request comments

3. **Monitor progress** through the automatically updated comment showing:
   - Current task being executed
   - Task completion status with emojis
   - Overall progress (X/Y tasks completed)
   - Execution duration
   - Links to workflow logs if errors occur

### Example Trigger Comments

```
@usta user-authentication

Let's implement the user auth system: @usta auth-system

@usta checkout-flow Please implement the shopping cart checkout
```

### Spec Structure Example

```
.usta/specs/user-authentication/
├── requirements.md     # User stories and acceptance criteria
├── design.md          # Technical architecture and approach  
├── tasks.md           # Implementation tasks with checkboxes
```

### Task Format in tasks.md

```markdown
# Implementation Plan

## Core Features
- [ ] 1. Create user registration endpoint
  - Add email validation
  - Hash passwords securely
  - _Requirements: 1.1, 1.2_

- [ ] 2. Implement login functionality
  - JWT token generation
  - Session management
  - _Requirements: 2.1, 2.2_
```

### Limitations

- **Fork repositories**: Cannot push to forks due to security restrictions
- **Branch protection**: May require configuring branch protection rules to allow `github-actions[bot]`
- **API rate limits**: GitHub API calls for comment updates are subject to rate limits
- **Execution timeout**: Default 30-minute timeout for the entire workflow

### Troubleshooting

**Common Issues:**

1. **"Spec not found" error**: Ensure the spec directory exists in `.usta/specs/`
2. **Permission denied**: Check that repository permissions allow the action to push
3. **Fork restriction**: Use a branch in the main repository instead of a fork
4. **Task validation failures**: Check that `tasks.md` follows the required checkbox format

**Debug Tips:**

- Check workflow logs for detailed error messages
- Verify spec file syntax and structure
- Ensure tasks have proper numbering and checkbox format
- Test locally using the action's standalone mode first