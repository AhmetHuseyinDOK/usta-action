#!/usr/bin/env bun

import * as core from "@actions/core";
import { setupClaudeCodeSettings } from "./setup-claude-code-settings";
import { validateEnvironmentVariables } from "./validate-env";
import { runUsta } from "./run-usta";

async function run() {
  try {
    validateEnvironmentVariables();

    await setupClaudeCodeSettings(process.env.INPUT_SETTINGS);

    await runUsta();
  } catch (error) {
    core.setFailed(`Action failed with error: ${error}`);
    core.setOutput("conclusion", "failure");
    process.exit(1);
  }
}

if (import.meta.main) {
  run();
}
