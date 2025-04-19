import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import axios from 'axios';
import { exec } from 'child_process';
import { TaskViewProvider } from './taskViewProvider';

let currentPlan: string[] = [];
let taskDescription: string = '';
let executionOutput: string = '';
let fileOperations: Record<string, string> = {};
let outputChannel: vscode.OutputChannel;
let taskViewProvider: TaskViewProvider;

console.log('Registering TaskViewProvider with viewType:', TaskViewProvider.viewType);

export function activate(context: vscode.ExtensionContext) {
    //creating an output channel for logs
    outputChannel = vscode.window.createOutputChannel('AI Task Agent');
    outputChannel.show();

    // TO-DO: design a sidebar for the Extension - taskViewProvider
    //Register the tree view provider for the sidebar
    taskViewProvider = new TaskViewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            TaskViewProvider.viewType,
            taskViewProvider
        )
    );

    // IMP. cmd to run a new AI task
    let runTaskDisposable = vscode.commands.registerCommand('ai-task-agent.runTask', async () => {
        //getting task description from the user
        const taskInput = await vscode.window.showInputBox({
            placeHolder: 'Describe your task (e.g., "Create a simple Python web server")',
            prompt: 'Enter a task for the AI agent to execute',
            ignoreFocusOut: true
        });

        if (!taskInput) {
            vscode.window.showInformationMessage('Task cancelled');
            return;
        }

        taskDescription = taskInput;
        outputChannel.appendLine(`\n🤖 Processing task: ${taskDescription}`);
        taskViewProvider.updateView({
            task: taskDescription,
            status: 'planning'
        });

        try {
            //generate plan using AI
            const plan = await generatePlan(taskDescription);
            if (!plan || plan.length === 0) {
                vscode.window.showErrorMessage('Failed to generate a plan. Please try again with a clearer task description.');
                taskViewProvider.updateView({
                    status: 'idle'
                });
                return;
            }

            currentPlan = plan;

            //show the plan to the user
            outputChannel.appendLine('\n📋 Generated Plan:');
            plan.forEach((step, idx) => {
                outputChannel.appendLine(`  ${idx + 1}. ${step}`);
            });

            //TO-DO: update webview with plan
            taskViewProvider.updateView({
                plan: plan
            });

            //parse the plan
            const { safeCommands, fileOps, unsafeCommands } = await parsePlan(plan);
            fileOperations = fileOps;

            if (unsafeCommands.length > 0) {
                outputChannel.appendLine('\n⚠️ Warning: Some commands were deemed unsafe:');
                unsafeCommands.forEach(cmd => {
                    outputChannel.appendLine(`  - ${cmd}`);
                });
                vscode.window.showWarningMessage('Plan contains unsafe commands. Review the output channel for details.');
            }

            //ask for user approval
            const approve = await vscode.window.showInformationMessage(
                'Do you approve this plan?',
                { modal: true },
                'Execute', 'Cancel'
            );

            if (approve === 'Execute') {
                executeTaskPlan(safeCommands, fileOps);
            } else {
                vscode.window.showInformationMessage('Task execution cancelled');
                taskViewProvider.updateView({
                    status: 'idle'
                });
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
            outputChannel.appendLine(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}`);
            taskViewProvider.updateView({
                status: 'failed',
                output: `Error: ${error instanceof Error ? error.message : String(error)}`
            });
        }
    });

    //cmd to execute the current plan
    let executeTaskDisposable = vscode.commands.registerCommand('ai-task-agent.executeTask', async () => {
        if (currentPlan.length === 0) {
            vscode.window.showWarningMessage('No task plan available. Please run a task first.');
            return;
        }

        try {
            const { safeCommands, fileOps } = await parsePlan(currentPlan);
            executeTaskPlan(safeCommands, fileOps);
        } catch (error) {
            vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    });

    //cmd to cancel the current task
    let cancelTaskDisposable = vscode.commands.registerCommand('ai-task-agent.cancelTask', () => {
        currentPlan = [];
        taskDescription = '';
        fileOperations = {};
        vscode.window.showInformationMessage('Task cancelled');
        taskViewProvider.updateView({
            task: 'No task running',
            plan: ['No plan generated'],
            output: 'No output',
            status: 'idle'
        });
    });

    //cmd to provide feedback
    let provideFeedbackDisposable = vscode.commands.registerCommand('ai-task-agent.provideFeedback', async () => {
        if (!taskDescription || currentPlan.length === 0) {
            vscode.window.showWarningMessage('No task to provide feedback for. Please run a task first.');
            return;
        }

        //get feedback from the user
        const feedbackInput = await vscode.window.showInputBox({
            placeHolder: 'What went wrong? Please be specific.',
            prompt: 'Provide feedback to help refine the plan',
            ignoreFocusOut: true
        });

        if (!feedbackInput) {
            return;
        }

        outputChannel.appendLine(`\n🔄 Refining plan based on feedback: ${feedbackInput}`);
        taskViewProvider.updateView({
            status: 'planning',
            output: `Refining plan based on feedback: ${feedbackInput}`
        });

        try {
            //generate refined plan based on feedback
            const refinedPlan = await generatePlan(taskDescription, currentPlan, feedbackInput);
            if (!refinedPlan || refinedPlan.length === 0) {
                vscode.window.showErrorMessage('Failed to generate a refined plan. Please try again with clearer feedback.');
                taskViewProvider.updateView({
                    status: 'failed',
                    output: 'Failed to generate a refined plan.'
                });
                return;
            }

            currentPlan = refinedPlan;

            //show the refined plan to the user
            outputChannel.appendLine('\n📋 Refined Plan:');
            refinedPlan.forEach((step, idx) => {
                outputChannel.appendLine(`  ${idx + 1}. ${step}`);
            });

            // TO-DO: update webview with plan
            taskViewProvider.updateView({
                plan: refinedPlan
            });

            //parse the plan
            const { safeCommands, fileOps, unsafeCommands } = await parsePlan(refinedPlan);
            fileOperations = fileOps;

            if (unsafeCommands.length > 0) {
                outputChannel.appendLine('\n⚠️ Warning: Some commands were deemed unsafe:');
                unsafeCommands.forEach(cmd => {
                    outputChannel.appendLine(`  - ${cmd}`);
                });
                vscode.window.showWarningMessage('Refined plan contains unsafe commands. Review the output channel for details.');
            }

            //ask for user approval
            const approve = await vscode.window.showInformationMessage(
                'Do you approve this refined plan?',
                { modal: true },
                'Execute', 'Cancel'
            );

            if (approve === 'Execute') {
                executeTaskPlan(safeCommands, fileOps);
            } else {
                vscode.window.showInformationMessage('Task execution cancelled');
                taskViewProvider.updateView({
                    status: 'idle'
                });
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
            outputChannel.appendLine(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}`);
            taskViewProvider.updateView({
                status: 'failed',
                output: `Error: ${error instanceof Error ? error.message : String(error)}`
            });
        }
    });

    context.subscriptions.push(runTaskDisposable);
    context.subscriptions.push(executeTaskDisposable);
    context.subscriptions.push(cancelTaskDisposable);
    context.subscriptions.push(provideFeedbackDisposable);
}

