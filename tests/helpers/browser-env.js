'use strict';
/**
 * Boots the production browser scripts in Node with a minimal DOM shim, so
 * tests can call the real entry points instead of re-implementing them.
 *
 * Files are loaded unmodified from src/js. Anything a test needs must already
 * be exported by the production debug handle (window.__nailong and friends).
 */

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

function createNode() {
  const classes = new Set();
  const listeners = new Map();
  const self = {
    style: { setProperty() {} },
    dataset: {},
    children: [],
    innerHTML: '',
    textContent: '',
    classList: {
      add(...names) { names.forEach(name => classes.add(name)); },
      remove(...names) { names.forEach(name => classes.delete(name)); },
      toggle(name, force) { if (force) classes.add(name); else classes.delete(name); },
      contains(name) { return classes.has(name); }
    },
    appendChild(child) { self.children.push(child); return child; },
    remove() {},
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    setAttribute() {},
    getAttribute() { return null; },
    querySelector() { return createNode(); },
    querySelectorAll() { return []; },
    scrollIntoView() {},
    focus() {},
    click() {
      if (!self.disabled) {
        for (const listener of listeners.get('click') || []) listener({ target: self });
      }
    },
    get childElementCount() { return self.children.length; },
    get firstElementChild() { return self.children[0] || null; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 550 }; }
  };
  return self;
}

function createStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem(key) { return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null; },
    setItem(key, value) { data[key] = String(value); },
    removeItem(key) { delete data[key]; }
  };
}

function readFile(name) {
  return fs.readFileSync(path.join(ROOT, 'src', 'js', name), 'utf8');
}

// Loads production files, in order, into one shared browser-like global.
function boot({ files = [], search = '', save = createStorage(), globals = {} } = {}) {
  const nodes = new Map();
  const document = {
    getElementById(id) {
      if (!nodes.has(id)) nodes.set(id, createNode());
      return nodes.get(id);
    },
    querySelector() { return createNode(); },
    querySelectorAll() { return []; },
    createElement() { return createNode(); },
    addEventListener() {},
    removeEventListener() {},
    body: createNode(),
    documentElement: createNode()
  };
  const context = {
    console,
    URLSearchParams,
    performance: { now: () => 0 },
    location: { search, href: 'index.html', assign(value) { this.href = value; } },
    localStorage: save,
    sessionStorage: createStorage(),
    requestAnimationFrame() { return 1; },
    cancelAnimationFrame() {},
    setTimeout() { return 1; },
    clearTimeout() {},
    setInterval() { return 1; },
    clearInterval() {},
    document,
    navigator: { userAgent: 'node' },
    innerWidth: 1280,
    innerHeight: 720,
    addEventListener() {},
    removeEventListener() {},
    AudioContext: class { constructor() { this.state = 'running'; } },
    webkitAudioContext: undefined,
    ...globals
  };
  const global = vm.createContext(context);
  vm.runInContext('globalThis.window = globalThis;', global);
  for (const file of files) {
    vm.runInContext(readFile(file), global, { filename: file });
  }
  return { global, context, nodes, save, document };
}

module.exports = { boot, createStorage, createNode, readFile, ROOT };
