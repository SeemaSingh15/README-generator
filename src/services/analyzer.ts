import * as fs from 'fs';
import * as path from 'path';

/**
 * Project Analyzer - NO LLM ALLOWED
 * 
 * Deterministic analysis:
 * - File tree structure
 * - Language detection (via extensions)
 * - Framework detection (via config files)
 * - Basic stats (file count, approx LOC)
 * 
 * Does NOT read file contents (except config files)
 */

export interface ProjectAnalysis {
    name: string;
    structure: string[];
    languages: string[];
    frameworks: string[];
    fileCount: number;
    estimatedLOC: number;
}

const LANGUAGE_MAP: Record<string, string> = {
    '.ts': 'TypeScript',
    '.js': 'JavaScript',
    '.py': 'Python',
    '.java': 'Java',
    '.go': 'Go',
    '.rs': 'Rust',
    '.cpp': 'C++',
    '.c': 'C',
    '.cs': 'C#',
    '.rb': 'Ruby',
    '.php': 'PHP',
    '.swift': 'Swift',
    '.kt': 'Kotlin'
};

const FRAMEWORK_INDICATORS: Record<string, string> = {
    'package.json': 'Node.js',
    'requirements.txt': 'Python',
    'Cargo.toml': 'Rust',
    'go.mod': 'Go',
    'pom.xml': 'Maven/Java',
    'build.gradle': 'Gradle/Java',
    'Gemfile': 'Ruby',
    'composer.json': 'PHP'
};

const IGNORE_DIRS = new Set([
    'node_modules', '.git', 'dist', 'build', 'out',
    '__pycache__', '.vscode', '.idea', 'target'
]);

export async function analyzeProject(rootPath: string): Promise<ProjectAnalysis> {
    const structure: string[] = [];
    const languageSet = new Set<string>();
    const frameworkSet = new Set<string>();
    let fileCount = 0;
    let estimatedLOC = 0;

    function scan(dir: string, depth: number = 0) {
        if (depth > 3) { return; } // Limit depth

        const items = fs.readdirSync(dir);

        for (const item of items) {
            const fullPath = path.join(dir, item);
            const relativePath = path.relative(rootPath, fullPath);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                if (IGNORE_DIRS.has(item)) { continue; }
                structure.push(`${'  '.repeat(depth)}📁 ${item}/`);
                scan(fullPath, depth + 1);
            } else {
                structure.push(`${'  '.repeat(depth)}📄 ${item}`);
                fileCount++;

                // Language detection
                const ext = path.extname(item);
                if (LANGUAGE_MAP[ext]) {
                    languageSet.add(LANGUAGE_MAP[ext]);
                }

                // Framework detection
                if (FRAMEWORK_INDICATORS[item]) {
                    frameworkSet.add(FRAMEWORK_INDICATORS[item]);
                }

                // Estimate LOC (rough: 30 lines per file average)
                if (ext in LANGUAGE_MAP) {
                    estimatedLOC += 30;
                }
            }
        }
    }

    scan(rootPath);

    return {
        name: path.basename(rootPath),
        structure: structure.slice(0, 50), // Limit to 50 lines
        languages: Array.from(languageSet),
        frameworks: Array.from(frameworkSet),
        fileCount,
        estimatedLOC
    };
}
