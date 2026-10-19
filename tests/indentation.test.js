import test from "node:test";
import assert from "node:assert/strict";
import { indentationEdit } from "../src/utils/indentation.js";

function apply(value, start, end, outdent = false) {
  const edit = indentationEdit(value, start, end, outdent);
  return {
    value: value.slice(0, edit.from) + edit.text + value.slice(edit.to),
    start: edit.start,
    end: edit.end,
  };
}

test("Tab inserts spaces to the next four-column stop without replacing code", () => {
  assert.deepEqual(apply("print(1)", 0, 0), {
    value: "    print(1)",
    start: 4,
    end: 4,
  });
  assert.deepEqual(apply("  x", 2, 2), { value: "    x", start: 4, end: 4 });
  assert.deepEqual(apply("\nx", 0, 0), { value: "    \nx", start: 4, end: 4 });
});

test("selected lines indent together and keep the original text selected", () => {
  assert.deepEqual(apply("one\ntwo\nthree", 0, 7), {
    value: "    one\n    two\nthree",
    start: 4,
    end: 15,
  });
  assert.deepEqual(apply("one", 1, 2), { value: "    one", start: 5, end: 6 });
});

test("a selection ending at the next line start excludes that line", () => {
  assert.deepEqual(apply("one\ntwo", 0, 4), {
    value: "    one\ntwo",
    start: 4,
    end: 8,
  });
});

test("Shift+Tab removes spaces or a tab and adjusts partial selections", () => {
  assert.deepEqual(apply("    one\n  two\n\tthree", 2, 19, true), {
    value: "one\ntwo\nthree",
    start: 0,
    end: 12,
  });
  assert.deepEqual(apply("    one", 6, 6, true), {
    value: "one",
    start: 2,
    end: 2,
  });
});

test("unindenting an unindented or empty line does not delete code", () => {
  assert.deepEqual(apply("one", 0, 0, true), {
    value: "one",
    start: 0,
    end: 0,
  });
  assert.deepEqual(apply("", 0, 0, true), { value: "", start: 0, end: 0 });
});
