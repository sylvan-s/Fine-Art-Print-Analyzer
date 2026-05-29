import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey });

async function testModel(modelName: string) {
  try {
    console.log(`Testing model: ${modelName}...`);
    const response = await ai.models.generateContent({
      model: modelName,
      contents: 'Hello, reply with "Success!" and nothing else.',
    });
    console.log(`-> Result for ${modelName}:`, response.text?.trim());
  } catch (err: any) {
    console.error(`-> Error for ${modelName}:`, err.message || err);
  }
}

async function main() {
  await testModel('gemini-2.5-pro');
  await testModel('gemini-pro-latest');
  await testModel('gemini-3.1-pro-preview');
  await testModel('gemini-3.5-flash');
}
main();
