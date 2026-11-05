import { createHeadphoneViewer } from './headphones.js?v=4';
import { installMaterialInspection } from './inspection.js?v=2';
import { installComponentLabUI } from './lab-ui.js?v=4';
import { createBuildCardSVG, isBuildPreview } from './build-card.js?v=4';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const finishNames = { obsidian: 'OBSIDIAN', chalk: 'CHALK', signal: 'SIGNAL RED' };
const storageKey = 'rift-n01-setup-v1';
let finish = 'obsidian';
let mode = 'focus';
let savedSetup = null;
let exploded = false;
let viewer;
let toastTimer;
let viewStatusTimer;

function readSaved() {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey));
    if (value && Object.hasOwn(finishNames, value.finish) && ['focus', 'aware'].includes(value.mode)) {
      return { version: 2, finish: value.finish, mode: value.mode, preview: isBuildPreview(value.preview) ? value.preview : null };
    }
  } catch { /* Storage can be unavailable in private browsing. */ }
  return null;
}

function notify(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 3500);
}

function applyFinish(value) {
  if (!Object.hasOwn(finishNames, value)) return;
  finish = value;
  $('#product').dataset.finish = finish;
  $(`input[name="finish"][value="${finish}"]`).checked = true;
  $$('[data-current-finish]').forEach((element) => { element.textContent = finishNames[finish]; });
  $('#viewer-fallback').style.color = { obsidian: '#151614', chalk: '#babcb1', signal: '#e63323' }[finish];
  viewer?.setFinish(finish);
  $('#setup-note').textContent = savedSetup && savedSetup.finish === finish && savedSetup.mode === mode ? 'YOUR SAVED SETUP / READY TO EXPLORE.' : 'YOUR SETUP / READY TO SAVE.';
}

function show3dError() {
  $('.viewer-footer').hidden = true;
  $('#headphone-canvas').hidden = true;
  $('#viewer-fallback').hidden = false;
  $('#viewer-loading').hidden = true;
  $('#explode-button').hidden = true;
  $('#reset-view').hidden = true;
  $('.interaction-modes').hidden = true;
  $('.view-sliders').hidden = true;
  $('.drag-hint').textContent = 'N01 / PRODUCT OVERVIEW';
}

function reflectView(state) {
  if (!state) return;
  $$('[data-interaction]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.interaction === state.interactionMode)));
  $('#drag-instruction').textContent = state.interactionMode === 'move' ? 'DRAG TO MOVE' : 'DRAG TO ROTATE';
  const x = Math.round(state.position.x * 100);
  const y = Math.round(state.position.y * 100);
  const zoom = Math.round(state.zoom * 100);
  $('#view-x').value = x;
  $('#view-y').value = y;
  $('#view-zoom').value = zoom;
  $('#view-x-value').textContent = x > 0 ? `+${x}` : String(x);
  $('#view-y-value').textContent = y > 0 ? `+${y}` : String(y);
  $('#view-zoom-value').textContent = `${zoom}%`;
  clearTimeout(viewStatusTimer);
  viewStatusTimer = setTimeout(() => { $('#view-status').textContent = `${state.interactionMode === 'move' ? 'Move' : 'Rotate'} mode. Position ${x}, ${y}. Zoom ${zoom} percent.`; }, 180);
}

$$('[data-interaction]').forEach((button) => button.addEventListener('click', () => {
  viewer?.setInteractionMode(button.dataset.interaction);
}));
for (const selector of ['#view-x', '#view-y']) {
  $(selector).addEventListener('input', () => viewer?.setPosition(Number($('#view-x').value) / 100, Number($('#view-y').value) / 100));
}
$('#view-zoom').addEventListener('input', () => viewer?.setZoom(Number($('#view-zoom').value) / 100));

$$('input[name="finish"]').forEach((input) => {
  input.setAttribute('aria-label', finishNames[input.value]);
  input.addEventListener('change', () => applyFinish(input.value));
});
$('#explode-button').addEventListener('click', () => {
  exploded = !exploded;
  viewer?.setExploded(exploded);
  $('#explode-button').setAttribute('aria-pressed', String(exploded));
  $('#explode-button').innerHTML = `${exploded ? 'ASSEMBLE' : 'EXPLODE'} <span aria-hidden="true">${exploded ? '−' : '+'}</span>`;
});
$('#reset-view').addEventListener('click', () => {
  viewer?.reset();
  if (exploded) $('#explode-button').click();
  notify('Product view reset.');
});

const menuToggle = $('.menu-toggle');
menuToggle.addEventListener('click', () => {
  const open = menuToggle.getAttribute('aria-expanded') !== 'true';
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  $('#main-nav').classList.toggle('is-open', open);
});
$$('#main-nav a').forEach((link) => link.addEventListener('click', () => {
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', 'Open navigation');
  $('#main-nav').classList.remove('is-open');
}));
$$('a[href="#configure"]').forEach((link) => link.addEventListener('click', () => {
  $('#configure').classList.remove('highlight');
  requestAnimationFrame(() => $('#configure').classList.add('highlight'));
}));

function openSetup(configuration, message) {
  $('#saved-finish').textContent = finishNames[configuration.finish];
  $('#saved-mode').textContent = configuration.mode.toUpperCase();
  $('.saved-product-symbol').style.color = { obsidian: '#151614', chalk: '#9ca293', signal: '#c92519' }[configuration.finish];
  $('#save-message').textContent = message;
  const preview = $('#saved-preview');
  const hasPreview = isBuildPreview(configuration.preview);
  preview.hidden = !hasPreview;
  $('#saved-preview-fallback').toggleAttribute('hidden', hasPreview);
  if (hasPreview) preview.src = configuration.preview; else preview.removeAttribute('src');
  $('#setup-dialog').showModal();
}

$('#save-setup').addEventListener('click', () => {
  const preview = viewer?.getSnapshot();
  savedSetup = { version: 2, finish, mode, preview: isBuildPreview(preview) ? preview : null };
  let message = 'Your setup is saved on this device.';
  try { localStorage.setItem(storageKey, JSON.stringify(savedSetup)); }
  catch { message = 'Your setup is ready for this visit. Download a build card to keep it.'; }
  $('#setup-note').textContent = 'YOUR SETUP / SAVED.';
  openSetup(savedSetup, message);
});
$('#open-saved').addEventListener('click', () => {
  if (savedSetup) openSetup(savedSetup, 'Your saved setup. Ready when you are.');
  else {
    $('#configure').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });
    notify('Choose a finish, then save your setup.');
  }
});
$('#keep-exploring').addEventListener('click', () => $('#setup-dialog').close());
$('#setup-dialog').addEventListener('click', (event) => {
  if (event.target !== event.currentTarget) return;
  const box = event.currentTarget.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) event.currentTarget.close();
});

