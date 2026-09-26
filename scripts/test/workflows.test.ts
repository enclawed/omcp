/**
 * Guards the CI configuration itself.
 *
 * A workflow whose YAML does not parse is not reported as a failure by GitHub:
 * it runs no jobs and reports success, so the checks silently stop running.
 * These tests fail loudly instead.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { parse } from "yaml";

const WORKFLOWS = path.join(__dirname, "..", "..", ".github", "workflows");

const files = fs
  .readdirSync(WORKFLOWS)
  .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
  .sort();

interface Workflow {
  on?: unknown;
  jobs?: Record<
    string,
    { steps?: { name?: string; run?: string; uses?: string }[] }
  >;
}

test("there are workflows to check", () => {
  assert.ok(files.length > 0, "no workflow files found");
});

for (const file of files) {
  test(`${file} is valid YAML and defines at least one job`, () => {
    const source = fs.readFileSync(path.join(WORKFLOWS, file), "utf8");

    let workflow: Workflow;
    try {
      workflow = parse(source) as Workflow;
    } catch (error) {
      assert.fail(`${file} does not parse: ${(error as Error).message}`);
    }

    assert.ok(workflow, `${file} is empty`);
    // "on" is a YAML 1.1 boolean, so a parser may hand it back as `true`.
    assert.ok(workflow.on !== undefined, `${file} has no trigger`);

    const jobs = workflow.jobs ?? {};
    assert.ok(
      Object.keys(jobs).length > 0,
      `${file} defines no jobs, so it would run nothing`,
    );

    for (const [name, job] of Object.entries(jobs)) {
      const steps = job?.steps;
      if (steps === undefined) continue; // a job may call a reusable workflow instead
      assert.ok(steps.length > 0, `${file}: job "${name}" has no steps`);
      for (const [index, step] of steps.entries()) {
        assert.ok(
          step.run !== undefined || step.uses !== undefined,
          `${file}: job "${name}" step ${index} neither runs nor uses anything`,
        );
      }
    }
  });
}

test("the main workflow still runs the repository checks", () => {
  const workflow = parse(
    fs.readFileSync(path.join(WORKFLOWS, "main.yml"), "utf8"),
  ) as Workflow;
  const runs = Object.values(workflow.jobs ?? {})
    .flatMap((job) => job.steps ?? [])
    .map((step) => step.run ?? "")
    .join("\n");
  for (const command of ["npm ci", "npm run check:code"]) {
    assert.ok(runs.includes(command), `main.yml no longer runs "${command}"`);
  }
});
