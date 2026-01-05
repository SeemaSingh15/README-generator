import axios from 'axios';
import { ProjectAnalysis } from './analyzer';

/**
 * Backend Client - Communicates with Flask server
 * 
 * Localhost-only communication
 * Timeout & retry logic
 * Clean error handling
 */

const BACKEND_URL = 'http://localhost:5000';
const TIMEOUT_MS = 60000; // 60 seconds
const MAX_RETRIES = 2;

export async function generateReadme(analysis: ProjectAnalysis): Promise<string> {
    let lastError: any;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await axios.post(
                `${BACKEND_URL}/generate-readme`,
                analysis,
                {
                    timeout: TIMEOUT_MS,
                    headers: { 'Content-Type': 'application/json' }
                }
            );

            if (response.data && response.data.readme) {
                return response.data.readme;
            } else {
                throw new Error('Invalid response from backend');
            }

        } catch (error: any) {
            lastError = error;
            console.error(`Attempt ${attempt} failed:`, error.message);

            if (attempt < MAX_RETRIES) {
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
            }
        }
    }

    // All retries failed
    if (lastError.code === 'ECONNREFUSED') {
        throw new Error('Backend server not running. Start it with: python backend/app.py');
    } else if (lastError.code === 'ETIMEDOUT') {
        throw new Error('Request timed out. Try again or use shorter README length.');
    } else {
        throw new Error(`Backend error: ${lastError.message}`);
    }
}
