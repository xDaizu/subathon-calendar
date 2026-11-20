# ⏳ Calendario Subatón

Línea de tiempo en directo para OBS + panel de control rapidísimo para gestionar un subatón mientras juegas.

- **Overlay** (`overlay.html`): barra horizontal con fondo transparente. Muestra el momento actual avanzando, el próximo evento y los descansos (🌙). **Nunca muestra el tiempo restante ni el fin**: enseña una ventana de tiempo (24 h por defecto) alrededor de ahora.
- **Panel** (`admin.html`): pensado para usarse con una mano desde el móvil o un segundo monitor.

*[English below](#english)*

---

## Cómo funciona

| Concepto | Qué hace |
| --- | --- |
| **Tiempo restante** | Es tiempo *de directo*. Lo copias de tu temporizador (subs, bits…) cuando quieras: «12h 25m», «12:25», «1d 3h»… y empieza a contar desde ahí. Solo cambia el fin estimado. Botones rápidos +5m, +15m, +30m, +1h, −5m. **Es privado**: se guarda en el documento privado y solo lo ves tú en el panel. |
| **Descanso habitual** | Hora y duración de tu descanso diario (p. ej. 03:00, 8 h). Solo se usa para **estimar** el fin. |
| **🌙 Modo descanso** | Lo activas tú a mano. El tiempo se **pausa**, el overlay se convierte en una tarjeta nocturna con «Volvemos en…». Si te pasas de hora, se ve **«VOLVEMOS PRONTO»**, nunca un retraso. |
| **🕑 Ajustar** | Desde la tarjeta de descanso cambias la hora de inicio y de vuelta **solo del próximo** descanso (los demás siguen el habitual). Mover el inicio mantiene la duración. Descansando, toca «Vuelta prevista» para poner la hora exacta. |
| **👁 / 🙈 Próximo descanso** | En la misma tarjeta, el ojo desactiva **solo el próximo** descanso: desaparece del directo y del fin estimado. **Nunca se reactiva solo**: solo con 👁 o pulsando «A descansar». Mientras está desactivado, el documento público solo dice «desactivado» (sus horas ajustadas se guardan en privado). |
| **🔴 En curso** | Botón para empezar/terminar un evento. Los horarios son solo previsiones: un evento **no** sale «EN DIRECTO» hasta que lo marcas, y no termina hasta que lo desmarcas. Si pasa su hora sin empezar, se ve **«PRONTO»**. |
| **🙈 Eventos ocultos** | Prepáralos con antelación sin que se vean. Se guardan en el documento privado (nadie puede espiarlos). Un toque en 👁 y aparecen. |
| **Saltar** | Para eventos que al final no se hacen. |

Eventos que caen **durante un descanso previsto** no se muestran en el directo. Los que caen **después del fin estimado** sí se ven (el overlay no conoce el fin); el panel los marca con ⚠ para que decidas si ocultarlos.

Cuando el tiempo llega a 0, el **panel** (si está abierto) termina el evento en curso y el directo muestra «¡Fin del subatón!». Si añades tiempo, vuelve a la normalidad.

Todas las acciones del panel tienen **Deshacer**.

## Probar sin configurar nada

```bash
npm install
npm run dev
```

Abre <http://localhost:5173/subathon-calendar/admin.html?demo=1>. El modo demo guarda los datos en el navegador (localStorage) y el overlay `overlay.html?u=demo` se actualiza en otra pestaña del **mismo navegador**. Para OBS necesitas Firebase (abajo).

## Puesta en marcha (Firebase + GitHub Pages)

### 1. Firebase (gratis, plan Spark)

1. Crea un proyecto en <https://console.firebase.google.com>.
2. **Authentication → Sign-in method → Google**: actívalo.
3. **Authentication → Settings → Authorized domains**: añade `TU-USUARIO.github.io`.
4. **Firestore Database → Crear base de datos** (modo producción, región europea p. ej. `eur3`).
5. **Reglas**: copia [`firestore.rules.example`](firestore.rules.example) a `firestore.rules` (no se sube a git: lleva los emails de quien puede entrar), pon tu id de cuenta y los emails autorizados, y publica con `npx firebase-tools deploy --only firestore:rules`.
6. **Configuración del proyecto → Tus apps → Web (</>)**: registra una app y copia la configuración.

### 2. Local

```bash
cp .env.example .env.local   # rellena los VITE_FIREBASE_*
npm run dev
```

### 3. GitHub Pages

1. Sube el repo a GitHub (rama `main`).
2. **Settings → Pages → Source: GitHub Actions**.
3. **Settings → Secrets and variables → Actions → Variables**: crea `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`.
   (La config web de Firebase es pública por diseño; la seguridad la dan las reglas.)
4. Cada push a `main` despliega en `https://TU-USUARIO.github.io/subathon-calendar/`.

### 4. OBS

1. Entra en el panel, crea tu subatón y abre **⚙︎ Ajustes → URL para OBS → Copiar**.
2. En OBS: **Fuente → Navegador**, pega la URL, **ancho 1920, alto 200**. El fondo ya es transparente.
3. Opciones de la URL (también desde Ajustes): `lang=es|en`, `pos=bottom|top`, `theme=dark|light`, `hours=12|24|48` (ventana visible), `accent=a855f7`.

## Desarrollo

```bash
npm test          # tests de la lógica de tiempo (Vitest)
npm run build     # typecheck + build
```

- `src/lib/schedule.ts` — corazón del modelo: tiempo restante y fin estimado (solo panel), proyección de descansos (`projectRests`, pública), estados de eventos (`upcoming / soon / live / done`). Funciones puras con tests.
- `src/lib/actions.ts` — transiciones de estado puras (empezar evento, descanso, ajustar tiempo…), ejecutadas dentro de transacciones de Firestore.
- `src/overlay/` — overlay para OBS. `src/admin/` — panel. `src/i18n/` — textos (`es.ts` es la fuente; `en.ts` debe tener las mismas claves o no compila).
- Emuladores: `npx firebase-tools emulators:start` y `VITE_USE_EMULATORS=true` en `.env.local`.

---

## English

A live OBS timeline + a fast control panel for running a subathon while you play.

**Model in short:** the overlay **never shows the remaining time or the end** — just a time window (24h by default) with what's next and the rests. Remaining time is *stream time*, private (owner-only document) — paste it from your subathon timer at any moment (e.g. "12h 25m") and it counts down from there; it **pauses in rest mode**. The usual daily rest (e.g. 03:00 for 8 h) is only used to **estimate** the end. Rest mode and "In progress" are always manual toggles: planned times are just forecasts. Viewers never see lateness — an unstarted event past its time shows **SOON**, an overdue rest shows **BACK SOON**. Hidden events are stored in an owner-only document and can be revealed with one tap. Events during a projected rest are hidden from the overlay; events after the estimated end are still shown (the overlay doesn't know the end) and flagged ⚠ in the panel. When the timer hits 0, the open panel publishes "the end". Every action has Undo.

**Try it:** `npm install && npm run dev`, open `/subathon-calendar/admin.html?demo=1` (localStorage demo; overlay at `overlay.html?u=demo` in the same browser).

**Deploy:** create a Firebase project → enable Google sign-in → add `YOUR-USER.github.io` to authorized domains → create Firestore → copy [`firestore.rules.example`](firestore.rules.example) to the git-ignored `firestore.rules`, fill in the editors and deploy it → register a web app. Put the config in `.env.local` (local) and in GitHub **Actions variables** (`VITE_FIREBASE_*`). Set **Pages → Source: GitHub Actions**; every push to `main` deploys.

**OBS:** panel → ⚙︎ Settings → OBS URL → Copy. Browser Source, 1920 × 200, transparent. URL params: `lang=es|en`, `pos=bottom|top`, `theme=dark|light`, `hours=12|24|48`, `accent=hex`.
