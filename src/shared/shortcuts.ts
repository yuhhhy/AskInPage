export const DEFAULT_TRANSLATE_SHORTCUT = 'KeyT';
export const DEFAULT_ASK_SHORTCUT = 'Enter';

const MODIFIER_ORDER = ['Ctrl', 'Alt', 'Shift', 'Meta'] as const;
const MODIFIER_CODES = new Set([
  'AltLeft', 'AltRight',
  'ControlLeft', 'ControlRight',
  'MetaLeft', 'MetaRight',
  'ShiftLeft', 'ShiftRight'
]);

interface ParsedShortcut {
  code: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

function parseKeyboardShortcut(value: unknown): ParsedShortcut | null {
  const parts = String(value || '').split('+').filter(Boolean);
  const code = parts.pop() || '';
  if (!code || code.includes(' ') || MODIFIER_CODES.has(code)) return null;
  const modifiers = new Set(parts);
  if (parts.some(part => !MODIFIER_ORDER.includes(part as typeof MODIFIER_ORDER[number]))) return null;
  return {
    code,
    ctrlKey: modifiers.has('Ctrl'),
    altKey: modifiers.has('Alt'),
    shiftKey: modifiers.has('Shift'),
    metaKey: modifiers.has('Meta')
  };
}

export function normalizeKeyboardShortcut(value: unknown, fallback: string): string {
  const parsed = parseKeyboardShortcut(value) || parseKeyboardShortcut(fallback);
  if (!parsed) return DEFAULT_ASK_SHORTCUT;
  const modifiers = [
    parsed.ctrlKey && 'Ctrl',
    parsed.altKey && 'Alt',
    parsed.shiftKey && 'Shift',
    parsed.metaKey && 'Meta'
  ].filter(Boolean);
  return [...modifiers, parsed.code].join('+');
}

export function keyboardShortcutFromEvent(event: KeyboardEvent): string | null {
  if (!event.code || MODIFIER_CODES.has(event.code)) return null;
  return [
    event.ctrlKey && 'Ctrl',
    event.altKey && 'Alt',
    event.shiftKey && 'Shift',
    event.metaKey && 'Meta',
    event.code
  ].filter(Boolean).join('+');
}

export function matchesKeyboardShortcut(event: KeyboardEvent, shortcut: string): boolean {
  const parsed = parseKeyboardShortcut(shortcut);
  return Boolean(parsed
    && event.code === parsed.code
    && event.ctrlKey === parsed.ctrlKey
    && event.altKey === parsed.altKey
    && event.shiftKey === parsed.shiftKey
    && event.metaKey === parsed.metaKey);
}

const CODE_LABELS: Record<string, string> = {
  Backquote: '`',
  Backslash: '\\',
  Backspace: 'Backspace',
  BracketLeft: '[',
  BracketRight: ']',
  Comma: ',',
  Delete: 'Delete',
  End: 'End',
  Enter: 'Enter',
  Equal: '=',
  Escape: 'Esc',
  Home: 'Home',
  Insert: 'Insert',
  Minus: '-',
  PageDown: 'Page Down',
  PageUp: 'Page Up',
  Period: '.',
  Quote: "'",
  Semicolon: ';',
  Slash: '/',
  Space: 'Space',
  Tab: 'Tab'
};

function formatCode(code: string): string {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^F\d{1,2}$/.test(code)) return code;
  if (code.startsWith('Arrow')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  return CODE_LABELS[code] || code;
}

export function formatKeyboardShortcut(shortcut: string): string[] {
  const parsed = parseKeyboardShortcut(shortcut);
  if (!parsed) return [];
  return [
    parsed.ctrlKey && 'Ctrl',
    parsed.altKey && 'Alt',
    parsed.shiftKey && 'Shift',
    parsed.metaKey && 'Meta',
    formatCode(parsed.code)
  ].filter((part): part is string => Boolean(part));
}
