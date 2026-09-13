export type MenuCategory = 'Mains' | 'Proteins' | 'Sides' | 'Drinks';
export type MenuKind = 'package' | 'addon' | 'drink';

export type MenuItem = {
  id: string;
  name: string;
  price: number;
  category: MenuCategory;
  kind: MenuKind;
  aliases: string[];
  available: boolean;
};

// Iya Anike's Kitchen MVP.
// Every main meal includes one Fried Chicken and one Bottled Water.
// Extras are independent add-ons. No swallow/package flow in this MVP.
export const menu: MenuItem[] = [
  { id: 'jollof', name: 'Smoky Jollof Rice', price: 3500, category: 'Mains', kind: 'package', aliases: ['jollof', 'jollof rice', 'party jollof'], available: true },
  { id: 'fried-rice', name: 'Fried Rice', price: 3500, category: 'Mains', kind: 'package', aliases: ['fried rice'], available: true },
  { id: 'white-rice', name: 'White Rice', price: 3000, category: 'Mains', kind: 'package', aliases: ['white rice', 'plain rice'], available: true },
  { id: 'jollof-spaghetti', name: 'Jollof Spaghetti', price: 3200, category: 'Mains', kind: 'package', aliases: ['spaghetti', 'jollof spaghetti'], available: true },

  { id: 'fried-chicken', name: 'Fried Chicken', price: 2200, category: 'Proteins', kind: 'addon', aliases: ['fried chicken', 'extra fried chicken'], available: true },
  { id: 'fish', name: 'Grilled Fish', price: 4500, category: 'Proteins', kind: 'addon', aliases: ['fish', 'grilled fish', 'extra fish'], available: true },
  { id: 'beef', name: 'Beef', price: 1800, category: 'Proteins', kind: 'addon', aliases: ['beef', 'extra beef'], available: true },
  { id: 'plantain', name: 'Fried Plantain', price: 1500, category: 'Sides', kind: 'addon', aliases: ['plantain', 'fried plantain', 'dodo'], available: true },

  { id: 'coke', name: 'Coca-Cola', price: 500, category: 'Drinks', kind: 'drink', aliases: ['coke', 'coca cola', 'coca-cola', 'cokes', 'cola'], available: true },
  { id: 'fanta', name: 'Fanta', price: 500, category: 'Drinks', kind: 'drink', aliases: ['fanta'], available: true },
  { id: 'sprite', name: 'Sprite', price: 500, category: 'Drinks', kind: 'drink', aliases: ['sprite'], available: true },
  { id: '7up', name: '7UP', price: 500, category: 'Drinks', kind: 'drink', aliases: ['7up', '7 up'], available: true },
  { id: 'pepsi', name: 'Pepsi', price: 500, category: 'Drinks', kind: 'drink', aliases: ['pepsi'], available: true },
  { id: 'maltina', name: 'Maltina', price: 700, category: 'Drinks', kind: 'drink', aliases: ['malt', 'maltina'], available: true },
  { id: 'fearless', name: 'Fearless Energy Drink', price: 700, category: 'Drinks', kind: 'drink', aliases: ['fearless', 'fearless energy'], available: true },
  { id: 'hollandia', name: 'Hollandia Yoghurt', price: 1200, category: 'Drinks', kind: 'drink', aliases: ['hollandia', 'hollandia yoghurt', 'hollandia yogurt'], available: true },
  { id: 'peak-milk', name: 'Peak Milk', price: 700, category: 'Drinks', kind: 'drink', aliases: ['peak milk', 'peak'], available: true },
  { id: 'bigi', name: 'Bigi Cola', price: 400, category: 'Drinks', kind: 'drink', aliases: ['bigi', 'bigi cola'], available: true },
  { id: 'viju-milk', name: 'Viju Milk', price: 800, category: 'Drinks', kind: 'drink', aliases: ['viju', 'viju milk'], available: true },
  { id: 'water', name: 'Bottled Water', price: 300, category: 'Drinks', kind: 'drink', aliases: ['water', 'bottle water', 'bottled water'], available: true },
];

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');

// Punctuation is irrelevant to menu matching: "amala," and "coke!" now behave like normal words.
export const normalizeText = (raw: string) => raw.toLowerCase().replace(/['’]/g, '').replace(/-/g, ' ').replace(/[^a-z0-9×\s]/gi, ' ').replace(/\s+/g, ' ').trim();

export const findMenuMatches = (raw: string) => {
  const text = normalizeText(raw);
  const candidates = menu.flatMap(item => item.aliases.map(alias => ({ item, alias: normalizeText(alias) }))).sort((a, b) => b.alias.length - a.alias.length);
  const used: Array<[number, number]> = [];
  const found: MenuItem[] = [];
  for (const candidate of candidates) {
    if (!candidate.item.available) continue;
    const regex = new RegExp(`(^|\\s)${escapeRegExp(candidate.alias)}(?=\\s|$)`, 'g');
    const match = regex.exec(text);
    if (!match) continue;
    const start = match.index + match[1].length;
    const end = start + candidate.alias.length;
    if (used.some(([from, to]) => start < to && end > from)) continue;
    used.push([start, end]);
    found.push(candidate.item);
  }
  return found;
};

const GREETING_PATTERN = /^(hi|hello|hey|yo|good\s*morning|good\s*afternoon|good\s*evening|how\s*far|how\s*(are\s*)?you(\s*(dey|doing))?|you\s*dey|wetin\s*dey|wassup|what'?s\s*up)\b/i;
const MENU_QUESTION_PATTERN = /(what.*(food|drink|dish|item).*have|what.*you.*(sell|serve|got|offer)|show.*menu|what'?s.*(on\s*the\s*)?menu|what\s*do\s*you\s*have|do\s*you\s*have\s*a\s*menu)/i;
export const isGreeting = (raw: string) => GREETING_PATTERN.test(raw.trim());
export const isMenuQuestion = (raw: string) => MENU_QUESTION_PATTERN.test(raw.trim());

export const menuSummaryByCategory = () => {
  const groups = new Map<string, string[]>();
  for (const item of menu) {
    if (!item.available) continue;
    if (!groups.has(item.category)) groups.set(item.category, []);
    groups.get(item.category)!.push(item.name);
  }
  return [...groups.entries()].map(([category, items]) => `${category}: ${items.join(', ')}`).join(' · ');
};

export const isValidPhone = (raw: string) => { const digits = raw.replace(/\D/g, ''); return digits.length >= 10 && digits.length <= 14; };
export const isValidName = (raw: string) => raw.trim().length >= 2 && /[a-zA-Z]/.test(raw.trim());
export const isValidAddress = (raw: string) => raw.trim().length >= 8 && raw.trim().split(/\s+/).filter(Boolean).length >= 2;
