import { GoogleGenAI, ThinkingLevel, type Content, type Part } from "@google/genai";

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
  "Missing Gemini API key. Set GOOGLE_API_KEY or GEMINI_API_KEY in .env.local and restart the dev server.";

const INVALID_API_KEY_MESSAGE =
  "The Gemini API key is invalid. Create a new key in Google AI Studio, update .env.local, and restart the dev server.";

const MODEL_NAME = "gemini-3.5-flash";
const MAX_CONTEXT_MESSAGES = 8;
const MAX_MESSAGE_CHARS = 1500;

export interface TutorMessage {
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

function toUserFriendlyError(error: unknown) {
  if (error instanceof Error) {
    if (
      error.message.includes("API_KEY_INVALID") ||
      error.message.includes("API key not valid")
    ) {
      return new Error(INVALID_API_KEY_MESSAGE);
    }

    return error;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    (error.message.includes("API_KEY_INVALID") || error.message.includes("API key not valid"))
  ) {
    return new Error(INVALID_API_KEY_MESSAGE);
  }

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

export async function* streamTutorResponse(messages: TutorMessage[], imageBase64?: string) {
  const ai = new GoogleGenAI({ apiKey: getGeminiApiKey() });
  const contents = buildContents(messages, imageBase64);

  try {
    const responseStream = await ai.models.generateContentStream({
      model: MODEL_NAME,
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        temperature: 0.7,
      },
    });

    for await (const chunk of responseStream) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw toUserFriendlyError(error);
  }
}

export async function getTutorResponse(messages: TutorMessage[], imageBase64?: string) {
  let responseText = "";

  for await (const chunk of streamTutorResponse(messages, imageBase64)) {
    responseText += chunk;
  }

  return responseText;
}
