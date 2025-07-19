import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { getPRContext } from "../src/pr-context";
import { createCommentManager } from "../src/comment-manager";

describe("PR Workflow Integration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe("getPRContext", () => {
    test("should return disabled context when not in PR mode", () => {
      delete process.env.USTA_PR_MODE;
      
      const context = getPRContext();
      
      expect(context.isEnabled).toBe(false);
      expect(context.number).toBe(0);
      expect(context.branch).toBe("");
    });

    test("should return enabled context when in PR mode with valid data", () => {
      process.env.USTA_PR_MODE = "true";
      process.env.USTA_PR_NUMBER = "123";
      process.env.USTA_PR_BRANCH = "feature-branch";
      process.env.USTA_COMMENT_ID = "456";
      
      const context = getPRContext();
      
      expect(context.isEnabled).toBe(true);
      expect(context.number).toBe(123);
      expect(context.branch).toBe("feature-branch");
      expect(context.commentId).toBe("456");
    });

    test("should return disabled context when missing PR data", () => {
      process.env.USTA_PR_MODE = "true";
      // Missing USTA_PR_NUMBER and USTA_PR_BRANCH
      
      const context = getPRContext();
      
      expect(context.isEnabled).toBe(false);
    });
  });

  describe("CommentManager", () => {
    test("should create comment manager with disabled PR context", async () => {
      const context = {
        number: 0,
        branch: "",
        isEnabled: false,
      };
      
      const tasks = [
        { id: "1", title: "Task 1", description: "", completed: false, requirements: [], subtasks: [] },
        { id: "2", title: "Task 2", description: "", completed: false, requirements: [], subtasks: [] }
      ];
      const manager = await createCommentManager(context, "test-spec", tasks);
      
      expect(manager).toBeDefined();
      // Should not throw when updating comment (should be no-op)
      expect(manager.updateComment()).resolves.toBeUndefined();
    });

    test("should handle task status updates", async () => {
      const context = {
        number: 0,
        branch: "",
        isEnabled: false,
      };
      
      const tasks = [
        { id: "1", title: "Task 1", description: "", completed: false, requirements: [], subtasks: [] }
      ];
      const manager = await createCommentManager(context, "test-spec", tasks);
      
      // Should not throw when updating task status
      expect(() => {
        manager.updateTaskStatus("1", "working");
        manager.updateTaskStatus("1", "completed");
        manager.setOverallStatus("completed");
      }).not.toThrow();
    });
  });

  describe("Environment Variable Handling", () => {
    test("should properly detect PR mode environment", () => {
      // Test various combinations
      const testCases = [
        { USTA_PR_MODE: "true", USTA_PR_NUMBER: "123", USTA_PR_BRANCH: "main", expected: true },
        { USTA_PR_MODE: "false", USTA_PR_NUMBER: "123", USTA_PR_BRANCH: "main", expected: false },
        { USTA_PR_MODE: "true", expected: false }, // Missing required fields
        { USTA_PR_NUMBER: "123", USTA_PR_BRANCH: "main", expected: false }, // Missing PR_MODE
      ];

      testCases.forEach(({ expected, ...envVars }) => {
        // Clear env
        delete process.env.USTA_PR_MODE;
        delete process.env.USTA_PR_NUMBER;
        delete process.env.USTA_PR_BRANCH;
        
        // Set test env vars
        Object.entries(envVars).forEach(([key, value]) => {
          process.env[key] = value;
        });
        
        const context = getPRContext();
        expect(context.isEnabled).toBe(expected);
      });
    });
  });
});