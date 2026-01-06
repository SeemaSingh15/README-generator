import * as vscode from 'vscode';
import { ReadmePanel } from './ui/ReadmePanel';
import { PreviewContentProvider } from './ui/PreviewContentProvider';
import * as path from 'path';
import * as fs from 'fs';

/**
 * GodForge README Agent - Extension Entry Point
 */

export function activate(context: vscode.ExtensionContext) {
    console.log('GodForge README Agent activated');

    // Ensure .godforge/history exists
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
        const godforgeDir = path.join(workspaceFolder.uri.fsPath, '.godforge', 'history');
        if (!fs.existsSync(godforgeDir)) {
            fs.mkdirSync(godforgeDir, { recursive: true });
        }
    }

    // Register Preview Provider
    const previewProvider = new PreviewContentProvider();
    context.subscriptions.push(
        vscode.workspace.registerTextDocumentContentProvider(
            'godforge-preview',
            previewProvider
        )
    );

    // Register command to open the panel
    context.subscriptions.push(
        vscode.commands.registerCommand('godforge.openPanel', () => {
            ReadmePanel.createOrShow(context.extensionUri, previewProvider, context);
        })
    );

    // Add Status Bar Item
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'godforge.openPanel';
    statusBarItem.text = '$(book) GodForge';
    statusBarItem.tooltip = 'Open README Generator';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    console.log('GodForge panel registered');
}

export function deactivate() {
    // Cleanup if needed
}
