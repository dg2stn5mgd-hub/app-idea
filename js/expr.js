// A small, safe parser for functions of x, e.g. "2x^2 - 3x + 1", "(x+1)/(x-2)", "e^(-x) sin x", "|x| - 1".
// parseFunction(str) returns a JS function x -> number. It throws an Error with a friendly message on bad input.

const FUNCS = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  ln: Math.log, log: Math.log10, exp: Math.exp,
  sqrt: Math.sqrt, abs: Math.abs, cbrt: Math.cbrt,
  sec: (x) => 1 / Math.cos(x), cosec: (x) => 1 / Math.sin(x), csc: (x) => 1 / Math.sin(x), cot: (x) => 1 / Math.tan(x),
};
const CONSTS = { pi: Math.PI, e: Math.E };

function tokenize(src) {
  const s = src
    .replace(/[−–]/g, '-').replace(/[×·]/g, '*').replace(/÷/g, '/')
    .replace(/π/g, 'pi').replace(/√/g, 'sqrt').replace(/²/g, '^2').replace(/³/g, '^3')
    .toLowerCase();
  const tokens = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (/[0-9.]/.test(ch)) {
      const m = s.slice(i).match(/^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/);
      tokens.push({ t: 'num', v: parseFloat(m[0]) });
      i += m[0].length;
      continue;
    }
    if (/[a-z]/.test(ch)) {
      // Longest known name first, so "sinx" reads as sin x and "ex" as e·x.
      const rest = s.slice(i).match(/^[a-z]+/)[0];
      let name = null;
      for (const n of Object.keys(FUNCS).concat(Object.keys(CONSTS), ['x']).sort((a, b) => b.length - a.length)) {
        if (rest.startsWith(n)) { name = n; break; }
      }
      if (!name) throw new Error(`I don't know "${rest}". Use x, numbers, + − × ÷ ^ and functions like sin, ln, sqrt, abs.`);
      tokens.push(FUNCS[name] ? { t: 'fn', v: name } : name === 'x' ? { t: 'x' } : { t: 'num', v: CONSTS[name] });
      i += name.length;
      continue;
    }
    if ('+-*/^()|'.includes(ch)) { tokens.push({ t: ch }); i++; continue; }
    if (ch === '[' || ch === '{') { tokens.push({ t: '(' }); i++; continue; }
    if (ch === ']' || ch === '}') { tokens.push({ t: ')' }); i++; continue; }
    throw new Error(`Unexpected character "${ch}".`);
  }
  return tokens;
}

export function parseFunction(src) {
  if (!src || !src.trim()) throw new Error('Type a function of x.');
  const tokens = tokenize(src);
  let pos = 0;
  const peek = () => tokens[pos];
  const take = (t) => {
    const tok = tokens[pos];
    if (!tok || (t && tok.t !== t)) throw new Error(t === ')' ? 'A bracket is missing a ")".' : 'The expression looks incomplete.');
    pos++;
    return tok;
  };
  const startsPrimary = (tok) => tok && ['num', 'x', 'fn', '('].includes(tok.t);

  // expr := term (('+'|'-') term)*
  function expr() {
    let left = term();
    while (peek() && (peek().t === '+' || peek().t === '-')) {
      const op = take().t;
      const right = term();
      const l = left;
      left = op === '+' ? (x) => l(x) + right(x) : (x) => l(x) - right(x);
    }
    return left;
  }
  // term := unary (('*'|'/'| implicit) unary)*
  function term() {
    let left = unary();
    for (;;) {
      const tok = peek();
      if (tok && (tok.t === '*' || tok.t === '/')) {
        take();
        const right = unary();
        const l = left;
        left = tok.t === '*' ? (x) => l(x) * right(x) : (x) => l(x) / right(x);
      } else if (startsPrimary(tok)) {
        const right = power();
        const l = left;
        left = (x) => l(x) * right(x);
      } else return left;
    }
  }
  // unary := '-' unary | power
  function unary() {
    if (peek() && peek().t === '-') { take(); const u = unary(); return (x) => -u(x); }
    if (peek() && peek().t === '+') { take(); return unary(); }
    return power();
  }
  // power := primary ('^' unary)?   (right-associative, so 2^-x and e^x^2 behave)
  function power() {
    const base = primary();
    if (peek() && peek().t === '^') {
      take();
      const ex = unary();
      return (x) => {
        const b = base(x), p = ex(x);
        // Real odd roots of negatives, e.g. x^(1/3) for x < 0.
        if (b < 0 && !Number.isInteger(p)) {
          const inv = 1 / p;
          if (Math.abs(inv - Math.round(inv)) < 1e-9 && Math.round(inv) % 2 !== 0) return -Math.pow(-b, p);
        }
        return Math.pow(b, p);
      };
    }
    return base;
  }
  function primary() {
    const tok = peek();
    if (!tok) throw new Error('The expression looks incomplete.');
    if (tok.t === 'num') { take(); const v = tok.v; return () => v; }
    if (tok.t === 'x') { take(); return (x) => x; }
    if (tok.t === '(') { take(); const e = expr(); take(')'); return e; }
    if (tok.t === '|') { take(); const e = expr(); take('|'); return (x) => Math.abs(e(x)); }
    if (tok.t === 'fn') {
      take();
      const f = FUNCS[tok.v];
      // sin^2 x style
      if (peek() && peek().t === '^') {
        take();
        const p = unary();
        const arg = peek() && peek().t === '(' ? primary() : power();
        return (x) => Math.pow(f(arg(x)), p(x));
      }
      // sin(x) or sin x (argument without brackets binds to one implicit product like "sin 2x")
      if (peek() && peek().t === '(') { const a = power(); return (x) => f(a(x)); }
      let a = power();
      while (peek() && ['num', 'x'].includes(peek().t)) { const l = a, r = power(); a = (x) => l(x) * r(x); }
      return (x) => f(a(x));
    }
    throw new Error(`Unexpected "${tok.t}".`);
  }

  const f = expr();
  if (pos < tokens.length) throw new Error(tokens[pos].t === ')' ? 'There is an extra ")".' : 'Unexpected symbol near the end.');
  return (x) => {
    const y = f(x);
    return Number.isFinite(y) ? y : NaN;
  };
}
