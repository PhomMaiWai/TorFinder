# LINE notifications: one-time setup

TOR Finder sends match alerts through a **LINE Official Account (OA)** using the
**LINE Messaging API**. (LINE Notify shut down in March 2025.) Until the three
keys below are set, the LINE card on the Notifications page says "not enabled"
and nothing else changes.

## 1. Create the Official Account (one team member, about 10 minutes)

1. Go to <https://developers.line.biz/console/> and sign in with a LINE account.
   Any team member's account works. You can add the others as admins later.
2. Create a **Provider**, for example "TOR Finder".
3. Under the provider, create a **Messaging API** channel. The console walks
   you through creating the OA on LINE Official Account Manager. The free
   plan is enough for development.
4. In **LINE Official Account Manager → Settings → Response settings**:
   - turn **Webhook** on
   - turn **Auto-response** off. If you leave it on, the OA also answers the
     link code with its generic "can't reply" message.

## 2. Copy the three keys into `.env`

| Variable | Where to find it |
| --- | --- |
| `LINE_CHANNEL_ACCESS_TOKEN` | Developers console → channel → **Messaging API** → *Channel access token (long-lived)* → Issue |
| `LINE_CHANNEL_SECRET` | Developers console → channel → **Basic settings** → *Channel secret* |
| `LINE_BOT_ID` | Messaging API tab → *Bot basic ID*, including the `@` (e.g. `@123abcde`) |

Put them in the root `.env` for Docker, or in `backend/.env` for `npm run dev`.
Then restart the backend.

## 3. Point the webhook at the site

Go to Developers console → **Messaging API** → *Webhook URL* and enter:

```
https://<your-site>/api/line/webhook
```

Then press **Verify**. It should answer *Success*. Turn on **Use webhook**.

LINE only calls public **HTTPS** URLs, so `localhost` won't work. For local
testing, expose the frontend with a tunnel and use its URL:

```
cloudflared tunnel --url http://localhost:3000   # or: ngrok http 3000
```

## How users connect

1. Notifications page → **Connect LINE**. The page shows a code like `TF-K7QH2MXA`.
2. **Open LINE and send the code** opens the OA chat with the code already
   typed in. If they aren't friends with the OA yet, the "Add TOR Finder"
   link handles that first.
3. The webhook matches the code (it works for 10 minutes, once) and saves
   the sender's LINE user id. The OA replies "connected" and the page updates
   by itself.

If someone blocks the OA, they are unlinked automatically. A LINE id can never
be typed in by hand, so nobody can send alerts to someone else's LINE.

## Quota

Link-code replies are free. Each alert is a *push* message, and push messages
count toward the OA plan's monthly quota (the free plan includes a few hundred).
That is plenty for a demo. For real use, check the current plan prices in
LINE Official Account Manager.
