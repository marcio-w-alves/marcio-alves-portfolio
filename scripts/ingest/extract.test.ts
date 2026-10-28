import { describe, expect, it } from 'vitest';
import { extractReadablePage } from './extract';

const URL = 'https://pipewright.example/';

const PAGE = `<!doctype html><html lang="pt-BR"><head><title>Pipewright</title><script>window.tracking = true;</script></head><body>
  <header><nav><a href="/">Início</a> <a href="/precos">Preços</a> <a href="/entrar">Entrar</a></nav></header>
  <main>
    <h1>Builds que só fazem o que mudou</h1>
    <p>O Pipewright recompila apenas os alvos afetados por uma mudança, então o build de um monorepo termina em segundos.</p>
    <div class="mock-dashboard"><span>8,420</span><span>87% resolved by AI</span><span>5 live</span></div>
    <p class="chip"><span aria-hidden="true"><svg></svg></span><span><span>Recarga confirmada por usuário hoje</span><span>Shopping Manaíra · 120 kW · R$ 2,19/kWh oficial</span></span></p>
    <h2>Abriu o app,<br/><span>já sabe o que fazer.</span></h2>
    <p>Cada etapa fica em cache remoto e é compartilhada com o time inteiro: ninguém compila a mesma coisa duas vezes.</p>
    <ul><li>Roda no CI que você já usa, sem servidores novos para manter.</li><li>Instale o runner e aponte para o repositório.</li></ul>
    <details><summary>Funciona sem internet?</summary><p>Sim. Os builds ficam em cache local até a conexão voltar.</p></details>
  </main>
  <footer><p>© 2026 Pipewright · Todos os direitos reservados</p></footer>
</body></html>`;

describe('extracting a page’s readable text', () => {
  it('keeps the main content’s prose, in order, and leaves navigation, labels and footers out', () => {
    const { paragraphs } = extractReadablePage(PAGE, URL, 'en');
    expect(paragraphs).toEqual([
      'O Pipewright recompila apenas os alvos afetados por uma mudança, então o build de um monorepo termina em segundos.',
      'Abriu o app, já sabe o que fazer.',
      'Cada etapa fica em cache remoto e é compartilhada com o time inteiro: ninguém compila a mesma coisa duas vezes.',
      'Roda no CI que você já usa, sem servidores novos para manter.',
      'Instale o runner e aponte para o repositório.',
      'Funciona sem internet?',
      'Sim. Os builds ficam em cache local até a conexão voltar.',
    ]);
  });

  it("drops a mock screen's figures and cards, so a demo's numbers never become facts", () => {
    const text = extractReadablePage(PAGE, URL, 'en').paragraphs.join('\n');
    expect(text).not.toContain('8,420');
    expect(text).not.toContain('87% resolved by AI');
    expect(text).not.toContain('Shopping Manaíra');
  });

  it('reads the language the page declares, falling back when it declares none', () => {
    expect(extractReadablePage(PAGE, URL, 'en').language).toBe('pt');
    expect(extractReadablePage(PAGE.replace(' lang="pt-BR"', ''), URL, 'en').language).toBe('en');
  });

  it('refuses a page drawn by JavaScript, naming it, instead of keeping its shell', () => {
    const shell =
      '<html><body><div id="root">Loading…</div><script src="/app.js"></script></body></html>';
    expect(() => extractReadablePage(shell, URL, 'en')).toThrow(
      /^https:\/\/pipewright\.example\/: only \d+ characters of readable text; it renders client-side, so its static HTML cannot be ingested$/,
    );
  });

  it('never runs the page’s scripts', () => {
    const page = PAGE.replace(
      '</main>',
      '<script>document.querySelector("main").innerHTML = "<p>Injected by a script, which must not run at all.</p>";</script></main>',
    );
    expect(extractReadablePage(page, URL, 'en').paragraphs.join(' ')).not.toContain('Injected');
  });
});
