# AI Restaurant Receptionist

A focused interactive demo of an AI-style restaurant receptionist.

## What it demonstrates

- Conversational order capture
- Natural-ish keyword understanding without an AI API
- Clarifying prompts and quick replies
- Live cart / order summary
- Delivery vs pickup
- Customer details collection
- Simulated checkout
- Live fulfillment tracking

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Architecture

The first version intentionally uses deterministic client-side state instead of a paid LLM API. This makes the demo instant, predictable, and easy to replace with an LLM, speech-to-text, text-to-speech, WhatsApp, or phone integration later.
