#!/usr/bin/env bun

import * as core from "@actions/core";

import { createManualTestPrompt, preparePrompt } from "./prepare-prompt";
import { runClaude } from "./run-claude";
import { setupClaudeCodeSettings } from "./setup-claude-code-settings";
import { validateEnvironmentVariables } from "./validate-env";
import { getNextTask, getSpecPath, markTaskAsCompleted, type Task } from "./spec/utils";
import { readFileSync } from "fs";


export async function runUsta() {
  try {
    validateEnvironmentVariables();

    await setupClaudeCodeSettings(process.env.INPUT_SETTINGS);

    // Get and validate spec path
    const specPath = await getSpecPath(process.env.INPUT_SPEC_NAME);
    let task: Task | null = await getNextTask(specPath);
    while (task != null){
        core.info(`Next task: ${task.title}\n`);
        // Prepare prompt using the current task
        const promptFile = await preparePrompt({
            specPath: specPath,
            taskId: task.id,
        });
        console.log(`Running task ${task.title}...`);
        await runClaude(promptFile, {
            allowedTools: process.env.INPUT_ALLOWED_TOOLS,
            disallowedTools: process.env.INPUT_DISALLOWED_TOOLS,
            maxTurns: process.env.INPUT_MAX_TURNS,
            mcpConfig: process.env.INPUT_MCP_CONFIG,
            systemPrompt: process.env.INPUT_SYSTEM_PROMPT,
            appendSystemPrompt: process.env.INPUT_APPEND_SYSTEM_PROMPT,
            claudeEnv: process.env.INPUT_CLAUDE_ENV,
            fallbackModel: process.env.INPUT_FALLBACK_MODEL,
        });
        console.log(`Testing task ${task.title}...`);
        const testPrompt = await createManualTestPrompt({
            specPath: specPath,
            taskId: task.id,
        });
        await runClaude(promptFile, {
            allowedTools: process.env.INPUT_ALLOWED_TOOLS,
            disallowedTools: process.env.INPUT_DISALLOWED_TOOLS,
            maxTurns: process.env.INPUT_MAX_TURNS,
            mcpConfig: process.env.INPUT_MCP_CONFIG,
            systemPrompt: process.env.INPUT_SYSTEM_PROMPT,
            appendSystemPrompt: process.env.INPUT_APPEND_SYSTEM_PROMPT,
            claudeEnv: process.env.INPUT_CLAUDE_ENV,
            fallbackModel: process.env.INPUT_FALLBACK_MODEL,
        });
        console.log(`-----------\nPrompt for task ${task.id}:\n${readFileSync(testPrompt)}\n-----------`);
        await markTaskAsCompleted(specPath, task.id);
    
        // Get next task
        task = await getNextTask(specPath);
    }


  } catch (error) {
    core.setFailed(`Action failed with error: ${error}`);
    core.setOutput("conclusion", "failure");
    process.exit(1);
  }
}

if (import.meta.main) {
  runUsta();
}
