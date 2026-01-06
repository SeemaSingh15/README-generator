# GodForge - README Generator

VS Code extension that auto-generates professional README files using AI (Google Gemini).

---

## ✨ Features

- **Automated Analysis**: Scans project files, dependencies, and scripts.
- **AI-Powered Generation**: Uses Google Gemini to write professional documentation.
- **Smart Snapshots**: History-based backup system (undo/restore anytime).
- **Secure Key Storage**: API keys stored in VS Code's native SecretStorage (never in code).
- **Panel UI**: Integrated editor panel for better visibility.
- **One-Click Actions**: Generate, Preview, Apply, Restore.

---

## 🛠️ Architecture

```
VS Code Extension (TypeScript)  ←→  FastAPI Backend (Python)  ←→  Gemini AI
     ↓                                      ↓
  Panel UI                            Prompt Engineering
  Analyzer (fs/path)                  Model Discovery
  Snapshot System                     Error Handling
  SecretStorage                       REST API
```

**Workflow:**
1. User clicks "Generate" button.
2. Extension scans project (file tree, `package.json`, dependencies).
3. Securely retrieves API Key from VS Code Secrets.
4. Sends payload to Python Backend.
5. Backend constructs high-context prompt and calls Gemini.
6. Returns Markdown for preview.

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** (for Extension)
- **Python 3.10+** (for Backend)

### 2. Install Dependencies

**Frontend (Extension):**
```bash
npm install
npm run compile
```

**Backend (AI Server):**
```bash
cd backend
pip install -r requirements.txt
```

### 3. Run the Backend
Start the local server that handles AI logic:
```bash
python backend/app.py
```
> Keep this terminal open!

### 4. Launch Extension
1. Press `F5` in VS Code to open the Extension Host.
2. Open any project folder.
3. Click the **$(book) GodForge** status bar item (bottom right).
4. Or run command: `GodForge: Open README Generator`.

### 5. First Run
- You will be asked to enter your **Google Gemini API Key**.
- This is stored securely on your machine.
- You can reset it anytime via the "Change API Key" button in the panel.

---

## 📁 Project Structure

```
├── src/
/   ├── extension.ts              # Entry & Status Bar
│   ├── ui/
│   │   ├── ReadmePanel.ts        # Webview Panel Logic & HTML
│   │   └── PreviewProvider.ts    # Read-only Preview System
│   └── services/
│       ├── analyzer.ts           # Codebase Scanning
│       ├── snapshot.ts           # Backup/Restore Logic
│       └── backend-client.ts     # Axios Client
├── backend/
│   ├── app.py                    # FastAPI Server
│   ├── docgen_agent.py           # Prompt Engineering
│   ├── gemini_client.py          # Gemini Wrapper
│   └── requirements.txt
└── package.json
```

---

**GodForge 2026** - *Automating Documentation*
