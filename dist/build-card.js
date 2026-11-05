const finishes = { obsidian: ['OBSIDIAN', '#20231f'], chalk: ['CHALK', '#c3c7bc'], signal: ['SIGNAL RED', '#e63323'] };

export function isBuildPreview(value) {
  return typeof value === 'string' && value.length < 2_000_000 && /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
}

export function createBuildCardSVG(configuration = {}) {
  const finish = Object.hasOwn(finishes, configuration.finish) ? configuration.finish : 'obsidian';
  const [name, colour] = finishes[finish];
  const mode = configuration.mode === 'aware' ? 'AWARE' : 'FOCUS';
  const product = isBuildPreview(configuration.preview)
    ? `<image href="${configuration.preview}" x="590" y="145" width="820" height="640" preserveAspectRatio="xMidYMid meet"/>`
    : `<g transform="translate(660 160) scale(1.35)"><path d="M80 282V205C80 10 380 10 380 205v77" fill="none" stroke="${colour}" stroke-width="35"/><path d="M93 207C93 38 367 38 367 207" fill="none" stroke="#818a74" stroke-width="8"/><g fill="${colour}" stroke="#777f6b" stroke-width="5"><rect x="43" y="235" width="115" height="190" rx="16" transform="rotate(-9 100 330)"/><rect x="302" y="235" width="115" height="190" rx="16" transform="rotate(9 360 330)"/></g><path d="m76 290 35-7m233 0 35 7" stroke="#fa3b2e" stroke-width="8"/></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="1000" viewBox="0 0 1500 1000"><defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#b6bdab" stroke-width=".5"/></pattern></defs><rect width="1500" height="1000" fill="#e9e8e2"/><rect x="45" y="45" width="1410" height="910" fill="url(#grid)" stroke="#151614"/><g fill="#151614" font-family="Arial,sans-serif"><text x="85" y="130" font-size="50" font-weight="900">RIFT <tspan fill="#fa3b2e">//</tspan> AUDIO</text><text x="1410" y="120" font-size="18" text-anchor="end">PERSONAL CONFIGURATION / 01</text><text x="85" y="300" font-size="128" font-weight="900">N—01</text><text x="85" y="355" font-size="20" letter-spacing="2">LESS NOISE. MORE YOU.</text></g><circle cx="990" cy="465" r="277" fill="none" stroke="#a3ab96"/><circle cx="990" cy="465" r="296" fill="none" stroke="#fa3b2e" stroke-dasharray="3 8"/>${product}<g font-family="monospace" fill="#151614"><text x="85" y="505" font-size="18">FINISH /</text><text x="85" y="560" font-size="36" font-weight="bold">${name}</text><text x="85" y="645" font-size="18">PREFERRED MODE /</text><text x="85" y="700" font-size="36" font-weight="bold">${mode}</text><text x="85" y="900" font-size="16">RIFT / AUDIO — PRODUCT DESIGN CONCEPT</text><text x="1410" y="900" font-size="16" text-anchor="end">RFT-N01 / 2026</text></g><path d="M85 825h1325" stroke="#151614"/><rect x="85" y="755" width="38" height="7" fill="#fa3b2e"/></svg>`;
}
