# GodForge - README Generator

VS Code extension that auto-generates professional README files using AI.

---

## What It Does

Analyzes your project structure and generates a comprehensive README.md file using Google Gemini AI.

**Features:**
- Scans project files and detects tech stack
- Generates README with proper sections (Features, Setup, Tech Stack, etc.)
- Preview before saving
- Auto-backup (undo anytime)
- Button-based UI (4 buttons: Generate, Preview, Apply, Restore)

---

## Tech Stack

**Frontend:**
- TypeScript
- VS Code Extension API
- React (WebView)

**Backend:**
- Python 3.10+
- FastAPI
- Uvicorn
- Google Gemini API

---

## Architecture

```
VS Code Extension (TypeScript)  ←→  FastAPI Backend (Python)  ←→  Gemini AI
     ↓                                      ↓
  Sidebar UI                          Prompt Engineering
  Project Scanner                     Model Discovery
  Snapshot Manager                    Error Handling
```

**Flow:**
1. User clicks "Generate" button
2. Extension scans project files
3. Sends data to FastAPI backend (localhost:5000)
4. Backend calls Gemini API with structured prompt
5. Returns generated README
6. User previews and applies

---

## How to Run

### 1. Install Dependencies

```bash
# Frontend
npm install
npm run compile

# Backend
pip install -r backend/requirements.txt
```

### 2. Add API Key

Edit `backend/.env`:
```
GEMINI_API_KEY=your_key_here
```

Get free key: https://aistudio.google.com/app/apikey

### 3. Start Backend

```bash
python backend/app.py
```

Keep this running!

### 4. Run Extension

Press **F5** in VS Code → New window opens → Open any project → Press `Ctrl+Shift+P` → Type "GodForge"

### 5. Generate README

Click **🚀 Generate** → **👁️ Preview** → **✅ Apply**

---

## Project Structure

```
├── src/
│   ├── extension.ts              # Extension entry
│   ├── ui/SidebarProvider.ts     # 4-button UI
│   └── services/
│       ├── analyzer.ts           # Project scanner
│       ├── snapshot.ts           # Backup system
│       └── backend-client.ts     # API calls
├── backend/
│   ├── app.py                    # FastAPI server
│   ├── docgen_agent.py           # README generation
│   ├── gemini_client.py          # AI integration
│   └── .env                      # API key
├── package.json
└── tsconfig.json
```

---

## Commands Reference

```bash
# Compile TypeScript
npm run compile

# Start backend
python backend/app.py

# Run extension
Press F5 in VS Code

# View API docs
http://localhost:5000/docs
```

---

**Final Year Project 2026**
