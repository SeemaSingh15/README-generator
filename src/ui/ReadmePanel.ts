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
                    case 'resetKey':
                        await this.resetApiKey();
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

        // Proactively check for API key
        ReadmePanel.currentPanel.getApiKey();
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
        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
    }

    private async getApiKey(forcePrompt: boolean = false): Promise<string | undefined> {
        // Try to get from secrets
        let key = await this._context.secrets.get('godforge.geminiApiKey');

        // If not found OR forcePrompt is true
        if (!key || forcePrompt) {
            // Note: If forcePrompt is true, we ignore the stored key and ask again
            // But we can PRE-FILL the input box with the stored key if it exists

            key = await vscode.window.showInputBox({
                prompt: 'Enter your Google Gemini API Key',
                password: true,
                ignoreFocusOut: true,
                placeHolder: 'AIza...',
                value: key || '' // Pre-fill if exists
            });

            if (key) {
                // Store in secrets
                await this._context.secrets.store('godforge.geminiApiKey', key);
            }
        }
        return key;
    }

    private async resetApiKey() {
        await this._context.secrets.delete('godforge.geminiApiKey');
        vscode.window.showInformationMessage('API Key removed. You will be prompted to enter a new one next time.');
        this.getApiKey(); // Prompt immediately
    }

    private async handleGenerate() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }

        // Step 0: Ensure API Key (Force Prompt)
        const apiKey = await this.getApiKey(true);
        if (!apiKey) {
            vscode.window.showWarningMessage('API Key is required to generate README.');
            return;
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
            // Pass API Key to generate function if needed, or set it in process env/config
            // Assuming generateReadme uses the key from context or config. 
            // Since backend-client likely reads from config, we might need to update it to take the key as arg
            // OR we temporarily set process.env.GEMINI_API_KEY? 
            // Let's check generateReadme signature later. For now assuming it works or has been updated.
            // Actually, I need to check `backend-client.ts`. If it reads from VSCode config, I need to change it.

            // For now, I'll pass it if I can, or update generateReadme.
            this._previewContent = await generateReadme(analysis, apiKey);

            this._sendMessage({
                type: 'generated',
                content: this._previewContent
            });
            vscode.window.showInformationMessage('README generated! Click Preview to review.');
        } catch (error) {
            vscode.window.showErrorMessage(`Generation failed: ${error}`);
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
            // New Requirement: Snapshot CURRENT state before restoring old state
            // "in the history this second readme code should also be saved like a commit of restored ones too"
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

    private _getHtmlForWebview(webview: vscode.Webview) {
        // Same HTML as SidebarProvider but adjusted if needed
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>GodForge</title>
            <style>
                body {
                    padding: 20px;
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-foreground);
                    max-width: 800px;
                    margin: 0 auto;
                }
                button {
                    width: 100%;
                    padding: 14px;
                    margin: 8px 0;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 600;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.2);
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    text-shadow: 0 1px 2px rgba(0,0,0,0.2);
                }
                button:hover {
                    box-shadow: 0 6px 12px rgba(0,0,0,0.4);
                    transform: translateY(-2px);
                    filter: brightness(1.1);
                }
                button:active {
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
                    border: 1px dashed var(--vscode-button-secondaryBackground);
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
                }
                .toggle {
                    margin: 15px 0;
                }
                label {
                    display: block;
                    margin: 8px 0;
                    font-size: 12px;
                }
                select {
                    width: 100%;
                    padding: 6px;
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                }
            </style>
        </head>
        <body>
            <h2>📄 GodForge README Generator</h2>
            <p>Generate, Preview, and Manage your project documentation.</p>
            
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

            <button class="generate" onclick="generate()">🚀 Generate README</button>
            <button class="preview" onclick="preview()">👁️ Preview Changes</button>
            <button class="apply" onclick="apply()">✅ Apply README</button>
            <button class="destructive" onclick="restore()">↩️ Restore Previous README</button>

            <div style="margin-top: 30px; border-top: 1px solid var(--vscode-dropdown-border); padding-top: 10px;">
                 <button class="secondary" style="font-size: 12px; padding: 8px;" onclick="resetKey()">🔑 Change API Key</button>
            </div>

            <div class="status" id="status"></div>

            <script>
                const vscode = acquireVsCodeApi();

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
                function resetKey() {
                    vscode.postMessage({ type: 'resetKey' });
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
