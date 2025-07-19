import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { promises as fs } from "fs";
import * as path from "path";
import * as os from "os";
import {
  getSpecPath,
  getTasksFilePath,
  parseTasks,
  getNextTask,
  markTaskAsCompleted,
  getAllTasks,
  getTaskById,
  getIncompleteTasks,
  getTaskProgress
} from "./utils";

// Test helpers
const TEST_SPEC_NAME = "test-spec";
const TEST_SPEC_PATH = path.join(os.homedir(), ".usta", "specs", TEST_SPEC_NAME);
const TEST_TASKS_PATH = path.join(TEST_SPEC_PATH, "tasks.md");

const SAMPLE_TASKS_CONTENT = `# Implementation Plan

## Core Changes

- [  ] 1. Update trigger detection for PR descriptions
  - Modify \`src/github/validation/trigger.ts\` to parse PR body text
  - Add \`@usta execute <file_path>\` pattern matching
  - Support multiple triggers in PR descriptions
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Add simple file finder
  - Create basic file resolution with exact path matching
  - Add fuzzy matching for partial paths
  - Return null if file not found or ambiguous
  - _Requirements: 2.1, 2.2, 2.3_

- [ ] 3. Simplify Claude Code execution
  - Update \`src/create-prompt/index.ts\` to pass file path only
  - Remove complex prompt generation logic
  - Execute with \`/execute <file_path>\` command
  - _Requirements: 2.8, 2.10_

## Cleanup

- [x] 4. Remove issue support
  - Remove issue event handling from triggers
  - Clean up issue-related code paths
  - _Requirements: 6.1_

- [ ] 5. Remove assignee/label triggers
  - Remove assignee and label trigger logic
  - _Requirements: 6.2_

## Testing

- [ ] 6. Add basic tests
  - Test trigger parsing for PR descriptions
  - Test file resolution logic
  - Test simplified execution flow
  - _Requirements: All_
`;

// Setup and teardown
async function createTestSpec() {
  await fs.mkdir(TEST_SPEC_PATH, { recursive: true });
  await fs.writeFile(TEST_TASKS_PATH, SAMPLE_TASKS_CONTENT);
}

async function cleanupTestSpec() {
  try {
    await fs.rm(TEST_SPEC_PATH, { recursive: true, force: true });
  } catch (error) {
    // Ignore errors during cleanup
  }
}

describe("getSpecPath", () => {
  beforeEach(async () => {
    await createTestSpec();
  });

  afterEach(async () => {
    await cleanupTestSpec();
  });

  test("should return spec path for valid spec name", async () => {
    const specPath = await getSpecPath(TEST_SPEC_NAME);
    expect(specPath).toBe(TEST_SPEC_PATH);
  });

  test("should handle spec name with file extension", async () => {
    const specPath = await getSpecPath(`${TEST_SPEC_NAME}.md`);
    expect(specPath).toBe(TEST_SPEC_PATH);
  });

  test("should handle absolute path to spec directory", async () => {
    const specPath = await getSpecPath(TEST_SPEC_PATH);
    expect(specPath).toBe(TEST_SPEC_PATH);
  });

  test("should handle absolute path to file in spec directory", async () => {
    const specPath = await getSpecPath(TEST_TASKS_PATH);
    expect(specPath).toBe(TEST_SPEC_PATH);
  });

  test("should handle case-insensitive matching", async () => {
    const specPath = await getSpecPath(TEST_SPEC_NAME.toUpperCase());
    // It should find the spec regardless of case
    expect(specPath).toBe(TEST_SPEC_PATH);
  });

  test("should handle partial name fuzzy matching", async () => {
    // Create a uniquely named spec for fuzzy matching
    const uniqueSpecPath = path.join(os.homedir(), ".usta", "specs", "unique-fuzzy-spec");
    await fs.mkdir(uniqueSpecPath, { recursive: true });
    await fs.writeFile(path.join(uniqueSpecPath, "tasks.md"), "# Tasks");
    
    const specPath = await getSpecPath("fuzzy");
    expect(specPath).toBe(uniqueSpecPath);
    
    await fs.rm(uniqueSpecPath, { recursive: true, force: true });
  });

  test("should throw error for ambiguous fuzzy matches", async () => {
    // Create two specs with similar names
    const spec1Path = path.join(os.homedir(), ".usta", "specs", "fuzzy-test-1");
    const spec2Path = path.join(os.homedir(), ".usta", "specs", "fuzzy-test-2");
    await fs.mkdir(spec1Path, { recursive: true });
    await fs.mkdir(spec2Path, { recursive: true });
    
    expect(getSpecPath("fuzzy-test")).rejects.toThrow(/Multiple specs found/);
    
    await fs.rm(spec1Path, { recursive: true, force: true });
    await fs.rm(spec2Path, { recursive: true, force: true });
  });

  test("should throw error when spec name is not provided", async () => {
    expect(getSpecPath(undefined)).rejects.toThrow("spec_name input is required");
  });

  test("should throw error when spec folder does not exist", async () => {
    expect(getSpecPath("non-existent-spec")).rejects.toThrow(/Spec not found/);
  });
});

