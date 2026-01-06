"""
GodForge Backend - FastAPI Server
Localhost-only, single endpoint for README generation
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from docgen_agent import DocGenAgent
from typing import List
import uvicorn

app = FastAPI(title="GodForge README Agent", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize agent
agent = DocGenAgent()

# Request/Response models
class ProjectAnalysis(BaseModel):
    name: str
    structure: List[str]
    languages: List[str]
    frameworks: List[str]
    fileCount: int
    estimatedLOC: int
    apiKey: str | None = None
    description: str | None = None
    dependencies: dict | None = None
    scripts: dict | None = None

class ReadmeResponse(BaseModel):
    readme: str

@app.post('/generate-readme', response_model=ReadmeResponse)
async def generate_readme(analysis: ProjectAnalysis):
    """
    Generate README from project analysis
    
    Request body:
    {
        "name": "project-name",
        "structure": ["file1.ts", "file2.py", ...],
        "languages": ["TypeScript", "Python"],
        "frameworks": ["Node.js"],
        "fileCount": 42,
        "estimatedLOC": 1260
    }
    
    Response:
    {
        "readme": "# Project Name\n\n..."
    }
    """
    try:
        print(f"📥 Received request for project: {analysis.name}")
        
        # Convert Pydantic model to dict for agent
        analysis_dict = analysis.model_dump()
        
        # Generate README via agent
        readme_content = agent.generate(analysis_dict, analysis.apiKey)
        
        print(f"✅ README generated successfully ({len(readme_content)} chars)")
        
        return ReadmeResponse(readme=readme_content)
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"❌ ERROR generating README:")
        print(error_details)
        raise HTTPException(status_code=500, detail=str(e))

@app.get('/health')
async def health():
    """Health check endpoint"""
    return {"status": "ok"}

if __name__ == '__main__':
    print("🚀 GodForge Backend (FastAPI) starting on http://localhost:5000")
    print("📝 Endpoint: POST /generate-readme")
    print("📚 API Docs: http://localhost:5000/docs")
    uvicorn.run(app, host="127.0.0.1", port=5000, log_level="info")
