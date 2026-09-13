'use client';

import { FormEvent, useMemo, useState } from 'react';
import { Bot, Check, ChevronRight, Clock3, Minus, Plus, Send, ShoppingBag, Sparkles, Truck, UtensilsCrossed } from 'lucide-react';
import {
  findMenuMatches,
  findUnavailableWords,
  isGreeting,
  isMenuQuestion,
  isValidAddress,
  isValidName,
  isValidPhone,
  menu,
  menuSummaryByCategory,
  type MenuItem,
} from '../lib/menu';

type CartItem = MenuItem & { qty: number; option?: string };
type Message = { id: number; from: 'ai' | 'user'; text: string; time?: string; chips?: string[] };
type Stage = 'chat' | 'details' | 'payment' | 'tracking';

const money = (n: number) => `₦${n.toLocaleString()}`;
const initialMessages: Message[] = [{ id: 1, from: 'ai', text: "Hi! I'm Maya, the restaurant's AI receptionist. What can I get started for you today?", time: 'Now' }];

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
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [touched, setTouched] = useState(false);
  const [status, setStatus] = useState(0);

  const total = useMemo(() => cart.reduce((sum, i) => sum + i.price * i.qty, 0), [cart]);
  const count = cart.reduce((sum, i) => sum + i.qty, 0);

  const add = (item: MenuItem, qty = 1) => setCart(c => {
    const found = c.find(i => i.id === item.id);
    return found ? c.map(i => i.id === item.id ? { ...i, qty: i.qty + qty } : i) : [...c, { ...item, qty }];
  });
  const change = (id: string, delta: number) => setCart(c => c.map(i => i.id === id ? { ...i, qty: i.qty + delta } : i).filter(i => i.qty > 0));
  const ai = (text: string, chips?: string[]) => setMessages(m => [...m, { id: Date.now() + Math.random(), from: 'ai', text, time: 'Now', chips }]);
  const user = (text: string) => setMessages(m => [...m, { id: Date.now() + Math.random(), from: 'user', text, time: 'Now' }]);

  const interpret = (raw: string) => {
    const matches = findMenuMatches(raw);
    const unavailable = findUnavailableWords(raw, matches);
    return { matches, unavailable };
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text) return;
    user(text); setInput('');
    const { matches, unavailable } = interpret(text);

    setTimeout(() => {
      if (stage !== 'chat') return;
      const isDone = /^(that'?s all|thats all|all|done|ready|finish|finished|checkout)$/i.test(text.trim()) || /^(that's all|thats all|i'?m done|im done)/i.test(text.trim());
      const isCancel = /^(cancel|cancel order|start over|reset|never\s*mind|forget it)\b/i.test(text.trim());
      const removeMatch = text.match(/^(remove|delete|take out|drop)\s+(.*)/i);

      if (isCancel) {
        if (!cart.length) {
          ai('There’s nothing to cancel yet — you haven’t started an order. What would you like?');
        } else {
          setCart([]);
          ai('No problem, I’ve cleared that order. Let me know whenever you’re ready to start again.');
        }
        return;
      }

      if (removeMatch) {
        const toRemove = findMenuMatches(removeMatch[2]);
        if (!toRemove.length) {
          ai('I couldn’t tell which item to remove — could you name it, like “remove suya”?');
        } else {
          const stillInCart = toRemove.filter(item => cart.some(c => c.id === item.id));
          if (!stillInCart.length) {
            ai(`${toRemove.map(i => i.name).join(', ')} isn't in your order right now.`);
          } else {
            setCart(c => c.filter(i => !stillInCart.some(r => r.id === i.id)));
            ai(`Removed ${stillInCart.map(i => i.name).join(', ')}. Anything else?`);
          }
        }
        return;
      }

      if (matches.length) {
        matches.forEach(item => add(item, quantityFor(text, item)));
        const added = matches.map(item => `${quantityFor(text, item)}× ${item.name}`).join(', ');
        const unavailableNote = unavailable.length ? ` I couldn't find ${unavailable.join(', ')} on this restaurant's menu right now.` : '';
        ai(`Got it — I've added ${added}.${unavailableNote} Anything else, or are we ready to sort out delivery?`, ['That’s all', 'Add a drink', 'Add plantain']);
      } else if (isDone) {
        if (!cart.length) ai('I’m ready when you are. Tell me what you’d like — for example, “2 jollof, chicken and a Coke.”');
        else ai('Perfect. Would you like this for delivery or pickup?', ['Delivery', 'Pickup']);
      } else if (/\bdelivery\b/i.test(text)) {
        setDelivery('delivery'); setStage('details'); ai('Delivery it is. I’ll need your name, phone number and delivery address next.');
      } else if (/\bpickup\b/i.test(text)) {
        setDelivery('pickup'); setStage('details'); ai('Pickup it is. I’ll just need your name and phone number to attach to the order.');
      } else if (isGreeting(text)) {
        ai('Hey there 👋 Good to have you. Whenever you’re ready, just tell me what you’d like — for example, “jollof and a Coke” — or ask “what do you have?” to see the menu.');
      } else if (isMenuQuestion(text)) {
        ai(`Here's what we've got — ${menuSummaryByCategory()}. Just tell me what you'd like.`);
      } else if (!unavailable.length) {
        // Nothing recognized, but nothing clearly "unavailable" either — avoid a false accusatory reply.
        ai('Sorry, I didn’t quite catch an order in that. You can say something like “jollof and suya” or ask “what do you have?”');
      } else {
        ai(`I’m sorry, we don’t currently have ${unavailable.join(', ')} on the menu. I can only add items from the restaurant’s current catalog — try jollof, fried rice, chicken, suya, plantain, egusi soup, Coke, Sprite or water.`);
      }
    }, 450);
  };

  const choose = (value: string) => {
    user(value);
    if (value === 'Delivery' || value === 'Pickup') {
      setDelivery(value.toLowerCase() as 'delivery' | 'pickup'); setStage('details');
      ai(value === 'Delivery' ? 'Delivery it is. I’ll need your name, phone number and address.' : 'Pickup it is. I’ll need your name and phone number.');
    } else if (value === 'That’s all') ai('Perfect. Would you like this for delivery or pickup?', ['Delivery', 'Pickup']);
    else if (value === 'Add a drink') add(menu.find(i => i.id === 'coke')!);
    else if (value === 'Add plantain') add(menu.find(i => i.id === 'plantain')!);
  };

  const nameValid = isValidName(name);
  const phoneValid = isValidPhone(phone);
  const addressValid = delivery === 'pickup' || isValidAddress(address);
  const detailsReady = nameValid && phoneValid && addressValid;

  const continueDetails = () => {
    setTouched(true);
    if (!detailsReady) return;
    ai(`Thanks, ${name}. Your order is ${delivery === 'delivery' ? 'going to ' + address : 'for pickup'}. Ready to review and pay?`);
    setStage('payment');
  };
  const [paying, setPaying] = useState(false);
  const pay = () => {
    setPaying(true);
    setTimeout(() => {
      setPaying(false);
      // Simulate an occasional real-world payment hiccup rather than always succeeding instantly.
      const failed = Math.random() < 0.12;
      if (failed) {
        ai('Hmm, that payment didn’t go through on our end. No charge was made — want to try again?');
        return;
      }
      setStage('tracking'); setStatus(1);
      ai('Payment confirmed. Your order is now with the kitchen. I’ll keep you posted here.');
      setTimeout(() => setStatus(2), 1800); setTimeout(() => setStatus(3), 4200);
    }, 900);
  };

  return <main className="min-h-screen bg-[#07090d] p-3 text-zinc-100 sm:p-6">
    <div className="mx-auto flex min-h-[calc(100vh-24px)] max-w-7xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0b0e13] shadow-2xl shadow-black/40 lg:flex-row">
      <section className="flex min-h-[680px] flex-1 flex-col border-r border-white/10">
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-7">
          <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-black"><Bot size={21}/></div><div><div className="font-semibold tracking-tight">Maya</div><div className="flex items-center gap-1.5 text-xs text-emerald-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400"/> AI receptionist · Online</div></div></div>
          <div className="rounded-full border border-white/10 bg-white/[.03] px-3 py-1.5 text-xs text-zinc-400">Demo mode</div>
        </header>
        <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-7">
          {messages.map(m => <div key={m.id} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[88%] ${m.from === 'user' ? 'items-end' : 'items-start'} flex flex-col`}><div className={`rounded-2xl px-4 py-3 text-sm leading-6 ${m.from === 'user' ? 'rounded-br-md bg-white text-black' : 'rounded-bl-md border border-white/10 bg-[#131820] text-zinc-200'}`}>{m.text}</div>{m.chips && <div className="mt-2 flex flex-wrap gap-2">{m.chips.map(c => <button key={c} onClick={() => choose(c)} className="rounded-full border border-white/10 bg-white/[.03] px-3 py-1.5 text-xs text-zinc-300 transition hover:border-white/25 hover:bg-white/[.07]">{c}</button>)}</div>}<span className="mt-1 px-1 text-[10px] text-zinc-600">{m.time}</span></div></div>)}
          {stage === 'details' && <div className="ml-auto max-w-md rounded-2xl border border-white/10 bg-[#10141b] p-4">
            <div className="mb-3 text-xs font-medium text-zinc-400">CUSTOMER DETAILS</div>
            <div className="grid gap-2">
              <div>
                <input value={name} onChange={e=>setName(e.target.value)} placeholder="Full name" className={`w-full rounded-xl border bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-white/30 ${touched && !nameValid ? 'border-red-500/60' : 'border-white/10'}`}/>
                {touched && !nameValid && <div className="mt-1 text-[11px] text-red-400">Enter your full name.</div>}
              </div>
              <div>
                <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Phone number" className={`w-full rounded-xl border bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-white/30 ${touched && !phoneValid ? 'border-red-500/60' : 'border-white/10'}`}/>
                {touched && !phoneValid && <div className="mt-1 text-[11px] text-red-400">Enter a valid phone number (10–14 digits).</div>}
              </div>
              {delivery==='delivery' && <div>
                <input value={address} onChange={e=>setAddress(e.target.value)} placeholder="Delivery address" className={`w-full rounded-xl border bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-white/30 ${touched && !addressValid ? 'border-red-500/60' : 'border-white/10'}`}/>
                {touched && !addressValid && <div className="mt-1 text-[11px] text-red-400">Enter a full delivery address (street and area).</div>}
              </div>}
              <button onClick={continueDetails} className="mt-1 rounded-xl bg-white py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200">Continue <ChevronRight className="ml-1 inline" size={15}/></button>
            </div>
          </div>}
          {stage === 'payment' && <div className="ml-auto max-w-md rounded-2xl border border-white/10 bg-[#10141b] p-4"><div className="mb-3 flex items-center justify-between"><span className="text-xs font-medium text-zinc-400">ORDER READY</span><span className="text-lg font-semibold">{money(total)}</span></div><div className="space-y-2 border-y border-white/10 py-3">{cart.map(i=><div key={i.id} className="flex justify-between text-sm"><span>{i.qty}× {i.name}</span><span>{money(i.price*i.qty)}</span></div>)}</div><button onClick={pay} disabled={paying} className="mt-3 w-full rounded-xl bg-emerald-400 py-2.5 text-sm font-bold text-black disabled:opacity-60">{paying ? 'Processing…' : <>Pay {money(total)} <ChevronRight className="ml-1 inline" size={15}/></>}</button><div className="mt-2 text-center text-[10px] text-zinc-600">Demo payment · no card details collected</div></div>}
        </div>
        {stage === 'chat' && <form onSubmit={submit} className="border-t border-white/10 p-4 sm:p-5"><div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#11151b] p-2 focus-within:border-white/20"><input value={input} onChange={e=>setInput(e.target.value)} placeholder="Tell Maya what you'd like..." className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-zinc-600"/><button className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-black transition hover:scale-105"><Send size={16}/></button></div></form>}
      </section>

      <aside className="w-full bg-[#090c11] lg:w-[390px]">
        <div className="border-b border-white/10 p-5"><div className="mb-4 flex items-center justify-between"><div><div className="text-xs uppercase tracking-[.18em] text-zinc-600">The demo</div><h2 className="mt-1 text-lg font-semibold">Order command center</h2></div><Sparkles size={18} className="text-zinc-500"/></div><div className="grid grid-cols-3 gap-2">{[['chat','Reception'],['payment','Checkout'],['tracking','Tracking']].map(([key,label])=><div key={key} className={`rounded-xl border p-2.5 text-center ${stage===key?'border-white/20 bg-white/[.06]':'border-white/5 bg-white/[.02]'}`}><div className="text-[10px] text-zinc-500">{label}</div><div className="mt-1 text-xs font-medium">{stage===key?'Live':'Ready'}</div></div>)}</div></div>
        <div className="border-b border-white/10 p-5"><div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><ShoppingBag size={15}/><span className="text-sm font-semibold">Current order</span></div><span className="text-xs text-zinc-500">{count} item{count===1?'':'s'}</span></div>{cart.length===0 ? <div className="rounded-2xl border border-dashed border-white/10 p-5 text-center text-xs text-zinc-600">Order items will appear here as Maya understands the conversation.</div> : <div className="space-y-3">{cart.map(i=><div key={i.id} className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-white/[.06] text-xs font-semibold text-zinc-400">{i.name.charAt(0)}</div><div className="min-w-0 flex-1"><div className="truncate text-xs font-medium">{i.name}</div><div className="text-[11px] text-zinc-500">{money(i.price)} each</div></div><div className="flex items-center gap-1 rounded-lg border border-white/10"><button onClick={()=>change(i.id,-1)} className="p-1.5 text-zinc-500 hover:text-white"><Minus size={11}/></button><span className="w-4 text-center text-xs">{i.qty}</span><button onClick={()=>change(i.id,1)} className="p-1.5 text-zinc-500 hover:text-white"><Plus size={11}/></button></div></div>)}<div className="mt-4 flex justify-between border-t border-white/10 pt-3"><span className="text-xs text-zinc-500">Total</span><span className="font-semibold">{money(total)}</span></div></div>}</div>
        <div className="p-5"><div className="mb-3 text-xs uppercase tracking-[.18em] text-zinc-600">Order tracking</div><div className="space-y-0">{[['Order received','We have your request',ShoppingBag],['Payment confirmed','Transaction verified',Check],['Kitchen preparing','Your food is being made',UtensilsCrossed],['Out for delivery','Driver is on the way',Truck],['Delivered','Enjoy your meal',Check]].map(([label,sub,Icon],idx)=><div key={label as string} className="relative flex gap-3 pb-5 last:pb-0"><div className={`relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full border ${idx<=status?'border-white bg-white text-black':'border-white/10 bg-[#090c11] text-zinc-700'}`}><Icon size={12}/></div>{idx<4 && <div className={`absolute left-[13px] top-7 h-full w-px ${idx<status?'bg-white/40':'bg-white/10'}`}/>}<div><div className={`text-xs font-medium ${idx<=status?'text-zinc-200':'text-zinc-600'}`}>{label as string}</div><div className="mt-0.5 text-[10px] text-zinc-600">{sub as string}</div></div></div>)}</div></div>
        <div className="border-t border-white/10 p-5"><div className="rounded-2xl bg-white/[.03] p-4"><div className="flex items-start gap-3"><div className="grid h-8 w-8 place-items-center rounded-xl bg-white text-black"><Clock3 size={15}/></div><div><div className="text-xs font-semibold">Live catalog</div><div className="mt-1 text-[11px] leading-5 text-zinc-500">{menu.length} menu items indexed · keyword matching · unavailable-item detection · quantity parsing</div></div></div></div></div>
      </aside>
    </div>
  </main>;
}
