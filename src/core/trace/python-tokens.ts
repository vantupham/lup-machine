/** Tách một dòng Python thành các mẩu để tô màu (đủ cho mã minh họa, không phải trình phân tích đầy đủ). */
export type TokenKind = 'keyword' | 'builtin' | 'string' | 'number' | 'comment' | 'plain';

export interface Token {
  readonly kind: TokenKind;
  readonly text: string;
}

const KEYWORDS = new Set([
  'and', 'as', 'class', 'def', 'elif', 'else', 'False', 'for', 'from', 'if', 'import',
  'in', 'is', 'lambda', 'None', 'not', 'or', 'return', 'True', 'while', 'with', 'yield',
]);
const BUILTINS = new Set(['print', 'range', 'len', 'int', 'float', 'self', 'enumerate', 'zip']);

/** Thứ tự quan trọng: chú thích và chuỗi trước, để dấu # trong chuỗi không bị coi là chú thích. */
const PATTERN = /(#.*$)|([rfbu]?"(?:[^"\\]|\\.)*"|[rfbu]?'(?:[^'\\]|\\.)*')|(\b\d[\d_]*(?:\.\d*)?(?:e[+-]?\d+)?\b|\b0x[\da-f]+\b)|([A-Za-z_]\w*)/gi;

export function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  const push = (kind: TokenKind, value: string) => {
    if (value === '') return;
    const prev = tokens.at(-1);
    if (prev && prev.kind === kind && kind === 'plain') tokens[tokens.length - 1] = { kind, text: prev.text + value };
    else tokens.push({ kind, text: value });
  };
  for (const match of line.matchAll(PATTERN)) {
    push('plain', line.slice(last, match.index));
    const [whole, comment, str, num, word] = match;
    if (comment) push('comment', whole);
    else if (str) push('string', whole);
    else if (num) push('number', whole);
    else if (word && KEYWORDS.has(word)) push('keyword', whole);
    else if (word && BUILTINS.has(word)) push('builtin', whole);
    else push('plain', whole);
    last = match.index + whole.length;
  }
  push('plain', line.slice(last));
  return tokens;
}
