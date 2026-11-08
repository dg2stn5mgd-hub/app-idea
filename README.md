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

There's also a **Learn** page (`learn/`) with one section per concept. Each section has a 3D demo with sliders, a worked example and common mistakes:

- **Dot product**: angles, the perpendicular test, projections
- **Cross product**: normals, the right-hand rule, areas
- **Projections and distances**: foot of perpendicular and distances, shown as one right-angled triangle

Answers come out exact where possible (fractions and surds, e.g. `7√3/3 ≈ 4.04`). Angles are given to 1 d.p.

## Graph Lab: graphs and transformations

`graphs/` is a second interactive page for the H2 Math **Graphs and transformations** topic (9758, section 1.2). It works in 2D and covers each point of the syllabus:

- **Graph explorer.** Type any y = f(x). The page draws it and finds the intercepts, turning points, vertical, horizontal and oblique asymptotes, and any symmetry, like a GC would.
- **Transformations.** Build a sequence of y = f(x + a), y = f(ax), y = af(x) and y = f(x) + a steps on a chosen curve. You see the equation after each step and where the key points and asymptotes end up. Includes a random "describe the transformations" practice question.
- **y = (ax + b)/(cx + d).** Sliders for a, b, c, d. Shows asymptotes, intercepts, the divided-out form and the transformations from y = 1/x.
- **y = (ax² + bx + c)/(dx + e).** Shows long division, the oblique asymptote and turning points, and finds the range by the discriminant method with exact surds.
- **Conics.** Ellipses and hyperbolas x²/a² ± y²/b² = 1, with a translated centre: vertices, asymptotes and restrictions on x and y.
- **Related graphs** (extension): |f(x)|, f(|x|), 1/f(x) and f′(x).
- A sketching checklist, worked examples and common mistakes.

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
js/viewer.js      small reusable 3D viewer used by the Learn pages
js/learn.js       slider controls and colours for the Learn pages
learn/index.html  the Learn page (all lessons; the old per-topic files redirect to their section)
learn.css         styling for the Learn pages
js/analysis.js    the maths for each "Compare" pair: start here to add a new comparison
js/math.js        vector operations and input parsing ("(1,2,3)", "i + 2j - k", "1/2")
js/format.js      exam-style output: fractions, surds, column vectors, Cartesian equations
graphs/index.html the Graph Lab page (graphs and transformations)
graphs.css        styling for the Graph Lab page
js/graphs.js      the Graph Lab demos: explorer, transformation builder, rational functions, conics
js/plot2d.js      small 2D canvas plotter with pan and zoom
js/expr.js        safe parser for functions of x ("2x^2 - 3", "e^(-x) sin x", "|x| - 1")
js/features.js    finds intercepts, turning points and asymptotes numerically
lib/three/        three.js r160 (MIT licence), saved here so the site works offline
```

Maths uses **z up**. three.js uses y up, so `M()` in `app.js` converts between the two.

## Ideas for next steps

- Show the angle between two lines or planes as an arc in the 3D view
- Animated step-by-step worked solutions
- Plane input in Cartesian form (`x + 2y − z = 4`)
- Practice mode: random questions with the answer revealed in 3D
- Ratio theorem and collinearity explorer
