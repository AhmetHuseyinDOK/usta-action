import { getTaskById } from "./spec/utils";
import { writeFileSync } from "fs";
export const __TEST_SUCCESS_PHARESE = "__TASK_TEST_COMPLETED__";
export interface PreparePromptConfig {
  specPath: string;
  taskId: string;
}

export async function preparePrompt(
  config: PreparePromptConfig,
): Promise<string> {
  const task = await getTaskById(config.specPath, config.taskId);
  if (!task) {
    throw new Error(
      `Task with ID ${config.taskId} not found in spec ${config.specPath}`,
    );
  }
  const prompt = `You are working on ${task.title} in ${config.specPath}.
- Must read requirements.md, design.md, tasks, CLAUDE.md before executing
- Execute only ONE task at a time
- Focus only on requested task, not others
- Stop after completing task

current date: ${new Date().toISOString()}
  `;
  return crateTemporaryPromptFile(prompt, task.id);
}

export async function createManualTestPrompt(
  config: PreparePromptConfig,
): Promise<string> {
  const task = await getTaskById(config.specPath, config.taskId);
  if (!task) {
    throw new Error(
      `Task with ID ${config.taskId} not found in spec ${config.specPath}`,
    );
  }
  const prompt = `The coding agent has finished the task ${task.title} in ${config.specPath}.

You must the task using <DEVELOPER PERSPECTIVE>
- Respond exactly with "${__TEST_SUCCESS_PHARESE}" if the task is complete
- If the exact text of "${__TEST_SUCCESS_PHARESE}" is not found in your response, then the task will be considered as non-complete
- Respond with the reason if the task is not complete

<DEVELOPER PERSPECTIVE>
- Take a step back, try to use the feature from a fresh perspective
- You must read requirements.md, design.md, tasks, CLAUDE.md, README.md before executing
- Check for configs/environment variables
- Build/Run the project
- Test the features end-to-end using <MANUAL TESTING>
</DEVELOPER PERSPECTIVE>

<MANUAL TESTING>
It is testing from a user's perspective. So that user can use the feature right away.

- If the task is a UI feature, utilize playwright mcp to test it
  - If it needs access to a protected route login or create a new account
  - Take screenshots when needed
  - Test the feature as a user would
  - If the task is not ready to be used by real users, then it is not complete
- If the task is a Server related feature, use the commands like "curl" to test it
  - If it needs access to a protected route, create a new user or use an existing one to get a token
  - Verify that the API works as expected
  - If the task is not ready to be used by real users, then it is not complete
</MANUAL TESTING>

current date: ${new Date().toISOString()}
  `;
  return crateTemporaryPromptFile(prompt, "test-" + task.id);
}

export function crateTemporaryPromptFile(
  prompt: string,
  taskId: string,
): string {
  const fileName = `prompt-${taskId}.txt`;
  const filePath = `/tmp/${fileName}`;

  // Write the prompt to a temporary file
  writeFileSync(filePath, prompt);

  return filePath;
}
