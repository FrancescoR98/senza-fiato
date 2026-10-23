// Archivio del sito: legge e scrive i dati della società su Netlify Blobs.
// Le modifiche richiedono il codice della Presidenza (variabile CODICE_PRESIDENTE).
import { getStore } from "@netlify/blobs";
import { createHash, timingSafeEqual } from "node:crypto";
import seed from "./seed.mjs";

const COLLEZIONI = ["giocatori", "partite", "comunicati", "conferenze", "mercato", "trofei", "annuari", "club"];
const MAX_DOC = 400 * 1024; // le foto delle figurine stanno ben sotto

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

function stesso(a, b) {
  const ha = createHash("sha256").update(String(a || "")).digest();
  const hb = createHash("sha256").update(String(b || "")).digest();
  return timingSafeEqual(ha, hb);
}

function negozio() {
  return getStore({ name: "senza-fiato", consistency: "strong" });
}

// Al primo avvio copia nell'archivio i dati inseriti nella versione precedente del sito.
async function preparaArchivio(store) {
  if (await store.get("meta/inizializzato")) return;
  for (const c of COLLEZIONI) {
    const attuale = await store.get("col/" + c, { type: "json" });
    if (!attuale) await store.setJSON("col/" + c, seed[c] || {});
  }
  await store.setJSON("meta/inizializzato", { quando: new Date().toISOString() });
}

async function leggi(store, c) {
  return (await store.get("col/" + c, { type: "json" })) || {};
}

// Limite semplice ai tentativi sbagliati di codice, per indirizzo IP.
async function troppiTentativi(store, ip) {
  const key = "tentativi/" + createHash("sha256").update(ip || "?").digest("hex").slice(0, 24);
  const t = (await store.get(key, { type: "json" })) || { n: 0, da: Date.now() };
  if (Date.now() - t.da > 15 * 60 * 1000) return { key, t: { n: 0, da: Date.now() }, bloccato: false };
  return { key, t, bloccato: t.n >= 10 };
}

async function controllaCodice(req, store, context, codice) {
  const atteso = Netlify.env.get("CODICE_PRESIDENTE");
  if (!atteso) return { ok: false, res: json({ error: "Codice della Presidenza non impostato su Netlify" }, 500) };
  const lim = await troppiTentativi(store, context.ip);
  if (lim.bloccato) return { ok: false, res: json({ error: "Troppi tentativi, riprova tra 15 minuti" }, 429) };
  if (!stesso(codice, atteso)) {
    lim.t.n++;
    await store.setJSON(lim.key, lim.t);
    return { ok: false, res: json({ error: "Codice della Presidenza non valido" }, 401) };
  }
  return { ok: true };
}

export default async (req, context) => {
  const url = new URL(req.url);
  const azione = url.pathname.replace(/\/+$/, "").split("/").pop();
  const store = negozio();
  await preparaArchivio(store);

  try {
    if (azione === "data" && req.method === "GET") {
      const out = {};
      for (const c of COLLEZIONI) {
        const m = await leggi(store, c);
        out[c] = Object.entries(m).map(([id, d]) => ({ id, ...d }));
      }
      out.club = out.club.find((d) => d.id === "info") || {};
      const { blobs } = await store.list({ prefix: "voto/" });
      const voter = url.searchParams.get("voter") || "";
      const voti = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
      out.sondaggi = voti.filter(Boolean).map((v) => ({ voti: v.voti || {} }));
      const mio = blobs.findIndex((b) => b.key === "voto/" + voter);
      out.mine = mio >= 0 ? out.sondaggi[mio] : null;
      out.codiceSpogliatoio = !!Netlify.env.get("CODICE_SPOGLIATOIO");
      return json(out);
    }

    if (req.method !== "POST") return json({ error: "Metodo non ammesso" }, 405);
    const body = await req.json().catch(() => ({}));

    if (azione === "login") {
      const c = await controllaCodice(req, store, context, body.codice);
      if (!c.ok) return c.res;
      return json({ ok: true, ai: !!Netlify.env.get("ANTHROPIC_API_KEY") });
    }

    if (azione === "write") {
      const c = await controllaCodice(req, store, context, req.headers.get("x-codice"));
      if (!c.ok) return c.res;
      const { op, col, id, data } = body;
      if (!COLLEZIONI.includes(col)) return json({ error: "Sezione sconosciuta" }, 400);
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(String(id || ""))) return json({ error: "Identificativo non valido" }, 400);
      if (op !== "delete" && (!data || typeof data !== "object" || Array.isArray(data))) return json({ error: "Dati non validi" }, 400);
      if (data && JSON.stringify(data).length > MAX_DOC) return json({ error: "Documento troppo grande: usa una foto più piccola" }, 413);
      const m = await leggi(store, col);
      if (op === "set") m[id] = data;
      else if (op === "update") {
        if (!m[id]) return json({ error: "Elemento non trovato" }, 404);
        m[id] = { ...m[id], ...data };
      } else if (op === "delete") delete m[id];
      else return json({ error: "Operazione sconosciuta" }, 400);
      await store.setJSON("col/" + col, m);
      return json({ ok: true, id });
    }

    if (azione === "vote") {
      const { voter, matchId, mvp, bombola, codice } = body;
      const spogliatoio = Netlify.env.get("CODICE_SPOGLIATOIO");
      if (spogliatoio && !stesso(codice, spogliatoio)) return json({ error: "Codice spogliatoio sbagliato" }, 403);
      if (!/^[a-z0-9]{16,64}$/.test(String(voter || ""))) return json({ error: "Votante non valido" }, 400);
      const partite = await leggi(store, "partite");
      const p = partite[matchId];
      if (!p || !p.giocata) return json({ error: "Partita non trovata" }, 404);
      if (p.sondaggioChiuso) return json({ error: "Il sondaggio di questa partita è chiuso" }, 403);
      const inCampo = Object.keys(p.pagelle || {});
      if ((mvp && !inCampo.includes(mvp)) || (bombola && !inCampo.includes(bombola))) return json({ error: "Si vota solo chi è sceso in campo" }, 400);
      const key = "voto/" + voter;
      const mio = (await store.get(key, { type: "json" })) || { voti: {} };
      mio.voti[matchId] = { mvp: mvp || "", bombola: bombola || "", quando: new Date().toISOString().slice(0, 10) };
      await store.setJSON(key, mio);
      return json({ ok: true });
    }

    return json({ error: "Richiesta sconosciuta" }, 404);
  } catch (e) {
    console.error(e);
    return json({ error: "Errore del server, riprova tra poco" }, 500);
  }
};

export const config = { path: ["/api/data", "/api/login", "/api/write", "/api/vote"] };