async function executeTaskPlan(commands: string[], fileOps: Record<string, string>) {
    outputChannel.appendLine('\n🔧 Executing task plan...');
    taskViewProvider.updateView({
        status: 'executing',
        output: 'Executing task plan...'
    });

    //first, handle file operations
    for (const [filename, content] of Object.entries(fileOps)) {
        try {
            await createFile(filename, content);
            outputChannel.appendLine(`✅ Created file: ${filename}`);
        } catch (error) {
            outputChannel.appendLine(`❌ Error creating file ${filename}: ${error instanceof Error ? error.message : String(error)}`);
            vscode.window.showErrorMessage(`Failed to create file: ${filename}`);
            taskViewProvider.updateView({
                status: 'failed',
                output: `Failed to create file: ${filename}\n${error instanceof Error ? error.message : String(error)}`
            });
            return;
        }
    }

    //then execute commands
    let allSuccess = true;
    executionOutput = '';

    for (const command of commands) {
        outputChannel.appendLine(`\n⚡ Executing: ${command}`);
        taskViewProvider.updateView({
            output: executionOutput + `Executing: ${command}\n`
        });

        try {
            const output = await executeCommand(command);
            executionOutput += `Command: ${command}\nOutput: ${output}\n\n`;
            outputChannel.appendLine(`✅ Success:\n${output}`);
            taskViewProvider.updateView({
                output: executionOutput
            });
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            executionOutput += `Command: ${command}\nError: ${errorMsg}\n\n`;
            outputChannel.appendLine(`❌ Error:\n${errorMsg}`);
            taskViewProvider.updateView({
                output: executionOutput
            });
            allSuccess = false;
            break;
        }
    }

    if (allSuccess) {
        outputChannel.appendLine('\n✅ Task completed successfully!');

        taskViewProvider.updateView({
            status: 'success',
            output: executionOutput + '\nTask completed successfully!'
        });

        //asking if the task was successful
        const successful = await vscode.window.showInformationMessage(
            'Was the task successful?',
            'Yes', 'No'
        );

        if (successful === 'Yes') {
            vscode.window.showInformationMessage('Great! Task completed successfully.');
            //resetting current plan
            currentPlan = [];
            taskDescription = '';
            fileOperations = {};
            taskViewProvider.updateView({
                task: 'No task running',
                plan: ['No plan generated'],
                output: 'Task completed successfully!',
                status: 'idle'
            });
        } else if (successful === 'No') {
            vscode.commands.executeCommand('ai-task-agent.provideFeedback');
        }
    } else {
        outputChannel.appendLine('\n❌ Task execution failed!');
        taskViewProvider.updateView({
            status: 'failed',
            output: executionOutput + '\nTask execution failed!'
        });

        //automatically prompt for feedback
        vscode.window.showErrorMessage(
            'Task execution failed. Would you like to provide feedback to refine the plan?',
            'Provide Feedback', 'Cancel'
        ).then(selection => {
            if (selection === 'Provide Feedback') {
                vscode.commands.executeCommand('ai-task-agent.provideFeedback');
            }
        });
    }
}

