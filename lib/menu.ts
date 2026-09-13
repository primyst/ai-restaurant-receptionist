export type MenuCategory = 'Mains' | 'Swallows' | 'Soups' | 'Sides' | 'Proteins' | 'Drinks';
export type MenuKind = 'package' | 'option' | 'addon' | 'drink';

export type MenuItem = {
  id: string;
  name: string;
  price: number;
  category: MenuCategory;
  kind: MenuKind;
  aliases: string[];
  available: boolean;
  includedWith?: string;
};

// Demo catalog for Iya Anike's Kitchen. Prices are editable sample prices.
// Modern meals are packages: rice comes with a standard chicken portion;
// swallow comes with one soup + one protein. Sides, extra proteins and drinks are add-ons.
export const menu: MenuItem[] = [
  { id: 'jollof', name: 'Smoky Jollof Rice', price: 3500, category: 'Mains', kind: 'package', aliases: ['jollof', 'jollof rice', 'party jollof'], available: true },
  { id: 'fried-rice', name: 'Fried Rice', price: 3500, category: 'Mains', kind: 'package', aliases: ['fried rice'], available: true },
  { id: 'white-rice', name: 'White Rice', price: 3000, category: 'Mains', kind: 'package', aliases: ['white rice', 'plain rice'], available: true },
  { id: 'jollof-spaghetti', name: 'Jollof Spaghetti', price: 3200, category: 'Mains', kind: 'package', aliases: ['spaghetti', 'jollof spaghetti'], available: true },
  { id: 'pounded-yam', name: 'Pounded Yam', price: 3500, category: 'Swallows', kind: 'package', aliases: ['pounded yam', 'poundo', 'pounded'], available: true },
  { id: 'eba', name: 'Eba', price: 3300, category: 'Swallows', kind: 'package', aliases: ['eba', 'garri'], available: true },
  { id: 'amala', name: 'Amala', price: 3300, category: 'Swallows', kind: 'package', aliases: ['amala', 'amala swallow'], available: true },
  { id: 'egusi', name: 'Egusi Soup', price: 0, category: 'Soups', kind: 'option', aliases: ['egusi', 'egusi soup'], available: true },
  { id: 'efo-riro', name: 'Efo Riro', price: 0, category: 'Soups', kind: 'option', aliases: ['efo', 'efo riro'], available: true },
  { id: 'ogbono', name: 'Ogbono Soup', price: 0, category: 'Soups', kind: 'option', aliases: ['ogbono', 'ogbono soup'], available: true },
  { id: 'okro', name: 'Okro Soup', price: 0, category: 'Soups', kind: 'option', aliases: ['okro', 'okra', 'okro soup'], available: true },
  { id: 'plantain', name: 'Fried Plantain', price: 1500, category: 'Sides', kind: 'addon', aliases: ['plantain', 'fried plantain', 'dodo'], available: true },
  { id: 'fries', name: 'French Fries', price: 2200, category: 'Sides', kind: 'addon', aliases: ['fries', 'french fries', 'chips'], available: true },
  { id: 'coleslaw', name: 'Coleslaw', price: 1200, category: 'Sides', kind: 'addon', aliases: ['coleslaw', 'slaw'], available: true },
  { id: 'moi-moi', name: 'Moi Moi', price: 1800, category: 'Sides', kind: 'addon', aliases: ['moi moi', 'moin moin', 'moi-moi'], available: true },
  { id: 'beef', name: 'Extra Beef', price: 1800, category: 'Proteins', kind: 'addon', aliases: ['beef', 'extra beef', 'peppered beef', 'assorted beef'], available: true },
  { id: 'chicken', name: 'Extra Chicken', price: 2000, category: 'Proteins', kind: 'addon', aliases: ['chicken', 'extra chicken', 'grilled chicken', 'chicken piece'], available: true },
  { id: 'fried-chicken', name: 'Fried Chicken', price: 2200, category: 'Proteins', kind: 'addon', aliases: ['fried chicken'], available: true },
  { id: 'fish', name: 'Grilled Fish', price: 4500, category: 'Proteins', kind: 'addon', aliases: ['fish', 'grilled fish'], available: true },
  { id: 'suya', name: 'Beef Suya', price: 3500, category: 'Proteins', kind: 'addon', aliases: ['suya', 'beef suya'], available: true },
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

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const normalizeText = (raw: string) => raw.toLowerCase().replace(/['']/g, '').replace(/-/g, ' ').replace(/\s+/g, ' ').trim();

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
    const start = match.index + match[1].length; const end = start + candidate.alias.length;
    if (used.some(([from, to]) => start < to && end > from)) continue;
    used.push([start, end]); found.push(candidate.item);
  }
  // Chicken is part of the standard rice package. Only treat it as an add-on
  // when the customer explicitly asks for extra/additional/more chicken.
  if (found.some(item => item.category === 'Mains') && !/\b(extra|additional|more)\s+chicken\b/i.test(text)) {
    return found.filter(item => item.id !== 'chicken');
  }
  return found;
};

const GREETING_PATTERN = /^(hi|hello|hey|yo|good\s*morning|good\s*afternoon|good\s*evening|how\s*far|how\s*(are\s*)?you(\s*(dey|doing))?|you\s*dey|wetin\s*dey|wassup|what'?s\s*up)\b/i;
const MENU_QUESTION_PATTERN = /(what.*(food|drink|dish|item).*have|what.*you.*(sell|serve|got|offer)|show.*menu|what'?s.*(on\s*the\s*)?menu|what\s*do\s*you\s*have|do\s*you\s*have\s*a\s*menu)/i;
export const isGreeting = (raw: string) => GREETING_PATTERN.test(raw.trim());
export const isMenuQuestion = (raw: string) => MENU_QUESTION_PATTERN.test(raw.trim());

export const menuSummaryByCategory = () => {
  const groups = new Map<string, string[]>();
  for (const item of menu) { if (item.kind === 'option') continue; if (!groups.has(item.category)) groups.set(item.category, []); groups.get(item.category)!.push(item.name); }
  return [...groups.entries()].map(([category, items]) => `${category}: ${items.join(', ')}`).join(' · ');
};

export const findUnavailableWords = (raw: string, matches: MenuItem[]) => {
  const normalized = raw.toLowerCase().replace(/['']/g, '').replace(/[^a-z0-9\s-]/g, ' ');
  const known = new Set(matches.flatMap(item => item.aliases.flatMap(alias => alias.toLowerCase().split(/\s+/))));
  const stop = new Set(['i','want','need','like','get','give','please','can','you','me','some','and','with','for','the','a','an','of','to','my','order','orders','food','drink','drinks','meal','meals','also','then','plus','make','it','two','three','four','five','one','more','another','piece','pieces','bottle','bottles','plate','plates','delivery','pickup','which','what','soup','would','choose','choice','extra','add','hi','hello','hey','yo','good','morning','afternoon','evening','how','far','are','doing','dey','wetin','wassup','whats','up','do','have','got','sell','serve','offer','show','menu','on']);
  return [...new Set(normalized.split(/\s+/).filter(word => word.length > 2 && !stop.has(word) && !known.has(word)))].slice(0, 3);
};

export const isValidPhone = (raw: string) => { const digits = raw.replace(/\D/g, ''); return digits.length >= 10 && digits.length <= 14; };
export const isValidName = (raw: string) => raw.trim().length >= 2 && /[a-zA-Z]/.test(raw.trim());
export const isValidAddress = (raw: string) => raw.trim().length >= 8 && raw.trim().split(/\s+/).filter(Boolean).length >= 2;
