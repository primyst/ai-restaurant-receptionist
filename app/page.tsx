'use client';

import { FormEvent, useMemo, useState } from 'react';
import { ArrowRight, Check, ChevronRight, Clock3, Minus, Plus, Send, Sparkles, Truck, UtensilsCrossed } from 'lucide-react';
import { isValidAddress, isValidName, isValidPhone, menu, menuSummaryByCategory, type MenuItem } from '../lib/menu';

type CartItem = MenuItem & { qty: number };
type Message = { id: number; from: 'ai' | 'user'; text: string; chips?: string[] };
type Stage = 'chat' | 'details' | 'payment' | 'tracking';

const money = (n: number) => `₦${n.toLocaleString()}`;
const initialMessages: Message[] = [{ id: 1, from: 'ai', text: "Welcome to Iya Anike's Kitchen. I'm Maya — tell me what you'd like and I'll get it sorted." }];
const stages: { key: Stage; label: string }[] = [
  { key: 'chat', label: 'Order' }, { key: 'details', label: 'Details' }, { key: 'payment', label: 'Payment' }, { key: 'tracking', label: 'Tracking' },
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [stage, setStage] = useState<Stage>('chat');
  const [typing, setTyping] = useState(false);
  const [delivery, setDelivery] = useState<'delivery' | 'pickup' | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [touched, setTouched] = useState(false);
  const [paying, setPaying] = useState(false);
  const [status, setStatus] = useState(0);

  const total = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.qty, 0), [cart]);
  const count = useMemo(() => cart.reduce((sum, item) => sum + item.qty, 0), [cart]);
  const stageIndex = stages.findIndex(s => s.key === stage);

  const addLocal = (items: CartItem[], item: MenuItem, qty: number) => {
    if (!Number.isInteger(qty) || qty < 1 || qty > 20) return items;
    const existing = items.find(i => i.id === item.id);
    return existing ? items.map(i => i.id === item.id ? { ...i, qty: Math.min(20, i.qty + qty) } : i) : [...items, { ...item, qty }];
  };

  const applyActions = (actions: any[], current: CartItem[]) => {
    let next = [...current];
    let shouldFinish = false;
    for (const action of actions ?? []) {
      const type = action?.type;
      if (type === 'add') {
        const item = menu.find(i => i.id === action.itemId && i.available);
        if (item) next = addLocal(next, item, Number(action.quantity));
      } else if (type === 'set_quantity') {
        const item = menu.find(i => i.id === action.itemId && i.available);
        const qty = Number(action.quantity);
        if (item && Number.isInteger(qty) && qty >= 0 && qty <= 20) {
          if (qty === 0) next = next.filter(i => i.id !== item.id);
          else next = next.some(i => i.id === item.id) ? next.map(i => i.id === item.id ? { ...i, qty } : i) : next;
        }
      } else if (type === 'remove') {
        const qty = Number(action.quantity);
        if (Number.isInteger(qty) && qty > 0) {
          next = next.map(i => i.id === action.itemId ? { ...i, qty: i.qty - qty } : i).filter(i => i.qty > 0);
        }
      } else if (type === 'replace') {
        const from = next.find(i => i.id === action.fromItemId);
        const to = menu.find(i => i.id === action.toItemId && i.available);
        const qty = Number(action.quantity);
        if (from && to && Number.isInteger(qty) && qty > 0 && qty <= 20) {
          next = next.filter(i => i.id !== from.id);
          next = addLocal(next, to, qty);
        }
      } else if (type === 'finish') {
        shouldFinish = true;
      }
    }
    return { next, shouldFinish };
  };

  const send = async (value?: string) => {
    const text = (value ?? input).trim();
    if (!text || typing) return;
    setInput('');
    setMessages(prev => [...prev, { id: Date.now(), from: 'user', text }]);
    setTyping(true);
    try {
      const history = [...messages, { id: Date.now(), from: 'user' as const, text }].map(m => ({ from: m.from, text: m.text }));
      const response = await fetch('/api/maya', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, cart: cart.map(({ id, name, qty }) => ({ id, name, qty })), history }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Maya is unavailable');
      const result = applyActions(data.actions, cart);
      setCart(result.next);
      if (result.shouldFinish && result.next.length) setStage('details');
      setMessages(prev => [...prev, { id: Date.now() + 1, from: 'ai', text: data.reply, chips: Array.isArray(data.chips) ? data.chips.slice(0, 4) : [] }]);
    } catch (error) {
      setMessages(prev => [...prev, { id: Date.now() + 1, from: 'ai', text: 'Sorry, I’m having a little trouble right now. Please try that again.' }]);
      console.error(error);
    } finally {
      setTyping(false);
    }
  };

  const choose = (value: string) => {
    if (value === 'Delivery' || value === 'Pickup') {
      setDelivery(value.toLowerCase() as 'delivery' | 'pickup');
      setStage('details');
      setMessages(prev => [...prev, { id: Date.now(), from: 'user', text: value }, { id: Date.now() + 1, from: 'ai', text: value === 'Delivery' ? 'Delivery it is. I’ll need your name, phone number and address.' : 'Pickup it is. I’ll just need your name and phone number.' }]);
      return;
    }
    void send(value);
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(i => i.id === id ? { ...i, qty: i.qty + delta } : i).filter(i => i.qty > 0));
  };

  const nameValid = isValidName(name);
  const phoneValid = isValidPhone(phone);
  const addressValid = delivery === 'pickup' || isValidAddress(address);
  const detailsReady = nameValid && phoneValid && addressValid;

  const continueDetails = () => {
    setTouched(true);
    if (!detailsReady) return;
    setStage('payment');
    setMessages(prev => [...prev, { id: Date.now(), from: 'ai', text: `Thanks, ${name}. Your ${delivery === 'delivery' ? 'delivery' : 'pickup'} details are ready. Let's review your order.` }]);
  };

  const pay = () => {
    setPaying(true);
    setTimeout(() => {
      setPaying(false); setStage('tracking'); setStatus(1);
      setMessages(prev => [...prev, { id: Date.now(), from: 'ai', text: 'Payment confirmed. Your order is now with the kitchen. I’ll keep you posted here.' }]);
      setTimeout(() => setStatus(2), 1800); setTimeout(() => setStatus(3), 4200);
    }, 800);
  };

  return (
    <main className="min-h-screen bg-[#f7f3ec] text-[#1f1b17]">
      <header className="border-b border-black/8 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#1e1712] text-[#f4c879]"><UtensilsCrossed size={19} /></div>
            <div><p className="font-semibold tracking-tight">Iya Anike’s Kitchen</p><p className="text-xs text-black/50">AI ordering assistant</p></div>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-[#eef6ed] px-3 py-1.5 text-xs font-medium text-[#50724a]"><span className="h-2 w-2 rounded-full bg-[#6f9b63]" /> Maya is online</div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-5 px-3 py-4 sm:px-6 sm:py-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="flex min-h-[calc(100vh-118px)] flex-col overflow-hidden rounded-[28px] border border-black/8 bg-white shadow-[0_18px_70px_rgba(53,40,25,.08)]">
          <div className="border-b border-black/6 px-5 py-4 sm:px-6">
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-semibold">Order with Maya</p><p className="text-xs text-black/45">Talk normally. She’ll handle the order.</p></div>
              <div className="hidden items-center gap-1 text-[11px] text-black/35 sm:flex"><Sparkles size={13} /> AI receptionist</div>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
            {messages.map(message => (
              <div key={message.id} className={`flex ${message.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] ${message.from === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-2`}>
                  <div className={`rounded-2xl px-4 py-3 text-sm leading-6 ${message.from === 'user' ? 'rounded-br-md bg-[#1f1914] text-white' : 'rounded-bl-md bg-[#f3efe8] text-[#29231d]'}`}>{message.text}</div>
                  {message.chips?.length ? <div className="flex flex-wrap gap-2">{message.chips.map(chip => <button key={chip} onClick={() => choose(chip)} className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium transition hover:border-black/25 hover:bg-black/[.02]">{chip}</button>)}</div> : null}
                </div>
              </div>
            ))}
            {typing && <div className="flex"><div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-[#f3efe8] px-4 py-3"><span className="h-1.5 w-1.5 rounded-full bg-black/35 animate-pulse" /><span className="h-1.5 w-1.5 rounded-full bg-black/35 animate-pulse [animation-delay:150ms]" /><span className="h-1.5 w-1.5 rounded-full bg-black/35 animate-pulse [animation-delay:300ms]" /></div></div>}
          </div>

          {stage === 'chat' && <form onSubmit={(e: FormEvent) => { e.preventDefault(); void send(); }} className="border-t border-black/6 p-3 sm:p-4">
            <div className="flex items-center gap-2 rounded-2xl border border-black/10 bg-[#faf9f6] p-2 focus-within:border-black/25">
              <input value={input} onChange={e => setInput(e.target.value)} placeholder="e.g. Abeg give me two jollof and dodo" className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-black/30" disabled={typing} />
              <button type="submit" disabled={!input.trim() || typing} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#1f1914] text-white transition hover:bg-[#35291f] disabled:opacity-30"><Send size={16} /></button>
            </div>
          </form>}
        </section>

        <aside className="space-y-4">
          <div className="rounded-[26px] border border-black/8 bg-white p-5 shadow-[0_18px_70px_rgba(53,40,25,.07)]">
            <div className="mb-5 flex items-center justify-between"><div><p className="font-semibold">Your order</p><p className="text-xs text-black/45">{count ? `${count} item${count === 1 ? '' : 's'}` : 'Nothing added yet'}</p></div>{count > 0 && <span className="rounded-full bg-[#f5eee4] px-2.5 py-1 text-xs font-semibold">{money(total)}</span>}</div>
            {cart.length === 0 ? <div className="rounded-2xl border border-dashed border-black/10 bg-[#faf9f6] p-6 text-center text-sm text-black/40">Your order will appear here as you chat with Maya.</div> : <div className="space-y-4">
              {cart.map(item => <div key={item.id} className="flex gap-3">
                <div className="min-w-0 flex-1"><p className="text-sm font-medium">{item.name}</p><p className="mt-0.5 text-xs text-black/45">{money(item.price)} each{item.category === 'Mains' ? ` · includes ${item.qty} chicken + ${item.qty} water` : ''}</p></div>
                <div className="flex h-8 items-center gap-2 rounded-lg border border-black/8 px-1"><button onClick={() => updateQty(item.id, -1)} className="grid h-6 w-6 place-items-center rounded hover:bg-black/5"><Minus size={12} /></button><span className="w-4 text-center text-xs font-semibold">{item.qty}</span><button onClick={() => updateQty(item.id, 1)} className="grid h-6 w-6 place-items-center rounded hover:bg-black/5"><Plus size={12} /></button></div>
              </div>)}
              <div className="border-t border-black/7 pt-4"><div className="flex items-center justify-between text-sm"><span className="text-black/50">Total</span><strong>{money(total)}</strong></div></div>
            </div>}
          </div>

          <div className="rounded-[26px] border border-black/8 bg-white p-5 shadow-[0_18px_70px_rgba(53,40,25,.07)]">
            <div className="mb-4 flex items-center justify-between"><p className="text-sm font-semibold">Order progress</p><span className="text-[11px] text-black/35">{stageIndex + 1}/4</span></div>
            <div className="space-y-3">{stages.map((s, i) => <div key={s.key} className="flex items-center gap-3"><div className={`grid h-7 w-7 place-items-center rounded-full text-xs ${i <= stageIndex ? 'bg-[#1f1914] text-white' : 'bg-black/5 text-black/30'}`}>{i < stageIndex ? <Check size={13} /> : i + 1}</div><span className={`text-sm ${i === stageIndex ? 'font-semibold' : 'text-black/40'}`}>{s.label}</span>{i === stageIndex && <ChevronRight size={14} className="ml-auto text-black/25" />}</div>)}</div>
          </div>

          {stage === 'details' && <div className="rounded-[26px] border border-black/8 bg-white p-5 shadow-[0_18px_70px_rgba(53,40,25,.07)]"><p className="mb-1 font-semibold">{delivery === 'delivery' ? 'Delivery details' : 'Pickup details'}</p><p className="mb-4 text-xs text-black/45">A few details and we’re ready.</p><div className="space-y-3"><input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" className="w-full rounded-xl border border-black/10 bg-[#faf9f6] px-3 py-2.5 text-sm outline-none" /><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number" className="w-full rounded-xl border border-black/10 bg-[#faf9f6] px-3 py-2.5 text-sm outline-none" />{delivery === 'delivery' && <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Delivery address" className="w-full rounded-xl border border-black/10 bg-[#faf9f6] px-3 py-2.5 text-sm outline-none" />}<button onClick={continueDetails} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1f1914] py-3 text-sm font-semibold text-white">Continue <ArrowRight size={15} /></button>{touched && !detailsReady && <p className="text-xs text-[#a33b26]">Please enter valid details before continuing.</p>}</div></div>}

          {stage === 'payment' && <div className="rounded-[26px] border border-black/8 bg-white p-5 shadow-[0_18px_70px_rgba(53,40,25,.07)]"><p className="font-semibold">Ready to pay</p><p className="mt-1 text-xs text-black/45">Demo checkout — no real payment is taken.</p><div className="my-4 rounded-2xl bg-[#faf9f6] p-4"><div className="flex justify-between text-sm"><span>Total</span><strong>{money(total)}</strong></div></div><button onClick={pay} disabled={paying} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1f1914] py-3 text-sm font-semibold text-white disabled:opacity-60">{paying ? 'Confirming…' : 'Pay & place order'} <ArrowRight size={15} /></button></div>}

          {stage === 'tracking' && <div className="rounded-[26px] border border-black/8 bg-white p-5 shadow-[0_18px_70px_rgba(53,40,25,.07)]"><div className="mb-5 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#eef6ed] text-[#50724a]"><Truck size={19} /></div><div><p className="font-semibold">Order confirmed</p><p className="text-xs text-black/45">#{String(Date.now()).slice(-6)}</p></div></div><div className="space-y-4">{['Order received', 'Kitchen preparing', 'Ready / on the way'].map((label, i) => <div key={label} className="flex items-center gap-3"><div className={`grid h-7 w-7 place-items-center rounded-full ${i < status ? 'bg-[#6f9b63] text-white' : 'bg-black/5 text-black/25'}`}>{i < status ? <Check size={13} /> : <Clock3 size={13} />}</div><span className={`text-sm ${i < status ? 'font-medium' : 'text-black/35'}`}>{label}</span></div>)}</div></div>}
        </aside>
      </div>
    </main>
  );
}
