// Shared bits for the Learn pages: colours and vector slider controls.

export const COLORS = {
  a: '#2563eb', // blue
  b: '#dc2626', // red
  result: '#059669', // green
  highlight: '#d97706', // amber
  muted: '#94a3b8',
};

// Three sliders (x, y, z) for one vector. Calls onChange([x, y, z]) whenever one moves.
export function vectorControl(container, { name, color, value, min = -5, max = 5, onChange }) {
  const v = [...value];
  const box = document.createElement('fieldset');
  box.className = 'vec-control';
  box.style.setProperty('--c', color);
  const legend = document.createElement('legend');
  legend.innerHTML = `<span class="swatch"></span><b>${name}</b> <span class="vec-read"></span>`;
  box.appendChild(legend);
  const read = legend.querySelector('.vec-read');
  const outs = [];
  ['x', 'y', 'z'].forEach((axis, i) => {
    const row = document.createElement('label');
    const id = `${container.id || 'v'}-${name}-${axis}`.replace(/[^\w-]/g, '');
    row.innerHTML = `<span>${axis}</span><input id="${id}" type="range" min="${min}" max="${max}" step="1" value="${v[i]}"><output>${v[i]}</output>`;
    const input = row.querySelector('input');
    const out = row.querySelector('output');
    outs.push(out);
    input.addEventListener('input', () => {
      v[i] = Number(input.value);
      out.textContent = fmtInt(v[i]);
      read.textContent = `(${v.map(fmtInt).join(', ')})`;
      onChange([...v]);
    });
    box.appendChild(row);
  });
  read.textContent = `(${v.map(fmtInt).join(', ')})`;
  outs.forEach((o, i) => (o.textContent = fmtInt(v[i])));
  container.appendChild(box);
  return { get value() { return [...v]; } };
}

const fmtInt = (x) => String(x).replace('-', '−');
