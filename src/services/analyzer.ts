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
    apiKey?: string;
    // New rich metadata
    description?: string;
    dependencies?: Record<string, string>;
    scripts?: Record<string, string>;
}

const LANGUAGE_MAP: Record<string, string> = {
    '.ts': 'TypeScript',
    '.js': 'JavaScript',
    '.jsx': 'React (JS)',
    '.tsx': 'React (TS)',
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
    '.kt': 'Kotlin',
    '.html': 'HTML',
    '.css': 'CSS'
};

const FRAMEWORK_INDICATORS: Record<string, string> = {
    'package.json': 'Node.js',
    'requirements.txt': 'Python',
    'Cargo.toml': 'Rust',
    'go.mod': 'Go',
    'pom.xml': 'Maven/Java',
    'build.gradle': 'Gradle/Java',
    'Gemfile': 'Ruby',
    'composer.json': 'PHP',
    'next.config.js': 'Next.js',
    'tailwind.config.js': 'Tailwind CSS',
    'vite.config.ts': 'Vite',
    'vite.config.js': 'Vite'
};

const IGNORE_DIRS = new Set([
    'node_modules', '.git', 'dist', 'build', 'out',
    '__pycache__', '.vscode', '.idea', 'target', '.godforge'
]);

export async function analyzeProject(rootPath: string): Promise<ProjectAnalysis> {
    const structure: string[] = [];
    const languageSet = new Set<string>();
    const frameworkSet = new Set<string>();
    let fileCount = 0;
    let estimatedLOC = 0;

    // Config Metadata
    let description = '';
    let dependencies: Record<string, string> = {};
    let scripts: Record<string, string> = {};

    function scan(dir: string, depth: number = 0) {
        if (depth > 4) { return; } // Limit depth slightly more

        let items: string[] = [];
        try {
            items = fs.readdirSync(dir);
        } catch (e) { return; }

        // Sort items: directories first, then files
        items.sort((a, b) => {
            const pathA = path.join(dir, a);
            const pathB = path.join(dir, b);
            const statA = fs.statSync(pathA);
            const statB = fs.statSync(pathB);
            if (statA.isDirectory() && !statB.isDirectory()) return -1;
            if (!statA.isDirectory() && statB.isDirectory()) return 1;
            return a.localeCompare(b);
        });

        for (const item of items) {
            const fullPath = path.join(dir, item);
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

                // Estimate LOC
                if (ext in LANGUAGE_MAP) {
                    estimatedLOC += 30; // Very rough
                }

                // READ KEY CONFIG FILES
                if (item === 'package.json') {
                    try {
                        const content = fs.readFileSync(fullPath, 'utf8');
                        const json = JSON.parse(content);
                        if (json.description) description = json.description;
                        if (json.dependencies) dependencies = { ...dependencies, ...json.dependencies };
                        if (json.devDependencies) dependencies = { ...dependencies, ...json.devDependencies };
                        if (json.scripts) scripts = { ...scripts, ...json.scripts };
                    } catch (e) {
                        // ignore parse errors
                    }
                }
            }
        }
    }

    scan(rootPath);

    return {
        name: path.basename(rootPath),
        structure: structure.slice(0, 80), // Increased limit
        languages: Array.from(languageSet),
        frameworks: Array.from(frameworkSet),
        fileCount,
        estimatedLOC,
        description,
        dependencies,
        scripts
    };
}
