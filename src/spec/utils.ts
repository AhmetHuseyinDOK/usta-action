import * as path from "path";
import * as os from "os";
import { promises as fs } from "fs";
import { cwd } from "process";

export interface Task {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  requirements: string[];
  subtasks: string[];
}

export interface TaskSection {
  title: string;
  tasks: Task[];
}

async function fuzzyMatchSpec(searchTerm: string, specsDir: string): Promise<string | null> {
  try {
    const entries = await fs.readdir(specsDir);
    const lowerSearchTerm = searchTerm.toLowerCase();
    
    // Filter only directories
    const directories: string[] = [];
    for (const entry of entries) {
      const entryPath = path.join(specsDir, entry);
      try {
        const stats = await fs.stat(entryPath);
        if (stats.isDirectory()) {
          directories.push(entry);
        }
      } catch (error) {
        // Skip entries that can't be accessed
      }
    }
    
    // Exact match
    const exactMatch = directories.find(dir => dir === searchTerm);
    if (exactMatch) {
      return path.join(specsDir, exactMatch);
    }
    
    // Case-insensitive match
    const caseInsensitiveMatch = directories.find(dir => 
      dir.toLowerCase() === lowerSearchTerm
    );
    if (caseInsensitiveMatch) {
      return path.join(specsDir, caseInsensitiveMatch);
    }
    
    // Fuzzy match - contains the search term
    const fuzzyMatches = directories.filter(dir => 
      dir.toLowerCase().includes(lowerSearchTerm) ||
      lowerSearchTerm.includes(dir.toLowerCase())
    );
    
    if (fuzzyMatches.length === 1 && fuzzyMatches[0]) {
      return path.join(specsDir, fuzzyMatches[0]);
    } else if (fuzzyMatches.length > 1) {
      throw new Error(`Multiple specs found matching '${searchTerm}': ${fuzzyMatches.join(', ')}`);
    }
    
    return null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function getSpecPath(specName: string | undefined): Promise<string> {
  // Validate spec name is provided
  if (!specName) {
    throw new Error("spec_name input is required");
  }

  // Check if it's already a full path
  if (path.isAbsolute(specName)) {
    try {
      const stats = await fs.stat(specName);
      if (stats.isFile()) {
        // If it's a file path, get the directory
        const dir = path.dirname(specName);
        const dirStats = await fs.stat(dir);
        if (dirStats.isDirectory()) {
          return dir;
        }
      } else if (stats.isDirectory()) {
        return specName;
      }
    } catch (error) {
      // Path doesn't exist, continue with other strategies
    }
  }
  
  // Check if it's a relative path from current directory
  if (specName.includes('/') || specName.includes('\\')) {
    const relativePath = path.resolve(process.cwd(), specName);
    try {
      const stats = await fs.stat(relativePath);
      if (stats.isDirectory()) {
        return relativePath;
      } else if (stats.isFile()) {
        return path.dirname(relativePath);
      }
    } catch (error) {
      // Path doesn't exist, continue with other strategies
    }
  }
  
  // Remove file extensions if present
  const cleanSpecName = specName.replace(/\.(md|txt|yaml|yml|json)$/i, '');
  
  // Extract just the spec name from paths
  const baseName = path.basename(cleanSpecName);
  
  // Try fuzzy matching in .usta/specs directory
  const specsDir = path.join(process.cwd(), ".usta", "specs");
  const fuzzyMatch = await fuzzyMatchSpec(baseName, specsDir);
  
  if (fuzzyMatch) {
    return fuzzyMatch;
  }
  
  // If all strategies fail, throw error
  throw new Error(`Spec not found: ${specName}. Searched in standard location and current directory.`);
}

export async function getTasksFilePath(specPath: string): Promise<string> {
  return path.join(specPath, "tasks.md");
}

export async function parseTasks(specPath: string): Promise<TaskSection[]> {
  const tasksPath = await getTasksFilePath(specPath);
  const content = await fs.readFile(tasksPath, "utf-8");
  
  const sections: TaskSection[] = [];
  let currentSection: TaskSection | null = null;
  let currentTask: Task | null = null;
  
  const lines = content.split("\n");
  
  for (const line of lines) {
    // Section header (## Title)
    if (line.startsWith("## ")) {
      if (currentTask) {
        currentSection?.tasks.push(currentTask);
        currentTask = null;
      }
      
      currentSection = {
        title: line.substring(3).trim(),
        tasks: []
      };
      sections.push(currentSection);
      continue;
    }
    
    // Task line (- [ ] or - [x]) - handle extra spaces in checkbox
    const taskMatch = line.match(/^- \[\s*([ x])\s*\] (\d+\. )?(.+)$/);
    if (taskMatch) {
      if (currentTask) {
        currentSection?.tasks.push(currentTask);
      }
      
      const [, completed, numberPrefix, titleText] = taskMatch;
      if (titleText) {
        let taskId: string;
        let fullTitle: string;
        
        if (numberPrefix) {
          // Extract just the number from "1. "
          taskId = numberPrefix.replace('.', '').trim();
          fullTitle = numberPrefix + titleText;
        } else {
          // No number prefix, use first word as ID
          taskId = titleText.split(' ')[0] || titleText;
          fullTitle = titleText;
        }
        
        currentTask = {
          id: taskId,
          title: fullTitle.trim(),
          description: "",
          completed: completed === "x",
          requirements: [],
          subtasks: []
        };
      }
      continue;
    }
    
    // Subtask or description line (indented with spaces)
    if (currentTask && line.match(/^  /)) {
      const trimmedLine = line.trim();
      
      // Requirements line
      if (trimmedLine.startsWith("_Requirements:")) {
        const reqText = trimmedLine.replace(/^_Requirements:\s*/, "").replace(/_$/, "");
        currentTask.requirements = reqText.split(",").map(r => r.trim());
      }
      // Subtask line
      else if (trimmedLine.startsWith("- ") && !trimmedLine.startsWith("- _")) {
        currentTask.subtasks.push(trimmedLine.substring(2));
      }
      // Description line
      else if (trimmedLine.length > 0) {
        if (currentTask.description) {
          currentTask.description += "\n" + trimmedLine;
        } else {
          currentTask.description = trimmedLine;
        }
      }
    }
  }
  
  // Add the last task if exists
  if (currentTask && currentSection) {
    currentSection.tasks.push(currentTask);
  }
  
  return sections;
}

export async function getNextTask(specPath: string): Promise<Task | null> {
  const sections = await parseTasks(specPath);
  
  for (const section of sections) {
    for (const task of section.tasks) {
      if (!task.completed) {
        return task;
      }
    }
  }
  
  return null;
}

export async function markTaskAsCompleted(specPath: string, taskId: string): Promise<void> {
  const tasksPath = await getTasksFilePath(specPath);
  let content = await fs.readFile(tasksPath, "utf-8");
  
  const lines = content.split("\n");
  let modified = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    
    const taskMatch = line.match(/^- \[\s*\s*\] (.+)$/);
    
    if (taskMatch && taskMatch[1]) {
      const taskTitle = taskMatch[1];
      const idMatch = taskTitle.match(/^(\d+)\./);
      const taskIdFromTitle = idMatch ? idMatch[1] : taskTitle.split(' ')[0];
      
      if (taskIdFromTitle === taskId || taskTitle.includes(taskId)) {
        lines[i] = line.replace(/- \[\s*\s*\]/, "- [x]");
        modified = true;
        break;
      }
    }
  }
  
  if (!modified) {
    throw new Error(`Task with ID '${taskId}' not found or already completed`);
  }
  
  await fs.writeFile(tasksPath, lines.join("\n"), "utf-8");
}

export async function getAllTasks(specPath: string): Promise<Task[]> {
  const sections = await parseTasks(specPath);
  const allTasks: Task[] = [];
  
  for (const section of sections) {
    allTasks.push(...section.tasks);
  }
  
  return allTasks;
}

export async function getTaskById(specPath: string, taskId: string): Promise<Task | null> {
  const tasks = await getAllTasks(specPath);
  return tasks.find(task => task.id === taskId) || null;
}

export async function getIncompleteTasks(specPath: string): Promise<Task[]> {
  const tasks = await getAllTasks(specPath);
  return tasks.filter(task => !task.completed);
}

export async function getTaskProgress(specPath: string): Promise<{ completed: number; total: number; percentage: number }> {
  const tasks = await getAllTasks(specPath);
  const completed = tasks.filter(task => task.completed).length;
  const total = tasks.length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  return { completed, total, percentage };
}
