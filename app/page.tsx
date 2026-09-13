'use client';

import { FormEvent, useMemo, useState } from 'react';
import { Check, Minus, Plus, Send, Truck, UtensilsCrossed } from 'lucide-react';
import { findMenuMatches, isGreeting, isMenuQuestion, isValidAddress, isValidName, isValidPhone, menu, menuSummaryByCategory, normalizeText, type MenuItem } from '../lib/menu';

type CartItem = MenuItem & { qty: number };
type Message = { id: number; from: 'ai' | 'user'; text: string; chips?: string[] };
type Stage = 'chat' | 'details' | 'payment' | 'tracking';

const money = (n: number) => `₦${n.toLocaleString()}`;
const drinks = menu.filter(i => i.category === 'Drinks');
const DRINK_CHIPS = drinks.map(i => i.name);
const ADDON_CHIPS = ['Choose a drink', 'Add plantain', 'That’s all'];
const numberWords: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const STAGES = [{ key: 'chat' as Stage, label: 'Order' }, { key: 'details' as Stage, label: 'Details' }, { key: 'payment' as Stage, label: 'Payment' }, { key: 'tracking' as Stage, label: 'Tracking' }];
const initialMessages: Message[] = [{ id: 1, from: 'ai', text: "Welcome to Iya Anike's Kitchen. I'm Maya — tell me what you'd like and I'll get it sorted." }];

const quantityFor = (raw: string, item: MenuItem) => {
  const text = normalizeText(raw);
  for (const alias of item.aliases) {
    const a = normalizeText(alias).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const before = text.match(new RegExp(`(?:^|\\s)(\\d+)\\s*(?:x|×)?\\s*(?:plates?|pieces?|bottles?|servings?)?\\s*${a}(?=\\s|$)`));
    if (before) return Math.max(1, Number(before[1]));
    const wordBefore = text.match(new RegExp(`(?:^|\\s)(one|two|three|four|five|six|seven|eight|nine|ten)\\s*(?:x|×)?\\s*(?:plates?|pieces?|bottles?|servings?)?\\s*${a}(?=\\s|$)`));
    if (wordBefore) return numberWords[wordBefore[1]];
    const after = text.match(new RegExp(`${a}\\s+(?:x|×)?\\s*(\\d+|one|two|three|four|five|six|seven|eight|nine|ten)\\b`));
    if (after) return Number(after[1]) || numberWords[after[1]] || 1;
  }
  return 1;
};

