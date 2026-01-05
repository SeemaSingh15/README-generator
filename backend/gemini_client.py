"""
Gemini API Client - Wrapper for Google Generative AI

Handles:
- Model selection
- Timeout configuration
- Error handling
- Response parsing
"""

import google.generativeai as genai
from typing import Optional

class GeminiClient:
    def __init__(self, api_key: str):
        genai.configure(api_key=api_key)
        
        print("🔍 Listing all available models for your API key...")
        
        try:
            # List all available models
            available_models = list(genai.list_models())
            
            print(f"📋 Found {len(available_models)} total models")
            
            # Filter for models that support generateContent
            content_models = [
                m for m in available_models 
                if 'generateContent' in m.supported_generation_methods
            ]
            
            print(f"✅ Found {len(content_models)} models that support generateContent:")
            for m in content_models:
                print(f"   - {m.name}")
            
            if not content_models:
                print("❌ No models support generateContent!")
                print("📋 All available models:")
                for m in available_models:
                    print(f"   - {m.name}: {m.supported_generation_methods}")
                raise ValueError("No models available that support generateContent")
            
            # Use the first available model
            selected_model = content_models[0]
            print(f"\n🎯 Using model: {selected_model.name}")
            
            self.model = genai.GenerativeModel(selected_model.name)
            
        except Exception as e:
            print(f"❌ Error during model initialization: {e}")
            raise
    
    def generate_content(self, prompt: str, timeout: int = 60) -> str:
        """
        Generate content from prompt
        
        Args:
            prompt: Structured prompt string
            timeout: Max seconds to wait
        
        Returns:
            Generated text
        
        Raises:
            Exception on API errors
        """
        try:
            response = self.model.generate_content(
                prompt,
                generation_config={
                    'temperature': 0.3,  # Low temperature for consistency
                    'top_p': 0.9,
                    'top_k': 40,
                    'max_output_tokens': 2048,
                }
            )
            
            if not response or not response.text:
                raise ValueError("Empty response from Gemini")
            
            return response.text.strip()
            
        except Exception as e:
            raise Exception(f"Gemini API error: {str(e)}")
