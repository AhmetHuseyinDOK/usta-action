# Claude Code Base Action - Detailed Architecture

## Overview

The Claude Code Base Action is a GitHub Action that enables running Claude Code within GitHub workflows. It provides a seamless way to integrate AI-powered code assistance into your CI/CD pipelines.

## Architecture Flow

```mermaid
flowchart TD
    A[GitHub Workflow] -->|Triggers| B[Claude Code Base Action]
    B --> C[Setup Node.js]
    C --> D[Install Bun]
    D --> E[Install Dependencies]
    E --> F[Install Claude Code]
    F --> G[Run Claude Code Action]

    G --> H{Provider Selection}
    H -->|Anthropic API| I[Direct API Authentication]
    H -->|AWS Bedrock| J[OIDC Authentication]
    H -->|Google Vertex| K[OIDC Authentication]

    I --> L[Execute Claude Code]
    J --> L
    K --> L

    L --> M[Generate Output]
    M --> N[Return Results]
    N --> O[Workflow Continues]
```

## Component Details

### 1. Action Definition (`action.yml`)

The action is defined as a composite action with the following structure:

```mermaid
graph LR
    A[action.yml] --> B[Inputs]
    A --> C[Outputs]
    A --> D[Steps]

    B --> B1[spec_name]
    B --> B2[allowed_tools]
    B --> B3[disallowed_tools]
    B --> B4[max_turns]
    B --> B5[model]
    B --> B6[Authentication]
    B --> B7[Settings]

    C --> C1[conclusion]
    C --> C2[execution_file]

    D --> D1[Setup Node.js]
    D --> D2[Install Bun]
    D --> D3[Install Dependencies]
    D --> D4[Install Claude Code]
    D --> D5[Run Claude Code]
```

### 2. Execution Process (`src/index.ts`)

The main execution script handles:

```mermaid
sequenceDiagram
    participant W as GitHub Workflow
    participant A as Action
    participant S as Setup Script
    participant C as Claude Code
    participant O as Output

    W->>A: Trigger Action
    A->>S: Run index.ts
    S->>S: Parse Environment Variables
    S->>S: Validate Configuration
    S->>S: Prepare Claude Arguments
    S->>C: Execute Claude Code
    C->>C: Process with AI Model
    C->>O: Generate JSON Output
    O->>S: Return Execution Log
    S->>A: Set Output Variables
    A->>W: Return Results
```

### 3. Input Processing

The action processes various types of inputs:

```mermaid
graph TD
    A[Environment Variables] --> B{Input Type}

    B --> C[Model Configuration]
    C --> C1[model/anthropic_model]
    C --> C2[fallback_model]

    B --> D[Tool Configuration]
    D --> D1[allowed_tools]
    D --> D2[disallowed_tools]

    B --> E[Execution Settings]
    E --> E1[max_turns]
    E --> E2[timeout_minutes]
    E --> E3[spec_name]

    B --> F[Advanced Settings]
    F --> F1[mcp_config]
    F --> F2[settings]
    F --> F3[system_prompt]
    F --> F4[append_system_prompt]
    F --> F5[claude_env]

    B --> G[Authentication]
    G --> G1[anthropic_api_key]
    G --> G2[claude_code_oauth_token]
    G --> G3[use_bedrock]
    G --> G4[use_vertex]
```

### 4. Provider Authentication Flow

