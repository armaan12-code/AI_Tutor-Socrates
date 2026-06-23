import { Router, Request, Response } from 'express';
import { GoogleGenAI, ThinkingLevel, type Content, type Part } from '@google/genai';

export const tutorRouter = Router();

const SYSTEM_INSTRUCTION = `You are Socrates, a compassionate and patient Socratic math tutor. 
Your goal is to help students learn math by guiding them through problems, not by giving them the answer.

RULES:
1. NEVER provide the full solution or final answer immediately.
2. When an image is provided, identify the problem and suggest ONLY the first logical step.
3. Use a warm, encouraging, and patient tone.
4. If the student asks "Why did we do that?" or seems confused, explain the underlying mathematical concept simply before proceeding.
5. Ask guiding questions to lead the student to the next step.
6. If the student makes a mistake, gently point it out and ask them to re-examine that part.
7. Use LaTeX for mathematical notation (wrap in $ or $$).
8. Keep explanations concise but clear.

Your personality: You are like a kind mentor sitting next to the student. You care about their understanding more than the result.`;

const MISSING_API_KEY_MESSAGE =
  "Missing Gemini API key on server. Set GOOGLE_API_KEY or GEMINI_API_KEY in server environment.";

const INVALID_API_KEY_MESSAGE =
  "The Gemini API key is invalid or has been revoked. Please create a new key at https://aistudio.google.com/app/apikey.";

const MAX_CONTEXT_MESSAGES = 8;
const MAX_MESSAGE_CHARS = 1500;

interface TutorMessage {
  role: string;
  content: string;
}

function getGeminiApiKey() {
  const apiKey = process.env.GOOGLE_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(MISSING_API_KEY_MESSAGE);
  }
  return apiKey;
}

const QUOTA_EXCEEDED_MESSAGE =
  "You exceeded your Gemini API quota or rate limit (429). If this is a new key, make sure the Gemini API is enabled in your Google Cloud Project, or wait a moment and try again.";

function isApiKeyError(msg: string) {
  return (
    msg.includes("API_KEY_INVALID") ||
    msg.includes("API key not valid") ||
    msg.includes("API key expired") ||
    msg.includes("PERMISSION_DENIED") ||
    msg.includes("reported as leaked") ||
    msg.includes("403")
  );
}

function isQuotaError(msg: string) {
  return (
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("quota") ||
    msg.includes("Quota")
  );
}

function toUserFriendlyError(error: unknown) {
  const msg =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
      ? String((error as any).message)
      : String(error);

  if (isQuotaError(msg)) {
    return new Error(QUOTA_EXCEEDED_MESSAGE);
  }

  if (isApiKeyError(msg)) {
    return new Error(INVALID_API_KEY_MESSAGE);
  }

  if (error instanceof Error) return error;

  return new Error("The tutor service failed to respond. Try again in a moment.");
}

function buildContents(messages: TutorMessage[], imageBase64?: string) {
  const recentMessages = messages.slice(-MAX_CONTEXT_MESSAGES);
  const lastMessageIndex = recentMessages.length - 1;
  const trimmedMessages = recentMessages
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, MAX_MESSAGE_CHARS),
    }))
    .filter((message, index) => message.content.length > 0 || (Boolean(imageBase64) && index === lastMessageIndex));

  const contents: Content[] = trimmedMessages.map((m) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }] as Part[],
  }));

  if (imageBase64) {
    const lastMessage = contents[contents.length - 1];
    if (lastMessage && lastMessage.role === 'user') {
      lastMessage.parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: imageBase64
        }
      });
    }
  }

  return contents;
}

// POST /api/tutor/stream
tutorRouter.post('/stream', async (req: Request, res: Response) => {
  try {
    const { messages, imageBase64 } = req.body as { messages: TutorMessage[]; imageBase64?: string };

    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required.' });
    }

    const apiKey = getGeminiApiKey();
    const ai = new GoogleGenAI({ apiKey });
    const contents = buildContents(messages, imageBase64);

    const modelOrder = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-3.5-flash"];
    let lastError: any = null;
    let streamEstablished = false;

    for (const model of modelOrder) {
      try {
        console.log(`[Socrates Server] Attempting generation with ${model}...`);
        const responseStream = await ai.models.generateContentStream({
          model,
          contents,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            thinkingConfig: model.includes("2.0-flash") ? { thinkingLevel: ThinkingLevel.MINIMAL } : undefined,
            temperature: 0.7,
          },
        });

        // Set response headers for streaming once a model responds successfully
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');
        streamEstablished = true;

        for await (const chunk of responseStream) {
          if (chunk.text) {
            res.write(chunk.text);
          }
        }
        res.end();
        return; // Stream succeeded, exit the route handler
      } catch (error) {
        console.warn(`[Socrates Server] Model ${model} failed:`, error);
        lastError = error;
      }
    }

    // If stream was never established and all models failed, send friendly error
    const friendlyError = toUserFriendlyError(lastError);
    if (!streamEstablished) {
      return res.status(500).json({ error: friendlyError.message });
    } else {
      // If we failed mid-stream (rare)
      res.write(`\nError: ${friendlyError.message}`);
      res.end();
    }
  } catch (error: any) {
    console.error('[Socrates Server] Tutor stream handler error:', error);
    return res.status(500).json({ error: error.message || 'Tutoring session failed.' });
  }
});
