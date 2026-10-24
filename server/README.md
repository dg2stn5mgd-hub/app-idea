# Carriage live-data server

This small server gets **live bus arrival times** and **MRT service alerts** from LTA DataMall, the same data the MyTransport.SG app uses, and passes them to the Carriage app.

You need it because LTA gives you a secret **account key**. If the key were inside the app, anyone could copy it. The server keeps it hidden.

```
Carriage app  →  this server (holds your secret key)  →  LTA DataMall
```

Setup is free and takes about 15 minutes, all in your web browser. Nothing to install.

## Step 1: Get an LTA DataMall account key

1. Go to the LTA DataMall "Request for API Access" page: https://datamall.lta.gov.sg/content/datamall/en/request-for-api.html
2. Fill in the form. For what you'll use it for, something like "A student project that matches commuters on the same bus" is fine.
3. LTA emails you an **AccountKey** (a long string of letters and numbers). Keep it private, like a password. Don't post it in a chat or put it in GitHub.

## Step 2: Create the server on Cloudflare (free)

1. Sign up at https://dash.cloudflare.com/sign-up. The free plan is enough (100,000 requests a day).
2. In the menu, open **Workers & Pages**, then **Create**, then **Create Worker**.
3. Name it `carriage-live` and click **Deploy**. Cloudflare gives it an address like `https://carriage-live.yourname.workers.dev`.
4. Click **Edit code**. Delete everything in the editor, paste in the whole of [`worker.js`](worker.js), then click **Deploy**.

## Step 3: Give the server your LTA key

1. Go back to the worker and open **Settings**, then **Variables and Secrets**.
2. Click **Add**, choose type **Secret**, name it exactly `LTA_ACCOUNT_KEY`, and paste your LTA key as the value.
3. Click **Deploy**.

## Step 4: Check it works

Open this in your browser, with your own worker address:

```
https://carriage-live.yourname.workers.dev/arrivals?stop=92071
```

You should see the next buses at Marine Terr Stn Exit 4, with their arrival times. Compare them with MyTransport.SG and they should match. Also try `/train-alerts`.

If you see an error, it tells you what's wrong (for example, the key is missing).

## Step 5: Connect the app

In `prototype/index.html`, find this line near the top:

```js
const LIVE_API = "";
```

Put your worker address between the quotes, then run `python3 prototype/make_new_user.py` so the new-user page gets it too. Open the **Ride day** screen and the times say **Live from LTA**.

**Note:** the claude.ai prototype links are locked down and can't fetch data from other websites, so they always show sample times. Live times work when the app runs from its own website or from the file on your computer.

## Optional: only let your app use the server

Once the app has its own website, add another variable called `ALLOWED_ORIGIN` with that site's address (for example `https://carriage.example.com`). Then only your app can use the server.

## What it answers

| Address | What you get |
|---|---|
| `/arrivals?stop=92071&service=150` | The next 3 buses of service 150 at stop 92071 |
| `/arrivals?stop=92071` | The next buses of every service at that stop |
| `/train-alerts` | Whether MRT lines are running normally, and any delay messages |
| `/search?q=dunman%20high%20school` | Places matching a school, building, address or postal code, with where they are (from OneMap, Singapore's official map; no key needed) |
| `/check` | Whether your saved key looks right and LTA accepts it (never shows the key) |

Each bus has: the arrival time, minutes away, whether it's **tracked by GPS** or just from the timetable, how full it is (seats available, standing available, limited standing), and whether it's single-deck, double-deck or bendy.

Answers are reused for 20 seconds, because LTA only updates about that often. This saves your LTA quota.

## Testing without an LTA key

`node server/test.mjs` checks the server against a pretend LTA reply. It needs no internet and no key.
