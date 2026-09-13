export type MenuItem = {
  id: string;
  name: string;
  price: number;
  category: 'Mains' | 'Sides' | 'Soups' | 'Proteins' | 'Breakfast' | 'Drinks';
  aliases: string[];
  available: boolean;
};

// Demo catalog. Prices are intentionally editable sample prices, not a real restaurant menu.
export const menu: MenuItem[] = [
  { id: 'jollof', name: 'Smoky Jollof Rice', price: 3500, category: 'Mains', aliases: ['jollof', 'jollof rice', 'party jollof'], available: true },
  { id: 'fried-rice', name: 'Fried Rice', price: 3500, category: 'Mains', aliases: ['fried rice'], available: true },
  { id: 'white-rice', name: 'White Rice', price: 2500, category: 'Mains', aliases: ['white rice', 'plain rice'], available: true },
  { id: 'spaghetti', name: 'Jollof Spaghetti', price: 3200, category: 'Mains', aliases: ['spaghetti', 'jollof spaghetti'], available: true },
  { id: 'yam', name: 'Fried Yam', price: 2500, category: 'Mains', aliases: ['fried yam', 'yam'], available: true },
  { id: 'chips', name: 'French Fries', price: 2200, category: 'Sides', aliases: ['fries', 'french fries', 'chips'], available: true },
  { id: 'plantain', name: 'Fried Plantain', price: 1500, category: 'Sides', aliases: ['plantain', 'fried plantain', 'dodo'], available: true },
  { id: 'coleslaw', name: 'Coleslaw', price: 1200, category: 'Sides', aliases: ['coleslaw', 'slaw'], available: true },
  { id: 'salad', name: 'Garden Salad', price: 1800, category: 'Sides', aliases: ['salad', 'garden salad'], available: true },
  { id: 'puff-puff', name: 'Puff Puff', price: 1200, category: 'Breakfast', aliases: ['puff puff', 'puffpuff'], available: true },
  { id: 'moi-moi', name: 'Moi Moi', price: 1800, category: 'Breakfast', aliases: ['moi moi', 'moin moin', 'moi-moi'], available: true },
  { id: 'akara', name: 'Akara', price: 1500, category: 'Breakfast', aliases: ['akara', 'bean cake'], available: true },
  { id: 'peppered-beef', name: 'Peppered Beef', price: 2500, category: 'Proteins', aliases: ['beef', 'peppered beef', 'assorted beef'], available: true },
  { id: 'grilled-chicken', name: 'Grilled Chicken', price: 2000, category: 'Proteins', aliases: ['chicken', 'grilled chicken', 'chicken piece'], available: true },
  { id: 'fried-chicken', name: 'Fried Chicken', price: 2200, category: 'Proteins', aliases: ['fried chicken'], available: true },
  { id: 'fish', name: 'Grilled Fish', price: 4500, category: 'Proteins', aliases: ['fish', 'grilled fish'], available: true },
  { id: 'suya', name: 'Beef Suya', price: 3500, category: 'Proteins', aliases: ['suya', 'beef suya'], available: true },
  { id: 'egusi', name: 'Egusi Soup', price: 3000, category: 'Soups', aliases: ['egusi', 'egusi soup'], available: true },
  { id: 'efo-riro', name: 'Efo Riro', price: 3000, category: 'Soups', aliases: ['efo', 'efo riro'], available: true },
  { id: 'ogbono', name: 'Ogbono Soup', price: 3000, category: 'Soups', aliases: ['ogbono', 'ogbono soup'], available: true },
  { id: 'okro', name: 'Okro Soup', price: 2800, category: 'Soups', aliases: ['okro', 'okra', 'okro soup'], available: true },
  { id: 'coke', name: 'Coca-Cola', price: 500, category: 'Drinks', aliases: ['coke', 'coca cola', 'coca-cola', 'cola'], available: true },
  { id: 'fanta', name: 'Fanta', price: 500, category: 'Drinks', aliases: ['fanta'], available: true },
  { id: 'sprite', name: 'Sprite', price: 500, category: 'Drinks', aliases: ['sprite'], available: true },
  { id: 'pepsi', name: 'Pepsi', price: 500, category: 'Drinks', aliases: ['pepsi'], available: true },
  { id: '7up', name: '7UP', price: 500, category: 'Drinks', aliases: ['7up', '7 up'], available: true },
  { id: 'malt', name: 'Malt', price: 700, category: 'Drinks', aliases: ['malt', 'maltina'], available: true },
  { id: 'chapman', name: 'Chapman', price: 1800, category: 'Drinks', aliases: ['chapman'], available: true },
  { id: 'juice', name: 'Fruit Juice', price: 1500, category: 'Drinks', aliases: ['juice', 'fruit juice', 'orange juice'], available: true },
  { id: 'water', name: 'Bottled Water', price: 300, category: 'Drinks', aliases: ['water', 'bottle water', 'bottled water'], available: true },
  { id: 'ginger', name: 'Ginger Drink', price: 1200, category: 'Drinks', aliases: ['ginger', 'ginger drink'], available: true },
];

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const findMenuMatches = (raw: string) => {
  const text = raw.toLowerCase().replace(/['']/g, '').replace(/-/g, ' ');
  const candidates = menu.flatMap(item => item.aliases.map(alias => ({
    item,
    alias: alias.toLowerCase().replace(/-/g, ' '),
  }))).sort((a, b) => b.alias.length - a.alias.length);
  const used: Array<[number, number]> = [];
  const found: MenuItem[] = [];

  for (const candidate of candidates) {
    if (!candidate.item.available) continue;
    const regex = new RegExp(`(^|\\s)${escapeRegExp(candidate.alias)}(?=\\s|$)`, 'g');
    const match = regex.exec(text);
    if (!match) continue;
    const start = match.index + match[1].length;
    const end = start + candidate.alias.length;
    const overlaps = used.some(([from, to]) => start < to && end > from);
    if (overlaps) continue;
    used.push([start, end]);
    found.push(candidate.item);
  }

  return found;
};

