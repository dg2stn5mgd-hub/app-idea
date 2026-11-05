# Vector Lab

An interactive 3D visualiser for **H2 Math (Singapore A-Level) vectors**.

Type in points, vectors, lines and planes. They're drawn in 3D, and you can rotate the view.
Pick any two of them under **Compare** to get the standard exam answers, each with a short "how to work it out":

| Compare | You get |
|---|---|
| point & point | vector AB, distance, midpoint |
| point & line | foot of perpendicular, perpendicular distance, reflection |
| point & plane | foot of perpendicular, distance, reflection |
| vector & vector | dot and cross product, angle, area of parallelogram, projection |
| line & line | parallel / intersecting / skew, intersection point, shortest distance, angle |
| line & plane | intersection point, or parallel with distance; angle |
| plane & plane | line of intersection, or parallel with distance; angle |

Answers come out exact where possible (fractions and surds, e.g. `7√3/3 ≈ 4.04`). Angles are given to 1 d.p.

## Running it

The site is plain HTML, CSS and JavaScript, with no build step. Browsers block JavaScript modules opened
straight from a file, so start a tiny local server in this folder:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. In VS Code, the "Live Server" extension does the same job.

To put it online for free, use GitHub Pages: in the repo go to **Settings → Pages**, choose the `main` branch and the root folder, then save.

## How the code is organised

```
index.html        page layout: side panel + 3D view
style.css         all styling (phones stack the 3D view above the panel)
js/app.js         3D scene (three.js), object cards, wiring everything together
js/analysis.js    the maths for each "Compare" pair: start here to add a new comparison
js/math.js        vector operations and input parsing ("(1,2,3)", "i + 2j - k", "1/2")
js/format.js      exam-style output: fractions, surds, column vectors, Cartesian equations
lib/three/        three.js r160 (MIT licence), saved here so the site works offline
```

Maths uses **z up**. three.js uses y up, so `M()` in `app.js` converts between the two.

## Ideas for next steps

- Show the angle between two lines or planes as an arc in the 3D view
- Animated step-by-step worked solutions
- Plane input in Cartesian form (`x + 2y − z = 4`)
- Practice mode: random questions with the answer revealed in 3D
- Ratio theorem and collinearity explorer
