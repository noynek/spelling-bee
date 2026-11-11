# Spelling Bee

A mobile-first Next.js / TypeScript spelling practice studio for arbitrary word lists. No accounts or vocabulary service required.

## Run

Use Node.js 24 or newer.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. For a production server:

```sh
npm run build
npm start
```

## Verify

```sh
npm test
npm run typecheck
npm run build
```

Tests cover strict Unicode/case/whitespace comparison, explicit alternatives, repeated letters, sequence alignment, import validation, duplicate merging, spoken-letter parsing, and benchmark scoring. Browser smoke checks covered hidden answers, incorrect/correct feedback, retries, and first-attempt tracking.

## Included

- Create, edit, reorder and delete lists; merge identical spellings and their alternatives.
- Review all manual and imported entries before saving.
- Paste line-separated, numbered, bulleted, or comma-separated lists with a live editable preview. Choose the separator, optionally remove list markers, review duplicate/format warnings, then save or save and practice. Duplicates are kept until explicitly merged.
- Import TXT, CSV, TSV, XLSX, PDF text, DOCX, JSON and images.
- Sequential, shuffled or missed-word practice, word ranges and custom session lengths.
- Exact character grading against spelling and explicit alternatives; no normalization, case folding, autocorrection or fuzzy acceptance.
- Character alignment explaining substitutions, omissions and insertions.
- Device text-to-speech, slower playback, language codes, pronunciation overrides and optional hints with answer text redacted.
- Local student profiles, attempts, first-attempt accuracy, retries, missed words and resumable rounds.
- Voice-first practice with microphone recording, editable recognized letters, AssemblyAI pronunciation, server-side providers, and a developer comparison page.

## Import format

CSV/TSV/XLSX can have a header containing `spelling` (or `word`), `definition`, `example`, `pronunciation`, `language`, `difficulty`, `notes` and `alternatives`. Alternatives use a pipe separator. Without a recognized header, the first column is used as the word. XLSX imports all worksheets in order.

JSON accepts an array of strings, an array of word objects, or `{"words": [...]}`:

```json
[
  {
    "spelling": "color",
    "alternatives": ["colour"],
    "definition": "A hue.",
    "language": "en-US"
  }
]
```

Plain text and extracted document/image text use one nonempty line per entry. Surrounding line whitespace is trimmed; words are otherwise left as extracted. JSON and table spellings preserve whitespace. Documents with tables, running prose, headers or multiple columns need careful review. PDF scans without a text layer should be imported as page images. OCR is English by default and may misread characters; it never saves directly. OCR downloads its worker and language model from the library's public CDN; image recognition runs locally. No AI definitions or examples are generated in this release.

## Speech setup and evaluation

Create `.env.local` in the project root (never commit it):

```dotenv
ASSEMBLYAI_API_KEY=your-key-from-the-AssemblyAI-dashboard
SPEECH_PROVIDER=assemblyai
ASSEMBLYAI_STT_MODEL=universal-3-5-pro
ASSEMBLYAI_TTS_VOICE=aai-audrey
```

Restart `pnpm dev` (or `npm run dev`). One server-side key enables both services. Never use a `NEXT_PUBLIC_` variable for this key.

Practice: hear the word, tap **Record my spelling**, say each English letter name separately, and tap **Done — recognize letters**. The app grades recognized letters automatically, even when they spell the word incorrectly. Use **Correct misheard letters** to revise a transcription error. If recognition is unclear, record again or type your spelling. Repeated and incorrect letters must be retained. You can cancel recording/recognition, record again, or type instead. Microphone tracks are stopped on completion, cancellation, and navigation. Recordings stay in memory for the request and are not stored by this app.

AssemblyAI transcription uses Universal-3.5 Pro by default with generic instructions to preserve isolated letters. Only audio is uploaded: the authoritative spelling, list name, alternatives, and pronunciation metadata are never sent to the transcription API. The parser refuses ambiguous whole-word transcripts rather than guessing their letters. Spoken English letter names are supported initially, even when practicing non-English words; type accented characters or unsupported letter names in the review field.

Pronunciation uses AssemblyAI Audrey by default. It sends only the pronunciation override (or word) and language to the separate TTS endpoint. English, Spanish, French, German, Italian and Portuguese are supported; unsupported languages and service failures fall back to the device voice. **Use device voice** is also available explicitly. Normal and slow playback share the same generated audio. Audio is cached in bounded server memory (up to 128 clips / 20 MB for 24 hours) and browser memory (up to 64 clips per page). Server cache resets on restart and is not shared across replicas. No recordings of students are cached.

