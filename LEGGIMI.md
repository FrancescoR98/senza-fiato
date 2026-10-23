# Senza Fiato · sito ufficiale su Netlify

Questa cartella contiene il sito completo: partite, pagellino, figurine, classifiche, premi, calciomercato, sala stampa, sondaggi e le funzioni di Claude.
Al primo avvio il sito copia da solo nel suo archivio i dati che avevi già inserito: 7 giocatori, 6 partite, la conferenza stampa, le 2 voci di mercato e i dati della società.

## Cosa c'è dentro

| Percorso | A cosa serve |
|---|---|
| `public/index.html` | Il sito che vedono tutti |
| `public/logo.webp` | Il logo ufficiale |
| `netlify/functions/api/api.mjs` | L'archivio: legge e salva i dati, controlla il codice della Presidenza, registra i voti |
| `netlify/functions/api/seed.mjs` | I dati già inseriti, copiati nell'archivio al primo avvio |
| `netlify/edge-functions/claude.js` | Collega i pulsanti "con Claude" all'API di Anthropic |
| `netlify.toml`, `package.json` | Configurazione per Netlify |

## Pubblicare il sito (circa 15 minuti)

Le funzioni lato server non funzionano con il semplice trascinamento della cartella su Netlify Drop. Serve passare da GitHub, che è gratuito.

1. **Crea un account GitHub** su github.com, se non ce l'hai.
2. **Crea un nuovo repository** (pulsante "New"), chiamalo per esempio `senza-fiato` e lascialo privato.
3. **Carica i file.** Nella pagina del repository scegli "uploading an existing file" e trascina **il contenuto** di questa cartella: `public`, `netlify`, `netlify.toml`, `package.json` e `LEGGIMI.md`. Poi premi "Commit changes".
4. **Crea un account Netlify** su netlify.com, entrando con GitHub.
5. **Collega il repository.** Su Netlify: "Add new site" → "Import an existing project" → GitHub → scegli `senza-fiato`. Lascia le impostazioni di build come sono e premi "Deploy".
6. **Imposta i codici.** Vai in "Site configuration" → "Environment variables" → "Add a variable" e aggiungi:
   - `CODICE_PRESIDENTE`: il codice per entrare nell'Area Presidenza. Sceglilo lungo, per esempio quattro parole: `bombola-lasagna-traversa-1926`.
   - `ANTHROPIC_API_KEY`: la chiave per le funzioni di Claude (vedi sotto).
   - `CODICE_SPOGLIATOIO` *(facoltativo)*: se lo imposti, per votare nei sondaggi serve questo codice, da dare solo ai compagni. Se non lo imposti, può votare chiunque abbia il link, una volta per telefono.
7. **Ripubblica.** Vai in "Deploys" → "Trigger deploy" → "Deploy site", così il sito legge le variabili appena inserite.
8. **Cambia il nome del sito**, se vuoi: "Site configuration" → "Change site name", per esempio `senzafiato.netlify.app`.

## La chiave di Claude

1. Vai su console.anthropic.com e crea un account.
2. In "Billing" aggiungi un piccolo credito: bastano pochi euro per una stagione. Ogni cronaca, conferenza o voce di mercato costa qualche centesimo.
3. In "API Keys" crea una chiave e copiala in `ANTHROPIC_API_KEY` su Netlify.

La chiave resta solo su Netlify: non compare mai nella pagina e solo chi ha il codice della Presidenza può usare Claude.
Per cambiare il modello di Claude puoi aggiungere la variabile `CLAUDE_MODEL`; di base usa `claude-sonnet-5-5`.
Senza chiave il sito funziona lo stesso: i pulsanti di Claude semplicemente non compaiono.

## Usare l'Area Presidenza

- In fondo alla pagina c'è il pulsante **Area Presidenza**: inserisci il codice e compaiono tutti i pulsanti per modificare.
- Il telefono o il computer se lo ricorda. Per uscire c'è **Esci** nella barra della Presidenza.
- Dopo 10 codici sbagliati di fila da una stessa connessione, il sito blocca i tentativi per 15 minuti.
- Se pensi che qualcuno abbia scoperto il codice, cambialo su Netlify e ripubblica: tutti i telefoni che lo avevano salvato vengono disconnessi.

## Aggiornare il sito in futuro

Basta sostituire i file su GitHub, per esempio `public/index.html`: Netlify ripubblica da solo in un minuto.
I dati inseriti dal sito non stanno nei file e restano al sicuro nell'archivio di Netlify.
Il file `seed.mjs` viene letto solo al primo avvio: modificarlo dopo non cambia nulla.