// Small talk / non-order phrases the receptionist should recognize and
// respond to conversationally, instead of treating every stray word as
// an "unavailable menu item".
const GREETING_PATTERN = /^(hi|hello|hey|yo|good\s*morning|good\s*afternoon|good\s*evening|how\s*far|how\s*(are\s*)?you(\s*(dey|doing))?|you\s*dey|wetin\s*dey|wassup|what'?s\s*up)\b/i;
const MENU_QUESTION_PATTERN = /(what.*(food|drink|dish|item).*have|what.*you.*(sell|serve|got|offer)|show.*menu|what'?s.*(on\s*the\s*)?menu|what\s*do\s*you\s*have|do\s*you\s*have\s*a\s*menu)/i;

export const isGreeting = (raw: string) => GREETING_PATTERN.test(raw.trim());
export const isMenuQuestion = (raw: string) => MENU_QUESTION_PATTERN.test(raw.trim());

export const menuSummaryByCategory = () => {
  const groups = new Map<string, string[]>();
  for (const item of menu) {
    if (!groups.has(item.category)) groups.set(item.category, []);
    groups.get(item.category)!.push(item.name);
  }
  return [...groups.entries()].map(([category, items]) => `${category}: ${items.join(', ')}`).join(' · ');
};

export const findUnavailableWords = (raw: string, matches: MenuItem[]) => {
  const normalized = raw.toLowerCase().replace(/['']/g, '').replace(/[^a-z0-9\s-]/g, ' ');
  const known = new Set(matches.flatMap(item => item.aliases.flatMap(alias => alias.toLowerCase().split(/\s+/))));
  const stop = new Set([
    'i', 'want', 'need', 'like', 'get', 'give', 'please', 'can', 'you', 'me', 'some', 'and', 'with', 'for',
    'the', 'a', 'an', 'of', 'to', 'my', 'order', 'orders', 'food', 'drink', 'drinks', 'meal', 'meals', 'also',
    'then', 'plus', 'make', 'it', 'two', 'three', 'four', 'five', 'one', 'more', 'another', 'piece', 'pieces',
    'bottle', 'bottles', 'plate', 'plates', 'delivery', 'pickup',
    // greetings / smalltalk / questions — these should never be treated as an unrecognized menu item
    'hi', 'hello', 'hey', 'yo', 'good', 'morning', 'afternoon', 'evening', 'how', 'far', 'are', 'doing', 'dey',
    'wetin', 'wassup', 'whats', 'up', 'what', 'do', 'have', 'got', 'sell', 'serve', 'offer', 'show', 'menu', 'on',
  ]);
  return [...new Set(normalized.split(/\s+/).filter(word => word.length > 2 && !stop.has(word) && !known.has(word)))].slice(0, 3);
};

// --- Basic input validation for customer details ---

export const isValidPhone = (raw: string) => {
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 14;
};

export const isValidName = (raw: string) => {
  const trimmed = raw.trim();
  return trimmed.length >= 2 && /[a-zA-Z]/.test(trimmed);
};

export const isValidAddress = (raw: string) => {
  const trimmed = raw.trim();
  if (trimmed.length < 8) return false;
  // A real delivery address is normally more than one word (street + area,
  // house number + street, etc). Catches single-word junk like "rubbish".
  const words = trimmed.split(/\s+/).filter(Boolean);
  return words.length >= 2;
};
