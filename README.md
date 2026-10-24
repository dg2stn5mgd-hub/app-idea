# Carriage (working name)

An app for meeting people on your daily commute, starting with friends and adding dating later.

## The idea

People in Singapore spend their train and bus rides scrolling on their phones. Many are too busy for proper meetups or dates. Carriage uses the commute you already take: it matches you with people who ride the same train at about the same time and like the same things, so you can talk on the way to school or work.

## How it works

**Five tabs at the bottom, always one tap away:** Map (navigation), Rides (people on your commute), Waves (who you waved at and who waved at you, with a badge for new ones), Met (people you've ridden with) and Me (your commute, interests and who you want to meet).

Rides and Waves use your saved **daily commute**, so you never have to search a destination to check them. A one-off trip searched on the Map can be shown on Rides too, with a button to switch back to your commute.

**The Map tab works like a maps app.** You pick where you're going (or tap a saved trip like "Home → School") and see your route. Then you choose:
- **Just navigate**: opens Google Maps with the route filled in. Google does the turn-by-turn directions.
- **Meet someone on this ride**: Carriage's own feature, described below.

You can't add features inside Google Maps itself (Google doesn't allow it), so Carriage has its own maps-style front screen and hands off to Google Maps for directions. It doesn't try to compete with Google on navigation. The people are the point.

Your profile (set up once, editable on the Me tab) covers:

1. **Set your commute**: where you start and where you get off (any MRT station or bus stop), the time you set off, and how you travel: **Bus + MRT**, **MRT only** or **Bus only**. The app works out the fastest route across every MRT line and bus service, including changes and short walks between a bus stop and a station.
2. **Pick your interests**, for example investing or cars.
3. **Choose who to meet**: friends mode now, dating mode (18+) later, plus an age range and how flexible your timing is.
4. **See matches**: people who share at least one stop with you, going the same way, within your time window. Every train and bus of your trip counts, so someone can join you before or after a change, or change with you.
5. **Wave**: if both people wave, you plan a ride together and pick a day and where to meet: a carriage on a train, or a seat on a bus (upper deck front, upper deck back, lower deck).
   - **Same route, a bit earlier or later**: people who ride your route outside your time window (up to 30 min away). You can wave at them too, and you'd catch their train.
   - **Waves page**: one place for everyone you've waved at (the people you want to meet, with "Take back wave"), everyone who waved at you first ("Wave back" or a private "Not now"), and matches ready to plan. Waves end quietly after 7 days.
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
- **A real map inside the app**: Google Maps API or **OneMap** (Singapore's free official map). Google needs an API key and charges after a free amount.
- **Address search** ("Blk 50 Marine Terrace" → nearest station): Google Places or OneMap search.
- **Bus stops and services** (in the prototype now): all 5,208 bus stops and 602 services with their stops in order, from [sgbusdata](https://github.com/cheeaun/sgbusdata) by Lim Chee Aun, built from LTA data.
- **LTA DataMall** (free, from Singapore's Land Transport Authority; the same data MyTransport.SG uses): live bus arrivals and train service alerts, through the small server in [`server/`](server/README.md), which keeps the LTA key secret. Setup guide: [server/README.md](server/README.md).

## Prototype

There are two versions, built from the same code:

- `prototype/index.html`: **an existing user** already using the app (bottom tabs, waves, people met).
- `prototype/new-user.html`: **a new user** signing up: mobile number and code, name, birthday, school or work, optional photo, daily commute and days, interests, who to meet, and the safety rules. It ends in the app with an empty history.

`new-user.html` is generated. After changing `index.html`, run `python3 prototype/make_new_user.py` to rebuild it.

Places are picked with a search (station, bus stop name, road or 5-digit stop number). Made-up riders appear on each bus service the first time a route uses it.

It has about 300 made-up riders on every MRT line (a handful written by hand on the TEL, the rest generated with Singapore names, schools and jobs, and morning times from 07:15 to 08:30), so any route you demo has people on it.
