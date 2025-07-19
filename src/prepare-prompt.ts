import { getTaskById } from "./spec/utils";

export interface PreparePromptConfig {
  specPath: string;
  taskId: string;
}

export async function preparePrompt(config: PreparePromptConfig): Promise<string> {

  const task = await getTaskById(config.specPath, config.taskId);
  if(!task) {
    throw new Error(`Task with ID ${config.taskId} not found in spec ${config.specPath}`);
  }
  const prompt = `You are working on ${task.title} in ${config.specPath}.
- Must read requirements.md, design.md, and tasks.md before executing
- Execute only ONE task at a time
- Focus only on requested task, not others
- Stop after completing task

current date: ${new Date().toISOString()}
  `
  return crateTemporaryPromptFile(prompt, task.id);
}

export async function createManualTestPrompt(config: PreparePromptConfig): Promise<string> {
  const task = await getTaskById(config.specPath, config.taskId);
  if(!task) {
    throw new Error(`Task with ID ${config.taskId} not found in spec ${config.specPath}`);
  }
  const prompt =  `The coding agent has finished the task ${task.title} in ${config.specPath}.
  
You must the task using <DEVELOPER PERSPECTIVE>
- Respond with single "OK" if the task is complete
- Respond with the reason if the task is not complete

<DEVELOPER PERSPECTIVE>
- Take a step back, try to use the feature from a fresh perspective
- Check the README.md and related docs
- Check for configs/environment variables
- Build/Run the project
- Test the features end-to-end using <MANUAL TESTING>
</DEVELOPER PERSPECTIVE>
current date: ${new Date().toISOString()}
  `
  return crateTemporaryPromptFile(prompt, 'test-' + task.id);
}

export function crateTemporaryPromptFile(
  prompt: string,
  taskId: string,
): string {
  const fileName = `prompt-${taskId}.txt`;
  const filePath = `/tmp/${fileName}`;
  
  // Write the prompt to a temporary file
  require('fs').writeFileSync(filePath, prompt);
  
  return filePath;
}

