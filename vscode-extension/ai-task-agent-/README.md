# AI Task Agent - VSCode Extension

The AI Task Agent is a VSCode extension that automates tasks on your computer using AI. Simply describe a task, and the extension will generate a plan of commands to execute, show you the plan for approval, and then execute it upon confirmation. If a task fails, the agent will collect feedback and refine the plan for another attempt.

## Features

- 🤖 AI-generated task execution plans
- 👁️ Preview and approve plans before execution
- 📝 File creation and editing
- 🖥️ Command execution in the workspace
- 🔄 Feedback and refinement loop for failed tasks
- 🔧 Support for multiple AI providers (Groq, HuggingFace)

## Prerequisites

- VS Code version 1.74.0 or higher
- Node.js and npm installed
- Groq API key or HuggingFace API token (free tier)

## Installation

### Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/1shChheda/AI-Task-Agent-Project.git
   cd AI-Task-Agent-Project/vscode-extension/ai-task-agent-
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run compile
   ```

4. Launch the extension in development mode:
   - Press `F5` in VS Code (or click on "Run & Debug" -> "Run Extension") to start a debugging session
   - Alternatively, run from terminal:
     ```bash
     code --extensionDevelopmentPath=/path/to/AI-Task-Agent-Project/vscode-extension/ai-task-agent-
     ```

### Installing the Extension Locally

1. Package the extension:
   ```bash
   npm install -g @vscode/vsce
   vsce package
   ```

2. Install the generated .vsix file:
   - Open VS Code
   - Go to Extensions view (Ctrl+Shift+X)
   - Click on the "..." menu (top-right)
   - Select "Install from VSIX..."
   - Browse to the generated .vsix file

## Configuration

Before using the extension, you need to configure your AI provider settings:

1. Open VS Code settings (Ctrl+,)
2. Search for "AI Task Agent"
3. Configure the following settings:

| Setting | Description | Default |
|---------|-------------|---------|
| `aiTaskAgent.provider` | AI provider to use | `groq` |
| `aiTaskAgent.groqApiKey` | Your Groq API key | `""` |
| `aiTaskAgent.huggingfaceApiToken` | Your HuggingFace API token | `""` |
| `aiTaskAgent.model` | Model to use | `llama3-8b-8192` |
| `aiTaskAgent.debugMode` | Enable verbose output | `false` |
| `aiTaskAgent.maxRetries` | Maximum retry attempts | `3` |

### Getting API Keys

- **Groq**: Sign up for a free account at [groq.com](https://console.groq.com/keys) to get your API key
- **HuggingFace**: Create a free account at [huggingface.co](https://huggingface.co/settings/tokens) to get your API token

## Usage

Currently, the extension's sidebar view is under development. You can use the extension through the Command Palette:

1. Open Command Palette (Ctrl+Shift+P)
2. Type and select "Run AI Task"
3. Enter your task description (e.g., "Create a React component that displays a counter")
4. Review the generated plan in the output channel
5. Approve the plan when prompted
6. Monitor execution in the output channel
7. Provide feedback if the task fails

### Available Commands

- `AI Task Agent: Run Task` - Start a new task
- `AI Task Agent: Execute Task` - Execute the current plan
- `AI Task Agent: Cancel Task` - Cancel the current task
- `AI Task Agent: Provide Feedback` - Provide feedback on the current task

### Output Channel

The extension displays detailed information in the "AI Task Agent" output channel, which you can view by:

1. Open the Output panel (Ctrl+Shift+U)
2. Select "AI Task Agent" from the dropdown menu

## Task Execution Flow

1. **Task Description**: Enter a natural language description of what you want to accomplish
2. **Plan Generation**: The AI generates a step-by-step plan
3. **Plan Review**: Review and approve/reject the proposed plan
4. **Execution**: The extension executes the approved plan
5. **Feedback**: Indicate if the task was successful or provide feedback to refine the plan

## Examples

Here are some example tasks you can try:

- "Create a React component that displays a counter"
- "Initialize a new npm project with Express"
- "Create a basic HTML page with CSS styling"

## Troubleshooting

### Extension not showing in sidebar

The sidebar view is currently under development. Use the Command Palette (Ctrl+Shift+P) to access all commands.

### API connection issues

- Verify your API key is correctly entered in settings
- Check your internet connection
- Ensure the API service is operational

### Command execution failures

- Make sure your workspace has the necessary environment (e.g., Python installed for Python scripts)
- Check the output channel for detailed error messages
- For permission issues, try simplifying the task or running VS Code with elevated permissions

## Security Notes

The extension includes safety checks to prevent harmful commands from executing. However, always review the plan carefully before approving execution.

## Limitations

- Limited to tasks that can be accomplished with command-line operations
- Complex multi-step workflows might require refinement
- Depends on the capabilities of the selected AI model

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.