$('#download-card').addEventListener('click', () => {
  const configuration = savedSetup || { finish, mode };
  const colour = { obsidian: '#20231d', chalk: '#c1c6b6', signal: '#e63323' }[configuration.finish];
  const svg = createBuildCardSVG(configuration);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `RIFT-N01-${configuration.finish}.svg`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  $('#save-message').textContent = 'Your build card is ready. Keep it, share it, make it yours.';
});

// Audio starts only after a click. It is an illustrative, locally generated mix.
let audio = null;
let playing = false;
let audioFrame = 0;
const waveCanvas = $('#waveform');
const waveContext = waveCanvas.getContext('2d');
let sequenceTimer = null;

function drawWave(time = 0) {
  if (!waveContext) return;
  const width = waveCanvas.width;
  const height = waveCanvas.height;
  waveContext.clearRect(0, 0, width, height);
  waveContext.strokeStyle = '#78836b55';
  waveContext.lineWidth = 1;
  waveContext.beginPath();
  waveContext.moveTo(0, height / 2); waveContext.lineTo(width, height / 2); waveContext.stroke();
  let data;
  if (playing && audio) {
    data = new Uint8Array(audio.analyser.fftSize);
    audio.analyser.getByteTimeDomainData(data);
  }
  for (let layer = 2; layer >= 0; layer--) {
    waveContext.beginPath();
    waveContext.lineWidth = layer === 0 ? 3 : 1;
    waveContext.strokeStyle = layer === 0 ? '#fa3b2e' : `rgba(165,181,144,${layer === 1 ? '.55' : '.25'})`;
    for (let x = 0; x <= width; x += 2) {
      const fraction = x / width;
      const envelope = Math.pow(Math.sin(fraction * Math.PI), 1.2);
      let signal;
      if (data) signal = ((data[Math.floor(fraction * (data.length - 1))] - 128) / 128) * 280;
      else signal = (Math.sin(fraction * 58 + layer * .4) * Math.sin(fraction * 17) * 58 + Math.cos(fraction * 150) * (mode === 'aware' ? 21 : 4));
      const y = height / 2 + (signal + Math.sin(fraction * 100 + time * .002) * (playing ? 4 : 0)) * envelope * (1 - layer * .18);
      if (x === 0) waveContext.moveTo(x, y); else waveContext.lineTo(x, y);
    }
    waveContext.stroke();
  }
  if (playing) audioFrame = requestAnimationFrame(drawWave);
}

