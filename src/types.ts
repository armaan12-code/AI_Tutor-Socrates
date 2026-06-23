// Shared TypeScript interfaces used across the app

export interface User {
  id: number;
  name: string;
  email: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image?: string;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
  projectId?: string | null;
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
}
