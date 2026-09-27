const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const trackerPath = path.join(__dirname, "..", "mining-tracker.js");
const source = fs.readFileSync(trackerPath, "utf8");

assert.doesNotMatch(source, /<<<<<<<|=======|>>>>>>>/);
assert.doesNotMatch(source, /postMessage\(\{\s*type:\s*["']getData/);

function createElement() {
  return {
    style: {},
    hidden: false,
    textContent: "",
    classList: {
      add() {},
      remove() {},
      toggle() {}
    },
    addEventListener() {},
    removeEventListener() {},
    querySelector() { return createElement(); },
    getBoundingClientRect() { return { left: 0, top: 0, bottom: 0 }; },
    offsetWidth: 200,
    offsetHeight: 200
  };
}

const messageListeners = [];
const postedMessages = [];
const windowObject = {
  state: {},
  parent: null,
  addEventListener(type, listener) {
    if (type === "message") messageListeners.push(listener);
  },
  removeEventListener() {},
  postMessage(message) {
    postedMessages.push(message);
  }
};
windowObject.parent = windowObject;

const documentObject = {
  visibilityState: "visible",
  documentElement: { style: { setProperty() {} } },
  body: createElement(),
  addEventListener() {},
  removeEventListener() {},
  querySelector() { return createElement(); },
  getElementById() { return createElement(); },
  createElement() { return createElement(); }
};

const storage = new Map();
const timers = new Map();
let nextTimerId = 1;
const context = {
  window: windowObject,
  document: documentObject,
  localStorage: {
    getItem(key) { return storage.get(key) ?? null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); }
  },
  // Isolated so the tracker's console silencing doesn't swallow test output.
  console: Object.create(console),
  Date,
  JSON,
  Math,
  Number,
  Object,
  String,
  Array,
  Set,
  isFinite,
  requestAnimationFrame() { return 1; },
  cancelAnimationFrame() {},
  setTimeout(callback) {
    const id = nextTimerId++;
    timers.set(id, callback);
    return id;
  },
  clearTimeout(id) { timers.delete(id); },
  setInterval() { return 1; },
  clearInterval() {}
};
context.globalThis = context;
vm.runInNewContext(source, context, { filename: trackerPath });

function send(data) {
  for (const listener of messageListeners) {
    listener({ source: windowObject, data: { data } });
  }
}

async function flushTimers() {
  for (let i = 0; i < 100 && timers.size > 0; i++) {
    const [id, callback] = timers.entries().next().value;
    timers.delete(id);
    callback();
    await new Promise(resolve => setImmediate(resolve));
  }
}

function countPosted(type) {
  return postedMessages.filter(message => message.type === type).length;
}

(async () => {
send({
  hidden: false,
  job: "miner",
  weight: 12,
  max_weight: 100,
  inventory: JSON.stringify({ mining_copper: { amount: 4 } }),
  exp_farming_mining: 15
});
assert.equal(windowObject.state.cache.job, "miner");
assert.equal(windowObject.state.cache.weight, 12);
assert.equal(
  JSON.parse(windowObject.state.cache.inventory).mining_copper.amount,
  4
);

send({ weight: 20 });
assert.equal(windowObject.state.cache.weight, 20);
assert.equal(
  JSON.parse(windowObject.state.cache.inventory).mining_copper.amount,
  4
);

assert.doesNotThrow(() => send({}));
await flushTimers();

// Closed app must not drive the game menu.
postedMessages.length = 0;
send({
  hidden: true,
  menu_open: true,
  menu_choices: [["Exchange Copper Ore"]],
  inventory: JSON.stringify({ mining_copper: { amount: 2 } }),
  weight: 22,
  max_weight: 100
});
await flushTimers();
assert.equal(postedMessages.length, 0);

send({ focused: true });
await flushTimers();
assert.equal(postedMessages.length, 0);

// Pinned (visible but unfocused) is the normal mining state and must still auto-exchange.
postedMessages.length = 0;
send({
  hidden: false,
  focused: false,
  menu_open: true,
  menu_choices: [["Exchange Copper Ore"]],
  inventory: JSON.stringify({ mining_copper: { amount: 2 } }),
  weight: 22,
  max_weight: 100
});
await flushTimers();
assert.equal(countPosted("forceMenuChoice"), 2);

console.log("Mining helper protocol tests passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
