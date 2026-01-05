import * as vscode from 'vscode';
import { SidebarProvider } from './ui/SidebarProvider';
import * as path from 'path';
import * as fs from 'fs';

/**
 * GodForge README Agent - Extension Entry Point
 * 
 * Philosophy:
 * - Button-based automation ONLY
 * - No chat, no natural language interaction
 * - All actions require explicit user confirmation
 * - Snapshot before every write
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

    // Register sidebar provider
    const sidebarProvider = new SidebarProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'godforge-sidebar',
            sidebarProvider
        )
    );

    // Register command to open the panel
    context.subscriptions.push(
        vscode.commands.registerCommand('godforge.openPanel', () => {
            vscode.commands.executeCommand('godforge-sidebar.focus');
        })
    );

    console.log('GodForge sidebar registered');
}

export function deactivate() {
    // Cleanup if needed
}
