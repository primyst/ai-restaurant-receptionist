'use client';

import { FormEvent, useMemo, useState } from 'react';
import { Check, ChevronRight, Minus, Plus, Send, Truck, UtensilsCrossed } from 'lucide-react';
import { findMenuMatches, findUnavailableWords, isGreeting, isMenuQuestion, isValidAddress, isValidName, isValidPhone, menu, menuSummaryByCategory, type MenuItem } from '../lib/menu';

type CartItem = MenuItem & { qty: number };
type Message = { id: number; from: 'ai' | 'user'; text: string; chips?: string[] };
type Stage = 'chat' | 'details' | 'payment' | 'tracking';
const money = (n: number) => `₦${n.toLocaleString()}`;
const initialMessages: Message[] = [{ id: 1, from: 'ai', text: "Welcome to Iya Anike's Kitchen. I'm Maya — tell me what you'd like and I'll get it sorted." }];
const STAGES: { key: Stage; label: string }[] = [{ key: 'chat', label: 'Order' }, { key: 'details', label: 'Details' }, { key: 'payment', label: 'Payment' }, { key: 'tracking', label: 'Tracking' }];

const quantityFor = (raw: string, item: MenuItem) => {
  const text = raw.toLowerCase();
  for (const alias of item.aliases) {
    const escaped = alias.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = text.match(new RegExp(`(\\d+)\\s*(?:x|×)?\\s*(?:plates?|pieces?|bottles?|servings?)?\\s*${escaped}(?=\\s|$)`));
    if (match) return Math.max(1, Number(match[1]));
  }
  return 1;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [stage, setStage] = useState<Stage>('chat');
  const [delivery, setDelivery] = useState<'delivery' | 'pickup' | null>(null);
  const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [address, setAddress] = useState('');
  const [touched, setTouched] = useState(false); const [status, setStatus] = useState(0); const [typing, setTyping] = useState(false); const [paying, setPaying] = useState(false);
  const [pendingSwallow, setPendingSwallow] = useState<MenuItem | null>(null); const [pendingSoup, setPendingSoup] = useState<MenuItem | null>(null);
  const total = useMemo(() => cart.reduce((sum, i) => sum + i.price * i.qty, 0), [cart]);
  const count = cart.reduce((sum, i) => sum + i.qty, 0); const stageIndex = STAGES.findIndex(s => s.key === stage);
  const add = (item: MenuItem, qty = 1) => setCart(c => { const found = c.find(i => i.id === item.id); return found ? c.map(i => i.id === item.id ? { ...i, qty: i.qty + qty } : i) : [...c, { ...item, qty }]; });
  const change = (id: string, delta: number) => setCart(c => c.map(i => i.id === id ? { ...i, qty: i.qty + delta } : i).filter(i => i.qty > 0));
  const ai = (text: string, chips?: string[]) => { setTyping(false); setMessages(m => [...m, { id: Date.now() + Math.random(), from: 'ai', text, chips }]); };
  const user = (text: string) => setMessages(m => [...m, { id: Date.now() + Math.random(), from: 'user', text }]);

  const finishSwallow = (base: MenuItem, soup: MenuItem, protein: MenuItem, qty: number) => {
    const meal: MenuItem = { ...base, id: `${base.id}-${soup.id}-${protein.id}`, name: `${base.name} + ${soup.name} + ${protein.name}`, aliases: [] };
    add(meal, qty); setPendingSwallow(null); setPendingSoup(null);
    ai(`Got it — ${qty}× ${meal.name} is added. The swallow package is ${money(base.price)} each. Anything else?`, ['Add a drink', 'Add plantain', 'That’s all']);
  };

  const handleOrder = (text: string) => {
    const matches = findMenuMatches(text); const swallow = matches.find(i => i.category === 'Swallows'); const soup = matches.find(i => i.category === 'Soups'); const protein = matches.find(i => i.category === 'Proteins');
    const qty = swallow ? quantityFor(text, swallow) : 1;
    if (pendingSwallow) {
      const selectedSoup = soup || pendingSoup;
      if (!selectedSoup) { ai(`Which soup would you like with the ${pendingSwallow.name}?`, ['Egusi', 'Efo Riro', 'Ogbono', 'Okro']); return true; }
      if (!protein) { setPendingSoup(selectedSoup); ai(`${selectedSoup.name} it is. Which protein would you like with it? One protein is included in the swallow package.`, ['Chicken', 'Beef', 'Fish']); return true; }
      finishSwallow(pendingSwallow, selectedSoup, protein, qty); return true;
    }
    if (swallow) {
      if (!soup) { setPendingSwallow(swallow); ai(`${swallow.name} it is. Which soup would you like?`, ['Egusi', 'Efo Riro', 'Ogbono', 'Okro']); return true; }
      if (!protein) { setPendingSwallow(swallow); setPendingSoup(soup); ai(`${soup.name} it is. Which protein would you like? One protein is included in the swallow package.`, ['Chicken', 'Beef', 'Fish']); return true; }
      finishSwallow(swallow, soup, protein, qty); return true;
    }
    return false;
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault(); const text = input.trim(); if (!text) return; user(text); setInput(''); setTyping(true);
    const { matches, unavailable } = { matches: findMenuMatches(text), unavailable: findUnavailableWords(text, findMenuMatches(text)) };
    setTimeout(() => {
      if (stage !== 'chat') { setTyping(false); return; }
      const clean = text.trim(); const isDone = /^(that'?s all|thats all|all|done|ready|finish|finished|checkout)$/i.test(clean) || /^(that's all|thats all|i'?m done|im done)/i.test(clean); const isCancel = /^(cancel|cancel order|start over|reset|never\s*mind|forget it)\b/i.test(clean); const removeMatch = clean.match(/^(remove|delete|take out|drop)\s+(.*)/i);
      if (isCancel) { setCart([]); setPendingSwallow(null); setPendingSoup(null); ai(cart.length ? 'No problem, I’ve cleared that order. Let me know whenever you’re ready to start again.' : 'There’s nothing to cancel yet — you haven’t started an order. What would you like?'); return; }
      if (removeMatch) { const toRemove = findMenuMatches(removeMatch[2]); const stillInCart = toRemove.filter(item => cart.some(c => c.id === item.id)); if (!stillInCart.length) ai(toRemove.length ? `${toRemove.map(i => i.name).join(', ')} isn't in your order right now.` : 'I couldn’t tell which item to remove — try “remove suya”.'); else { setCart(c => c.filter(i => !stillInCart.some(r => r.id === i.id))); ai(`Removed ${stillInCart.map(i => i.name).join(', ')}. Anything else?`); } return; }
      if (handleOrder(clean)) return;
      if (matches.some(i => i.category === 'Soups') && !matches.some(i => i.category === 'Swallows')) { ai('Our soups are paired with a swallow package. Which would you like — pounded yam, eba or amala?'); return; }
      if (matches.length) {
        const addable = matches.filter(item => item.kind !== 'option'); addable.forEach(item => add(item, quantityFor(clean, item))); const added = addable.map(item => `${quantityFor(clean, item)}× ${item.name}`).join(', ');
        const unavailableNote = unavailable.length ? ` I couldn't find ${unavailable.join(', ')} on this menu right now.` : '';
        ai(`Got it — I've added ${added}.${unavailableNote} Rice meals already include chicken; extras and drinks are separate. Anything else?`, ['Add a drink', 'Add plantain', 'That’s all']);
      } else if (isDone) { if (!cart.length) ai('I’m ready when you are. Try “2 jollof and a Fanta” or “pounded yam with egusi and beef.”'); else ai('Perfect. Would you like this for delivery or pickup?', ['Delivery', 'Pickup']); }
      else if (/\bdelivery\b/i.test(clean)) { setDelivery('delivery'); setStage('details'); ai('Delivery it is. I’ll need your name, phone number and delivery address next.'); }
      else if (/\bpickup\b/i.test(clean)) { setDelivery('pickup'); setStage('details'); ai('Pickup it is. I’ll just need your name and phone number to attach to the order.'); }
      else if (isGreeting(clean)) ai('Hey there. Tell me what you’d like, or ask “what do you have?” to see how the menu works.');
      else if (isMenuQuestion(clean)) ai(`For the main meals: ${menuSummaryByCategory()}. Rice meals come with chicken. For swallows, choose your swallow, soup and protein. Plantain, extra protein and drinks are add-ons.`);
      else if (!unavailable.length) ai('Sorry, I didn’t quite catch an order. Try “jollof and Fanta” or “amala with efo and beef.”');
      else ai(`Sorry, we don’t currently have ${unavailable.join(', ')} on the menu. Try jollof, fried rice, pounded yam, eba, amala, plantain, or one of our drinks.`);
    }, 550);
  };

  const choose = (value: string) => {
    user(value); setTyping(true); setTimeout(() => {
      const match = findMenuMatches(value)[0];
      if (value === 'Delivery' || value === 'Pickup') { setDelivery(value.toLowerCase() as 'delivery' | 'pickup'); setStage('details'); ai(value === 'Delivery' ? 'Delivery it is. I’ll need your name, phone number and address.' : 'Pickup it is. I’ll need your name and phone number.'); }
      else if (value === 'That’s all') ai('Perfect. Would you like this for delivery or pickup?', ['Delivery', 'Pickup']);
      else if (value === 'Add a drink') { add(menu.find(i => i.id === 'fanta')!); ai('Added a Fanta. Anything else?', ['That’s all']); }
      else if (value === 'Add plantain') { add(menu.find(i => i.id === 'plantain')!); ai('Added fried plantain. Anything else?', ['That’s all']); }
      else if (pendingSwallow && match?.category === 'Soups') { setPendingSoup(match); ai(`${match.name} it is. Which protein would you like? One protein is included.`, ['Chicken', 'Beef', 'Fish']); }
      else if (pendingSwallow && match?.category === 'Proteins') finishSwallow(pendingSwallow, pendingSoup || menu.find(i => i.id === 'egusi')!, match, 1);
      else if (match?.category === 'Swallows') { setPendingSwallow(match); ai(`${match.name} it is. Which soup would you like?`, ['Egusi', 'Efo Riro', 'Ogbono', 'Okro']); }
      else if (match) { add(match); ai(`Added ${match.name}. Anything else?`, ['That’s all']); }
      else ai('Tell me what you’d like and I’ll sort it out.');
    }, 450);
  };

  const nameValid = isValidName(name); const phoneValid = isValidPhone(phone); const addressValid = delivery === 'pickup' || isValidAddress(address); const detailsReady = nameValid && phoneValid && addressValid;
  const continueDetails = () => { setTouched(true); if (!detailsReady) return; setStage('payment'); ai(`Thanks, ${name}. Your order is ${delivery === 'delivery' ? 'going to ' + address : 'for pickup'}. Ready to review and pay?`); };
  const pay = () => { setPaying(true); setTimeout(() => { setPaying(false); if (Math.random() < 0.12) { ai('Hmm, that payment didn’t go through on our end. No charge was made — want to try again?'); return; } setStage('tracking'); setStatus(1); ai('Payment confirmed. Your order is now with the kitchen. I’ll keep you posted here.'); setTimeout(() => setStatus(2), 1800); setTimeout(() => setStatus(3), 4200); }, 900); };

  return <main className="min-h-screen p-3 sm:p-6" style={{ background: 'radial-gradient(circle at 15% 0%, #2c1f16 0%, var(--cocoa) 55%)' }}><div className="mx-auto flex min-h-[calc(100vh-24px)] max-w-6xl flex-col gap-4 lg:flex-row">
    <section className="flex min-h-[680px] flex-1 flex-col overflow-hidden rounded-[28px] border" style={{ background: 'var(--parchment)', borderColor: 'rgba(36,25,18,0.12)', color: '#241912' }}>
      <header className="px-6 py-5" style={{ borderBottom: '1px solid rgba(36,25,18,0.1)' }}><div className="font-display text-xl">Iya Anike&rsquo;s Kitchen</div><div className="mt-0.5 flex items-center gap-1.5 text-xs" style={{ color: 'var(--basil)' }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--basil)' }} /> Maya is taking orders</div></header>
      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
        {messages.map(m => <div key={m.id} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`flex max-w-[85%] flex-col ${m.from === 'user' ? 'items-end' : 'items-start'}`}><div className="rounded-2xl px-4 py-3 text-sm leading-6" style={m.from === 'user' ? { background: 'var(--pepper)', color: '#FBEFE6', borderBottomRightRadius: 4 } : { background: '#FFFFFF', color: '#241912', border: '1px solid rgba(36,25,18,0.08)', borderBottomLeftRadius: 4 }}>{m.text}</div>{m.chips && <div className="mt-2 flex flex-wrap gap-2">{m.chips.map(c => <button key={c} onClick={() => choose(c)} className="rounded-full px-3 py-1.5 text-xs transition hover:opacity-80" style={{ background: 'rgba(174,49,28,0.08)', color: 'var(--pepper)', border: '1px solid rgba(174,49,28,0.25)' }}>{c}</button>)}</div>}</div></div>)}
        {typing && <div className="flex justify-start"><div className="flex items-center gap-1.5 rounded-2xl px-4 py-3" style={{ background: '#FFFFFF', border: '1px solid rgba(36,25,18,0.08)' }}><span className="typing-dot h-1.5 w-1.5 rounded-full" style={{ background: '#9C8B75' }} /><span className="typing-dot h-1.5 w-1.5 rounded-full" style={{ background: '#9C8B75' }} /><span className="typing-dot h-1.5 w-1.5 rounded-full" style={{ background: '#9C8B75' }} /></div></div>}
        {stage === 'details' && <div className="ml-auto max-w-sm rounded-2xl p-4" style={{ background: '#FFFFFF', border: '1px solid rgba(36,25,18,0.08)' }}><div className="mb-3 text-xs font-medium" style={{ color: '#8A7960' }}>Your details</div><div className="grid gap-2.5"><input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={{ background: '#F8F3EA', border: `1px solid ${touched && !nameValid ? 'var(--pepper)' : 'rgba(36,25,18,0.12)'}` }} />{touched && !nameValid && <div className="text-[11px]" style={{ color: 'var(--pepper)' }}>Enter your full name.</div>}<input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number" className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={{ background: '#F8F3EA', border: `1px solid ${touched && !phoneValid ? 'var(--pepper)' : 'rgba(36,25,18,0.12)'}` }} />{touched && !phoneValid && <div className="text-[11px]" style={{ color: 'var(--pepper)' }}>Enter a valid phone number.</div>}{delivery === 'delivery' && <><input value={address} onChange={e => setAddress(e.target.value)} placeholder="Delivery address" className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={{ background: '#F8F3EA', border: `1px solid ${touched && !addressValid ? 'var(--pepper)' : 'rgba(36,25,18,0.12)'}` }} />{touched && !addressValid && <div className="text-[11px]" style={{ color: 'var(--pepper)' }}>Enter a valid delivery address.</div>}</>}<button onClick={continueDetails} className="mt-1 rounded-xl py-2.5 text-sm font-bold" style={{ background: 'var(--pepper)', color: '#FBEFE6' }}>Continue</button></div></div>}
        {stage === 'payment' && <div className="ml-auto max-w-sm rounded-2xl p-4" style={{ background: '#FFFFFF', border: '1px solid rgba(36,25,18,0.08)' }}><div className="mb-3 flex items-center justify-between"><span className="text-xs font-medium" style={{ color: '#8A7960' }}>Order ready</span><span className="text-lg font-semibold" style={{ color: 'var(--pepper)' }}>{money(total)}</span></div><div className="space-y-2 border-y py-3">{cart.map(i => <div key={i.id} className="flex justify-between text-sm"><span>{i.qty}× {i.name}</span><span>{money(i.price * i.qty)}</span></div>)}</div><button onClick={pay} disabled={paying} className="mt-3 w-full rounded-xl py-2.5 text-sm font-bold disabled:opacity-60" style={{ background: 'var(--gold)' }}>{paying ? 'Processing…' : <>Pay {money(total)} <ChevronRight className="ml-1 inline" size={15} /></>}</button><div className="mt-2 text-center text-[10px]" style={{ color: '#A6957C' }}>Demo payment · no card details collected</div></div>}
      </div>
      {stage === 'chat' && <form onSubmit={submit} className="p-4 sm:p-5" style={{ borderTop: '1px solid rgba(36,25,18,0.1)' }}><div className="flex items-center gap-2 rounded-2xl px-2 py-1.5" style={{ background: '#FFFFFF', border: '1px solid rgba(36,25,18,0.12)' }}><input value={input} onChange={e => setInput(e.target.value)} placeholder="Tell Maya what you'd like..." className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none" /><button className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: 'var(--pepper)', color: '#FBEFE6' }}><Send size={16} /></button></div></form>}
    </section>
    <aside className="w-full rounded-[28px] p-5 lg:w-[340px]" style={{ background: 'var(--cocoa-soft)', border: '1px solid var(--cocoa-line)' }}><div className="font-display text-lg" style={{ color: 'var(--parchment)' }}>Order ticket</div><div className="mt-4 flex items-center">{STAGES.map((s, idx) => <div key={s.key} className="flex flex-1 items-center last:flex-none"><div className="flex flex-col items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full" style={{ background: idx <= stageIndex ? 'var(--gold)' : 'rgba(243,232,214,0.18)' }} /><span className="text-[10px]" style={{ color: idx <= stageIndex ? 'var(--parchment)' : 'rgba(243,232,214,0.35)' }}>{s.label}</span></div>{idx < STAGES.length - 1 && <div className="mx-1 h-px flex-1" style={{ background: idx < stageIndex ? 'var(--gold)' : 'rgba(243,232,214,0.12)' }} />}</div>)}</div>
      <div className="relative mt-5 rounded-xl p-4" style={{ background: 'var(--parchment)', color: '#241912' }}><div className="flex items-center justify-between text-xs" style={{ color: '#8A7960' }}><span>{count} item{count === 1 ? '' : 's'}</span><span>Iya Anike&rsquo;s Kitchen</span></div>{cart.length === 0 ? <div className="mt-4 rounded-lg py-6 text-center text-xs" style={{ background: 'rgba(36,25,18,0.04)', color: '#A6957C' }}>Nothing on the ticket yet — order items will show up here as you chat with Maya.</div> : <div className="mt-3 space-y-2.5">{cart.map(i => <div key={i.id} className="flex items-center gap-3"><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{i.name}</div><div className="text-[11px]" style={{ color: '#A6957C' }}>{money(i.price)} each</div></div><div className="flex items-center gap-1 rounded-lg" style={{ border: '1px solid rgba(36,25,18,0.12)' }}><button onClick={() => change(i.id, -1)} className="p-1.5" style={{ color: '#8A7960' }}><Minus size={11} /></button><span className="w-4 text-center text-xs">{i.qty}</span><button onClick={() => change(i.id, 1)} className="p-1.5" style={{ color: '#8A7960' }}><Plus size={11} /></button></div><span className="w-16 text-right text-sm font-medium">{money(i.price * i.qty)}</span></div>)}<div className="flex justify-between border-t border-dashed pt-2 text-sm font-semibold" style={{ borderColor: 'rgba(36,25,18,0.2)', color: 'var(--pepper)' }}><span>Total</span><span>{money(total)}</span></div></div>}</div>
      <div className="mt-5"><div className="mb-3 text-xs" style={{ color: 'rgba(243,232,214,0.55)' }}>Delivery status</div>{[['Order received','We have your request',Check],['Payment confirmed','Transaction verified',Check],['Kitchen preparing','Your food is being made',UtensilsCrossed],['Out for delivery','Rider is on the way',Truck]].map(([label, sub, Icon], idx) => { const IconComp = Icon as typeof Check; return <div key={label as string} className="relative flex gap-3 pb-4 last:pb-0"><div className="relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full" style={idx <= status ? { background: 'var(--gold)', color: '#241912' } : { background: 'transparent', border: '1px solid rgba(243,232,214,0.2)', color: 'rgba(243,232,214,0.3)' }}><IconComp size={11} /></div>{idx < 3 && <div className="absolute left-[11px] top-6 h-full w-px" style={{ background: idx < status ? 'var(--gold)' : 'rgba(243,232,214,0.12)' }} />}<div><div className="text-xs font-medium" style={{ color: idx <= status ? 'var(--parchment)' : 'rgba(243,232,214,0.35)' }}>{label as string}</div><div className="mt-0.5 text-[10px]" style={{ color: 'rgba(243,232,214,0.3)' }}>{sub as string}</div></div></div>; })}</div>
    </aside>
  </div></main>;
}