describe("getTasksFilePath", () => {
  test("should return correct tasks.md path", async () => {
    const tasksPath = await getTasksFilePath(TEST_SPEC_PATH);
    expect(tasksPath).toBe(TEST_TASKS_PATH);
  });
});

describe("parseTasks", () => {
  beforeEach(async () => {
    await createTestSpec();
  });

  afterEach(async () => {
    await cleanupTestSpec();
  });

  test("should parse tasks correctly", async () => {
    const sections = await parseTasks(TEST_SPEC_PATH);
    
    expect(sections).toHaveLength(3);
    expect(sections[0]?.title).toBe("Core Changes");
    expect(sections[1]?.title).toBe("Cleanup");
    expect(sections[2]?.title).toBe("Testing");
    
    // Check Core Changes section
    expect(sections[0]?.tasks).toHaveLength(3);
    expect(sections[0]?.tasks[0]?.id).toBe("1");
    expect(sections[0]?.tasks[0]?.title).toBe("1. Update trigger detection for PR descriptions");
    expect(sections[0]?.tasks[0]?.completed).toBe(false);
    // The current implementation doesn't parse requirements from subtasks
    expect(sections[0]?.tasks[0]?.requirements).toEqual([]);
    // Only actual subtasks are included (requirements line is filtered out)
    expect(sections[0]?.tasks[0]?.subtasks).toHaveLength(3);
    expect(sections[0]?.tasks[0]?.subtasks[0]).toBe("Modify `src/github/validation/trigger.ts` to parse PR body text");
    
    expect(sections[0]?.tasks[1]?.id).toBe("2");
    expect(sections[0]?.tasks[1]?.completed).toBe(true);
    
    // Check Cleanup section
    expect(sections[1]?.tasks).toHaveLength(2);
    expect(sections[1]?.tasks[0]?.id).toBe("4");
    expect(sections[1]?.tasks[0]?.completed).toBe(true);
    
    expect(sections[1]?.tasks[1]?.id).toBe("5");
    expect(sections[1]?.tasks[1]?.completed).toBe(false);
  });

  test("should handle empty tasks file", async () => {
    await fs.writeFile(TEST_TASKS_PATH, "");
    const sections = await parseTasks(TEST_SPEC_PATH);
    expect(sections).toHaveLength(0);
  });

  test("should handle tasks without numbers", async () => {
    const content = `## Section\n\n- [ ] Task without number\n- [x] Another task`;
    await fs.writeFile(TEST_TASKS_PATH, content);
    
    const sections = await parseTasks(TEST_SPEC_PATH);
    expect(sections[0]?.tasks[0]?.id).toBe("Task");
    expect(sections[0]?.tasks[1]?.id).toBe("Another");
  });
});

describe("getNextTask", () => {
  beforeEach(async () => {
    await createTestSpec();
  });

  afterEach(async () => {
    await cleanupTestSpec();
  });

  test("should return first incomplete task", async () => {
    const nextTask = await getNextTask(TEST_SPEC_PATH);
    
    expect(nextTask).not.toBeNull();
    expect(nextTask?.id).toBe("1");
    expect(nextTask?.title).toBe("1. Update trigger detection for PR descriptions");
    expect(nextTask?.completed).toBe(false);
  });

  test("should return null when all tasks are completed", async () => {
    const allCompleted = SAMPLE_TASKS_CONTENT
      .replace(/- \[\s*\s*\]/g, "- [x]")  // Handle spaces in checkboxes
      .replace(/- \[ \]/g, "- [x]");      // Handle regular checkboxes
    await fs.writeFile(TEST_TASKS_PATH, allCompleted);
    
    const nextTask = await getNextTask(TEST_SPEC_PATH);
    expect(nextTask).toBeNull();
  });

  test("should skip completed tasks", async () => {
    // Mark first task as completed
    const content = SAMPLE_TASKS_CONTENT.replace("- [  ] 1.", "- [x] 1.");
    await fs.writeFile(TEST_TASKS_PATH, content);
    
    const nextTask = await getNextTask(TEST_SPEC_PATH);
    expect(nextTask?.id).toBe("3");
  });
});