async function generatePlan(task: string, previousAttempt: string[] = [], feedback: string = ''): Promise<string[]> {
    const config = vscode.workspace.getConfiguration('aiTaskAgent');
    const provider = config.get('provider', 'groq');
    const maxRetries = config.get('maxRetries', 3);
    const debugMode = config.get('debugMode', false);

    if (debugMode) {
        outputChannel.appendLine(`\nGenerating plan using ${provider} API...`);
    }

    try {
        if (provider === 'groq') {
            return await generatePlanWithGroq(task, previousAttempt, feedback);
        } else if (provider === 'huggingface') {
            return await generatePlanWithHuggingFace(task, previousAttempt, feedback);
        } else {
            throw new Error(`Unknown AI provider: ${provider}`);
        }
    } catch (error) {
        outputChannel.appendLine(`\n❌ Error generating plan: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
    }
}

async function generatePlanWithGroq(task: string, previousAttempt: string[] = [], feedback: string = ''): Promise<string[]> {
    const config = vscode.workspace.getConfiguration('aiTaskAgent');
    const apiKey = config.get('groqApiKey', '');
    const model = config.get('model', 'llama3-8b-8192');
    const temperature = 0.7;

    if (!apiKey) {
        throw new Error('Groq API key not configured. Please set it in the extension settings.');
    }

    const apiUrl = 'https://api.groq.com/openai/v1/chat/completions';

    //get OS information
    const systemOs = process.platform === 'win32' ? 'Windows' :
        process.platform === 'darwin' ? 'macOS' : 'Linux';

    //creating the system prompt
    const systemPrompt = `
    You are an AI assistant that generates execution plans for tasks on a local computer.
    The user's operating system is: ${systemOs}
    
    Your task is to break down the user's request into a list of executable commands or steps.
    
    Each command should be clear, concise, and executable in a ${systemOs === 'Windows' ? 'Command Prompt or PowerShell' : 'terminal'} environment.
    
    For file creation tasks, use the special syntax [WRITE_FILE:filename]content[/WRITE_FILE].
    
    Platform-specific guidelines:
    ${systemOs === 'Windows' ? '- Use Windows commands (dir instead of ls, type instead of cat, etc.)' : '- Use standard Unix/Linux shell commands'}
    ${systemOs === 'Windows' ? '- Use backslashes for file paths' : '- Use forward slashes / for file paths'}
    ${systemOs === 'Windows' ? '- For PowerShell-specific commands, consider Command Prompt compatibility' : ''}
    
    Do not include comments in the commands themselves - only provide executable commands.
    Do not use placeholders - provide complete, working commands.
    
    Format your response as a JSON array of strings, where each string is a command to execute. ALL IN A SINGLE ARRAY, no separate lines. MAKE SURE EVERYTHING IS IN ONE LINE ITSELF, INSIDE ONE ARRAY OF STRINGS, no new lines or line breaks.
    For code blocks that need to be saved to files, use the format: 
    \`[WRITE_FILE:filename.ext]content[/WRITE_FILE]\`
    `;

    //creating the user prompt
    let userPrompt = `Task: ${task}`;

    if (previousAttempt.length > 0 && feedback) {
        userPrompt += '\n\nMy previous plan didn\'t work:\n';
        userPrompt += previousAttempt.map(cmd => `- ${cmd}`).join('\n');
        userPrompt += `\n\nThe issue was: ${feedback}\n\nPlease provide a revised plan.`;
    }

    const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
    ];

    try {
        const response = await axios.post(apiUrl, {
            model: model,
            messages: messages,
            temperature: temperature,
            max_tokens: 1000
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 200) {
            const planText = response.data.choices[0].message.content.trim();

            //paarse the AI response
            try {
                //first, check if the response is a JSON array
                if (planText.startsWith('[') && planText.endsWith(']')) {
                    return JSON.parse(planText) as string[];
                }

                //otherwise, split by newlines
                return planText.split('\n').filter((cmd: string) => cmd.trim() !== '');
            } catch (parseError) {
                //if JSON parsing fails, split by newlines
                return planText.split('\n').filter((cmd: string) => cmd.trim() !== '');
            }
        } else {
            throw new Error(`Groq API request failed: ${response.statusText}`);
        }
    } catch (error) {
        if (axios.isAxiosError(error)) {
            throw new Error(`Groq API request failed: ${error.response?.data?.error?.message || error.message}`);
        }
        throw error;
    }
}

async function generatePlanWithHuggingFace(task: string, previousAttempt: string[] = [], feedback: string = ''): Promise<string[]> {
    const config = vscode.workspace.getConfiguration('aiTaskAgent');
    const apiToken = config.get('huggingfaceApiToken', '');
    const model = config.get('model', 'mistralai/Mistral-7B-Instruct-v0.2');

    if (!apiToken) {
        throw new Error('HuggingFace API token not configured. Please set it in the extension settings.');
    }

    const apiUrl = `https://api-inference.huggingface.co/models/${model}`;

    //get OS information
    const systemOs = process.platform === 'win32' ? 'Windows' :
        process.platform === 'darwin' ? 'macOS' : 'Linux';

    //creating the prompt
    let prompt = `
    You are an AI assistant that generates execution plans for tasks on a local computer.
    The user's operating system is: ${systemOs}
    
    Your task is to break down the user's request into a list of executable commands or steps.
    
    Each command should be clear, concise, and executable in a ${systemOs === 'Windows' ? 'Command Prompt or PowerShell' : 'terminal'} environment.
    
    For file creation tasks, use the special syntax [WRITE_FILE:filename]content[/WRITE_FILE].
    
    Platform-specific guidelines:
    ${systemOs === 'Windows' ? '- Use Windows commands (dir instead of ls, type instead of cat, etc.)' : '- Use standard Unix/Linux shell commands'}
    ${systemOs === 'Windows' ? '- Use backslashes for file paths' : '- Use forward slashes / for file paths'}
    ${systemOs === 'Windows' ? '- For PowerShell-specific commands, consider Command Prompt compatibility' : ''}
    
    Do not include comments in the commands themselves - only provide executable commands.
    Do not use placeholders - provide complete, working commands.
    
    Format your response as a JSON array of strings, where each string is a command to execute.
    For code blocks that need to be saved to files, use the format: 
    \`[WRITE_FILE:filename.ext]content[/WRITE_FILE]\`
    
    Task: ${task}
    `;

    if (previousAttempt.length > 0 && feedback) {
        prompt += '\n\nMy previous plan didn\'t work:\n';
        prompt += previousAttempt.map(cmd => `- ${cmd}`).join('\n');
        prompt += `\n\nThe issue was: ${feedback}\n\nPlease provide a revised plan.`;
    }

    prompt += '[/INST]';

    try {
        const response = await axios.post(apiUrl, {
            inputs: prompt,
            parameters: {
                temperature: 0.7,
                max_new_tokens: 1000,
                return_full_text: false
            }
        }, {
            headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 200) {
            let planText = '';

            //handle different response formats
            if (Array.isArray(response.data) && response.data.length > 0) {
                if ('generated_text' in response.data[0]) {
                    planText = response.data[0].generated_text.trim();
                } else {
                    planText = response.data[0];
                }
            } else if (typeof response.data === 'object' && 'generated_text' in response.data) {
                planText = response.data.generated_text.trim();
            } else {
                planText = String(response.data).trim();
            }

            //parse the AI response (remove code blocks if present)
            if (planText.includes('```')) {
                const codeBlocks = planText.split('```');
                for (let i = 1; i < codeBlocks.length; i += 2) {
                    if (i < codeBlocks.length) {
                        //get content after the first line (which might be language specification)
                        const lines = codeBlocks[i].trim().split('\n');
                        if (lines.length > 1) {
                            codeBlocks[i] = lines[0].toLowerCase() === 'bash' ||
                                lines[0].toLowerCase() === 'sh' ||
                                lines[0].toLowerCase() === 'shell' ||
                                lines[0].toLowerCase() === 'cmd' ||
                                lines[0].toLowerCase() === 'powershell' ?
                                lines.slice(1).join('\n') : lines.join('\n');
                        }
                    }
                }
                planText = codeBlocks.join('');
            }

            //try to parse as JSON first
            try {
                if (planText.includes('[') && planText.includes(']')) {
                    // Extract array portion from the text
                    const arrayMatch = planText.match(/\[.*\]/s);
                    if (arrayMatch) {
                        return JSON.parse(arrayMatch[0]) as string[];
                    }
                }
            } catch (parseError) {
                //if JSON parsing fails, fall back to line splitting
            }

            //split by newlines and filter out comments
            return planText.split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('#') && !line.startsWith('//'));
        } else {
            throw new Error(`HuggingFace API request failed: ${response.statusText}`);
        }
    } catch (error) {
        if (axios.isAxiosError(error)) {
            throw new Error(`HuggingFace API request failed: ${error.response?.data?.error || error.message}`);
        }
        throw error;
    }
}

async function parsePlan(plan: string[]): Promise<{
    safeCommands: string[],
    fileOps: Record<string, string>,
    unsafeCommands: string[]
}> {
    //extract file operations from the plan
    const filePattern = /\[WRITE_FILE:([^\]]+)\](.*?)\[\/WRITE_FILE\]/s;
    const refinedPlan: string[] = [];
    const fileOperations: Record<string, string> = {};

    for (const step of plan) {
        //skip empty steps
        if (!step.trim()) {
            continue;
        }

        let currentStep = step;

        //check if step contains file operations
        const matches = currentStep.match(new RegExp(filePattern, 'g'));
        if (matches) {
            for (const match of matches) {
                const matchResult = match.match(filePattern);
                if (matchResult && matchResult.length >= 3) {
                    const [fullMatch, filename, content] = matchResult;

                    //clean the filename
                    const cleanFilename = filename.trim()
                        .replace(/\\/g, path.sep)
                        .replace(/\//g, path.sep);

                    //handle absolute vs relative paths
                    let safeFilename = cleanFilename;
                    if (path.isAbsolute(cleanFilename)) {
                        //for security, only use the basename
                        safeFilename = path.basename(cleanFilename);
                    } else {
                        //making sure path does not escape current directory
                        const normPath = path.normalize(cleanFilename);
                        if (normPath.startsWith('..')) {
                            safeFilename = path.basename(normPath);
                        } else {
                            safeFilename = normPath;
                        }
                    }

                    fileOperations[safeFilename] = content;
                    currentStep = currentStep.replace(fullMatch, '').trim();
                }
            }
        }

        //check if step is a JSON array (from bad AI formatting)
        if (currentStep.startsWith('[') && (currentStep.endsWith(']') || currentStep.includes(']'))) {
            try {
                //try to parse as JSON array
                const parsed = JSON.parse(currentStep);
                if (Array.isArray(parsed)) {
                    for (const substep of parsed) {
                        if (substep && typeof substep === 'string') {
                            refinedPlan.push(substep.trim());
                        }
                    }
                } else {
                    //if it's not an array but valid JSON, add as-is
                    if (currentStep.trim()) {
                        refinedPlan.push(currentStep.trim());
                    }
                }
            } catch {
                //if parsing fails, add the step as-is
                if (currentStep.trim()) {
                    refinedPlan.push(currentStep.trim());
                }
            }
        } else {
            //regular step - add if not empty
            if (currentStep.trim()) {
                refinedPlan.push(currentStep.trim());
            }
        }
    }

    //validate commands for safety
    const safeCommands: string[] = [];
    const unsafeCommands: string[] = [];

    for (const command of refinedPlan) {
        if (isCommandSafe(command)) {
            safeCommands.push(command);
        } else {
            unsafeCommands.push(command);
        }
    }

    return { safeCommands, fileOps: fileOperations, unsafeCommands };
}

function isCommandSafe(command: string): boolean {
    // List of dangerous patterns to block
    const dangerousPatterns = [
        // System-level dangerous operations (for Linux)
        /rm\s+-rf\s+[/~]/,        // Remove root or home dir
        /mkfs/,                    // Format filesystem
        /dd\s+if=.+\s+of=\/dev/,    // Direct writing to devices
        /:\(\){ :\|:& };:/,          // Fork bomb

        // Network danger
        /wget.+\|\s*bash/,          // Download and pipe to bash
        /curl.+\|\s*bash/,          // Download and pipe to bash
        /Invoke-WebRequest.+\|\s*Invoke-Expression/,  // PowerShell equivalent

        // Privilege escalation
        /sudo\s+rm\s+-rf/,         // Sudo remove with force recursion
        /sudo\s+mkfs/,             // Sudo format filesystem
        /runas\s+\/user:administrator/,  // Windows run as admin

        // Windows-specific dangers
        /format\s+[a-zA-Z]:/,      // Format drives
        /del\s+\/[sfoqy]\s+[a-zA-Z]:/,  // Delete with system files
        /rd\s+\/s\s+\/q\s+[a-zA-Z]:/,  // Remove directory with system files

        // User data risks
        /rm\s+-rf\s+\$HOME/,       // Remove home directory
        /rm\s+-rf\s+~\//,          // Remove home directory
        /deltree\s+\/y/,           // Windows delete tree

        // Shell-related
        /shutdown/i,               // Shutdown system
        /reboot/i,                 // Reboot system
        /init\s+[0156]/,           // Change runlevel
    ];

    // Check if command matches any dangerous pattern
    for (const pattern of dangerousPatterns) {
        if (pattern.test(command)) {
            return false;
        }
    }

    //extra additional check for potential command chaining or redirection risks
    const chainOperators = [";", "&&", "||", "|", ">", ">>", "<", "<<", "2>", "2>>", "&"];
    if (chainOperators.some(op => command.includes(op))) {
        //double check these more carefully
        //for these, we'll still allow certain safe patterns

        // Safe patterns for command chaining
        const safeChainPatterns = [
            // Allow basic directory creation and navigation
            /mkdir\s+.+\s+&&\s+cd\s+/,
            // Allow npm or pip installs and basic usage
            /npm\s+install.+&&\s+npm\s+/,
            /pip\s+install.+&&\s+python/,
            // Allow basic output redirection for logs
            />.+\.log$/,
            />.+\.txt$/,
            /2>.+\.log$/
        ];

        //if the command matches any safe pattern, allow it
        if (safeChainPatterns.some(pattern => pattern.test(command))) {
            return true;
        }

        //otherwise check more carefully for dangerous operations
        if (dangerousPatterns.some(pattern => {
            //split by chain operators and check each part
            return chainOperators.some(op => {
                if (command.includes(op)) {
                    const parts = command.split(op);
                    return parts.some(part => pattern.test(part.trim()));
                }
                return false;
            });
        })) {
            return false;
        }
    }

    //by default, consider the command safe
    return true;
}

async function createFile(filename: string, content: string): Promise<void> {
    // Get the current workspace folder
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        throw new Error('No workspace folder is open. Please open a folder to create files.');
    }

    const rootPath = workspaceFolders[0].uri.fsPath;

    // Create the full path to the file
    let fullPath = path.join(rootPath, filename);

    // Ensure the directory exists
    const dirname = path.dirname(fullPath);
    if (!fs.existsSync(dirname)) {
        fs.mkdirSync(dirname, { recursive: true });
    }

    // Write the file
    return new Promise((resolve, reject) => {
        fs.writeFile(fullPath, content, (err) => {
            if (err) {
                reject(err);
            } else {
                // Open the file in the editor
                vscode.workspace.openTextDocument(fullPath).then(doc => {
                    vscode.window.showTextDocument(doc);
                    resolve();
                }, err => {
                    // If opening fails, still consider the file creation successful
                    resolve();
                });
            }
        });
    });
}

async function executeCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
        //get the current workspace folder
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            reject(new Error('No workspace folder is open. Please open a folder to execute commands.'));
            return;
        }

        const rootPath = workspaceFolders[0].uri.fsPath;

        //execute the command in the workspace folder
        exec(command, { cwd: rootPath }, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(`${stderr || error.message}`));
            } else {
                resolve(stdout || 'Command executed successfully.');
            }
        });
    });
}

export function deactivate() {
    //clean up resources when the extension is deactivated
    outputChannel.dispose();
}