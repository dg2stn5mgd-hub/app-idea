# Carriage (working name)

An app for meeting people on your daily commute, starting with friends and adding dating later.

## The idea

People in Singapore spend their train and bus rides scrolling on their phones. Many are too busy for proper meetups or dates. Carriage uses the commute you already take: it matches you with people who ride the same train at about the same time and like the same things, so you can talk on the way to school or work.

## How it works

1. **Set your commute**: the station where you start, the one where you get off, and the time you're usually on the train. The app works out your route across all MRT lines, including where you change.
2. **Pick your interests**, for example investing or cars.
3. **Choose who to meet**: friends mode now, dating mode (18+) later, plus an age range and how flexible your timing is.
4. **See matches**: people who share at least one stop with you, going the same way, within your time window. Every line of your trip counts, so someone can join you before or after a change, or change lines with you.
5. **Wave**: if both people wave, you plan a ride together and pick a day and a carriage to meet in.
6. **Warm up, don't chat**: there's no free chat before you meet. Each person adds a "how to spot me" note and answers up to 3 fun warm-up questions, so there's a hint but plenty left to talk about. Quick preset messages ("Running late", "Can't make it today") cover plan changes.
7. **Feedback after the ride**: rate it privately (Great / Okay / Not for me / They didn't show up). Then choose whether to ride together again and whether to share contacts (Telegram, Instagram or phone).
8. **Become friends**: a second ride or a contact swap only happens if **both** people say yes. If only one does, they get a gentle "no second ride this time" note after a couple of days instead of waiting forever. Nobody is told who said what.

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
- **Transfers and route choice.** Most people change lines. The prototype picks the fastest route (2 min per stop, 5 min per change) and matches on every line. Still to work out:
  - People don't always take the fastest route. They should be able to edit their route.
  - Walking time at a change differs a lot by station (Dhoby Ghaut vs a cross-platform change), which shifts everyone's timing after it.
  - Carriage choice matters: people board near the stairs for their change or exit. That's a good hint for where to meet.
  - Trains have different lengths (TEL 4 carriages, NSL/EWL/NEL 6, Circle/Downtown 3).
  - Delays and breakdowns break plans. Live train data could warn both people.

## Prototype

`prototype/index.html` is a clickable mockup with made-up people. Open it in a browser to try the flow.