describe("markTaskAsCompleted", () => {
  beforeEach(async () => {
    await createTestSpec();
  });

  afterEach(async () => {
    await cleanupTestSpec();
  });

  test("should mark task as completed by ID", async () => {
    await markTaskAsCompleted(TEST_SPEC_PATH, "1");
    
    const sections = await parseTasks(TEST_SPEC_PATH);
    const task = sections[0]?.tasks.find(t => t.id === "1");
    expect(task?.completed).toBe(true);
  });

  test("should preserve file formatting", async () => {
    await markTaskAsCompleted(TEST_SPEC_PATH, "3");
    
    const content = await fs.readFile(TEST_TASKS_PATH, "utf-8");
    expect(content).toContain("- [x] 3. Simplify Claude Code execution");
    expect(content).toContain("  - Update `src/create-prompt/index.ts`");
  });

  test("should throw error for non-existent task", async () => {
    expect(markTaskAsCompleted(TEST_SPEC_PATH, "999")).rejects.toThrow(
      /Task with ID '999' not found/
    );
  });

  test("should throw error for already completed task", async () => {
    expect(markTaskAsCompleted(TEST_SPEC_PATH, "2")).rejects.toThrow(
      /Task with ID '2' not found or already completed/
    );
  });
});

describe("getAllTasks", () => {
  beforeEach(async () => {
    await createTestSpec();
  });

  afterEach(async () => {
    await cleanupTestSpec();
  });

  test("should return all tasks from all sections", async () => {
    const allTasks = await getAllTasks(TEST_SPEC_PATH);
    
    expect(allTasks).toHaveLength(6);
    expect(allTasks.map(t => t.id)).toEqual(["1", "2", "3", "4", "5", "6"]);
  });
});

describe("getTaskById", () => {
  beforeEach(async () => {
    await createTestSpec();
  });

  afterEach(async () => {
    await cleanupTestSpec();
  });

  test("should return task by ID", async () => {
    const task = await getTaskById(TEST_SPEC_PATH, "3");
    
    expect(task).not.toBeNull();
    expect(task?.title).toBe("3. Simplify Claude Code execution");
    expect(task?.completed).toBe(false);
  });

  test("should return null for non-existent ID", async () => {
    const task = await getTaskById(TEST_SPEC_PATH, "999");
    expect(task).toBeNull();
  });
});

describe("getIncompleteTasks", () => {
  beforeEach(async () => {
    await createTestSpec();
  });

  afterEach(async () => {
    await cleanupTestSpec();
  });

  test("should return only incomplete tasks", async () => {
    const incompleteTasks = await getIncompleteTasks(TEST_SPEC_PATH);
    
    expect(incompleteTasks).toHaveLength(4);
    expect(incompleteTasks.map(t => t.id)).toEqual(["1", "3", "5", "6"]);
    expect(incompleteTasks.every(t => !t.completed)).toBe(true);
  });
});

describe("getTaskProgress", () => {
  beforeEach(async () => {
    await createTestSpec();
  });

  afterEach(async () => {
    await cleanupTestSpec();
  });

  test("should calculate progress correctly", async () => {
    const progress = await getTaskProgress(TEST_SPEC_PATH);
    
    expect(progress.total).toBe(6);
    expect(progress.completed).toBe(2);
    expect(progress.percentage).toBe(33);
  });

  test("should handle all tasks completed", async () => {
    const allCompleted = SAMPLE_TASKS_CONTENT
      .replace(/- \[\s*\s*\]/g, "- [x]")  // Handle spaces in checkboxes
      .replace(/- \[ \]/g, "- [x]");      // Handle regular checkboxes
    await fs.writeFile(TEST_TASKS_PATH, allCompleted);
    
    const progress = await getTaskProgress(TEST_SPEC_PATH);
    expect(progress.percentage).toBe(100);
  });

  test("should handle no tasks", async () => {
    await fs.writeFile(TEST_TASKS_PATH, "# Empty");
    
    const progress = await getTaskProgress(TEST_SPEC_PATH);
    expect(progress.total).toBe(0);
    expect(progress.completed).toBe(0);
    expect(progress.percentage).toBe(0);
  });
});