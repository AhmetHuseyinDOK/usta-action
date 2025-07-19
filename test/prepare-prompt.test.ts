#!/usr/bin/env bun

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  preparePrompt,
  createManualTestPrompt,
  type PreparePromptConfig,
} from "../src/prepare-prompt";
import { unlink, readFile, stat, mkdir, writeFile } from "fs/promises";
import { join } from "path";

// Mock getTaskById
const mockTask = {
  id: "task-1",
  title: "Test Task",
  description: "Test task description",
  completed: false,
  requirements: [],
  subtasks: [],
};

describe("preparePrompt integration tests", () => {
  beforeEach(async () => {
    // Create mock spec directory
    const specDir = "/tmp/test-spec";
    try {
      await mkdir(specDir, { recursive: true });
      // Create a mock tasks.md file
      await writeFile(
        join(specDir, "tasks.md"),
        `# Tasks\n\n## ${mockTask.title}\nID: ${mockTask.id}\n${mockTask.description}`,
      );
    } catch {
      // Ignore if already exists
    }
  });

  afterEach(async () => {
    // Clean up temp files
    try {
      await unlink(`/tmp/prompt-${mockTask.id}.txt`);
      await unlink(`/tmp/prompt-test-${mockTask.id}.txt`);
    } catch {
      // Ignore if files don't exist
    }
  });

  test("should create temporary prompt file for task", async () => {
    const config: PreparePromptConfig = {
      specPath: "/tmp/test-spec",
      taskId: "task-1",
    };

    const promptPath = await preparePrompt(config);

    expect(promptPath).toBe(`/tmp/prompt-${mockTask.id}.txt`);

    const fileContent = await readFile(promptPath, "utf-8");
    expect(fileContent).toContain("You are working on");
    expect(fileContent).toContain(mockTask.title);
    expect(fileContent).toContain(config.specPath);

    const fileStat = await stat(promptPath);
    expect(fileStat.size).toBeGreaterThan(0);
  });

  test("should create manual test prompt file", async () => {
    const config: PreparePromptConfig = {
      specPath: "/tmp/test-spec",
      taskId: "task-1",
    };

    const promptPath = await createManualTestPrompt(config);

    expect(promptPath).toBe(`/tmp/prompt-test-${mockTask.id}.txt`);

    const fileContent = await readFile(promptPath, "utf-8");
    expect(fileContent).toContain("Test");
    expect(fileContent).toContain(mockTask.title);
    expect(fileContent).toContain("MANUAL TESTING");

    const fileStat = await stat(promptPath);
    expect(fileStat.size).toBeGreaterThan(0);
  });

  test("should fail when task not found", async () => {
    const config: PreparePromptConfig = {
      specPath: "/tmp/test-spec",
      taskId: "non-existent-task",
    };

    await expect(preparePrompt(config)).rejects.toThrow(
      "Task with ID non-existent-task not found in spec /tmp/test-spec",
    );
  });
});
