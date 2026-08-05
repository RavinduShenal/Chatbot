# Bench - AI Chatbot

Bench is a small, responsive chatbot built for the Career141 technical assessment. It uses Next.js for the user interface and server-side API route, and OpenRouter for AI responses.

## Highlights

- Clean chat interface with starter prompts, loading feedback, automatic scrolling, and friendly errors.
- A server-side API route at `pages/api/chat.js`; the browser never calls OpenRouter directly.
- API key kept out of source control and configured separately for local and production environments.

## Tech stack

- Next.js 14 and React 18
- OpenRouter API (OpenAI-compatible REST)
- Vercel (recommended deployment platform)

## Project structure

```text
pages/
  index.js          # Chat interface and browser-side state
  api/chat.js       # Server-only route that calls OpenRouter
  _app.js           # Global application wrapper
styles/globals.css  # Responsive styles
.env.example        # Safe configuration template
```

## Configure and run locally

### Prerequisites

- Node.js 18 or newer
- An OpenRouter API key created at [OpenRouter Keys](https://openrouter.ai/keys)

### 1. Install dependencies

```bash
npm install
```

### 2. Create your local environment file

Create `.env.local` from the supplied safe template.

**PowerShell (Windows):**

```powershell
Copy-Item .env.example .env.local
```

**macOS/Linux:**

```bash
cp .env.example .env.local
```

### 3. Add your OpenRouter API key

Open `.env.local` and replace the placeholder value:

```dotenv
OPENROUTER_API_KEY=your-real-key-goes-here
OPENROUTER_MODEL=openrouter/free
```

`OPENROUTER_MODEL` is optional; the application uses `openrouter/free` if it is omitted.

Important: use `.env.local` only for your real key. Do not put it in `pages/index.js`, any `NEXT_PUBLIC_*` variable, a screenshot, or a Git commit. The server route reads it using `process.env.OPENROUTER_API_KEY`, so it is not included in the browser bundle.

### 4. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), send a message, and confirm you receive a response.

If the chat shows a missing-key error, confirm that `.env.local` is in the repository root, the variable is named exactly `OPENROUTER_API_KEY`, and restart `npm run dev` after editing the file.

## API-key security

The security boundary is intentional and easy to review:

```text
Browser -> POST /api/chat -> OpenRouter API
                 |
                 +-> reads OPENROUTER_API_KEY only on the server
```

- `.env.local` is excluded by `.gitignore` and must never be committed.
- `.env.example` contains placeholders only and is safe to commit.
- `pages/api/chat.js` is the only file that reads `OPENROUTER_API_KEY`.
- The browser sends messages to `/api/chat`; it does not receive or use the provider key.

Before committing, run this check (after Git is installed):

```bash
git check-ignore -v .env.local
git status
```

The first command should show that `.env.local` is ignored. The second should not list `.env.local`. If a key is ever committed, revoke it in OpenRouter, generate a replacement, update the deployment environment variable, and remove it from Git history before making the repository public.

## Deploy to Vercel

1. Push this repository to GitHub. Verify that `.env.local` is not included.
2. Import the repository at [Vercel](https://vercel.com/new); Vercel detects Next.js automatically.
3. In **Project Settings -> Environment Variables**, add:

   ```text
   OPENROUTER_API_KEY = your real OpenRouter API key
   OPENROUTER_MODEL   = openrouter/free  (optional)
   ```

4. Select the environments you intend to deploy to (at minimum, Production), then deploy.
5. Test the production chat with a real prompt before submitting the live URL.

Do not upload `.env.local` to Vercel or place the secret in a Vercel build command. Use the environment-variable dashboard instead.

## GitHub submission checklist

- [ ] The repository is public or shared with Career141.
- [ ] `.env.local` is not tracked and no API key appears in the commit history.
- [ ] The README setup steps work from a fresh clone.
- [ ] The Vercel URL is live and the chatbot returns a real response.
- [ ] The Git history uses small, meaningful commits, for example:

  ```text
  chore: initialize Next.js chatbot project
  feat: build responsive chat interface
  feat: add secure OpenRouter API route
  docs: document setup and deployment
  ```
