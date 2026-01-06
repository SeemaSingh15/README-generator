"""
DocGen Agent - README Generation Logic

Responsibilities:
1. Build structured prompt from project analysis
2. Call Gemini API
3. Return markdown string

NO file system access
NO state management
Pure function: analysis → README
"""

from gemini_client import GeminiClient
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class DocGenAgent:
    def __init__(self):
        pass
    
    def generate(self, analysis: dict, api_key: str = None) -> str:
        """
        Generate README from project analysis
        
        Args:
            analysis: ProjectAnalysis dict from TypeScript
            api_key: Gemini API Key provided by user
        
        Returns:
            Markdown string
        """
        # Fallback to env var if not provided (though frontend should provide it)
        key_to_use = api_key or os.getenv('GEMINI_API_KEY')
        
        if not key_to_use:
             raise ValueError(
                "GEMINI_API_KEY not provided.\n"
                "Please configure it in the VS Code extension."
            )

        # Initialize client per request with specific key
        gemini = GeminiClient(key_to_use)

        prompt = self._build_prompt(analysis)
        readme = gemini.generate_content(prompt)
        return readme
    
    def _build_prompt(self, analysis: dict) -> str:
        """
        Build STRICT, STRUCTURED prompt for professional README generation
        
        Philosophy:
        - Explicit constraints
        - No hallucination
        - Professional tone
        - Comprehensive but focused
        """
        
        structure_preview = "\n".join(analysis.get('structure', [])[:40])
        languages = ", ".join(analysis.get('languages', []))
        frameworks = ", ".join(analysis.get('frameworks', []))
        
        prompt = f"""You are a senior technical writer and developer advocate. Generate a comprehensive, professional README.md file that follows GitHub best practices.

PROJECT ANALYSIS:
- Name: {analysis.get('name', 'Unknown')}
- Primary Languages: {languages or 'Not detected'}
- Frameworks/Tools: {frameworks or 'Not detected'}
- Total Files: {analysis.get('fileCount', 0)}
- Estimated Lines of Code: {analysis.get('estimatedLOC', 0)}

PROJECT STRUCTURE:
{structure_preview}

REQUIREMENTS FOR THE README:

1. **Title & Description**
   - Use an engaging emoji that fits the project type
   - Write a clear, compelling 2-3 sentence description
   - Explain WHAT the project does and WHY it exists

2. **Features Section** (✨ Features)
   - List 4-6 key features based on the project structure
   - Be specific (e.g., "User authentication with JWT" not just "Authentication")
   - Use bullet points with descriptive icons/emojis

3. **Tech Stack Section** (🛠️ Tech Stack)
   - Organize by category: Frontend, Backend, Database, Tools
   - Only include technologies you can confirm from the structure
   - Be specific about versions if visible in package files

4. **Architecture & Design** (🏗️ Architecture)
   - Describe the high-level architecture (e.g., Client-Server, MVC)
   - If frontend/backend exists, explain their relationship
   - Mention key design patterns observed (e.g., Component-based, Service-layer)

5. **Getting Started** (🚀 Getting Started)
   - Include Prerequisites section
   - Provide clear Installation steps
   - Add Running the Application steps
   - If it's a full-stack app, show both frontend and backend setup

6. **Project Structure** (📁 Project Structure)
   - Show a clean tree view of main directories
   - Add brief comments explaining key folders
   - Keep it concise (top-level only)

7. **API Documentation** (📚 API Documentation) - ONLY if backend detected
   - Mention that API docs are available
   - Suggest where to find endpoint details

8. **Environment Variables** - ONLY if .env files detected
   - List required environment variables
   - Provide example values (not real secrets)

9. **Contributing** (🤝 Contributing)
   - Brief, welcoming contribution guidelines

10. **License** (📄 License)
   - Mention license if detected, otherwise use MIT

STYLE GUIDELINES:
- Use emojis strategically (one per section header)
- Use code blocks with proper language tags
- Use tables for structured data when appropriate
- Keep paragraphs short and scannable
- Use **bold** for emphasis
- Use `code` for technical terms

CRITICAL RULES:
- DO NOT invent features that aren't evident from the structure
- DO NOT add placeholder text like "Add your description here"
- DO NOT include badges (they'll be added separately)
- DO NOT make assumptions about deployment or testing unless files indicate it
- DO write in present tense
- DO be specific and actionable

OUTPUT FORMAT:
Generate ONLY the markdown content. Do not wrap in ```markdown blocks.
Start directly with the # title.

IMPORTANT: You MUST generate the COMPLETE README covering ALL sections from 1 to 10. Do not stop early. Ensure the response is complete.

Generate the README now:"""
        
        return prompt
