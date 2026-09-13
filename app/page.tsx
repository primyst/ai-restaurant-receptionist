'use client';

import { FormEvent, useMemo, useState } from 'react';
import { Check, Minus, Plus, Send, Truck, UtensilsCrossed } from 'lucide-react';
import { findMenuMatches, isGreeting, isMenuQuestion, isValidAddress, isValidName, isValidPhone, menu, menuSummaryByCategory, type MenuItem } from '../lib/menu';

type CartItem = MenuItem & { qty: number };
type Message = { id: number; from: 'ai' | 'user'; text: string; chips?: string[] };
type Stage = 'chat' | 'details' | 'payment' | 'tracking';
const money = (n: number) => `₦${n.toLocaleString()}`;
const drinks = menu.filter(i => i.category === 'Drinks');
const DRINK_CHIPS = drinks.map(i => i.name);
const ADDON_CHIPS = ['Choose a drink', 'Add plantain', 'That’s all'];
const initialMessages: Message[] = [{ id: 1, from: 'ai', text: "Welcome to Iya Anike's Kitchen. I'm Maya — tell me what you'd like and I'll get it sorted." }];
const STAGES = [{ key: 'chat' as Stage, label: 'Order' }, { key: 'details' as Stage, label: 'Details' }, { key: 'payment' as Stage, label: 'Payment' }, { key: 'tracking' as Stage, label: 'Tracking' }];

