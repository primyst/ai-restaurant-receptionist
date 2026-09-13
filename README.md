# AI Restaurant Receptionist

A focused interactive demo of an AI-style restaurant receptionist.

## What it demonstrates

- Conversational order capture
- Catalog-driven keyword understanding without an AI API
- 30 editable demo menu items with aliases and prices
- Quantity parsing such as `2 jollof` or `3 bottles of water`
- Mixed requests: known items are added while unknown items are rejected
- Explicit unavailable-item responses when a requested product is not in the catalog
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

## Catalog

The restaurant's catalog lives in `lib/menu.ts`. Each item has a name, price, category, aliases, and availability flag. The receptionist searches this catalog rather than relying on hard-coded `if` statements for individual foods.

To customize the demo for another restaurant, edit the catalog in one place. Set `available: false` to make an item unavailable without removing it.

## Architecture

The first version intentionally uses deterministic client-side state instead of a paid LLM API. This keeps the demo instant and predictable while giving us a clean catalog boundary. The catalog/interpreter can later sit underneath an LLM, speech-to-text, text-to-speech, WhatsApp, or phone integration.
