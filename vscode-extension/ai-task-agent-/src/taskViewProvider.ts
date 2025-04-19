import * as vscode from 'vscode';

export class TaskViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'aiTaskAgentView';

    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
    ) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            // Enable JavaScript in the webview
            enableScripts: true,

            // Restrict the webview to only load resources from the extension's directory
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'runTask':
                    vscode.commands.executeCommand('ai-task-agent.runTask');
                    break;
                case 'executeTask':
                    vscode.commands.executeCommand('ai-task-agent.executeTask');
                    break;
                case 'cancelTask':
                    vscode.commands.executeCommand('ai-task-agent.cancelTask');
                    break;
                case 'provideFeedback':
                    vscode.commands.executeCommand('ai-task-agent.provideFeedback');
                    break;
            }
        });
    }

    public updateView(data: {
        task?: string;
        plan?: string[];
        output?: string;
        status?: 'idle' | 'planning' | 'executing' | 'failed' | 'success';
    }) {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'update',
                data
            });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        // Use a nonce to whitelist which scripts can be run
        const nonce = getNonce();

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>AI Task Agent</title>
            <style>
                body {
                    padding: 0;
                    color: var(--vscode-foreground);
                    font-size: var(--vscode-font-size);
                    font-weight: var(--vscode-font-weight);
                    font-family: var(--vscode-font-family);
                    background-color: var(--vscode-editor-background);
                }
                .container {
                    padding: 15px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                button {
                    padding: 8px 12px;
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    cursor: pointer;
                    margin: 5px 0;
                    border-radius: 2px;
                }
                button:hover {
                    background: var(--vscode-button-hoverBackground);
                }
                .section {
                    margin-bottom: 15px;
                }
                .section-title {
                    font-weight: bold;
                    margin-bottom: 5px;
                }
                #task-description, #plan, #output {
                    background: var(--vscode-input-background);
                    padding: 10px;
                    max-height: 150px;
                    overflow: auto;
                    margin-bottom: 10px;
                    font-family: var(--vscode-editor-font-family);
                    font-size: var(--vscode-editor-font-size);
                    white-space: pre-wrap;
                }
                .status {
                    font-weight: bold;
                    margin: 10px 0;
                }
                .status.idle { color: var(--vscode-foreground); }
                .status.planning { color: var(--vscode-notificationsInfoIcon-foreground); }
                .status.executing { color: var(--vscode-terminal-ansiYellow); }
                .status.success { color: var(--vscode-terminal-ansiGreen); }
                .status.failed { color: var(--vscode-terminal-ansiRed); }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="section">
                    <div class="section-title">Commands</div>
                    <button id="run-task">New Task</button>
                    <button id="execute-task" disabled>Execute Plan</button>
                    <button id="cancel-task" disabled>Cancel Task</button>
                    <button id="provide-feedback" disabled>Provide Feedback</button>
                </div>
                
                <div class="status idle">Status: Idle</div>
                
                <div class="section">
                    <div class="section-title">Current Task</div>
                    <div id="task-description">No task running</div>
                </div>
                
                <div class="section">
                    <div class="section-title">Plan</div>
                    <div id="plan">No plan generated</div>
                </div>
                
                <div class="section">
                    <div class="section-title">Output</div>
                    <div id="output">No output</div>
                </div>
            </div>
            
            <script nonce="${nonce}">
                const vscode = acquireVsCodeApi();
                
                // UI elements
                const runTaskButton = document.getElementById('run-task');
                const executeTaskButton = document.getElementById('execute-task');
                const cancelTaskButton = document.getElementById('cancel-task');
                const provideFeedbackButton = document.getElementById('provide-feedback');
                const taskDescription = document.getElementById('task-description');
                const planElement = document.getElementById('plan');
                const outputElement = document.getElementById('output');
                const statusElement = document.querySelector('.status');
                
                // Event listeners
                runTaskButton.addEventListener('click', () => {
                    vscode.postMessage({
                        command: 'runTask'
                    });
                });
                
                executeTaskButton.addEventListener('click', () => {
                    vscode.postMessage({
                        command: 'executeTask'
                    });
                });
                
                cancelTaskButton.addEventListener('click', () => {
                    vscode.postMessage({
                        command: 'cancelTask'
                    });
                    updateUI({
                        status: 'idle',
                        task: 'No task running',
                        plan: 'No plan generated',
                        output: 'No output'
                    });
                });
                
                provideFeedbackButton.addEventListener('click', () => {
                    vscode.postMessage({
                        command: 'provideFeedback'
                    });
                });
                
                // Handle messages from the extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.type) {
                        case 'update':
                            updateUI(message.data);
                            break;
                    }
                });
                
                function updateUI(data) {
                    if (data.status) {
                        statusElement.className = 'status ' + data.status;
                        statusElement.textContent = 'Status: ' + data.status.charAt(0).toUpperCase() + data.status.slice(1);
                        
                        // Update button states based on status
                        if (data.status === 'idle') {
                            runTaskButton.disabled = false;
                            executeTaskButton.disabled = true;
                            cancelTaskButton.disabled = true;
                            provideFeedbackButton.disabled = true;
                        } else if (data.status === 'planning') {
                            runTaskButton.disabled = true;
                            executeTaskButton.disabled = true;
                            cancelTaskButton.disabled = false;
                            provideFeedbackButton.disabled = true;
                        } else if (data.status === 'executing') {
                            runTaskButton.disabled = true;
                            executeTaskButton.disabled = true;
                            cancelTaskButton.disabled = false;
                            provideFeedbackButton.disabled = true;
                        } else {
                            // failed or success
                            runTaskButton.disabled = false;
                            executeTaskButton.disabled = data.status === 'success';
                            cancelTaskButton.disabled = data.status === 'success';
                            provideFeedbackButton.disabled = data.status === 'success';
                        }
                    }
                    
                    if (data.task) {
                        taskDescription.textContent = data.task;
                    }
                    
                    if (data.plan) {
                        if (Array.isArray(data.plan)) {
                            planElement.textContent = data.plan.map(function(step, idx) {
                                return (idx + 1) + '. ' + step;
                            }).join('\n');
                        } else {
                            planElement.textContent = data.plan;
                        }
                    }
                    
                    if (data.output) {
                        outputElement.textContent = data.output;
                    }
                }
            </script>
        </body>
        </html>`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}