const hasExplicitQuantity = (raw: string, item: MenuItem) => {
  const text = normalizeText(raw);
  return item.aliases.some(alias => {
    const a = normalizeText(alias).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:^|\\s)(?:\\d+|one|two|three|four|five|six|seven|eight|nine|ten)\\s*(?:x|×)?\\s*(?:plates?|pieces?|bottles?|servings?)?\\s*${a}(?=\\s|$)|${a}\\s+(?:x|×)?\\s*(?:\\d+|one|two|three|four|five|six|seven|eight|nine|ten)\\b`).test(text);
  });
};

const isCancel = (text: string) => /^(cancel(?:\s+the)?\s+order|cancel|start over|reset|never\s*mind|forget it)\b/i.test(text.trim());
const isDone = (text: string) => /^(that'?s all|thats all|all|done|finish|finished|checkout|nothing else|no)$/i.test(text.trim());
const stripFiller = (text: string) => normalizeText(text).replace(/\b(wait|actually|please|just|then|anymore|only|instead|a|an|the)\b/g, ' ').replace(/\s+/g, ' ').trim();

export default function Home() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [stage, setStage] = useState<Stage>('chat');
  const [delivery, setDelivery] = useState<'delivery' | 'pickup' | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [touched, setTouched] = useState(false);
  const [status, setStatus] = useState(0);
  const [typing, setTyping] = useState(false);
  const [paying, setPaying] = useState(false);
  const [awaitingDrink, setAwaitingDrink] = useState(false);

  const total = useMemo(() => cart.reduce((sum, i) => sum + i.price * i.qty, 0), [cart]);
  const count = cart.reduce((sum, i) => sum + i.qty, 0);
  const stageIndex = STAGES.findIndex(s => s.key === stage);

  const ai = (text: string, chips?: string[]) => { setTyping(false); setMessages(m => [...m, { id: Date.now() + Math.random(), from: 'ai', text, chips }]); };
  const user = (text: string) => setMessages(m => [...m, { id: Date.now() + Math.random(), from: 'user', text }]);
  const add = (item: MenuItem, qty = 1) => setCart(c => { const found = c.find(i => i.id === item.id); return found ? c.map(i => i.id === item.id ? { ...i, qty: i.qty + qty } : i) : [...c, { ...item, qty }]; });
  const setQty = (id: string, qty: number) => setCart(c => c.map(i => i.id === id ? { ...i, qty: Math.max(0, qty) } : i).filter(i => i.qty > 0));
  const change = (id: string, delta: number) => setQty(id, (cart.find(i => i.id === id)?.qty || 0) + delta);

  const process = (raw: string) => {
    const clean = raw.trim();
    const normalized = normalizeText(clean);

    // Policy 1: cancellation always wins.
    if (isCancel(clean)) {
      const hadOrder = cart.length > 0;
      setCart([]); setAwaitingDrink(false);
      ai(hadOrder ? 'No problem, I’ve cleared that order. Let me know whenever you’re ready to start again.' : 'There’s nothing to cancel yet. What would you like?');
      return;
    }

    // Policy 2: replacement is atomic — remove the old item and add the new one.
    const replacement = normalized.match(/(?:change|replace|swap|switch)\s+(.+?)\s+(?:to|for|with)\s+(.+)/i) || normalized.match(/(?:i\s+)?(?:dont|do not)\s+want\s+(.+?)\s+(?:anymore\s*)?(?:give me|add|take)\s+(.+?)(?:\s+instead)?$/i);
    if (replacement && /\b(?:instead|change|replace|swap|switch|dont|do not)\b/i.test(normalized)) {
      const from = findMenuMatches(replacement[1]);
      const to = findMenuMatches(replacement[2]);
      if (from.length && to.length) {
        const old = from[0], next = to[0];
        const oldQty = cart.find(i => i.id === old.id)?.qty || 1;
        setCart(c => {
          const withoutOld = c.filter(i => i.id !== old.id);
          const existing = withoutOld.find(i => i.id === next.id);
          return existing ? withoutOld.map(i => i.id === next.id ? { ...i, qty: i.qty + oldQty } : i) : [...withoutOld, { ...next, qty: oldQty }];
        });
        setAwaitingDrink(false);
        ai(`Done — I swapped ${old.name} for ${next.name}. Anything else?`, ADDON_CHIPS);
        return;
      }
    }

    // Policy 3: quantity corrections mutate the cart; they never add a duplicate.
    const setQuantity = normalized.match(/(?:make|set|change)\s+(?:the\s+)?(.+?)\s+(?:to\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/i) || normalized.match(/(?:i\s+)?(?:only\s+want|want)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(.+)/i);
    if (setQuantity) {
      const quantityFirst = /^(?:\d|one\b|two\b|three\b|four\b|five\b|six\b|seven\b|eight\b|nine\b|ten\b)/i.test(setQuantity[1]);
      const targetText = quantityFirst ? setQuantity[2] : setQuantity[1];
      const qtyRaw = quantityFirst ? setQuantity[1] : setQuantity[2];
      const target = findMenuMatches(targetText)[0];
      if (target) {
        const qty = Number(qtyRaw) || numberWords[qtyRaw] || 1;
        if (cart.some(i => i.id === target.id)) { setQty(target.id, qty); ai(`Done — ${target.name} is now ${qty}×. Anything else?`, ADDON_CHIPS); }
        else ai(`${target.name} isn’t in your order yet. You can add it first, then change the quantity.`);
        return;
      }
    }

    // Policy 4: removal can decrement by a requested quantity or remove the whole line.
    const remove = normalized.match(/^(remove|delete|take out|drop)\s+(.+)/i) || normalized.match(/(?:i\s+)?(?:dont|do not)\s+want\s+(.+?)(?:\s+anymore)?$/i);
    if (remove) {
      const target = findMenuMatches(remove[2] || remove[1]);
      if (!target.length) { ai('Which item would you like me to remove?'); return; }
      const item = target[0];
      const present = cart.find(i => i.id === item.id);
      if (!present) { ai(`${item.name} isn’t in your order right now.`); return; }
      const qty = hasExplicitQuantity(clean, item) ? quantityFor(clean, item) : present.qty;
      setQty(item.id, present.qty - qty);
      ai(`Removed ${Math.min(qty, present.qty)}× ${item.name}. Anything else?`, ADDON_CHIPS);
      return;
    }

    // Policy 5: explicit context action. A non-drink instruction can interrupt drink selection.
    if (/^(choose|add|give me|i want)\s+(a\s+)?drink$/i.test(clean) || clean === 'Choose a drink') {
      setAwaitingDrink(true); ai('Sure. Which drink would you like?', DRINK_CHIPS); return;
    }

    const textForMatching = stripFiller(clean);
    const matches = findMenuMatches(textForMatching);
    const nonDrinkMatches = matches.filter(i => i.category !== 'Drinks');
    const drinkMatches = matches.filter(i => i.category === 'Drinks');

    if (awaitingDrink && drinkMatches.length && !nonDrinkMatches.length) {
      drinkMatches.forEach(item => add(item, quantityFor(textForMatching, item)));
      setAwaitingDrink(false);
      ai(`Added ${drinkMatches.map(i => `${quantityFor(textForMatching, i)}× ${i.name}`).join(', ')}. Anything else?`, ADDON_CHIPS);
      return;
    }
    if (awaitingDrink && nonDrinkMatches.length) setAwaitingDrink(false);

    // Policy 6: finish only after higher-priority mutations and context actions.
    if (isDone(clean)) {
      if (!cart.length) ai('I’m ready when you are. Try “2 jollof and 1 fried rice” or “jollof with Fanta and plantain.”');
      else ai('Perfect. Would you like this for delivery or pickup?', ['Delivery', 'Pickup']);
      return;
    }

    if (/\bdelivery\b/i.test(clean)) { setDelivery('delivery'); setStage('details'); ai('Delivery it is. I’ll need your name, phone number and delivery address next.'); return; }
    if (/\bpickup\b/i.test(clean)) { setDelivery('pickup'); setStage('details'); ai('Pickup it is. I’ll just need your name and phone number to attach to the order.'); return; }

    if (isMenuQuestion(clean)) {
      ai(`${menuSummaryByCategory()}. Every rice or spaghetti meal comes with one fried chicken and one bottled water. Fried chicken, grilled fish, beef and plantain are available as extras; drinks are separate.`);
      return;
    }
    if (isGreeting(clean)) { ai('Hey there. Tell me what you’d like, or ask “what do you have?” to see the menu.'); return; }

    // Policy 7: normal order/add flow.
    if (matches.length) {
      matches.forEach(item => add(item, quantityFor(textForMatching, item)));
      const parts = matches.map(item => `${quantityFor(textForMatching, item)}× ${item.name}`);
      const hasMain = matches.some(i => i.category === 'Mains');
      const included = hasMain ? ' Each main already includes one fried chicken and one bottled water.' : '';
      ai(`Got it — I've added ${parts.join(', ')}.${included} Anything else?`, ADDON_CHIPS);
      return;
    }

    if (/shawarma|pizza|burger|swallow|soup|fries|coleslaw|moi\s*moi|suya/i.test(normalized)) {
      ai('Sorry, that isn’t on our current menu. We’re keeping this menu focused on rice meals, spaghetti, four extras and drinks.');
      return;
    }

    ai('I didn’t quite catch that. Try “2 jollof and 1 fried rice”, “add plantain”, “make the plantain 2”, or “Coke instead of Fanta”.');
  };

  const submit = (e?: FormEvent) => { e?.preventDefault(); const text = input.trim(); if (!text) return; user(text); setInput(''); setTyping(true); setTimeout(() => process(text), 300); };
  const choose = (value: string) => { user(value); setTyping(true); setTimeout(() => process(value), 220); };
  const nameValid = isValidName(name); const phoneValid = isValidPhone(phone); const addressValid = delivery === 'pickup' || isValidAddress(address); const detailsReady = nameValid && phoneValid && addressValid;
  const continueDetails = () => { setTouched(true); if (!detailsReady) return; setStage('payment'); ai(`Thanks, ${name}. Your order is ${delivery === 'delivery' ? 'going to ' + address : 'for pickup'}. Ready to review and pay?`); };
  const pay = () => { setPaying(true); setTimeout(() => { setPaying(false); setStage('tracking'); setStatus(1); ai('Payment confirmed. Your order is now with the kitchen. I’ll keep you posted here.'); setTimeout(() => setStatus(2), 1800); setTimeout(() => setStatus(3), 4200); }, 700); };

  return <main className="min-h-screen p-3 sm:p-6" style={{ background: 'radial-gradient(circle at 15% 0%, #2c1f16 0%, var(--cocoa) 55%)' }}>
    <div className="mx-auto flex min-h-[calc(100vh-24px)] max-w-6xl flex-col gap-4 lg:flex-row">
      <section className="flex min-h-[680px] flex-1 flex-col overflow-hidden rounded-[28px] border" style={{ background: 'var(--parchment)', borderColor: 'rgba(36,25,18,0.12)', color: '#241912' }}>
        <header className="px-6 py-5" style={{ borderBottom: '1px solid rgba(36,25,18,0.1)' }}><div className="text-xl font-semibold">Iya Anike&rsquo;s Kitchen</div><div className="mt-0.5 flex items-center gap-1.5 text-xs" style={{ color: 'var(--basil)' }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--basil)' }} /> Maya is taking orders</div></header>
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
          {messages.map(m => <div key={m.id} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`flex max-w-[88%] flex-col ${m.from === 'user' ? 'items-end' : 'items-start'}`}><div className="rounded-2xl px-4 py-3 text-sm leading-6" style={m.from === 'user' ? { background: 'var(--pepper)', color: '#FBEFE6', borderBottomRightRadius: 4 } : { background: '#FFFFFF', color: '#241912', border: '1px solid rgba(36,25,18,0.08)', borderBottomLeftRadius: 4 }}>{m.text}</div>{m.chips && <div className="mt-2 flex flex-wrap gap-2">{m.chips.map(c => <button key={c} onClick={() => choose(c)} className="rounded-full px-3 py-1.5 text-xs transition hover:opacity-80" style={{ background: 'rgba(174,49,28,0.08)', color: 'var(--pepper)', border: '1px solid rgba(174,49,28,0.25)' }}>{c}</button>)}</div>}</div></div>)}
          {typing && <div className="flex justify-start"><div className="flex items-center gap-1.5 rounded-2xl px-4 py-3" style={{ background: '#FFFFFF', border: '1px solid rgba(36,25,18,0.08)' }}><span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: 'var(--pepper)' }} /><span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: 'var(--pepper)', animationDelay: '100ms' }} /><span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: 'var(--pepper)', animationDelay: '200ms' }} /></div></div>}
        </div>
        {stage === 'chat' && <form onSubmit={submit} className="flex items-center gap-2 border-t p-4" style={{ borderColor: 'rgba(36,25,18,0.1)' }}><input value={input} onChange={e => setInput(e.target.value)} placeholder="Tell Maya what you'd like..." className="min-w-0 flex-1 rounded-2xl border bg-white px-4 py-3 text-sm outline-none" /><button className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white" style={{ background: 'var(--pepper)' }}><Send size={17} /></button></form>}
        {stage === 'details' && <div className="border-t p-5" style={{ borderColor: 'rgba(36,25,18,0.1)' }}><div className="grid gap-3 sm:grid-cols-2"><input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" className="rounded-xl border bg-white px-4 py-3 text-sm" /><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number" className="rounded-xl border bg-white px-4 py-3 text-sm" /></div>{delivery === 'delivery' && <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Delivery address" className="mt-3 w-full rounded-xl border bg-white px-4 py-3 text-sm" />}{touched && !detailsReady && <p className="mt-2 text-xs text-red-700">Please provide valid {delivery === 'pickup' ? 'name and phone number.' : 'name, phone number and address.'}</p>}<button onClick={continueDetails} className="mt-4 w-full rounded-xl px-4 py-3 text-sm font-medium text-white" style={{ background: 'var(--pepper)' }}>Continue</button></div>}
        {stage === 'payment' && <div className="border-t p-5" style={{ borderColor: 'rgba(36,25,18,0.1)' }}><div className="rounded-2xl bg-white p-4 text-sm"><div className="flex justify-between"><span>Order total</span><strong>{money(total)}</strong></div><div className="mt-2 text-xs" style={{ color: '#8A7960' }}>{delivery === 'delivery' ? 'Delivery' : 'Pickup'} · {name}</div></div><button onClick={pay} disabled={paying} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white disabled:opacity-60" style={{ background: 'var(--pepper)' }}>{paying ? 'Processing...' : 'Pay now'}</button></div>}
        {stage === 'tracking' && <div className="border-t p-5" style={{ borderColor: 'rgba(36,25,18,0.1)' }}><div className="rounded-2xl bg-white p-4 text-sm"><div className="font-medium">Order received</div><div className="mt-1 text-xs" style={{ color: '#8A7960' }}>{status >= 3 ? 'Ready for collection / on the way' : status >= 2 ? 'Order is being prepared' : 'Order received by the kitchen'}</div></div></div>}
      </section>
      <aside className="w-full rounded-[28px] border p-5 lg:w-80" style={{ background: 'rgba(255,250,244,0.96)', borderColor: 'rgba(36,25,18,0.12)', color: '#241912' }}>
        <div className="mb-5 flex items-center justify-between"><div className="flex items-center gap-2 font-medium"><UtensilsCrossed size={17} /> Current order</div><span className="text-xs" style={{ color: '#8A7960' }}>{count} item{count === 1 ? '' : 's'}</span></div>
        {cart.length ? <div className="space-y-3">{cart.map(item => <div key={item.id} className="rounded-2xl border bg-white p-3"><div className="flex justify-between gap-3 text-sm"><span>{item.name}</span><span className="whitespace-nowrap">{money(item.price * item.qty)}</span></div><div className="mt-2 flex items-center justify-between"><div className="flex items-center gap-2"><button onClick={() => change(item.id, -1)} className="grid h-7 w-7 place-items-center rounded-full border"><Minus size={13} /></button><span className="text-xs">{item.qty}</span><button onClick={() => change(item.id, 1)} className="grid h-7 w-7 place-items-center rounded-full border"><Plus size={13} /></button></div><span className="text-[11px]" style={{ color: '#8A7960' }}>{item.category}</span></div>{item.category === 'Mains' && <div className="mt-2 text-[11px]" style={{ color: '#8A7960' }}>Includes {item.qty} fried chicken + {item.qty} bottled water</div>}</div>)}<div className="border-t pt-4"><div className="flex justify-between text-sm"><span>Total</span><strong>{money(total)}</strong></div></div></div> : <div className="rounded-2xl border border-dashed p-5 text-center text-sm" style={{ color: '#8A7960' }}>Your order is empty.</div>}
        <div className="mt-6 border-t pt-5">{STAGES.map((s, i) => <div key={s.key} className="flex items-center gap-3 py-2 text-xs"><div className="grid h-7 w-7 place-items-center rounded-full" style={{ background: i <= stageIndex ? 'var(--pepper)' : '#eee6dd', color: i <= stageIndex ? '#fff' : '#8A7960' }}>{i < stageIndex ? <Check size={13} /> : i + 1}</div><span style={{ color: i <= stageIndex ? '#241912' : '#8A7960' }}>{s.label}</span></div>)}</div>
        {stage === 'tracking' && <div className="mt-5 rounded-2xl p-4" style={{ background: '#fff', border: '1px solid rgba(36,25,18,0.08)' }}><div className="flex items-center gap-2 text-sm font-medium"><Truck size={16} /> Order tracking</div><div className="mt-3 text-xs" style={{ color: '#8A7960' }}>{status >= 3 ? 'Ready for collection / on the way' : status >= 2 ? 'Order is being prepared' : 'Order received by the kitchen'}</div></div>}
      </aside>
    </div>
  </main>;
}
