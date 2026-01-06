import * as vscode from 'vscode';
import { analyzeProject } from '../services/analyzer';
import { createSnapshot, restoreSnapshot, listSnapshots } from '../services/snapshot';
import { generateReadme } from '../services/backend-client';
import { PreviewContentProvider } from './PreviewContentProvider';

/**
 * ReadmePanel - Manages the React UI in a Webview Panel (Main Editor)
 */
export class ReadmePanel {
    public static currentPanel: ReadmePanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _previewContent: string | null = null;
    private _previewProvider: PreviewContentProvider;
    private _context: vscode.ExtensionContext;

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, previewProvider: PreviewContentProvider, context: vscode.ExtensionContext) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._previewProvider = previewProvider;
        this._context = context;

        // Set the webview's initial html content
        this._update(); // Updates HTML

        // Listen for when the panel is disposed
        // This comes cleanup the single instance
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.type) {
                    case 'generate':
                        await this.handleGenerate();
                        break;
                    case 'preview':
                        await this.handlePreview();
                        break;
                    case 'apply':
                        await this.handleApply();
                        break;
                    case 'restore':
                        await this.handleRestore();
                        break;
                    case 'saveKey':
                        if (message.key) {
                            await this.handleSaveKey(message.key);
                        }
                        break;
                    case 'deleteKey':
                        await this.handleDeleteKey();
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    public static createOrShow(extensionUri: vscode.Uri, previewProvider: PreviewContentProvider, context: vscode.ExtensionContext) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it.
        if (ReadmePanel.currentPanel) {
            ReadmePanel.currentPanel._panel.reveal(column);
            return;
        }

        // Otherwise, create a new panel.
        const panel = vscode.window.createWebviewPanel(
            'godforgePanel',
            'GodForge README',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [extensionUri]
            }
        );

        ReadmePanel.currentPanel = new ReadmePanel(panel, extensionUri, previewProvider, context);
    }

    public dispose() {
        ReadmePanel.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private async _update() {
        const key = await this._context.secrets.get('godforge.geminiApiKey');
        const maskedKey = key ? `${key.substring(0, 4)}...${key.substring(key.length - 4)}` : null;
        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview, !!key, maskedKey);
    }

    // kept for compatibility or internal use if needed, but not forcing prompt anymore in UI flow
    private async getApiKey(forcePrompt: boolean = false): Promise<string | undefined> {
        return await this._context.secrets.get('godforge.geminiApiKey');
    }

    private async handleSaveKey(key: string) {
        if (!key.trim()) {
            vscode.window.showErrorMessage('API Key cannot be empty');
            return;
        }
        await this._context.secrets.store('godforge.geminiApiKey', key.trim());
        vscode.window.showInformationMessage('API Key saved successfully!');
        this._update();
    }

    private async handleDeleteKey() {
        const confirm = await vscode.window.showWarningMessage(
            'Are you sure you want to delete your API Key?',
            { modal: true },
            'Delete'
        );

        if (confirm === 'Delete') {
            await this._context.secrets.delete('godforge.geminiApiKey');
            vscode.window.showInformationMessage('API Key removed.');
            this._update();
        }
    }

    private async handleGenerate() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }

        // Step 0: Ensure API Key
        // Step 0: Ensure API Key
        let apiKey = await this._context.secrets.get('godforge.geminiApiKey');

        // If missing, ask for it immediately
        if (!apiKey) {
            apiKey = await vscode.window.showInputBox({
                prompt: 'Enter your Google Gemini API Key to continue',
                password: true,
                ignoreFocusOut: true,
                placeHolder: 'AIza...'
            });

            if (apiKey && apiKey.trim()) {
                await this.handleSaveKey(apiKey);
            } else {
                vscode.window.showWarningMessage('API Key is required to generate README.');
                return;
            }
        }

        // STEP 1: Project Analysis (NO LLM)
        this._sendMessage({ type: 'status', message: 'Analyzing project...' });
        const analysis = await analyzeProject(workspaceFolder.uri.fsPath);

        // STEP 2: Create Snapshot (MANDATORY)
        this._sendMessage({ type: 'status', message: 'Creating snapshot...' });
        await createSnapshot(workspaceFolder.uri.fsPath);

        // STEP 3-4: Generate via Backend
        this._sendMessage({ type: 'status', message: 'Generating README...' });
        try {
            this._previewContent = await generateReadme(analysis, apiKey);

            this._sendMessage({
                type: 'generated',
                content: this._previewContent
            });
            vscode.window.showInformationMessage('README generated! Click Preview to review.');
        } catch (error: any) {
            const errStr = String(error);
            if (errStr.includes('400') || errStr.includes('401') || errStr.includes('403') || errStr.toLowerCase().includes('invalid')) {
                vscode.window.showErrorMessage('Generation Failed: API Key appears to be invalid or expired. Please check your key in the Manage API Keys section.');
            } else {
                vscode.window.showErrorMessage(`Generation failed: ${error}`);
            }
            this._sendMessage({ type: 'error', message: String(error) });
        }
    }

    private async handlePreview() {
        if (!this._previewContent) {
            vscode.window.showWarningMessage('Generate a README first');
            return;
        }

        // Update provider with content
        this._previewProvider.update(this._previewContent);

        // Open the virtual document
        const uri = vscode.Uri.parse('godforge-preview:README_Preview.md');
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, { preview: true, viewColumn: vscode.ViewColumn.Beside });
    }

    private async handleApply() {
        if (!this._previewContent) {
            vscode.window.showWarningMessage('Generate a README first');
            return;
        }

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) { return; }

        // STEP 6: Apply README (atomic write)
        const confirm = await vscode.window.showWarningMessage(
            'This will overwrite README.md. Continue?',
            { modal: true },
            'Yes'
        );

        if (confirm !== 'Yes') { return; }

        const fs = require('fs');
        const path = require('path');
        const readmePath = path.join(workspaceFolder.uri.fsPath, 'README.md');

        try {
            fs.writeFileSync(readmePath, this._previewContent, 'utf8');
            vscode.window.showInformationMessage('✅ README.md applied successfully!');
            this._previewContent = null; // Clear after apply
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to write README: ${error}`);
        }
    }

    private async handleRestore() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) { return; }

        // STEP 7: Restore from snapshot
        const snapshots = await listSnapshots(workspaceFolder.uri.fsPath);
        if (snapshots.length === 0) {
            vscode.window.showInformationMessage('No snapshots available');
            return;
        }

        const selected = await vscode.window.showQuickPick(
            snapshots.map(s => ({ label: s.timestamp, value: s.path })),
            { placeHolder: 'Select snapshot to restore' }
        );

        if (!selected) { return; }

        const confirm = await vscode.window.showWarningMessage(
            `Restore README from ${selected.label}?`,
            { modal: true },
            'Yes'
        );

        if (confirm === 'Yes') {
            this._sendMessage({ type: 'status', message: 'Saving current state before restore...' });
            await createSnapshot(workspaceFolder.uri.fsPath);

            await restoreSnapshot(workspaceFolder.uri.fsPath, selected.value);
            vscode.window.showInformationMessage('✅ README restored!');
            this._sendMessage({ type: 'status', message: 'Restored.' });
        }
    }

    private _sendMessage(message: any) {
        this._panel.webview.postMessage(message);
    }

    private _getHtmlForWebview(webview: vscode.Webview, hasKey: boolean, maskedKey: string | null) {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>GodForge</title>
            <style>
                body {
                    padding: 0;
                    margin: 0;
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-foreground);
                    background: var(--vscode-editor-background);
                }
                .container {
                    padding: 20px;
                    max-width: 800px;
                    margin: 0 auto;
                }
                h2, h3 { margin-top: 0; }
                
                /* Tabs */
                .tab-bar {
                    display: flex;
                    border-bottom: 1px solid var(--vscode-panel-border);
                    background: var(--vscode-sideBar-background);
                }
                .tab {
                    padding: 10px 15px;
                    cursor: pointer;
                    opacity: 0.7;
                    border-bottom: 2px solid transparent;
                    font-weight: 600;
                    font-size: 13px;
                }
                .tab:hover {
                    opacity: 1;
                    background: var(--vscode-list-hoverBackground);
                }
                .tab.active {
                    opacity: 1;
                    border-bottom-color: var(--vscode-activityBar-foreground);
                    color: var(--vscode-foreground);
                }
                .tab-content {
                    display: none;
                    padding-top: 20px;
                }
                .tab-content.active {
                    display: block;
                }

                /* Buttons & Inputs */
                button {
                    width: 100%;
                    padding: 12px;
                    margin: 8px 0;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 600;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.2);
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                }
                button:disabled {
                    background: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-disabledForeground);
                    cursor: not-allowed;
                    box-shadow: none;
                }
                button:hover:not(:disabled) {
                    box-shadow: 0 6px 12px rgba(0,0,0,0.4);
                    transform: translateY(-2px);
                    filter: brightness(1.1);
                }
                button:active:not(:disabled) {
                    transform: translateY(0);
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                }
                button.generate {
                    background: linear-gradient(135deg, #007fd4 0%, #005fb8 100%);
                }
                button.preview {
                    background: linear-gradient(135deg, #6e7681 0%, #484f58 100%);
                }
                button.apply {
                    background: linear-gradient(135deg, #2da44e 0%, #1a7f37 100%);
                }
                button.destructive {
                    background: linear-gradient(135deg, #d21f3c 0%, #b31d34 100%);
                }
                button.secondary {
                    background: transparent;
                    color: var(--vscode-foreground);
                    border: 1px solid var(--vscode-button-secondaryBackground);
                    box-shadow: none;
                }
                button.secondary:hover {
                    background: var(--vscode-list-hoverBackground);
                    transform: none;
                    box-shadow: none;
                }
                
                .status {
                    margin: 10px 0;
                    padding: 10px;
                    background: var(--vscode-editor-background);
                    border-radius: 4px;
                    font-size: 12px;
                    min-height: 20px;
                    border: 1px solid var(--vscode-panel-border);
                }
                .toggle {
                    margin: 15px 0;
                }
                label {
                    display: block;
                    margin: 8px 0;
                    font-size: 12px;
                }
                select, input[type="text"], input[type="password"] {
                    width: 100%;
                    padding: 8px;
                    box-sizing: border-box;
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                    margin-bottom: 8px;
                }

                .warning-box {
                    background-color: var(--vscode-inputValidation-warningBackground);
                    border: 1px solid var(--vscode-inputValidation-warningBorder);
                    color: var(--vscode-foreground);
                    padding: 10px;
                    border-radius: 4px;
                    margin-bottom: 15px;
                    display: ${hasKey ? 'none' : 'block'};
                }
                .warning-box strong { color: var(--vscode-inputValidation-warningForeground); }
                code {
                    background: var(--vscode-textBlockQuote-background);
                    padding: 2px 4px;
                    border-radius: 3px;
                }
            </style>
        </head>
        <body>
            <div class="tab-bar">
                <div class="tab active" onclick="showTab('main')">🏠 Generator</div>
                <div class="tab" onclick="showTab('keys')">🔑 API Keys</div>
                <div class="tab" onclick="showTab('docs')">📚 Docs</div>
            </div>

            <div class="container">
                
                <!-- MAIN TAB -->
                <div id="tab-main" class="tab-content active">
                    <h2>GodForge Generator</h2>
                    <p>Generate, Preview, and Manage your project documentation.</p>

                    <div class="warning-box" id="key-warning">
                        ⚠️ <strong>Missing API Key:</strong> Please set your Google Gemini API Key in the "API Keys" tab to enable generation.
                    </div>

                    <div class="toggle">
                        <label>
                            README Length:
                            <select id="length">
                                <option value="short">Short</option>
                                <option value="medium" selected>Medium</option>
                            </select>
                        </label>
                        <label>
                            <input type="checkbox" id="badges" checked> Include Badges
                        </label>
                    </div>

                    <button class="generate" onclick="generate()" id="generateBtn">🚀 Generate README</button>
                    <button class="preview" onclick="preview()">👁️ Preview Changes</button>
                    <button class="apply" onclick="apply()">✅ Apply README</button>
                    <button class="destructive" onclick="restore()">↩️ Restore Previous README</button>
                    
                    <div class="status" id="status"></div>
                </div>

                <!-- KEYS TAB -->
                <div id="tab-keys" class="tab-content">
                    <h3>🔑 Manage API Keys</h3>
                    <p>Manage your Google Gemini API Key securely.</p>
                    
                    <div id="key-display" style="margin-bottom: 20px; font-size: 13px; padding: 10px; background: var(--vscode-editor-inactiveSelectionBackground); border-radius: 4px;">
                        ${hasKey ? `
                            <div style="margin-bottom: 10px;"><strong>Current Key:</strong> <code>${maskedKey}</code></div>
                            <button class="destructive" style="width: auto; padding: 6px 12px; font-size: 12px;" onclick="deleteKey()">🗑️ Delete Key</button>
                        ` : '<div><strong>Current Key:</strong> <em>Not Configured</em></div>'}
                    </div>

                    <div style="margin-top: 20px; border-top: 1px solid var(--vscode-panel-border); padding-top: 20px;">
                        <label for="apiKeyInput">Add / Replace API Key:</label>
                        <input type="password" id="apiKeyInput" placeholder="Paste Gemini API Key here (starts with AIza...)">
                        <button class="secondary" onclick="saveKey()">Save API Key</button>
                    </div>
                </div>

                <!-- DOCS TAB -->
                <div id="tab-docs" class="tab-content">
                    <h3>📚 Documentation & Help</h3>
                    <div style="line-height: 1.6; font-size: 13px;">
                        <p><strong>GodForge</strong> is an advanced agentic coding assistant designed to automate documentation.</p>
                        
                        <h4>How to use:</h4>
                        <ol>
                            <li><strong>Configure API Key:</strong> Get your Gemini API key from <a href="https://aistudio.google.com/">Google AI Studio</a> and enter it in the "API Keys" tab.</li>
                            <li><strong>Generate:</strong> Go to the "Generator" tab and click "Generate README". This analyzes your project structure mostly locally.</li>
                            <li><strong>Preview:</strong> Click "Preview Changes" to see the generated markdown side-by-side.</li>
                            <li><strong>Apply:</strong> Click "Apply README" to write the file to your disk.</li>
                        </ol>

                        <h4>Features:</h4>
                        <ul>
                            <li><strong>Smart Analysis:</strong> Reads <code>package.json</code> and file structure.</li>
                            <li><strong>Snapshot Undo:</strong> "Restore Previous" allows you to roll back changes effectively.</li>
                            <li><strong>Secure:</strong> API keys are stored in VS Code's secure secret storage.</li>
                        </ul>
                        
                        <p><em>Note: This tool uses workflow execution with multiple safety checks, not just raw AI generation.</em></p>
                    </div>
                </div>

            </div>

            <script>
                const vscode = acquireVsCodeApi();

                function showTab(tabId) {
                    // Hide all tabs
                    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
                    document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
                    
                    // Show selected
                    document.getElementById('tab-' + tabId).classList.add('active');
                    
                    // Highlight tab button
                    const tabs = document.querySelectorAll('.tab');
                    if (tabId === 'main') tabs[0].classList.add('active');
                    if (tabId === 'keys') tabs[1].classList.add('active');
                    if (tabId === 'docs') tabs[2].classList.add('active');
                }

                function generate() {
                    vscode.postMessage({ type: 'generate' });
                }
                function preview() {
                    vscode.postMessage({ type: 'preview' });
                }
                function apply() {
                    vscode.postMessage({ type: 'apply' });
                }
                function restore() {
                    vscode.postMessage({ type: 'restore' });
                }
                function deleteKey() {
                    vscode.postMessage({ type: 'deleteKey' });
                }
                function saveKey() {
                    const input = document.getElementById('apiKeyInput');
                    const key = input.value.trim();
                    if (key) {
                        vscode.postMessage({ type: 'saveKey', key: key });
                        input.value = '';
                    }
                }

                window.addEventListener('message', event => {
                    const message = event.data;
                    const status = document.getElementById('status');
                    
                    if (message.type === 'status') {
                        status.textContent = message.message;
                    } else if (message.type === 'generated') {
                        status.textContent = '✅ README generated! Click Preview to review.';
                    } else if (message.type === 'error') {
                        status.textContent = '❌ ' + message.message;
                    }
                });
            </script>
        </body>
        </html>`;
    }
}
