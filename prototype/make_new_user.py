"""Builds new-user.html from index.html so both prototypes share one source.

Run after changing index.html:  python3 prototype/make_new_user.py
"""
from pathlib import Path

here = Path(__file__).parent
src = (here / "index.html").read_text()
swaps = [
    ('<title>Carriage Prototype</title>', '<title>Carriage Sign-up</title>'),
    ('const START_AS = "existing";', 'const START_AS = "new";'),
    ('Prototype: an existing user. The people below are made up so you can try the flow.',
     'Prototype: new user sign-up. Nothing you enter is saved or sent anywhere.'),
]
for old, new in swaps:
    assert src.count(old) == 1, old
    src = src.replace(old, new)
(here / "new-user.html").write_text(src)
print("wrote", here / "new-user.html")
