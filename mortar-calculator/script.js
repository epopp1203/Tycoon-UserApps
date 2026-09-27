const result = document.getElementById('result');
const resultBox = document.getElementById('result-box');
const warningText = document.getElementById('warning-text');
const distanceRelation = document.getElementById('distance-relation');
const rangeMeterFill = document.getElementById('range-meter-fill');
const rangeMeterMarker = document.getElementById('range-meter-marker');
const artilleryStatus = document.getElementById('artillery-status');
const sampleBtn = document.getElementById('sample-btn');
const clearBtn = document.getElementById('clear-btn');
const shareBtn = document.getElementById('share-btn');
const clearHistoryBtn = document.getElementById('clear-history-btn');
const historyList = document.getElementById('history-list');
const historyEmpty = document.getElementById('history-empty');
const themeButtons = document.querySelectorAll('.theme-btn');
const savedThemeKey = 'target-distance-theme';
const historyKey = 'target-distance-history';
const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
const mortarMax = 630;
const artilleryMin = 730;
const artilleryMax = 2630;
const maxHistoryItems = 8;

function getCoordinateNumberPattern() {
  return '[-+]?\\d*\\.?\\d+(?:e[-+]?\\d+)?';
}

function parseCoordinates(rawValue) {
  const text = String(rawValue || '').trim();
  const numberPattern = getCoordinateNumberPattern();
  const labeledMatch = text.match(new RegExp(`x\\s*[:=]?\\s*(${numberPattern}).*?y\\s*[:=]?\\s*(${numberPattern})`, 'i'));

  if (labeledMatch) {
    const labeledCoordinates = {
      x: Number(labeledMatch[1]),
      y: Number(labeledMatch[2])
    };

    if (Number.isFinite(labeledCoordinates.x) && Number.isFinite(labeledCoordinates.y)) {
      return labeledCoordinates;
    }
  }

  const plainNumbers = text.match(new RegExp(numberPattern, 'gi')) || [];
  if (plainNumbers.length < 2) {
    return null;
  }

  const x = Number(plainNumbers[0]);
  const y = Number(plainNumbers[1]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return { x, y };
}

function calculateDistance(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function getCoordinateInputs() {
  return {
    a: document.getElementById('a-coords'),
    b: document.getElementById('b-coords')
  };
}

function getCurrentCoordinates() {
  const inputs = getCoordinateInputs();
  return {
    a: parseCoordinates(inputs.a.value),
    b: parseCoordinates(inputs.b.value)
  };
}

function readHistory() {
  try {
    const savedHistory = JSON.parse(localStorage.getItem(historyKey) || '[]');
    if (!Array.isArray(savedHistory)) {
      return [];
    }

    return savedHistory.filter((entry) => (
      entry &&
      entry.a &&
      entry.b &&
      Number.isFinite(entry.a.x) &&
      Number.isFinite(entry.a.y) &&
      Number.isFinite(entry.b.x) &&
      Number.isFinite(entry.b.y) &&
      Number.isFinite(entry.distance)
    ));
  } catch {
    return [];
  }
}

function writeHistory(history) {
  try {
    localStorage.setItem(historyKey, JSON.stringify(history));
  } catch {
    // Storage may be unavailable in private browsing or restricted frames.
  }
}

function formatCoordinate(coordinates) {
  return `x${coordinates.x}, y${coordinates.y}`;
}

function renderHistory() {
  const history = readHistory();
  historyList.replaceChildren();
  historyEmpty.hidden = history.length > 0;

  history.forEach((entry, index) => {
    const item = document.createElement('button');
    const coordinates = document.createElement('span');
    const distance = document.createElement('strong');

    item.type = 'button';
    item.className = 'history-item';
    item.dataset.historyIndex = String(index);
    coordinates.textContent = `${formatCoordinate(entry.a)} → ${formatCoordinate(entry.b)}`;
    distance.textContent = `${entry.distance.toFixed(2)} m`;
    item.append(coordinates, distance);
    historyList.appendChild(item);
  });
}

function saveCalculation(aCoords, bCoords, distance) {
  const history = readHistory().filter((entry) => (
    entry.a.x !== aCoords.x || entry.a.y !== aCoords.y || entry.b.x !== bCoords.x || entry.b.y !== bCoords.y
  ));

  history.unshift({ a: aCoords, b: bCoords, distance });
  writeHistory(history.slice(0, maxHistoryItems));
  renderHistory();
}

function getShareUrl() {
  const url = new URL(window.location.href);
  const { a, b } = getCurrentCoordinates();
  url.search = '';
  if (a && b) {
    url.searchParams.set('a', formatCoordinate(a));
    url.searchParams.set('b', formatCoordinate(b));
  }
  return url.toString();
}

function setShareStatus(message) {
  shareBtn.textContent = message;
  window.setTimeout(() => {
    shareBtn.textContent = 'Copy share link';
  }, 1800);
}

function loadCoordinatesFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const a = params.get('a');
  const b = params.get('b');
  const inputs = getCoordinateInputs();

  if (a && b && parseCoordinates(a) && parseCoordinates(b)) {
    inputs.a.value = a;
    inputs.b.value = b;
  }
}

function updateResult() {
  const { a: aCoords, b: bCoords } = getCurrentCoordinates();

  if (!aCoords || !bCoords) {
    result.textContent = 'Enter valid coords';
    resultBox.classList.remove('warning');
    warningText.classList.add('hidden');
    distanceRelation.textContent = 'Paste values like x98.43, y110.38';
    artilleryStatus.textContent = 'Status: Invalid input';
    artilleryStatus.className = 'range-status warning';
    return;
  }

  const distance = calculateDistance(aCoords.x, aCoords.y, bCoords.x, bCoords.y);
  const percentOfMortarMax = (distance / mortarMax) * 100;
  const meterPercent = Math.min(Math.max((distance / mortarMax) * 100, 0), 100);

  result.textContent = `${distance.toFixed(2)} m`;
  distanceRelation.textContent = `${distance.toFixed(2)} m is ${percentOfMortarMax.toFixed(1)}% of the ${mortarMax.toLocaleString()} m mortar maximum.`;
  rangeMeterFill.style.width = `${meterPercent}%`;
  rangeMeterMarker.style.left = `${meterPercent}%`;

  if (distance > mortarMax) {
    resultBox.classList.add('warning');
    warningText.classList.remove('hidden');
  } else {
    resultBox.classList.remove('warning');
    warningText.classList.add('hidden');
  }

  if (distance >= artilleryMin && distance <= artilleryMax) {
    artilleryStatus.textContent = `Status: Within artillery range (${artilleryMin}m to ${artilleryMax.toLocaleString()}m)`;
    artilleryStatus.className = 'range-status good';
  } else {
    artilleryStatus.textContent = `Status: Outside artillery range (${artilleryMin}m to ${artilleryMax.toLocaleString()}m)`;
    artilleryStatus.className = 'range-status warning';
  }

  saveCalculation(aCoords, bCoords, distance);
}

function applyTheme(themeChoice) {
  const theme = themeChoice === 'system'
    ? (systemThemeQuery.matches ? 'dark' : 'light')
    : themeChoice;

  document.body.setAttribute('data-theme', theme);
  localStorage.setItem(savedThemeKey, themeChoice);

  themeButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.theme === themeChoice);
  });
}

