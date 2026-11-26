# Carriage (working name)

An app for meeting people on your daily commute, starting with friends and adding dating later.

## The idea

People in Singapore spend their train and bus rides scrolling on their phones. Many are too busy for proper meetups or dates. Carriage uses the commute you already take: it matches you with people who ride the same train at about the same time and like the same things, so you can talk on the way to school or work.

## How it works

**Five tabs at the bottom, always one tap away:** Map (navigation), Rides (people on your commute and your waves, with a badge for new ones), Chats (messages, with a badge for unread ones), Met (people you've ridden with) and Me (your commute, interests and who you want to meet).

**Rides** opens as three folded groups, each showing how many people and their initials. Tap one to open it (and close the others): **Waved at you** (wave back, or a private "Not now"; after waving back they stay here with "Plan a ride"), **On your ride** (everyone you can wave at; people you've waved at show "Waiting" with "Take back"), and **A bit earlier or later**.

**Met** starts with a slim **"Rate your ride with…"** banner when a rating is waiting, then three folded groups: **Friends** (contacts shared: Chat, Ride again), **Riding again** (next ride date, time and carriage: Chat) and **Past rides** (no second ride or didn't show; only you see this).

Waves on a **one-off trip** are remembered with that trip: when you both wave, the match shows in Chats as "One-off trip: Punggol → Raffles Place · 07:45", and planning the ride uses that trip.

**Chats** has three groups, each with its own rules:
- **About to meet** (a ride is planned): **quick messages only**, like "Running late, I'll take the next one" or "I'm in the carriage now". The quick messages on the ride ticket land here too.
- **Haven't met yet** (you both waved): no messages yet, just **Plan a ride**. The warm-up questions do the talking, which keeps first rides a surprise and keeps strangers from messaging before you meet.
- **Met before** (friends, and people you're riding with again): **free chat**.

Rides and Waves use your saved **daily commute**, so you never have to search a destination to check them. A one-off trip searched on the Map can be shown on Rides too, with a button to switch back to your commute.

**The Map tab works like a maps app.** You pick where you're going (or tap **Home → School**, which says **Home → Work** if you picked Working when signing up), start from **your current location** (GPS) or anywhere else, tap **Now** to leave now, and see your route. For a place that isn't a station or stop, the route includes the walk to and from whichever nearby station or bus stop makes the whole trip fastest (stations up to 1 km away, bus stops up to 500 m). Then you choose:
- **Just navigate**: Carriage's own full-screen navigation (below). "Open in Google Maps instead" hands the trip to Google Maps.
- **Meet someone on this ride**: Carriage's own feature, described below.

**Navigation mode** fills the screen so you only see the next step: "280 m, walk to Tanjong Rhu", "Take the TEL towards Woodlands North", "2 stops left", "Get off at Katong Park". A blue dot shows where you are, with a beam showing which way you're facing (from the phone's compass), and the arrow at the top turns with you. You can see the minutes left, your arrival time and the distance to go. If you're not on the route (for example when showing the app to someone at home), a demo moves you along it instead. Walks follow the streets with turn-by-turn directions ("220 m, turn right onto Fort Road") from OneMap's free routing service, through the live-data server. Until that's set up, or in the claude.ai previews, walks are straight lines.

**Getting in and out of stations:** navigation walks you to the **station exit** closest to where you are ("Walk to Tanjong Rhu, Exit 2"), then says "Enter at Exit 2: go down to the TEL platform for trains towards Woodlands North". At a change it says "Change to the NSL at Dhoby Ghaut: follow the signs to the North-South Line platform". After the ride it picks the exit closest to where you're going ("Leave by Exit 2, the closest exit to Dunman High School"). Exits show as yellow badges on the map. For buses, it gives the stop's name, number and road ("Stop 92239 · Marine Cres"), reminds you to wave the bus down, and says "Press the bell now" one stop before yours. On a planned ride, it also says where to stand on the platform: "Meet Yu Ting in carriage 3: carriage 1 is at the front, the end the train is heading to".

**A booked ride happens in stages, each on its own screen:**
1. **Booked:** the ride ticket is just the plan (who, when, where, how to spot them, warm-up answers) and "what happens next". Your next ride also sits at the top of Rides.
2. **The night before:** a reminder notification ("Tomorrow: ride with Yu Ting · 07:45 at Marine Terrace, carriage 3"), and home shows a "Tomorrow" card.
3. **That morning:** home opens with a "Today" card: meet time, station and carriage, when to leave, live train status, and one button, **Start walking to Marine Terrace**.
4. **Walking:** full-screen navigation that follows your live location (the dot glides smoothly between GPS readings), walking you to the right station exit.
5. **On the platform:** the panel switches to meeting them: how to spot them, quick messages ("I'm here", "Which carriage are you in?", "I see you!") and **We've met**, which you both tap.
6. **Riding together:** stops left together and a conversation starter.
7. **Ride over:** when your location reaches the stop where your shared part ends, navigation closes by itself and the private rating opens.

In the prototype, "skip ahead" buttons on the ticket jump to the night before or the ride morning. Real reminders at a set time need the live-data server to send push notifications (Web Push), which is the next server job.

Notifications work when the app is on the home screen and allowed to send them; otherwise the message shows inside the app.

You can't add features inside Google Maps itself (Google doesn't allow it), so Carriage has its own maps-style front screen and hands off to Google Maps for directions. It doesn't try to compete with Google on navigation. The people are the point.

Your profile (set up once, editable on the Me tab) covers:

1. **Set your commute**: where you start and where you get off (any MRT station, bus stop, or real place like a school, building, address or postal code, found through OneMap), the time you set off, and how you travel: **MRT only** for now (bus routing is built but switched off). The app works out the fastest route across every MRT line and bus service, including changes and short walks between a bus stop and a station.
2. **Pick your interests**, for example investing or cars.
3. **Choose who to meet**: friends mode now, dating mode (18+) later, plus an age range and how flexible your timing is.
4. **See matches**: people who share at least one stop with you, going the same way, within your time window. Every train and bus of your trip counts, so someone can join you before or after a change, or change with you.
5. **Wave**: if both people wave, you plan a ride together and pick a day and where to meet: a carriage on a train, or a seat on a bus (upper deck front, upper deck back, lower deck).
   - **Same route, a bit earlier or later**: people who ride your route outside your time window (up to 30 min away). You can wave at them too, and you'd catch their train.
   - **Waves** live on the Rides tab: people who waved at you first are at the top ("Wave back" or a private "Not now"), and people you waved at show "Waiting" ("Take back" to undo). Waves end quietly after 7 days. When you both wave, plan the ride from Rides or Chats.
6. **Warm up, don't chat**: there's no free chat before you meet. Each person adds a "how to spot me" note and answers up to 3 fun warm-up questions, so there's a hint but plenty left to talk about. Quick preset messages ("Running late", "Can't make it today") cover plan changes.
7. **Ride day**: shortly before you leave, the app checks **live bus arrivals from LTA** and picks the exact bus you and your match should catch: the first one at or after your planned time. It shows whether each bus is GPS-tracked, how full it is, and whether it's single-deck (so "upper deck" won't work). Tapping another bus tells your match. For trains, it shows whether the line is running normally or delayed.
8. **Feedback after the ride**: rate it privately (Great / Okay / Not for me / They didn't show up). Then choose whether to ride together again and whether to share contacts (Telegram, Instagram or phone).
9. **Become friends**: a second ride or a contact swap only happens if **both** people say yes. If only one does, they get a gentle "no second ride this time" note after a couple of days instead of waiting forever. Nobody is told who said what.

## Why it's low-risk to try

You're already on your way to school or work. If the other person runs late, gets sick or doesn't show, you've lost nothing: you still got where you were going. That makes it much easier to say yes than to a normal meetup.

## Safety rules (from day one)

- People under 18 are only matched with other people under 18. Dating mode is 18+ only, with ID checks.
- Nobody can see your stations or your time until you both wave.
- Matches show only the part of the ride you share, never your full route.
- Block and report are always one tap away.
- Ratings are private and never shown to the other person. People who often miss rides get fewer matches.

## Known challenges

- **Not enough users at the start.** Matching needs people on the same route at the same time. Plan: launch on one line (Thomson-East Coast) or one school first, and allow a wider time window early on.
- **Timing.** People may need to leave a few minutes early to catch the same train. Buses may be easier because they come less often.
- **Planning ahead is estimated; ride day is live.** LTA's live arrivals only cover the next ~30 minutes, so nobody can know tomorrow's exact bus. Matching ahead of time uses estimated times (about 25 km/h between stops, 5 min average wait, walks at 75 m a minute). On the day, the Ride day screen uses LTA's live arrivals ([server/](server/README.md)) to pick the actual bus, which takes care of rush-hour delays.
- **Trains have no live arrival times.** LTA DataMall gives train disruptions, not the minute each train comes. Trains run every 2 to 5 minutes at peak, so the app says "be on the platform by 07:43, take the next train together".
- **Transfers and route choice.** Most people change lines. The prototype picks the fastest route (2 min per stop, 5 min per change) and matches on every line. Still to work out:
  - People don't always take the fastest route. They should be able to edit their route.
  - Walking time at a change differs a lot by station (Dhoby Ghaut vs a cross-platform change), which shifts everyone's timing after it.
  - Carriage choice matters: people board near the stairs for their change or exit. That's a good hint for where to meet.
  - Trains have different lengths (TEL 4 carriages, NSL/EWL/NEL 6, Circle/Downtown 3).
  - Delays and breakdowns break plans. Live train data could warn both people.

## Maps and data for the real app

- **Route map** (in the prototype now): Singapore's outline with every MRT line drawn faintly and your route highlighted, zoomed to your trip, with a "Whole map" view. Station positions come from LTA station data on GitHub (hxchua/datadoubleconfirm), with stations opened since 2020 placed approximately. The coastline comes from world-geojson (OpenStreetMap). It's drawn by the app itself, with no Google map inside.
- **Google Maps links** (in the prototype now): open directions with the route filled in. Free, no sign-up.
- **Detailed, interactive map** (in the prototype now, on the website): **OneMap** street maps (Singapore Land Authority, free, no key), shown with [Leaflet](https://leafletjs.com) 1.9.4 (kept in `prototype/vendor/leaflet/`). Zoom and pan, every stop on your route (tap for its name), walks as dotted lines, a "show where I am" button and a bigger-map view. If the map pictures can't load, it falls back to drawing the MRT lines. The claude.ai previews keep the simple drawn map, since they can't load map pictures from other sites. Apple Maps or Google Maps inside the app would need a paid developer account and key.
- **Place search** (in the prototype now): schools, buildings, addresses and postal codes from **OneMap**, through the live-data server. Free, no key.
- **Checking routes against Google Maps:** not automatic (Google's directions API is paid and its terms don't allow reusing its routes in another app). The "Just navigate, in Google Maps" button opens the same trip in Google Maps to compare.
- **MRT station exits** (in the prototype now): about 600 exits for every station, from OpenStreetMap via [sgraildata](https://github.com/cheeaun/sgraildata) by Lim Chee Aun.
- **Bus stops and services** (in the prototype now): all 5,208 bus stops and 602 services with their stops in order, from [sgbusdata](https://github.com/cheeaun/sgbusdata) by Lim Chee Aun, built from LTA data.
- **LTA DataMall** (free, from Singapore's Land Transport Authority; the same data MyTransport.SG uses): live bus arrivals and train service alerts, through the small server in [`server/`](server/README.md), which keeps the LTA key secret. Setup guide: [server/README.md](server/README.md).

## Sign-up: a story first

Inspired by SocialLite's onboarding, sign-up starts with a short story before the account details:
1. **Welcome:** "Same train. New friends.", with two dots meeting on an MRT line and a wave.
2. **Quick tap questions** (big option cards, one per screen): where you're at (starting JC1, already in JC, something else), how long your train ride is (a slider), what you do on the train, and whether you've ever made a friend on your commute.
3. **The problem, from your own answers:** "You're not alone. But here's the thing…", then your two JC years as 800 squares, one per ride (2 years × 40 school weeks × 5 days × 2 rides), filling in as "alone on your phone". A full-green screen counts up the hours: "600 hours on the train in JC, next to people your age, without saying a word."
4. **"In that time, you could have…"**: cards with numbers worked out from your hours (K-drama seasons, Eras Tour concerts, walks from Changi to Tuas), ending on "1 friendship that could have started with a hi".
5. **"It's not your fault"** (a carriage of people all on their phones), **"It doesn't have to be this way"**, and **Carriage vs other friend apps** (strike-throughs on the left, ticks on the right).
6. **What you want from it** (picture cards), then **hold to commit**: press and hold, a circle floods the screen, and "See you on the train" leads into the account setup.

Every number comes from the person's own answers, not made-up statistics. Each screen's title arrives first and the options follow one by one; going back slides the other way. Taps give a light **haptic tick**: vibration on Android, and on iPhone (iOS 18 and newer) a trick with a hidden switch control. The hold button ticks while you hold and gives a double tap when done.

## Look and feel

**"Forest & cream":** warm and organic. A warm cream background (#FAF6EE) with white cards, deep forest green (#2F6B4F) for the main buttons, active routes and your chat bubbles, a touch of soft terracotta (#E07A5F) for destinations, and warm brown-black text. A soft warm light sits at the top of each screen, and the only other colours are the MRT line and bus colours. The Map tab greets you ("Good morning") and shows roughly how much CO₂ each trip saves compared with driving.

Things that float over the content (the tab bar, map buttons, navigation panels, messages that pop up) are frosted "liquid glass". Screens glide in, groups unfold, the tab bar's highlight slides to the tab you pick, and buttons give a little when pressed; nothing moves for people who turn motion off. The map uses OneMap's standard style. The app icon is forest green with a cream "C" and a dot for each MRT line.

## Prototype

**Live site:** https://carriage-eob.pages.dev (sign-up version at `/new-user`), hosted on Cloudflare Pages from this branch's `prototype/` folder. It updates by itself on every push. Live bus times come from the `carriage-live` server.

There are two versions, built from one source file, `prototype/src/carriage.html`:

- **an existing user** already using the app (bottom tabs, waves, people met): `prototype/index.html` on the website
- **a new user** signing up (mobile number and code, name, birthday, school or work, optional photo, daily commute and days, interests, who to meet, safety rules), ending in the app with a made-up history built around their own commute (people who waved, a match to plan, a friend to chat with, a ride to rate), so every tab can be demoed: `prototype/new-user.html` on the website

After changing `src/carriage.html`, run `python3 prototype/build.py`, then `node prototype/test.js` (with Playwright) to walk through the whole app. It writes the two website pages (full pages with the home-screen icon and app settings) and the two claude.ai preview copies in `prototype/artifact/`.

**On the home screen:** open the site in Safari, tap Share, then **Add to Home Screen**. Carriage then opens full-screen with its own icon. The app tells people how on the Map tab, and on Android it shows an **Install** button. A small offline helper (`sw.js`) keeps a copy on the phone, so it opens even with weak signal on the MRT; live bus times always come fresh. Links like `/#waves` or `/#rides` open straight to that tab.

Places are picked with a search (station, bus stop name, road or 5-digit stop number).

It has about 300 made-up riders on every MRT line (a handful written by hand on the TEL, the rest generated with Singapore names, schools and jobs). On top of that, whatever route and time someone enters, the app adds made-up riders on every train and bus of it: mostly on the same train, a few a bit earlier or later, in the ages that person wants to meet, and often sharing one of their interests. So any route you demo, at any time of day, has people on it.
