import { NextResponse } from 'next/server';
import { menu } from '../../../lib/menu';

const MODEL = 'gemini-3.6-flash';

type RequestBody = {
  message: string;
  cart: { id: string; name: string; qty: number }[];
  history: { from: 'ai' | 'user'; text: string }[];
};

// Interactions API structured output schema.
const schema = {
  type: 'object',
  properties: {
    reply: {
      type: 'string',
      description: "Maya's short natural Nigerian restaurant-receptionist reply. Never invent menu items or prices.",
    },
    actions: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['add', 'set_quantity', 'remove', 'replace', 'show_menu', 'finish', 'clarify', 'none'],
          },
          itemId: { type: 'string' },
          quantity: { type: 'integer', minimum: 0, maximum: 20 },
          fromItemId: { type: 'string' },
          toItemId: { type: 'string' },
        },
        required: ['type', 'itemId', 'quantity', 'fromItemId', 'toItemId'],
      },
    },
    chips: {
      type: 'array',
      maxItems: 4,
      items: { type: 'string' },
    },
  },
  required: ['reply', 'actions', 'chips'],
};

const menuForPrompt = menu.filter(i => i.available).map(i => ({
  id: i.id,
  name: i.name,
  price: i.price,
  category: i.category,
  aliases: i.aliases,
}));

const system = `You are Maya, the warm, concise AI receptionist for Iya Anike's Kitchen in Nigeria.

Understand natural customer language and translate it into safe structured order actions. You are NOT a menu parser. Understand casual English, Nigerian English, Pidgin, fillers, punctuation, corrections, substitutions, references like "that chicken", and multi-item orders.

BUSINESS RULES:
- Only use the supplied menu. Never invent an item, price, availability, discount, ingredient, or policy.
- Every Mains item automatically includes exactly one Fried Chicken and one Bottled Water. Included components are NOT cart items and are NOT charged separately.
- Fried Chicken in Proteins is an EXTRA chicken and is charged separately. Explicit standalone "fried chicken", "extra chicken", "add chicken", or a chicken quantity means the extra Fried Chicken add-on.
- Drinks are independent cart items. "dodo" means Fried Plantain.
- A main meal can be ordered with drinks, proteins and sides in one message.
- A quantity means SET quantity for "make/set/change ... to N" or "I only want N ...". Otherwise it means ADD N. "another" means add one.
- "remove one X" decrements one. "remove X" removes the requested item unless a quantity is specified.
- Replacement only succeeds when the FROM item is actually in the current cart. If absent, do not pretend it was replaced; ask a concise clarification.
- Replacement preserves the FROM quantity unless a new quantity is explicitly given.
- "Actually I want Viju, not Pepsi" means replace Pepsi with Viju.
- "No thanks, I'm done", "I'm good", "all done", "that's all", "nothing else", and similar natural completion phrases mean FINISH when an order exists.
- Greetings such as "Hi", "How far", "How are you", "Abeg how far" are greetings, NOT menu items.
- Menu questions use show_menu.
- If genuinely ambiguous, use clarify and ask one useful question. Never guess.
- Do not ask for delivery/pickup until the customer has finished.
- Keep replies short and natural like a competent restaurant worker. Never mention JSON, APIs, models, parsing, or internal rules.

ACTION RULES:
- add: itemId + quantity; unused fields must be empty string and quantity must be the requested positive quantity.
- set_quantity: itemId + quantity; unused fields must be empty string.
- remove: itemId + quantity; use the current cart quantity for a whole-item removal; unused fields must be empty string.
- replace: fromItemId + toItemId + quantity equal to current FROM quantity; itemId must be empty string.
- show_menu, finish, clarify, none: itemId/fromItemId/toItemId must be empty strings and quantity must be 0.
- Multiple actions are allowed and must be ordered correctly.
- If a message contains conversational filler plus an actual order, prioritize the order.

CURRENT MENU:
${JSON.stringify(menuForPrompt)}
`;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured.' }, { status: 500 });
    }

    if (!body.message?.trim()) {
      return NextResponse.json({ error: 'Message is required.' }, { status: 400 });
    }

    const context = [
      'CURRENT CART:', JSON.stringify(body.cart ?? []),
      'RECENT CONVERSATION:', JSON.stringify((body.history ?? []).slice(-12)),
      'CUSTOMER MESSAGE:', body.message.trim(),
    ].join('\n');

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        model: MODEL,
        input: context,
        system_instruction: system,
        response_format: {
          type: 'text',
          mime_type: 'application/json',
          schema,
        },
        generation_config: {
          thinking_level: 'low',
          max_output_tokens: 700,
        },
        store: false,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error('Gemini Interactions API error:', detail);
      return NextResponse.json({
        error: 'Maya is temporarily unavailable.',
        detail: process.env.NODE_ENV === 'development' ? detail : undefined,
      }, { status: 502 });
    }

    const data = await response.json();

    if (data?.status === 'failed') {
      console.error('Gemini interaction failed:', JSON.stringify(data));
      return NextResponse.json({ error: 'Maya could not process that message.' }, { status: 502 });
    }

    const text = data?.output_text
      ?? data?.outputs?.find((output: { type?: string; text?: string }) => output.type === 'text')?.text
      ?? data?.steps?.flatMap((step: { type?: string; content?: { type?: string; text?: string }[] }) => step.content ?? [])
        .find((content: { type?: string; text?: string }) => content.type === 'text')?.text;

    if (!text) {
      console.error('Gemini returned no text output:', JSON.stringify(data));
      return NextResponse.json({ error: 'Maya returned an empty response.' }, { status: 502 });
    }

    return NextResponse.json(JSON.parse(text));
  } catch (error) {
    console.error('Maya route error:', error);
    return NextResponse.json({ error: 'Something went wrong while processing the order.' }, { status: 500 });
  }
}