function initializeTheme() {
  const savedTheme = localStorage.getItem(savedThemeKey) || 'system';
  applyTheme(savedTheme);

  systemThemeQuery.addEventListener('change', () => {
    const currentTheme = localStorage.getItem(savedThemeKey) || 'system';
    if (currentTheme === 'system') {
      applyTheme('system');
    }
  });
}

const inputs = document.querySelectorAll('input');
inputs.forEach((input) => {
  input.addEventListener('input', updateResult);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      updateResult();
    }
  });
});

sampleBtn.addEventListener('click', () => {
  const { a: aCoordsInput, b: bCoordsInput } = getCoordinateInputs();

  aCoordsInput.value = 'x98.43, y110.38';
  bCoordsInput.value = 'x94.53, y109.03';

  updateResult();
});

clearBtn.addEventListener('click', () => {
  const { a, b } = getCoordinateInputs();
  a.value = '';
  b.value = '';
  updateResult();
  a.focus();
});

shareBtn.addEventListener('click', async () => {
  const { a, b } = getCurrentCoordinates();
  if (!a || !b) {
    setShareStatus('Enter both points first');
    return;
  }

  const shareUrl = getShareUrl();
  try {
    await navigator.clipboard.writeText(shareUrl);
    setShareStatus('Link copied');
  } catch {
    window.prompt('Copy this share link:', shareUrl);
  }
});

clearHistoryBtn.addEventListener('click', () => {
  writeHistory([]);
  renderHistory();
});

historyList.addEventListener('click', (event) => {
  const item = event.target.closest('.history-item');
  if (!item) {
    return;
  }

  const entry = readHistory()[Number(item.dataset.historyIndex)];
  if (!entry) {
    return;
  }

  const { a, b } = getCoordinateInputs();
  a.value = formatCoordinate(entry.a);
  b.value = formatCoordinate(entry.b);
  updateResult();
});

themeButtons.forEach((button) => {
  button.addEventListener('click', () => applyTheme(button.dataset.theme));
});

loadCoordinatesFromUrl();
initializeTheme();
renderHistory();
updateResult();