To compare transcription providers, add optional keys and a long random `SPEECH_LAB_TOKEN`, restart, then open http://localhost:3000/lab.

Upload the same recording to all configured providers in one request. Enter the exact sequence actually spoken, including mistakes, and separately enter the authoritative accepted spellings. Neither reference is sent to the server or providers. The lab measures exact sequence accuracy, edit-distance letter error rate, mean latency, provider failures, false accepts, false rejects and false grading rate. Runs remain in page memory and reset on reload.

AssemblyAI is selected by default whenever its key is set; `SPEECH_PROVIDER` can override this for comparison. Evaluate representative accents, devices, repeated letters, silence and intentionally incorrect answers before relying on scores. Tests mock AssemblyAI upload, transcription, deletion, and WAV synthesis responses. A real API key and microphone recordings were unavailable during development, so live provider accuracy, audible quality, and iPhone microphone behavior still require verification.

The letter parser is conservative and currently supports isolated Unicode letters and common English letter names. Ambiguous word-like transcripts are rejected rather than split into a guessed answer. Students must review and edit recognized letters before checking spelling. This parser does not support spoken letter names in every language yet.

Provider references:
- https://developers.openai.com/api/docs/guides/speech-to-text
- https://developers.deepgram.com/docs/pre-recorded-audio
- https://www.assemblyai.com/docs
- https://www.assemblyai.com/docs/tts/voices
- https://www.assemblyai.com/docs/tts/getting-started/choose-an-interface

## Privacy and deployment

Lists, profiles and progress are stored in this browser's localStorage. Clearing browser data removes them; there is no cloud backup or synchronization. Use display names rather than sensitive personal information.

Recording requires HTTPS outside localhost and explicit microphone permission. The UI discloses the selected external provider. Recordings are limited to 45 seconds in the UI and 4 MB on the server; this app does not write them to storage or logs. Provider-side retention is governed by each provider's account settings and policies. AssemblyAI transcript deletion is attempted after processing.

The transcription API has MIME and streaming size checks, timeouts, a process-local 20-request/minute limit and a three-request concurrency limit. Pronunciation has a separate 30-request/minute limit, three-request concurrency cap, 512-character text limit and 4 KB request limit. The lab requires a server-configured token. Before exposing a paid speech endpoint broadly, put it behind deployment authentication and a shared rate/budget limiter: process-local limits do not coordinate across server replicas. Keep all provider keys in server environment variables.

Deploy to a Node-capable Next.js host; this is a server application, not a static export. No hosted deployment or remote Git push was performed. Actual iPhone Safari microphone, voice availability, document-import and provider integration checks remain necessary on target devices.

For the shared-password sign-in on Vercel, set these environment variables for every deployment environment that has a speech provider key.

| Variable | Value |
| --- | --- |
| `APP_PASSWORD` | The shared password people type into the form |
| `APP_SESSION_SECRET` | A separate random signing secret of at least 32 characters. Generate one with `openssl rand -hex 32` |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | The keys for a Cloudflare Turnstile widget that permits the deployment hostname |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | The REST credentials for Upstash Redis. The Vercel integration’s `KV_REST_API_URL` and `KV_REST_API_TOKEN` also work. |
| `SPEECH_DAILY_LIMIT` | Optional provider call limit per UTC day. Defaults to 500 |

The sign-in form checks Turnstile on the server and allows five submissions per IP per ten-minute window. A successful sign-in sets a signed cookie for seven days. Changing the password or signing secret invalidates existing sessions once the change is deployed. The speech endpoints require a session and share the Redis quota. Pronunciation cache hits do not consume the quota. A lab request counts once for each provider it calls. If Redis is unavailable, the app refuses new paid calls.

Use a Turnstile widget for the stable production hostname. To use preview URLs, configure an allowed hostname for the preview you intend to test. See the [Turnstile setup guide](https://developers.cloudflare.com/turnstile/get-started/) and [Upstash REST guide](https://upstash.com/docs/redis/features/restapi).

Set the variables and redeploy before turning off Vercel Authentication. Then open the production site in a private window to test the sign-in, and check that the two speech routes return HTTP 401 without a session. For local development, leave `APP_PASSWORD` unset to open the app directly, or set it alongside `APP_SESSION_SECRET` to try the form. Turnstile and Redis are optional in local development.