```mermaid
stateDiagram-v2
    [*] --> CheckProvider

    CheckProvider --> AnthropicAPI: use_bedrock=false & use_vertex=false
    CheckProvider --> AWSBedrock: use_bedrock=true
    CheckProvider --> GoogleVertex: use_vertex=true

    AnthropicAPI --> CheckAPIKey
    CheckAPIKey --> UseAPIKey: anthropic_api_key provided
    CheckAPIKey --> UseOAuth: claude_code_oauth_token provided

    AWSBedrock --> ConfigureAWS
    ConfigureAWS --> SetRegion
    SetRegion --> SetCredentials
    SetCredentials --> SetBedrockURL

    GoogleVertex --> ConfigureGCP
    ConfigureGCP --> SetProjectID
    SetProjectID --> SetMLRegion
    SetMLRegion --> SetVertexURL

    UseAPIKey --> ExecuteClaude
    UseOAuth --> ExecuteClaude
    SetBedrockURL --> ExecuteClaude
    SetVertexURL --> ExecuteClaude

    ExecuteClaude --> [*]
```

### 5. Output Generation

```mermaid
graph LR
    A[Claude Execution] --> B[JSON Output]
    B --> C[/tmp/claude-execution-output.json]

    C --> D[Parse Results]
    D --> E[Extract Conclusion]
    D --> F[Set File Path]

    E --> G[Output: conclusion]
    F --> H[Output: execution_file]

    G --> I[GitHub Workflow]
    H --> I
```

## Key Features

### 1. Multi-Provider Support

The action supports three AI providers:

- **Anthropic API**: Direct API access with API key authentication
- **AWS Bedrock**: AWS-hosted Claude models with OIDC authentication
- **Google Vertex AI**: Google Cloud-hosted Claude models with OIDC authentication

### 2. Flexible Configuration

- **Model Selection**: Choose specific Claude models with fallback options
- **Tool Control**: Allow or disallow specific Claude Code tools
- **Execution Limits**: Set maximum conversation turns and timeouts
- **Custom Prompts**: Override or append to system prompts
- **Environment Variables**: Pass custom environment variables to Claude

### 3. Integration Points

```mermaid
graph TD
    A[GitHub Actions Workflow] --> B[Claude Code Base Action]

    B --> C[Pre-execution Setup]
    C --> C1[Node.js Setup]
    C --> C2[Bun Runtime]
    C --> C3[Dependencies]

    B --> D[Claude Code Execution]
    D --> D1[Specification Implementation]
    D --> D2[Code Generation]
    D --> D3[File Manipulation]

    B --> E[Post-execution]
    E --> E1[JSON Output Log]
    E --> E2[Success/Failure Status]
    E --> E3[Downstream Steps]
```

## Usage Examples

### Basic Usage

```yaml
- uses: anthropics/claude-code-base-action@v1
  with:
    spec_name: "user-authentication"
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

### Advanced Configuration

```yaml
- uses: anthropics/claude-code-base-action@v1
  with:
    spec_name: "payment-integration"
    model: "claude-3-opus-20240229"
    fallback_model: "claude-3-sonnet-20240229"
    allowed_tools: "Read,Write,Edit"
    max_turns: "10"
    timeout_minutes: "15"
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

### AWS Bedrock Usage

```yaml
- uses: anthropics/claude-code-base-action@v1
  with:
    spec_name: "data-pipeline"
    use_bedrock: "true"
    model: "anthropic.claude-3-opus-20240229-v1:0"
  env:
    AWS_REGION: "us-east-1"
```

## Technical Implementation Details

### 1. Named Pipes (FIFO)

The action uses named pipes for inter-process communication between the prompt preparation and Claude execution.

### 2. JSON Streaming

Execution logs are streamed as JSON to provide structured output that can be parsed by subsequent workflow steps.

### 3. Timeout Enforcement

The action wraps Claude Code execution in a timeout command to ensure workflows don't hang indefinitely.

### 4. Error Handling

The action captures both successful completions and failures, providing appropriate exit codes and status outputs.

## Security Considerations

1. **API Key Management**: API keys should be stored as GitHub secrets
2. **OIDC Authentication**: Bedrock and Vertex use temporary credentials via OIDC
3. **Tool Restrictions**: Use allowed_tools/disallowed_tools to limit Claude's capabilities
4. **Environment Isolation**: Each execution runs in an isolated GitHub runner environment
