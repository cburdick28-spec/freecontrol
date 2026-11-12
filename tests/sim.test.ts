import { test } from "node:test";
import assert from "node:assert/strict";
import { genesis, step, type Move, type World } from "../sim";

const EPOCH = "2026-01-01T00:00:00.000Z";
const fresh = () => genesis(99, EPOCH).world;
const base = fresh();
const clone = (w: World): World => JSON.parse(JSON.stringify(w));

function check(w: World) {
  const liveCivs = new Set(w.civs.filter((c) => c.fell === undefined).map((c) => c.id));
  for (const o of w.owner) assert.ok(o === 0 || liveCivs.has(o), `tile owned by dead civ ${o}`);
  for (const s of w.species) {
    for (const k in s.pops) assert.ok(Number.isInteger(s.pops[k]) && s.pops[k] >= 1, `bad pop ${s.pops[k]}`);
    assert.ok(Number.isFinite(s.total) && s.total >= 0);
    if (s.died === undefined) assert.equal(s.total, Object.values(s.pops).reduce((a, b) => a + b, 0), `total mismatch for ${s.name}`);
  }
  for (const c of w.civs) for (const v of [c.pop, c.tech, c.stability, c.tiles]) assert.ok(Number.isFinite(v) && v >= 0, `bad civ number in ${c.name}`);
  for (const book of [w.rel, w.wars, w.pacts])
    for (const k in book) for (const id of k.split("-")) assert.ok(liveCivs.has(+id), `stale diplomacy key ${k}`);
}

test("genesis starts at year 0 with life but no nations", () => {
  assert.equal(base.year, 0);
  assert.equal(base.civs.length, 0);
  assert.ok(base.species.filter((s) => s.died === undefined).length > 8);
  check(base);
});

test("same seed gives the exact same world", () => {
  const a = clone(base), b = fresh();
  for (let i = 0; i < 120; i++) { step(a); step(b); }
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test("saving and loading mid-run does not change the future", () => {
  const a = clone(base);
  let b = clone(base);
  for (let i = 0; i < 80; i++) { step(a); step(b); b = clone(b); }
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test("the world stays healthy for 800 ticks and nations rise and fall", () => {
  const w = clone(base);
  let fell = 0, wars = 0;
  for (let i = 0; i < 800; i++) {
    for (const e of step(w)) { if (e.k === "fall") fell++; if (e.k === "war") wars++; }
    if (i % 40 === 0) check(w);
  }
  check(w);
  assert.ok(w.civs.length > 2, "nations should appear");
  assert.ok(fell > 0, "some nation should fall");
  assert.ok(wars > 0, "some war should happen");
  assert.ok(JSON.stringify(w).length < 400_000, "state should stay small");
});

test("god moves land once and change the world", () => {
  const w = clone(base);
  for (let i = 0; i < 150; i++) step(w);
  const target = w.species.filter((s) => s.died === undefined).sort((a, b) => b.total - a.total)[0];
  const civ = w.civs.find((c) => c.fell === undefined)!;
  assert.ok(civ, "need a nation by tick 150");
  const at = EPOCH;

  const before = target.total;
  let ev = step(w, [{ id: "m1", type: "plague", species: target.id, at }]);
  assert.ok(ev.some((e) => e.k === "god"));
  assert.ok(target.total < before * 0.6, "plague should cut the species down");

  const again = step(w, [{ id: "m1", type: "plague", species: target.id, at }]);
  assert.ok(!again.some((e) => e.k === "god"), "a move must not apply twice");

  const smarts = target.smarts;
  step(w, [{ id: "m2", type: "fire", species: target.id, at }]);
  assert.ok(target.smarts > smarts || smarts === 10);

  step(w, [{ id: "m3", type: "bless", species: target.id, at }]);
  assert.ok((target.blessedUntil ?? 0) > w.tick);

  const pop = civ.pop;
  step(w, [{ id: "m4", type: "plague", civ: civ.id, at }]);
  assert.ok(civ.pop < pop * 0.7);

  const cold = w.climateFx.length;
  step(w, [{ id: "m5", type: "iceage", at }]);
  assert.ok(w.climateFx.length > cold);

  const m: Move = { id: "m6", type: "meteor", tile: civ.capital, at };
  ev = step(w, [m]);
  assert.ok(ev.some((e) => e.k === "god" && e.tile === m.tile));
  check(w);

  // junk targets are ignored, not fatal
  step(w, [{ id: "m7", type: "meteor", tile: 999999, at }, { id: "m8", type: "bless", species: -5, at }, { id: "m9", type: "plague", at }]);
  check(w);
});
