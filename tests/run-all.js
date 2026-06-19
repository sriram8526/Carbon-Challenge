/**
 * @fileoverview Unified test runner — executes all test suites in sequence
 * and reports a combined pass/fail summary.
 *
 * Run: node tests/run-all.js
 */

"use strict";

const { execSync } = require("child_process");

const suites = [
  { name: "Core utilities (calculator, validation, tips)", file: "tests/index.test.js" },
  { name: "Application controller (app.js)",               file: "tests/app.test.js"   },
];

console.log("╔" + "═".repeat(53) + "╗");
console.log("║  EcoTrack — Full Test Suite                        ║");
console.log("╚" + "═".repeat(53) + "╝");

let allPassed = true;

for (const suite of suites) {
  console.log(`\n▶ Running: ${suite.name}\n${"-".repeat(55)}`);
  try {
    const output = execSync(`node ${suite.file}`, { encoding: "utf8", stdio: "pipe" });
    process.stdout.write(output);
  } catch (err) {
    process.stdout.write(err.stdout || "");
    process.stderr.write(err.stderr || "");
    allPassed = false;
  }
}

console.log("\n" + "═".repeat(55));
console.log(allPassed ? "  ✅ ALL TEST SUITES PASSED" : "  ❌ SOME TEST SUITES FAILED");
console.log("═".repeat(55) + "\n");

process.exit(allPassed ? 0 : 1);
