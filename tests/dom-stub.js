/**
 * @fileoverview Minimal DOM stub for testing app.js business logic in Node.js
 * without requiring a full browser environment (jsdom).
 *
 * Only implements the subset of the DOM API that app.js actually uses:
 * getElementById, querySelectorAll, createElement, localStorage.
 *
 * This keeps the test suite dependency-free (no jsdom/puppeteer needed),
 * which matters for CI speed and the <10MB repository size constraint.
 */

"use strict";

/** In-memory localStorage polyfill. */
class MemoryStorage {
  constructor() { this._data = new Map(); }
  getItem(key)        { return this._data.has(key) ? this._data.get(key) : null; }
  setItem(key, value) { this._data.set(key, String(value)); }
  removeItem(key)      { this._data.delete(key); }
  clear()              { this._data.clear(); }
}

/** Minimal element stub supporting the properties app.js reads/writes. */
function createElementStub(id = "") {
  return {
    id,
    value: "",
    checked: false,
    textContent: "",
    innerHTML: "",
    style: {},
    className: "",
    dataset: {},
    children: [],
    classList: {
      _set: new Set(),
      add(c)    { this._set.add(c); },
      remove(c) { this._set.delete(c); },
      contains(c) { return this._set.has(c); },
    },
    attributes: {},
    setAttribute(k, v) { this.attributes[k] = v; },
    removeAttribute(k) { delete this.attributes[k]; },
    getAttribute(k)    { return this.attributes[k] ?? null; },
    addEventListener() {},
    appendChild(child)  { this.children.push(child); return child; },
    querySelectorAll()  { return []; },
    scrollTop: 0,
    scrollHeight: 0,
  };
}

/**
 * Builds a minimal `document` and `localStorage` global suitable for
 * unit-testing the pure calculation functions in app.js.
 * @param {Object.<string, string|number|boolean>} elementValues
 *   Map of element ID -> value/checked to pre-populate stub elements with.
 * @returns {{ document: Object, localStorage: MemoryStorage }}
 */
function createDOMStub(elementValues = {}) {
  const elements = new Map();

  for (const [id, value] of Object.entries(elementValues)) {
    const el = createElementStub(id);
    if (typeof value === "boolean") { el.checked = value; }
    else { el.value = String(value); }
    elements.set(id, el);
  }

  const document = {
    getElementById(id) {
      if (!elements.has(id)) { elements.set(id, createElementStub(id)); }
      return elements.get(id);
    },
    querySelectorAll() { return []; },
    createElement()    { return createElementStub(); },
    addEventListener() {},
  };

  return { document, localStorage: new MemoryStorage(), _elements: elements };
}

module.exports = { createDOMStub, MemoryStorage };