async function createAudio() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) throw new Error('Audio unavailable');
  const context = new AudioContext();
  const master = context.createGain(); master.gain.value = 0.22;
  const analyser = context.createAnalyser(); analyser.fftSize = 2048;
  master.connect(analyser); analyser.connect(context.destination);
  const bass = context.createOscillator(); bass.type = 'sine';
  const bassGain = context.createGain(); bassGain.gain.value = 0.2;
  bass.connect(bassGain); bassGain.connect(master);
  const high = context.createOscillator(); high.type = 'triangle';
  const highGain = context.createGain(); highGain.gain.value = 0.028;
  high.connect(highGain); highGain.connect(master);
  const noiseBuffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
  const samples = noiseBuffer.getChannelData(0);
  let seed = 3748;
  for (let i = 0; i < samples.length; i++) { seed = (seed * 16807) % 2147483647; samples[i] = seed / 1073741823.5 - 1; }
  const noise = context.createBufferSource(); noise.buffer = noiseBuffer; noise.loop = true;
  const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 750;
  const noiseGain = context.createGain(); noiseGain.gain.value = mode === 'aware' ? .09 : .006;
  noise.connect(filter); filter.connect(noiseGain); noiseGain.connect(master);
  bass.start(); high.start(); noise.start();
  let step = 0;
  const notes = [65.41, 65.41, 77.78, 58.27, 65.41, 87.31, 77.78, 58.27];
  const nextNote = () => {
    const now = context.currentTime;
    bass.frequency.setTargetAtTime(notes[step % notes.length], now, .07);
    high.frequency.setTargetAtTime(notes[(step + 2) % notes.length] * 4, now, .1);
    bassGain.gain.cancelScheduledValues(now);
    bassGain.gain.setValueAtTime(.22, now);
    bassGain.gain.exponentialRampToValueAtTime(.07, now + .48);
    step++;
  };
  nextNote(); sequenceTimer = setInterval(nextNote, 600);
  return { context, analyser, noiseGain, sources: [bass, high, noise] };
}

function stopSound() {
  playing = false;
  if (audioFrame) cancelAnimationFrame(audioFrame);
  if (sequenceTimer) clearInterval(sequenceTimer);
  audioFrame = 0; sequenceTimer = null;
  if (audio) { audio.sources.forEach((source) => { try { source.stop(); } catch {} }); audio.context.close().catch(() => {}); audio = null; }
  $('#sound-button-text').textContent = 'PLAY SOUND PREVIEW';
  $('.play-icon').textContent = '▶';
  $('#sound-toggle').setAttribute('aria-pressed', 'false');
  $('#signal-state').textContent = 'PREVIEW / STANDBY';
  drawWave();
}

$('#sound-toggle').addEventListener('click', async () => {
  if (playing) { stopSound(); return; }
  $('#sound-toggle').disabled = true;
  try {
    audio = await createAudio();
    await audio.context.resume();
    playing = true;
    $('#sound-button-text').textContent = 'STOP SOUND PREVIEW';
    $('.play-icon').textContent = '■';
    $('#sound-toggle').setAttribute('aria-pressed', 'true');
    $('#signal-state').textContent = `PREVIEW / ${mode.toUpperCase()} ACTIVE`;
    drawWave();
  } catch {
    stopSound();
    notify('Sound preview is unavailable in this browser.');
  } finally { $('#sound-toggle').disabled = false; }
});

function applyMode(value) {
  if (!['focus', 'aware'].includes(value)) return;
  mode = value;
  $$('.mode-button').forEach((button) => {
    button.classList.toggle('active', button.dataset.mode === mode);
    button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
  });
  $('#mode-description').textContent = mode === 'focus' ? 'Turn down the outside. Get closer to what you want to hear.' : 'Stay with the music. Let a little of the world back in.';
  $('#wave-caption').textContent = mode === 'focus' ? 'FOCUS / OUTSIDE NOISE REDUCED' : 'AWARE / SURROUNDINGS IN THE MIX';
  if (audio) audio.noiseGain.gain.setTargetAtTime(mode === 'aware' ? .09 : .006, audio.context.currentTime, .25);
  if (playing) $('#signal-state').textContent = `PREVIEW / ${mode.toUpperCase()} ACTIVE`;
  else drawWave();
  applyFinish(finish);
}
$$('.mode-button').forEach((button) => button.addEventListener('click', () => applyMode(button.dataset.mode)));
const cleanUpInspection = installMaterialInspection();
const componentLabUI = installComponentLabUI();
document.addEventListener('visibilitychange', () => { if (document.hidden && playing) stopSound(); });
window.addEventListener('pagehide', (event) => { stopSound(); if (!event.persisted) { viewer?.destroy(); componentLabUI.destroy(); cleanUpInspection(); clearTimeout(viewStatusTimer); } });

savedSetup = readSaved();
if (savedSetup) { finish = savedSetup.finish; mode = savedSetup.mode; }
applyFinish(finish);
applyMode(mode);
try {
  $('#headphone-canvas').setAttribute('aria-label', 'Interactive 3D N01 headphones. Choose Rotate or Move, then drag or use the arrow keys. Shift and arrow keys move in either mode. Use the sliders to position and zoom. Home resets the view.');
  viewer = await createHeadphoneViewer($('#headphone-canvas'), {
    onReady: () => { $('#viewer-stage').classList.add('is-ready'); $('#viewer-loading').hidden = true; },
    onError: show3dError,
    onViewChange: reflectView,
  });
  viewer.setFinish(finish);
  reflectView(viewer.getViewState());
} catch { show3dError(); }
