import * as vscode from 'vscode';

export class PreviewContentProvider implements vscode.TextDocumentContentProvider {
    // Event to signal content changes
    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    readonly onDidChange = this._onDidChange.event;

    private _content: string = '';

    // Update the content and trigger the event
    public update(content: string) {
        this._content = content;
        // Fire event for our specific URI
        this._onDidChange.fire(vscode.Uri.parse('godforge-preview:README_Preview.md'));
    }

    // Provide the content
    provideTextDocumentContent(uri: vscode.Uri): string {
        return this._content;
    }
}
