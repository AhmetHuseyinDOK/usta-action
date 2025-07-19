#!/usr/bin/env bun

import * as core from "@actions/core";

import {
  createManualTestPrompt,
  preparePrompt,
  __TEST_SUCCESS_PHARESE,
} from "./prepare-prompt";
import { runClaude } from "./run-claude";
import { setupClaudeCodeSettings } from "./setup-claude-code-settings";
import { validateEnvironmentVariables } from "./validate-env";
import {
  getAllTasks,
  getNextTask,
  getSpecPath,
  markTaskAsCompleted,
  type Task,
} from "./spec/utils";
import { basename } from "path";
import { gitCommitAndPush, gitRollback } from "./git-utils";
import type { OutputCapture } from "./output-capture";
import { getPRContext, logPRContext } from "./pr-context";
import { createCommentManager } from "./comment-manager";

// Capture Claude output to detect test results
class TestOutputCapture implements OutputCapture {
  private output = "";

  write(data: string): void {
    this.output += data;
    process.stdout.write(data); // Still show to user
  }

  containsTestSuccess(): boolean {
    const hasSuccess = this.output.includes(__TEST_SUCCESS_PHARESE);
    if (process.env.DEBUG_USTA) {
      console.log(
        `[DEBUG] Checking for "${__TEST_SUCCESS_PHARESE}" in captured output:`,
      );
      console.log(`[DEBUG] Output length: ${this.output.length}`);
      console.log(`[DEBUG] Last 500 chars: ${this.output.slice(-500)}`);
      console.log(`[DEBUG] Contains success phrase: ${hasSuccess}`);
    }
    return hasSuccess;
  }

  clear(): void {
    this.output = "";
  }
}

export async function runUsta() {
  try {
    validateEnvironmentVariables();

    await setupClaudeCodeSettings(process.env.INPUT_SETTINGS);

    // Get PR context and log it
    const prContext = getPRContext();
    logPRContext(prContext);

    // Get and validate spec path
    const specPath = await getSpecPath(process.env.INPUT_SPEC_NAME);
    const specName = basename(specPath);
    const enableLogging = process.env.INPUT_ENABLE_LOGGING === "true";

    // Get all tasks to set up comment manager
    const allTasks = await getAllTasks(specPath);
    
    // Create comment manager for PR updates
    const commentManager = await createCommentManager(prContext, specName, allTasks);

    let task: Task | null = await getNextTask(specPath);
    while (task != null) {
      console.log(`\n📋 Running task: ${task.title}`);

      // Update comment to show task is starting
      commentManager.updateTaskStatus(task.id, 'working');
      await commentManager.updateComment();

      // Commit any existing changes before starting
      console.log("📝 Committing existing changes...");
      await gitCommitAndPush(`Before starting task: ${task.title}`, prContext.branch);

      let tries = 0;
      let taskCompleted = false;

      while (tries < 3 && !taskCompleted) {
        tries++;
        console.log(`\n🔄 Attempt ${tries}/3`);
        
        // Update comment with attempt number
        commentManager.updateTaskStatus(task.id, 'working', tries);
        await commentManager.updateComment();

        try {
          // Run the task
          const promptFile = await preparePrompt({
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
            dangerouslySkipPermissions: process.env.INPUT_DANGEROUSLY_SKIP_PERMISSIONS === "true",
            enableRawJsonLogs: enableLogging,
            logContext: enableLogging
              ? {
                  specName: specName,
                  taskTitle: task.title,
                  taskId: task.id,
                  isTest: false,
                }
              : undefined,
          });

          // Test the task with output capture
          console.log(`\n🧪 Testing task: ${task.title}`);
          
          // Update comment to show testing phase
          commentManager.updateTaskStatus(task.id, 'testing');
          await commentManager.updateComment();
          
          const testPrompt = await createManualTestPrompt({
            specPath: specPath,
            taskId: task.id,
          });

          const testCapture = new TestOutputCapture();
          testCapture.clear(); // Ensure clean start

          await runClaude(testPrompt, {
            allowedTools: process.env.INPUT_ALLOWED_TOOLS,
            disallowedTools: process.env.INPUT_DISALLOWED_TOOLS,
            maxTurns: process.env.INPUT_MAX_TURNS,
            mcpConfig: process.env.INPUT_MCP_CONFIG,
            systemPrompt: process.env.INPUT_SYSTEM_PROMPT,
            appendSystemPrompt: process.env.INPUT_APPEND_SYSTEM_PROMPT,
            claudeEnv: process.env.INPUT_CLAUDE_ENV,
            fallbackModel: process.env.INPUT_FALLBACK_MODEL,
            dangerouslySkipPermissions: process.env.INPUT_DANGEROUSLY_SKIP_PERMISSIONS === "true",
            enableRawJsonLogs: enableLogging,
            outputCapture: testCapture,
            logContext: enableLogging
              ? {
                  specName: specName,
                  taskTitle: task.title,
                  taskId: task.id,
                  isTest: true,
                }
              : undefined,
          });

          // Check if test passed
          const hasTestSuccess = testCapture.containsTestSuccess();
          console.log(`\n[DEBUG] Test success detected: ${hasTestSuccess}`);

          if (hasTestSuccess) {
            console.log("\n✅ Test passed! Committing changes...");
            await gitCommitAndPush(`Complete task: ${task.title}`, prContext.branch);
            
            // Update comment to show task completed
            commentManager.updateTaskStatus(task.id, 'completed');
            await commentManager.updateComment();
            
            taskCompleted = true;
          } else {
            console.log("\n❌ Test failed! Rolling back changes...");
            await gitRollback();

            if (tries < 3) {
              console.log(`🔄 Retrying... (${tries}/3)`);
            }
          }
        } catch (error) {
          console.error(`\n❌ Error on attempt ${tries}:`, error);
          await gitRollback();

          if (tries < 3) {
            console.log(`🔄 Retrying... (${tries}/3)`);
          }
        }
      }

      if (!taskCompleted) {
        console.error(
          `\n💥 Failed to complete task "${task.title}" after 3 attempts`,
        );
        
        // Update comment to show task failed
        commentManager.updateTaskStatus(task.id, 'failed');
        commentManager.setOverallStatus('failed');
        await commentManager.updateComment();
        
        process.exit(1);
      }

      // Mark complete and get next
      await markTaskAsCompleted(specPath, task.id);
      task = await getNextTask(specPath);
    }

    console.log("\n✅ All tasks completed!");
    
    // Update comment with final success status
    commentManager.setOverallStatus('completed');
    await commentManager.updateComment();
  } catch (error) {
    core.setFailed(`Action failed with error: ${error}`);
    core.setOutput("conclusion", "failure");
    process.exit(1);
  }
}

if (import.meta.main) {
  runUsta();
}
