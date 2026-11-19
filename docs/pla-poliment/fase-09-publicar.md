# Fase 9 — Publicar

**Qui**: un de sol. **Depèn de**: 8, i **d'una decisió que cal prendre abans**.

- [ ] Decidir on va cada meitat. És de Pere.
- [ ] Publicar.
- [ ] Les claus fora del que es publica, i el CORS i l'origen de `/api` refets.

A Vercel hi va bé el `web/`, que és estàtic. **L'API no hi encaixa tal com
és**: és un Fastify que viu, i a Vercel seria una funció que neix i mor a cada
petició. Perdria els tres caus en memòria —deteccions, taula de
disponibilitat, observacions—, el cau en disc del combustible
(`api/data/cache`) i el comptador que limita a dues preparacions alhora. A més,
els 21 MB de dades preparades no són al repositori.

Les tres sortides:

- **El web a Vercel i l'API en un servidor que viu** (Render, Fly, Railway,
  una màquina). És el que menys toca el codi: només canvia d'on penja `/api`.
- **Tot a Vercel**, amb l'API com a funcions: cal decidir on viuen les dades i
  què es fa amb els caus. Toca codi, i la memòria ho ha d'explicar.
- **Només el web**, amb les dades congelades per a la demostració. Barat, però
  deixa de ser una aplicació que respon.
