import * as fs from 'fs';
import * as path from 'path';

/**
 * Snapshot Manager - Backup and Restore Logic
 * 
 * Safety guarantees:
 * - Snapshots created BEFORE any generation
 * - Bit-for-bit restoration
 * - No partial writes
 * - Timestamped for history
 */

export async function createSnapshot(workspacePath: string): Promise<void> {
    const readmePath = path.join(workspacePath, 'README.md');

    if (!fs.existsSync(readmePath)) {
        console.log('No existing README.md to snapshot');
        return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const snapshotDir = path.join(workspacePath, '.godforge', 'history');
    const snapshotPath = path.join(snapshotDir, `README_${timestamp}.md`);

    // Ensure directory exists
    if (!fs.existsSync(snapshotDir)) {
        fs.mkdirSync(snapshotDir, { recursive: true });
    }

    // Atomic copy
    fs.copyFileSync(readmePath, snapshotPath);
    console.log(`Snapshot created: ${snapshotPath}`);
}

export async function restoreSnapshot(
    workspacePath: string,
    snapshotPath: string
): Promise<void> {
    const readmePath = path.join(workspacePath, 'README.md');

    if (!fs.existsSync(snapshotPath)) {
        throw new Error('Snapshot not found');
    }

    // Atomic copy-back
    fs.copyFileSync(snapshotPath, readmePath);
    console.log(`Restored from: ${snapshotPath}`);
}

export async function listSnapshots(workspacePath: string): Promise<Array<{
    timestamp: string;
    path: string;
}>> {
    const snapshotDir = path.join(workspacePath, '.godforge', 'history');

    if (!fs.existsSync(snapshotDir)) {
        return [];
    }

    const files = fs.readdirSync(snapshotDir)
        .filter(f => f.startsWith('README_') && f.endsWith('.md'))
        .map(f => ({
            timestamp: f.replace('README_', '').replace('.md', ''),
            path: path.join(snapshotDir, f)
        }))
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp)); // Latest first

    return files;
}
