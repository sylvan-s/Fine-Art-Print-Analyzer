import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey });

async function main() {
  try {
    const response = await ai.models.list();
    console.log('--- ITERATING RESPONSE ---');
    // Try iterating
    let count = 0;
    for await (const m of response) {
      if (m.name.includes('gemini') || m.name.includes('flash') || m.name.includes('pro')) {
        console.log(m.name);
        count++;
      }
    }
    console.log(`Total matching models: ${count}`);
  } catch (err) {
    console.error('Error iterating models:', err);
  }
}
main();
