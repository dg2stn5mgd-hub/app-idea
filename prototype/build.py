"""Builds every version of the Carriage prototype from one source file.

    src/carriage.html        the app (edit this one)

    index.html, new-user.html                 the website (Cloudflare Pages serves these):
                                              full pages with the home-screen icon and app settings
    artifact/current-user.html, new-user.html for the claude.ai prototype links

Run after changing src/carriage.html:  python3 prototype/build.py
"""
import re
from pathlib import Path

here = Path(__file__).parent
from datetime import datetime, timedelta, timezone
src = (here / "src" / "carriage.html").read_text()
# Stamp the version with the time it was built (Singapore time), shown at the bottom of the Me tab
stamp = datetime.now(timezone(timedelta(hours=8))).strftime("%-d %b, %H:%M")
assert src.count('const BUILD = "dev";') == 1
src = src.replace('const BUILD = "dev";', f'const BUILD = "{stamp}";')

NEW_USER = [
    ('<title>Carriage Prototype</title>', '<title>Carriage Sign-up</title>'),
    ('const START_AS = "existing";', 'const START_AS = "new";'),
    ('Prototype: an existing user. The people below are made up so you can try the flow.',
     'Prototype: new user sign-up. Nothing you enter is saved or sent anywhere.'),
]

# The website needs a full page around the app, with what phones look for to install it
HEAD = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
{title}
<meta name="description" content="Meet people on your daily train or bus ride.">
<meta name="theme-color" content="#9d5b25">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Carriage">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<link rel="icon" type="image/png" href="/icons/icon-192.png">
<link rel="stylesheet" href="/vendor/leaflet/leaflet.css">
<script src="/vendor/leaflet/leaflet.js"></script>
<style>
:root { color-scheme: light; padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }
body { margin: 0; font: 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; }
img { max-width: 100%; }
[hidden] { display: none !important; }
</style>
</head>
<body>
"""

def website(page):
    title = re.search(r"<title>.*?</title>", page).group(0)
    return HEAD.replace("{title}", title) + page.replace(title, "", 1) + "\n</body>\n</html>\n"

def swapped(page, swaps):
    for old, new in swaps:
        assert page.count(old) == 1, old
        page = page.replace(old, new)
    return page

versions = {"current-user": src, "new-user": swapped(src, NEW_USER)}
for name, page in versions.items():
    (here / "artifact" / f"{name}.html").write_text(page)
(here / "index.html").write_text(website(versions["current-user"]))
(here / "new-user.html").write_text(website(versions["new-user"]))
print("built index.html, new-user.html and artifact/")
