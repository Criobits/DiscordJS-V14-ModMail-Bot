# Modmail

Benvenuto in Modmail, un progetto di bot Discord originariamente sviluppato da T.F.A#7524 e ora potenziato con funzionalità avanzate e un backend di database MariaDB. Questa versione è progettata per gestire in modo efficiente e sicuro le comunicazioni modmail su un server.

Se trovi utile questo progetto, per favore mostra il tuo supporto mettendo una stella (⭐️) al repository originale! 🙏

---

## Funzionalità Principali

* **Facile da usare e configurare**: Il setup è semplice e intuitivo.
* **Gestione Semplificata**: Semplifica la gestione delle modmail attraverso un'interfaccia pulita.
* **Sistema di Transcript**: Ogni ticket chiuso genera una cronologia completa e pulita della conversazione.
* **Sistema di Logging con Webhook**: Tiene traccia delle azioni più importanti, come la creazione e la chiusura dei ticket.
* **Gestione Ban**: Permette di bannare e sbannare utenti dal sistema di ModMail.

---

## ✨ Funzionalità Avanzate Aggiunte

Questa versione include miglioramenti significativi per la gestione, la sicurezza e l'archiviazione:

* **Archivio Transcript Centralizzato**: Alla chiusura di un ticket, il transcript completo della conversazione viene inviato in un canale dedicato, creando un archivio sicuro e facilmente consultabile.
* **Logica di Chiusura Migliorata**: Quando un ticket viene chiuso, al membro dello staff viene richiesto un motivo tramite un popup. Questo motivo viene registrato nei log e inviato all'utente.
* **Log Dettagliati delle Azioni**: Ogni azione critica (risposta, chiusura, ban/unban) viene registrata in modo dettagliato in un canale di log tramite webhook per una maggiore tracciabilità.
* **Conferma per Azioni Critiche**: Per prevenire errori, azioni come la chiusura di un ticket richiedono una seconda conferma da parte dello staff.
* **Backend con MariaDB**: Il bot utilizza `mysql2` per connettersi a un database MariaDB (o MySQL), garantendo maggiore robustezza e scalabilità.

---

## Requisiti

* [**Node.js**](https://nodejs.org/en/): versione 16.9.0 o superiore.
* [**discord.js**](https://www.npmjs.com/package/discord.js): versione 14.13.0 o superiore.
* [**mysql2**](https://www.npmjs.com/package/mysql2): la versione più recente.
* [**horizon-handler**](https://www.npmjs.com/package/horizon-handler): versione 1.6.0 o superiore.
* [**colors**](https://www.npmjs.com/package/colors): qualsiasi versione.
* Un **server MariaDB o MySQL** accessibile.

---

## ⚙️ Setup del Progetto

Per avviare il progetto, segui questi passaggi:

1.  **Scarica il codice sorgente.**
2.  Apri la cartella del progetto nel tuo editor di codice (es. Visual Studio Code).
3.  Esegui `npm install` nel terminale per installare tutte le dipendenze necessarie.
4.  **Configura il bot**:
    * Rinomina `example.config.js` in `config.js`.
    * Compila i campi nella sezione `client` con il **token** e l'**ID** del tuo bot, che puoi ottenere dal [Discord Developer Portal](https://discord.com/developers).
    * Nella sezione `database`, inserisci le credenziali di accesso al tuo database MariaDB/MySQL.
    * Configura la sezione `modmail`, inserendo l'ID del tuo server, gli ID delle categorie e, soprattutto, l'ID del **canale per i transcript** (`transcriptChannelId`).
    * Infine, imposta l'URL del webhook nella sezione `logs`.
5.  **Avvia il bot**: Esegui `npm run start` o `node .` nel terminale.
6.  Fatto! Goditi il tuo bot ModMail potenziato.

---

## Bisogno di Assistenza?

Se incontri problemi o hai domande su questo progetto, sentiti libero di creare una "issue" sul repository GitHub. Il tuo feedback è prezioso e aiuta a migliorare il progetto.

## Licenza

The **MIT** License.