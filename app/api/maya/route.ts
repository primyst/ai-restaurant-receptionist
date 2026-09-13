import { NextResponse } from 'next/server';
import { menu } from '../../../lib/menu';

const MODEL = 'gemini-2.5-flash';

type RequestBody = {
  message: string;
  cart: { id: string; name: string; qty: number }[];
  history: { from: 'ai' | 'user'; text: string }[];
};

const schema = {
  type: 'OBJECT',
  properties: {
    reply: { type: 'STRING', description: "Maya's short natural Nigerian restaurant-receptionist reply. Never invent menu items or prices." },
    actions: {
      type: 'ARRAY', maxItems: 10,
      items: { type: 'OBJECT', properties: {
        type: { type: 'STRING', enum: ['add', 'set_quantity', 'remove', 'replace', 'show_menu', 'finish', 'clarify', 'none'] },
        itemId: { type: ['STRING', 'NULL'] }, quantity: { type: ['INTEGER', 'NULL'] },
        fromItemId: { type: ['STRING', 'NULL'] }, toItemId: { type: ['STRING', 'NULL'] },
      }, required: ['type', 'itemId', 'quantity', 'fromItemId', 'toItemId'] },
    },
    chips: { type: 'ARRAY', maxItems: 4, items: { type: 'STRING' } },
  },
  required: ['reply', 'actions', 'chips'],
};

const menuForPrompt = menu.filter(i => i.available).map(i => ({ id: i.id, name: i.name, price: i.price, category: i.category, aliases: i.aliases }));

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
- add: itemId + quantity.
- set_quantity: itemId + quantity.
- remove: itemId + quantity; use the current cart quantity for a whole-item removal.
- replace: fromItemId + toItemId + quantity equal to current FROM quantity.
- show_menu, finish, clarify, none: other fields must be null.
- Multiple actions are allowed and must be ordered correctly.
- If a message contains conversational filler plus an actual order, prioritize the order.

CURRENT MENU:
${JSON.stringify(menuForPrompt)}
`;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: 'GEMINI_API_KEY is not configured.' }, { status: 500 });
    if (!body.message?.trim()) return NextResponse.json({ error: 'Message is required.' }, { status: 400 });

    const context = ['CURRENT CART:', JSON.stringify(body.cart ?? []), 'RECENT CONVERSATION:', JSON.stringify((body.history ?? []).slice(-12)), 'CUSTOMER MESSAGE:', body.message.trim()].join('\n');
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: context }] }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json', responseSchema: schema },
      }),
    });
    if (!response.ok) { console.error('Gemini API error:', await response.text()); return NextResponse.json({ error: 'Maya is temporarily unavailable.' }, { status: 502 }); }
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return NextResponse.json({ error: 'Maya returned an empty response.' }, { status: 502 });
    return NextResponse.json(JSON.parse(text));
  } catch (error) {
    console.error('Maya route error:', error);
    return NextResponse.json({ error: 'Something went wrong while processing the order.' }, { status: 500 });
  }
}