const numberWords: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const quantityFor = (raw: string, item: MenuItem) => {
  const text = raw.toLowerCase();
  for (const alias of item.aliases) {
    const escaped = alias.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const numeric = text.match(new RegExp(`(?:^|\\s)(\\d+)\\s*(?:x|×)?\\s*(?:plates?|pieces?|bottles?|servings?)?\\s*${escaped}(?=\\s|$)`));
    if (numeric) return Math.max(1, Number(numeric[1]));
    const word = text.match(new RegExp(`(?:^|\\s)(one|two|three|four|five|six|seven|eight|nine|ten)\\s*(?:x|×)?\\s*(?:plates?|pieces?|bottles?|servings?)?\\s*${escaped}(?=\\s|$)`));
    if (word) return numberWords[word[1]];
  }
  return 1;
};
const findItem = (text: string, category?: MenuItem['category']) => findMenuMatches(text).find(i => !category || i.category === category);
const isCancel = (text: string) => /^(cancel|cancel order|start over|reset|never\s*mind|forget it)\b/i.test(text.trim());
const isDone = (text: string) => /^(that'?s all|thats all|all|done|ready|finish|finished|checkout|no|nothing else)$/i.test(text.trim());
const stripFiller = (text: string) => text.replace(/\b(wait|actually|please|just|then|instead|anymore|i\s+don't\s+want|i\s+do\s+not\s+want)\b/gi, ' ').replace(/\s+/g, ' ').trim();

export default function Home() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [stage, setStage] = useState<Stage>('chat');
  const [delivery, setDelivery] = useState<'delivery' | 'pickup' | null>(null);
  const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [address, setAddress] = useState('');
  const [touched, setTouched] = useState(false); const [status, setStatus] = useState(0); const [typing, setTyping] = useState(false); const [paying, setPaying] = useState(false);
  const [pendingSwallow, setPendingSwallow] = useState<MenuItem | null>(null); const [pendingSoup, setPendingSoup] = useState<MenuItem | null>(null); const [choosingDrink, setChoosingDrink] = useState(false);
  const total = useMemo(() => cart.reduce((sum, i) => sum + i.price * i.qty, 0), [cart]);
  const count = cart.reduce((sum, i) => sum + i.qty, 0);
  const stageIndex = STAGES.findIndex(s => s.key === stage);
  const add = (item: MenuItem, qty = 1) => setCart(c => { const found = c.find(i => i.id === item.id); return found ? c.map(i => i.id === item.id ? { ...i, qty: i.qty + qty } : i) : [...c, { ...item, qty }]; });
  const change = (id: string, delta: number) => setCart(c => c.map(i => i.id === id ? { ...i, qty: i.qty + delta } : i).filter(i => i.qty > 0));
  const ai = (text: string, chips?: string[]) => { setTyping(false); setMessages(m => [...m, { id: Date.now() + Math.random(), from: 'ai', text, chips }]); };
  const user = (text: string) => setMessages(m => [...m, { id: Date.now() + Math.random(), from: 'user', text }]);
  const finishSwallow = (base: MenuItem, soup: MenuItem, protein: MenuItem, qty = 1) => { const meal: MenuItem = { ...base, id: `${base.id}-${soup.id}-${protein.id}`, name: `${base.name} + ${soup.name} + ${protein.name}`, aliases: [] }; add(meal, qty); setPendingSwallow(null); setPendingSoup(null); ai(`Got it — ${qty}× ${meal.name} is added. The swallow package is ${money(base.price)} each. Anything else?`, ADDON_CHIPS); };

  const process = (raw: string) => {
    const clean = raw.trim();
    if (isCancel(clean)) { const hadOrder = cart.length || pendingSwallow; setCart([]); setPendingSwallow(null); setPendingSoup(null); setChoosingDrink(false); ai(hadOrder ? 'No problem, I’ve cleared that order. Let me know whenever you’re ready to start again.' : 'There’s nothing to cancel yet — you haven’t started an order. What would you like?'); return; }
    if (clean === 'Choose a drink' || /^(add|choose|i want|give me)\s+(a\s+)?drink$/i.test(clean)) { setChoosingDrink(true); ai('Sure. Which drink would you like?', DRINK_CHIPS); return; }
    const remove = clean.match(/^(remove|delete|take out|drop)\s+(.+)/i);
    if (remove) { const target = findMenuMatches(remove[2]); const ids = target.map(i => i.id); if (!ids.length) { ai('Which item would you like me to remove?'); return; } const present = cart.filter(i => ids.includes(i.id)); if (!present.length) ai(`${target.map(i => i.name).join(', ')} isn't in your order right now.`); else { setCart(c => c.filter(i => !ids.includes(i.id))); ai(`Removed ${present.map(i => i.name).join(', ')}. Anything else?`, ADDON_CHIPS); } return; }
    if (isDone(clean)) { if (!cart.length) ai('I’m ready when you are. Try “2 jollof and a Fanta” or “pounded yam with egusi and beef.”'); else ai('Perfect. Would you like this for delivery or pickup?', ['Delivery', 'Pickup']); return; }
    if (/\bdelivery\b/i.test(clean)) { setDelivery('delivery'); setStage('details'); ai('Delivery it is. I’ll need your name, phone number and delivery address next.'); return; }
    if (/\bpickup\b/i.test(clean)) { setDelivery('pickup'); setStage('details'); ai('Pickup it is. I’ll just need your name and phone number to attach to the order.'); return; }
    if (choosingDrink) { const drink = findItem(clean, 'Drinks'); if (drink) { add(drink, quantityFor(clean, drink)); setChoosingDrink(false); ai(`Added ${drink.name}. Anything else?`, ADDON_CHIPS); } else ai('Which drink would you like?', DRINK_CHIPS); return; }

    const dontWant = clean.match(/(?:i\s+)?(?:don'?t|do\s+not)\s+want\s+(.+?)(?:\s+anymore)?$/i);
    if (dontWant) { const targets = findMenuMatches(dontWant[1]); if (targets.length) { const ids = targets.map(i => i.id); setCart(c => c.filter(i => !ids.includes(i.id))); ai(`Removed ${targets.map(i => i.name).join(', ')} from your order. Anything else?`, ADDON_CHIPS); } return; }
    const makeOne = clean.match(/make\s+(?:the\s+)?(.+?)\s+(?:just\s+)?one\b/i);
    if (makeOne) { const targets = findMenuMatches(makeOne[1]); if (targets.length) { const ids = targets.map(i => i.id); setCart(c => c.map(i => ids.includes(i.id) ? { ...i, qty: 1 } : i)); ai(`Done — ${targets.map(i => i.name).join(', ')} is now 1×. Anything else?`, ADDON_CHIPS); return; } }
    const textForMatching = stripFiller(clean);
    const matches = findMenuMatches(textForMatching);
    const swallow = matches.find(i => i.category === 'Swallows'); const soup = matches.find(i => i.category === 'Soups'); const protein = matches.find(i => i.category === 'Proteins');
    if (pendingSwallow) {
      const selectedSoup = soup || pendingSoup;
      if (!selectedSoup) { ai(`Which soup would you like with the ${pendingSwallow.name}?`, ['Egusi', 'Efo Riro', 'Ogbono', 'Okro']); return; }
      if (!protein) { setPendingSoup(selectedSoup); ai(`${selectedSoup.name} it is. Which protein would you like with it? One protein is included.`, ['Chicken', 'Beef', 'Fish']); return; }
      finishSwallow(pendingSwallow, selectedSoup, protein, quantityFor(textForMatching, pendingSwallow)); return;
    }
    if (swallow) { const qty = quantityFor(textForMatching, swallow); if (!soup) { setPendingSwallow(swallow); ai(`${swallow.name} it is. Which soup would you like?`, ['Egusi', 'Efo Riro', 'Ogbono', 'Okro']); return; } if (!protein) { setPendingSwallow(swallow); setPendingSoup(soup); ai(`${soup.name} it is. Which protein would you like? One protein is included.`, ['Chicken', 'Beef', 'Fish']); return; } finishSwallow(swallow, soup, protein, qty); return; }
    if (soup) { ai('Our soups are paired with a swallow package. Which would you like — pounded yam, eba or amala?', ['Pounded Yam', 'Eba', 'Amala']); return; }
    if (matches.length) {
      const addable = matches.filter(i => i.kind !== 'option'); addable.forEach(item => add(item, quantityFor(textForMatching, item)));
      const added = addable.map(item => `${quantityFor(textForMatching, item)}× ${item.name}`).join(', ');
      const hasRice = addable.some(i => i.category === 'Mains'); const note = hasRice ? ' Rice meals already include chicken; extra chicken is separate.' : '';
      ai(`Got it — I've added ${added}.${note} Anything else?`, ADDON_CHIPS); return;
    }
    if (isGreeting(clean)) { ai('Hey there. Tell me what you’d like, or ask “what do you have?” to see how the menu works.'); return; }
    if (isMenuQuestion(clean)) { ai(`We have ${menuSummaryByCategory()}. Rice meals come with chicken. Swallow packages include one soup and one protein. Sides, extra proteins and drinks are add-ons.`); return; }
    if (/shawarma|pizza|burger/i.test(clean)) { ai('Sorry, we don’t currently have that on the menu. We have rice meals, swallows, sides, proteins and drinks.'); return; }
    ai('Sorry, I didn’t quite catch an order. Try “jollof and Fanta”, “2 jollof and 1 fried rice”, or “amala with efo and beef.”');
  };

  const submit = (e?: FormEvent) => { e?.preventDefault(); const text = input.trim(); if (!text) return; user(text); setInput(''); setTyping(true); setTimeout(() => process(text), 450); };
  const choose = (value: string) => { user(value); setTyping(true); setTimeout(() => process(value), 350); };
  const nameValid = isValidName(name); const phoneValid = isValidPhone(phone); const addressValid = delivery === 'pickup' || isValidAddress(address); const detailsReady = nameValid && phoneValid && addressValid;
  const continueDetails = () => { setTouched(true); if (!detailsReady) return; setStage('payment'); ai(`Thanks, ${name}. Your order is ${delivery === 'delivery' ? 'going to ' + address : 'for pickup'}. Ready to review and pay?`); };
  const pay = () => { setPaying(true); setTimeout(() => { setPaying(false); if (Math.random() < 0.12) { ai('Hmm, that payment didn’t go through on our end. No charge was made — want to try again?'); return; } setStage('tracking'); setStatus(1); ai('Payment confirmed. Your order is now with the kitchen. I’ll keep you posted here.'); setTimeout(() => setStatus(2), 1800); setTimeout(() => setStatus(3), 4200); }, 900); };

  return <main className="min-h-screen p-3 sm:p-6" style={{ background: 'radial-gradient(circle at 15% 0%, #2c1f16 0%, var(--cocoa) 55%)' }}><div className="mx-auto flex min-h-[calc(100vh-24px)] max-w-6xl flex-col gap-4 lg:flex-row">
    <section className="flex min-h-[680px] flex-1 flex-col overflow-hidden rounded-[28px] border" style={{ background: 'var(--parchment)', borderColor: 'rgba(36,25,18,0.12)', color: '#241912' }}>
      <header className="px-6 py-5" style={{ borderBottom: '1px solid rgba(36,25,18,0.1)' }}><div className="text-xl font-semibold">Iya Anike&rsquo;s Kitchen</div><div className="mt-0.5 flex items-center gap-1.5 text-xs" style={{ color: 'var(--basil)' }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--basil)' }} /> Maya is taking orders</div></header>
      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
        {messages.map(m => <div key={m.id} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`flex max-w-[88%] flex-col ${m.from === 'user' ? 'items-end' : 'items-start'}`}><div className="rounded-2xl px-4 py-3 text-sm leading-6" style={m.from === 'user' ? { background: 'var(--pepper)', color: '#FBEFE6', borderBottomRightRadius: 4 } : { background: '#FFFFFF', color: '#241912', border: '1px solid rgba(36,25,18,0.08)', borderBottomLeftRadius: 4 }}>{m.text}</div>{m.chips && <div className="mt-2 flex flex-wrap gap-2">{m.chips.map(c => <button key={c} onClick={() => choose(c)} className="rounded-full px-3 py-1.5 text-xs transition hover:opacity-80" style={{ background: 'rgba(174,49,28,0.08)', color: 'var(--pepper)', border: '1px solid rgba(174,49,28,0.25)' }}>{c}</button>)}</div>}</div></div>)}
        {typing && <div className="flex justify-start"><div className="flex items-center gap-1.5 rounded-2xl px-4 py-3" style={{ background: '#FFFFFF', border: '1px solid rgba(36,25,18,0.08)' }}><span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: '#9C8B75' }} /><span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: '#9C8B75' }} /><span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: '#9C8B75' }} /></div></div>}
        {stage === 'details' && <div className="ml-auto max-w-sm rounded-2xl p-4" style={{ background: '#FFFFFF', border: '1px solid rgba(36,25,18,0.08)' }}><div className="mb-3 text-xs font-medium" style={{ color: '#8A7960' }}>Your details</div><div className="grid gap-2.5"><input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none" /><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number" className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none" />{delivery === 'delivery' && <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Delivery address" className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none" />}<button onClick={continueDetails} className="rounded-xl px-4 py-2.5 text-sm font-medium" style={{ background: 'var(--pepper)', color: '#fff' }}>Continue</button>{touched && !detailsReady && <div className="text-xs text-red-700">Please enter valid details before continuing.</div>}</div></div>}
        {stage === 'payment' && <div className="ml-auto max-w-sm rounded-2xl p-4" style={{ background: '#FFFFFF', border: '1px solid rgba(36,25,18,0.08)' }}><div className="mb-2 text-xs font-medium" style={{ color: '#8A7960' }}>Order total</div><div className="text-2xl font-semibold">{money(total)}</div><button onClick={pay} disabled={paying} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium disabled:opacity-60" style={{ background: 'var(--pepper)', color: '#fff' }}>{paying ? 'Processing…' : 'Pay now'}</button></div>}
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t p-4" style={{ borderColor: 'rgba(36,25,18,0.1)' }}><input value={input} onChange={e => setInput(e.target.value)} disabled={stage !== 'chat'} placeholder={stage === 'chat' ? 'Tell Maya what you want…' : 'Complete the panel above…'} className="min-w-0 flex-1 rounded-2xl border bg-white px-4 py-3 text-sm outline-none disabled:opacity-50" /><button disabled={stage !== 'chat' || !input.trim()} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl disabled:opacity-40" style={{ background: 'var(--pepper)', color: '#fff' }}><Send size={17} /></button></form>
    </section>
    <aside className="w-full rounded-[28px] border p-5 lg:w-80" style={{ background: 'rgba(255,250,244,0.96)', borderColor: 'rgba(36,25,18,0.12)', color: '#241912' }}><div className="mb-5 flex items-center justify-between"><div className="flex items-center gap-2 font-medium"><UtensilsCrossed size={17} /> Current order</div><span className="text-xs" style={{ color: '#8A7960' }}>{count} item{count === 1 ? '' : 's'}</span></div>{cart.length ? <div className="space-y-3">{cart.map(item => <div key={item.id} className="rounded-2xl border bg-white p-3"><div className="flex justify-between gap-3 text-sm"><span>{item.name}</span><span className="whitespace-nowrap">{money(item.price * item.qty)}</span></div><div className="mt-2 flex items-center justify-between"><div className="flex items-center gap-2"><button onClick={() => change(item.id, -1)} className="grid h-7 w-7 place-items-center rounded-full border"><Minus size={13} /></button><span className="text-xs">{item.qty}</span><button onClick={() => change(item.id, 1)} className="grid h-7 w-7 place-items-center rounded-full border"><Plus size={13} /></button></div><span className="text-[11px]" style={{ color: '#8A7960' }}>{item.category}</span></div></div>)}<div className="border-t pt-4"><div className="flex justify-between text-sm"><span>Total</span><strong>{money(total)}</strong></div></div></div> : <div className="rounded-2xl border border-dashed p-5 text-center text-sm" style={{ color: '#8A7960' }}>Your order is empty.</div>}<div className="mt-6 border-t pt-5">{STAGES.map((s, i) => <div key={s.key} className="flex items-center gap-3 py-2 text-xs"><div className="grid h-7 w-7 place-items-center rounded-full" style={{ background: i <= stageIndex ? 'var(--pepper)' : '#eee6dd', color: i <= stageIndex ? '#fff' : '#8A7960' }}>{i < stageIndex ? <Check size={13} /> : i + 1}</div><span style={{ color: i <= stageIndex ? '#241912' : '#8A7960' }}>{s.label}</span></div>)}</div>{stage === 'tracking' && <div className="mt-5 rounded-2xl p-4" style={{ background: '#fff', border: '1px solid rgba(36,25,18,0.08)' }}><div className="flex items-center gap-2 text-sm font-medium"><Truck size={16} /> Order tracking</div><div className="mt-3 text-xs" style={{ color: '#8A7960' }}>{status >= 3 ? 'Ready for collection / on the way' : status >= 2 ? 'Order is being prepared' : 'Order received by the kitchen'}</div></div>}</aside>
  </div></main>;
}
