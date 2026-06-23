export interface TutorMessage {
  role: string;
  content: string;
}

export async function* streamTutorResponse(messages: TutorMessage[], imageBase64?: string): AsyncGenerator<string> {
  const response = await fetch('/api/tutor/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages, imageBase64 }),
  });

  if (!response.ok) {
    let errorMsg = 'The tutor service failed to respond.';
    try {
      const data = await response.json();
      if (data && data.error) {
        errorMsg = data.error;
      }
    } catch {
      try {
        const text = await response.text();
        if (text) errorMsg = text;
      } catch {}
    }
    throw new Error(errorMsg);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Response body is not readable.");
  }

  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}

export async function getTutorResponse(messages: TutorMessage[], imageBase64?: string) {
  let responseText = "";

  for await (const chunk of streamTutorResponse(messages, imageBase64)) {
    responseText += chunk;
  }

  return responseText;
}
