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
const context = {
  window: windowObject,
  document: documentObject,
  localStorage: {
    getItem(key) { return storage.get(key) ?? null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); }
  },
  console,
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
  setTimeout() { return 1; },
  clearTimeout() {},
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

send({
  focused: true,
  tabbed: true,
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

postedMessages.length = 0;
send({
  focused: false,
  tabbed: true,
  menu_open: true,
  menu_choices: [["Exchange Copper Ore"]],
  inventory: JSON.stringify({ mining_copper: { amount: 2 } }),
  weight: 22,
  max_weight: 100
});
assert.equal(postedMessages.length, 0);

send({ focused: true, tabbed: false });
assert.equal(postedMessages.length, 0);

console.log("Mining helper protocol tests passed.");
