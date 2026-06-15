# Socrates: The Math Tutor

Socrates is a Vite + React math tutoring app powered by Gemini. It encourages step-by-step learning instead of immediately giving away the final answer, and it can also work from uploaded images of math problems.

## Features

- Socratic tutoring flow with guided responses
- Streaming Gemini replies in the chat UI
- Image upload for photo-based math questions
- Local chat history saved in the browser
- Markdown and LaTeX rendering for math explanations

## Tech Stack

- React 19
- TypeScript
- Vite
- Gemini via `@google/genai`
- Tailwind-based styling

## Getting Started

### Prerequisites

- Node.js 18+
- A Gemini API key

### Installation

1. Install dependencies:

```bash
npm install
```

2. Create a local environment file from the example:

```bash
cp .env.example .env.local
```

3. Set `GOOGLE_API_KEY` or `GEMINI_API_KEY` in `.env.local`.

4. Start the development server:

```bash
npm run dev
```

The app runs on `http://localhost:3000`.

## Available Scripts

- `npm run dev` starts the Vite development server
- `npm run build` creates a production build
- `npm run preview` previews the production build locally
- `npm run lint` runs TypeScript type-checking

## Environment Variables

- `GOOGLE_API_KEY` or `GEMINI_API_KEY`: required for Gemini requests
- `APP_URL`: optional app URL placeholder from the original template

## Project Structure

```text
src/
  App.tsx                  Main chat interface
  services/geminiService.ts Gemini request and streaming logic
  index.css                Global styles
```
