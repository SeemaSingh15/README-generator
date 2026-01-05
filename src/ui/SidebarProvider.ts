import * as vscode from 'vscode';
import { analyzeProject } from '../services/analyzer';
import { createSnapshot, restoreSnapshot, listSnapshots } from '../services/snapshot';
import { generateReadme } from '../services/backend-client';

/**
 * Sidebar Provider - Renders the React UI in VS Code sidebar
 * 
 * UI contains ONLY 4 buttons:
 * 1. Generate README
 * 2. Preview Changes
 * 3. Apply README
 * 4. Restore Previous README
 */

export class SidebarProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _previewContent: string | null = null;

    constructor(private readonly _extensionUri: vscode.Uri) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from webview
        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
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
            }
        });
    }

    private async handleGenerate() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open');
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
            this._previewContent = await generateReadme(analysis);
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

        // STEP 5: Show preview in new editor
        const doc = await vscode.workspace.openTextDocument({
            content: this._previewContent,
            language: 'markdown'
        });
        await vscode.window.showTextDocument(doc, { preview: true });
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
            await restoreSnapshot(workspaceFolder.uri.fsPath, selected.value);
            vscode.window.showInformationMessage('✅ README restored!');
        }
    }

    private _sendMessage(message: any) {
        this._view?.webview.postMessage(message);
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
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
                }
                button {
                    width: 100%;
                    padding: 12px;
                    margin: 8px 0;
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                }
                button:hover {
                    background: var(--vscode-button-hoverBackground);
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
            <h2>📄 Documentation</h2>
            
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

            <button onclick="generate()">🚀 Generate README</button>
            <button onclick="preview()">👁️ Preview Changes</button>
            <button onclick="apply()">✅ Apply README</button>
            <button onclick="restore()">↩️ Restore Previous README</button>

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
