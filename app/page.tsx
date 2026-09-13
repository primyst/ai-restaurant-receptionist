'use client';

import { FormEvent, useMemo, useState } from 'react';
import { Check, ChevronRight, Minus, Plus, Send, Truck, UtensilsCrossed } from 'lucide-react';
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
const initialMessages: Message[] = [{ id: 1, from: 'ai', text: "Welcome in. I'm Maya — tell me what you'd like and I'll get it sorted.", time: 'Now' }];

const STAGES: { key: Stage; label: string }[] = [
  { key: 'chat', label: 'Order' },
  { key: 'details', label: 'Details' },
  { key: 'payment', label: 'Payment' },
  { key: 'tracking', label: 'Tracking' },
];

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
  const [typing, setTyping] = useState(false);
  const [paying, setPaying] = useState(false);

  const total = useMemo(() => cart.reduce((sum, i) => sum + i.price * i.qty, 0), [cart]);
  const count = cart.reduce((sum, i) => sum + i.qty, 0);
  const stageIndex = STAGES.findIndex(s => s.key === stage);

  const add = (item: MenuItem, qty = 1) => setCart(c => {
    const found = c.find(i => i.id === item.id);
    return found ? c.map(i => i.id === item.id ? { ...i, qty: i.qty + qty } : i) : [...c, { ...item, qty }];
  });
  const change = (id: string, delta: number) => setCart(c => c.map(i => i.id === id ? { ...i, qty: i.qty + delta } : i).filter(i => i.qty > 0));
  const ai = (text: string, chips?: string[]) => { setTyping(false); setMessages(m => [...m, { id: Date.now() + Math.random(), from: 'ai', text, time: 'Now', chips }]); };
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
    setTyping(true);

    setTimeout(() => {
      if (stage !== 'chat') { setTyping(false); return; }
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
        ai('Hey there — good to have you. Whenever you’re ready, just tell me what you’d like, or ask “what do you have?” to see the menu.');
      } else if (isMenuQuestion(text)) {
        ai(`Here's what we've got — ${menuSummaryByCategory()}. Just tell me what you'd like.`);
      } else if (!unavailable.length) {
        ai('Sorry, I didn’t quite catch an order in that. You can say something like “jollof and suya” or ask “what do you have?”');
      } else {
        ai(`I’m sorry, we don’t currently have ${unavailable.join(', ')} on the menu. Try jollof, fried rice, chicken, suya, plantain, egusi soup, Coke, Sprite or water.`);
      }
    }, 550);
  };

  const choose = (value: string) => {
    user(value); setTyping(true);
    setTimeout(() => {
      if (value === 'Delivery' || value === 'Pickup') {
        setDelivery(value.toLowerCase() as 'delivery' | 'pickup'); setStage('details');
        ai(value === 'Delivery' ? 'Delivery it is. I’ll need your name, phone number and address.' : 'Pickup it is. I’ll need your name and phone number.');
      } else if (value === 'That’s all') ai('Perfect. Would you like this for delivery or pickup?', ['Delivery', 'Pickup']);
      else if (value === 'Add a drink') { add(menu.find(i => i.id === 'coke')!); ai('Added a Coke. Anything else, or shall we sort delivery?', ['That’s all']); }
      else if (value === 'Add plantain') { add(menu.find(i => i.id === 'plantain')!); ai('Added fried plantain. Anything else, or shall we sort delivery?', ['That’s all']); }
    }, 450);
  };

  const nameValid = isValidName(name);
  const phoneValid = isValidPhone(phone);
  const addressValid = delivery === 'pickup' || isValidAddress(address);
  const detailsReady = nameValid && phoneValid && addressValid;

  const continueDetails = () => {
    setTouched(true);
    if (!detailsReady) return;
    setStage('payment');
    ai(`Thanks, ${name}. Your order is ${delivery === 'delivery' ? 'going to ' + address : 'for pickup'}. Ready to review and pay?`);
  };

  const pay = () => {
    setPaying(true);
    setTimeout(() => {
      setPaying(false);
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

  return (
    <main className="min-h-screen p-3 sm:p-6" style={{ background: 'radial-gradient(circle at 15% 0%, #2c1f16 0%, var(--cocoa) 55%)' }}>
      <div className="mx-auto flex min-h-[calc(100vh-24px)] max-w-6xl flex-col gap-4 lg:flex-row">

        {/* Conversation panel */}
        <section className="flex min-h-[680px] flex-1 flex-col overflow-hidden rounded-[28px] border" style={{ background: 'var(--parchment)', borderColor: 'rgba(36,25,18,0.12)', color: '#241912' }}>
          <header className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid rgba(36,25,18,0.1)' }}>
            <div>
              <div className="font-display text-xl" style={{ color: '#241912' }}>Iya Basira&rsquo;s Kitchen</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs" style={{ color: 'var(--basil)' }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--basil)' }} />
                Maya is taking orders
              </div>
            </div>
          </header>

          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
            {messages.map(m => (
              <div key={m.id} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex max-w-[85%] flex-col ${m.from === 'user' ? 'items-end' : 'items-start'}`}>
                  <div
                    className="rounded-2xl px-4 py-3 text-sm leading-6"
                    style={m.from === 'user'
                      ? { background: 'var(--pepper)', color: '#FBEFE6', borderBottomRightRadius: 4 }
                      : { background: '#FFFFFF', color: '#241912', border: '1px solid rgba(36,25,18,0.08)', borderBottomLeftRadius: 4 }}
                  >
                    {m.text}
                  </div>
                  {m.chips && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {m.chips.map(c => (
                        <button
                          key={c}
                          onClick={() => choose(c)}
                          className="rounded-full px-3 py-1.5 text-xs transition hover:opacity-80"
                          style={{ background: 'rgba(174,49,28,0.08)', color: 'var(--pepper)', border: '1px solid rgba(174,49,28,0.25)' }}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {typing && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-2xl px-4 py-3" style={{ background: '#FFFFFF', border: '1px solid rgba(36,25,18,0.08)', borderBottomLeftRadius: 4 }}>
                  <span className="typing-dot h-1.5 w-1.5 rounded-full" style={{ background: '#9C8B75' }} />
                  <span className="typing-dot h-1.5 w-1.5 rounded-full" style={{ background: '#9C8B75' }} />
                  <span className="typing-dot h-1.5 w-1.5 rounded-full" style={{ background: '#9C8B75' }} />
                </div>
              </div>
            )}

            {stage === 'details' && (
              <div className="ml-auto max-w-sm rounded-2xl p-4" style={{ background: '#FFFFFF', border: '1px solid rgba(36,25,18,0.08)' }}>
                <div className="mb-3 text-xs font-medium" style={{ color: '#8A7960' }}>Your details</div>
                <div className="grid gap-2.5">
                  <div>
                    <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name"
                      className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                      style={{ background: '#F8F3EA', border: `1px solid ${touched && !nameValid ? 'var(--pepper)' : 'rgba(36,25,18,0.12)'}`, color: '#241912' }} />
                    {touched && !nameValid && <div className="mt-1 text-[11px]" style={{ color: 'var(--pepper)' }}>Enter your full name.</div>}
                  </div>
                  <div>
                    <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number"
                      className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                      style={{ background: '#F8F3EA', border: `1px solid ${touched && !phoneValid ? 'var(--pepper)' : 'rgba(36,25,18,0.12)'}`, color: '#241912' }} />
                    {touched && !phoneValid && <div className="mt-1 text-[11px]" style={{ color: 'var(--pepper)' }}>Enter a valid phone number (10–14 digits).</div>}
                  </div>
                  {delivery === 'delivery' && (
                    <div>
                      <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Delivery address"
                        className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                        style={{ background: '#F8F3EA', border: `1px solid ${touched && !addressValid ? 'var(--pepper)' : 'rgba(36,25,18,0.12)'}`, color: '#241912' }} />
                      {touched && !addressValid && <div className="mt-1 text-[11px]" style={{ color: 'var(--pepper)' }}>Enter a full delivery address (street and area).</div>}
                    </div>
                  )}
                  <button onClick={continueDetails} className="mt-1 rounded-xl py-2.5 text-sm font-semibold transition hover:opacity-90" style={{ background: 'var(--pepper)', color: '#FBEFE6' }}>
                    Continue <ChevronRight className="ml-1 inline" size={15} />
                  </button>
                </div>
              </div>
            )}

            {stage === 'payment' && (
              <div className="ml-auto max-w-sm rounded-2xl p-4" style={{ background: '#FFFFFF', border: '1px solid rgba(36,25,18,0.08)' }}>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-medium" style={{ color: '#8A7960' }}>Order ready</span>
                  <span className="text-lg font-semibold" style={{ color: 'var(--pepper)' }}>{money(total)}</span>
                </div>
                <div className="space-y-2 py-3" style={{ borderTop: '1px solid rgba(36,25,18,0.08)', borderBottom: '1px solid rgba(36,25,18,0.08)' }}>
                  {cart.map(i => <div key={i.id} className="flex justify-between text-sm" style={{ color: '#241912' }}><span>{i.qty}× {i.name}</span><span>{money(i.price * i.qty)}</span></div>)}
                </div>
                <button onClick={pay} disabled={paying} className="mt-3 w-full rounded-xl py-2.5 text-sm font-bold transition hover:opacity-90 disabled:opacity-60" style={{ background: 'var(--gold)', color: '#241912' }}>
                  {paying ? 'Processing…' : <>Pay {money(total)} <ChevronRight className="ml-1 inline" size={15} /></>}
                </button>
                <div className="mt-2 text-center text-[10px]" style={{ color: '#A6957C' }}>Demo payment · no card details collected</div>
              </div>
            )}
          </div>

          {stage === 'chat' && (
            <form onSubmit={submit} className="p-4 sm:p-5" style={{ borderTop: '1px solid rgba(36,25,18,0.1)' }}>
              <div className="flex items-center gap-2 rounded-2xl px-2 py-1.5" style={{ background: '#FFFFFF', border: '1px solid rgba(36,25,18,0.12)' }}>
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Tell Maya what you'd like..."
                  className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none"
                  style={{ color: '#241912' }}
                />
                <button className="grid h-10 w-10 shrink-0 place-items-center rounded-xl transition hover:opacity-90" style={{ background: 'var(--pepper)', color: '#FBEFE6' }}>
                  <Send size={16} />
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Order ticket */}
        <aside className="w-full rounded-[28px] p-5 lg:w-[340px]" style={{ background: 'var(--cocoa-soft)', border: '1px solid var(--cocoa-line)' }}>
          <div className="font-display text-lg" style={{ color: 'var(--parchment)' }}>Order ticket</div>

          {/* Stage thread */}
          <div className="mt-4 flex items-center">
            {STAGES.map((s, idx) => (
              <div key={s.key} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: idx <= stageIndex ? 'var(--gold)' : 'rgba(243,232,214,0.18)' }}
                  />
                  <span className="text-[10px]" style={{ color: idx <= stageIndex ? 'var(--parchment)' : 'rgba(243,232,214,0.35)' }}>{s.label}</span>
                </div>
                {idx < STAGES.length - 1 && (
                  <div className="mx-1 h-px flex-1" style={{ background: idx < stageIndex ? 'var(--gold)' : 'rgba(243,232,214,0.12)' }} />
                )}
              </div>
            ))}
          </div>

          {/* Ticket / receipt */}
          <div className="relative mt-5 rounded-xl p-4" style={{ background: 'var(--parchment)', color: '#241912' }}>
            <div className="flex items-center justify-between text-xs" style={{ color: '#8A7960' }}>
              <span>{count} item{count === 1 ? '' : 's'}</span>
              <span>Iya Basira&rsquo;s Kitchen</span>
            </div>
            {cart.length === 0 ? (
              <div className="mt-4 rounded-lg py-6 text-center text-xs" style={{ background: 'rgba(36,25,18,0.04)', color: '#A6957C' }}>
                Nothing on the ticket yet — order items will show up here as you chat with Maya.
              </div>
            ) : (
              <div className="mt-3 space-y-2.5">
                {cart.map(i => (
                  <div key={i.id} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{i.name}</div>
                      <div className="text-[11px]" style={{ color: '#A6957C' }}>{money(i.price)} each</div>
                    </div>
                    <div className="flex items-center gap-1 rounded-lg" style={{ border: '1px solid rgba(36,25,18,0.12)' }}>
                      <button onClick={() => change(i.id, -1)} className="p-1.5" style={{ color: '#8A7960' }}><Minus size={11} /></button>
                      <span className="w-4 text-center text-xs">{i.qty}</span>
                      <button onClick={() => change(i.id, 1)} className="p-1.5" style={{ color: '#8A7960' }}><Plus size={11} /></button>
                    </div>
                    <span className="w-16 text-right text-sm font-medium">{money(i.price * i.qty)}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-2 text-sm font-semibold" style={{ borderTop: '1px dashed rgba(36,25,18,0.2)', color: 'var(--pepper)' }}>
                  <span>Total</span><span>{money(total)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Tracking */}
          <div className="mt-5">
            <div className="mb-3 text-xs" style={{ color: 'rgba(243,232,214,0.55)' }}>Delivery status</div>
            <div className="space-y-0">
              {[
                ['Order received', 'We have your request', Check],
                ['Payment confirmed', 'Transaction verified', Check],
                ['Kitchen preparing', 'Your food is being made', UtensilsCrossed],
                ['Out for delivery', 'Rider is on the way', Truck],
              ].map(([label, sub, Icon], idx) => {
                const IconComp = Icon as typeof Check;
                return (
                  <div key={label as string} className="relative flex gap-3 pb-4 last:pb-0">
                    <div
                      className="relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full"
                      style={idx <= status ? { background: 'var(--gold)', color: '#241912' } : { background: 'transparent', border: '1px solid rgba(243,232,214,0.2)', color: 'rgba(243,232,214,0.3)' }}
                    >
                      <IconComp size={11} />
                    </div>
                    {idx < 3 && <div className="absolute left-[11px] top-6 h-full w-px" style={{ background: idx < status ? 'var(--gold)' : 'rgba(243,232,214,0.12)' }} />}
                    <div>
                      <div className="text-xs font-medium" style={{ color: idx <= status ? 'var(--parchment)' : 'rgba(243,232,214,0.35)' }}>{label as string}</div>
                      <div className="mt-0.5 text-[10px]" style={{ color: 'rgba(243,232,214,0.3)' }}>{sub as string}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
