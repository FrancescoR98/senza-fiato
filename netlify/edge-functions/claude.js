// Chiede un testo a Claude (cronache, giudizi, mercato, conferenze) tramite l'API di Anthropic.
// Gira come Edge Function e risponde in streaming, così non scade il tempo massimo delle funzioni normali.
// Serve il codice della Presidenza: la chiave API resta solo sul server.

const enc = new TextEncoder();

async function stesso(a, b) {
  const h = async (s) => new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(String(s || ""))));
  const [x, y] = await Promise.all([h(a), h(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

const errore = (msg, status) =>
  new Response(JSON.stringify({ error: msg }), { status, headers: { "content-type": "application/json; charset=utf-8" } });

export default async (req) => {
  if (req.method !== "POST") return errore("Metodo non ammesso", 405);
  const codice = Netlify.env.get("CODICE_PRESIDENTE");
  const chiave = Netlify.env.get("ANTHROPIC_API_KEY");
  if (!codice || !chiave) return errore("Claude non è configurato su Netlify", 500);
  if (!(await stesso(req.headers.get("x-codice"), codice))) return errore("Codice della Presidenza non valido", 401);

  const { prompt } = await req.json().catch(() => ({}));
  if (!prompt || typeof prompt !== "string" || prompt.length > 30000) return errore("Richiesta non valida", 400);

  const up = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": chiave, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: Netlify.env.get("CLAUDE_MODEL") || "claude-sonnet-5-5",
      max_tokens: 2500,
      stream: true,
      messages: [{ role: "user", content: prompt + "\n\nRispondi solo con il JSON richiesto, senza altro testo." }],
    }),
  });
  if (!up.ok) {
    const t = await up.text().catch(() => "");
    console.error("Anthropic", up.status, t.slice(0, 500));
    return errore(up.status === 429 ? "Troppe richieste a Claude, riprova tra poco" : "Claude non ha risposto (" + up.status + ")", up.status === 429 ? 429 : 502);
  }

  // Trasforma gli eventi SSE di Anthropic in testo semplice.
  const dec = new TextDecoder();
  let buf = "";
  const out = new ReadableStream({
    async start(controller) {
      const reader = up.body.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, i).trim();
            buf = buf.slice(i + 1);
            if (!line.startsWith("data:")) continue;
            try {
              const ev = JSON.parse(line.slice(5));
              if (ev.type === "content_block_delta" && ev.delta && ev.delta.type === "text_delta") controller.enqueue(enc.encode(ev.delta.text));
              if (ev.type === "error") controller.enqueue(enc.encode("ERRORE: " + (ev.error && ev.error.message)));
            } catch (_) { /* riga incompleta o non JSON */ }
          }
        }
      } catch (e) {
        controller.enqueue(enc.encode("ERRORE: connessione interrotta"));
      }
      controller.close();
    },
  });
  return new Response(out, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
};

export const config = { path: "/api/claude" };
