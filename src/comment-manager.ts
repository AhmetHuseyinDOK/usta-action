import { spawn } from "child_process";
import type { PRContext } from "./pr-context";
import type { Task } from "./spec/utils";

export interface TaskProgress {
  taskId: string;
  title: string;
  status: 'pending' | 'working' | 'testing' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  attempt: number;
  completedOnAttempt?: number;
}

export interface CommentState {
  specName: string;
  tasks: TaskProgress[];
  overallStatus: 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
}

export class CommentManager {
  private context: PRContext;
  private state: CommentState;
  private updateInterval?: NodeJS.Timeout;

  constructor(context: PRContext, specName: string, tasks: TaskProgress[] = []) {
    this.context = context;
    this.state = {
      specName,
      tasks,
      overallStatus: 'running',
      startTime: new Date(),
    };
  }

  updateTaskStatus(taskId: string, status: TaskProgress['status'], attempt?: number): void {
    const task = this.state.tasks.find(t => t.taskId === taskId);
    if (task) {
      task.status = status;
      if (attempt !== undefined) {
        task.attempt = attempt;
      }
      
      if (status === 'working' && !task.startTime) {
        task.startTime = new Date();
      } else if (status === 'completed') {
        if (!task.endTime) {
          task.endTime = new Date();
        }
        task.completedOnAttempt = task.attempt || 1;
      } else if (status === 'failed' && !task.endTime) {
        task.endTime = new Date();
      }
    }
  }

  addTask(task: TaskProgress): void {
    this.state.tasks.push(task);
  }

  setOverallStatus(status: CommentState['overallStatus']): void {
    this.state.overallStatus = status;
    if (status !== 'running' && !this.state.endTime) {
      this.state.endTime = new Date();
    }
  }

  private generateCommentBody(): string {
    const { specName, tasks, overallStatus, startTime, endTime } = this.state;
    
    let statusEmoji = '🔄';
    let statusText = 'Running';
    
    switch (overallStatus) {
      case 'completed':
        statusEmoji = '✅';
        statusText = 'Completed Successfully';
        break;
      case 'failed':
        statusEmoji = '❌';
        statusText = 'Failed';
        break;
    }

    // Get incomplete task count
    const incompleteTasks = tasks.filter(t => t.status !== 'completed').length;
    
    // Use different greeting based on status
    let greeting = '';
    if (overallStatus === 'running' && incompleteTasks > 0) {
      greeting = `🛠️ **Hacı abi ${incompleteTasks} iş kalmış. Hallediyorum... Bu iş bizde!**`;
    } else if (overallStatus === 'completed') {
      greeting = `🛠️ **Tüm işler tamamlandı hacı abi!**`;
    } else if (overallStatus === 'failed') {
      greeting = `🛠️ **Bir sorun çıktı hacı abi!**`;
    }

    let comment = `${greeting}

**Spec:** \`${specName}\`
**Status:** ${statusEmoji} **${statusText}**

`;

    if (tasks.length > 0) {
      comment += "## Task Progress\n\n";
      
      tasks.forEach((task) => {
        let taskEmoji = '';
        let taskStatus = '';
        
        switch (task.status) {
          case 'pending':
            taskEmoji = '⏳';
            taskStatus = 'Pending';
            break;
          case 'working':
            taskEmoji = '🔄';
            taskStatus = task.attempt ? `Working (attempt ${task.attempt}/3)` : 'Working';
            break;
          case 'testing':
            taskEmoji = '🧪';
            taskStatus = 'Testing';
            break;
          case 'completed':
            taskEmoji = '✅';
            const attemptsText = task.completedOnAttempt && task.completedOnAttempt > 1 
              ? ` (on attempt ${task.completedOnAttempt})` 
              : '';
            const duration = task.startTime && task.endTime 
              ? ` - ${Math.round((task.endTime.getTime() - task.startTime.getTime()) / (1000 * 60))} minutes`
              : '';
            taskStatus = `Completed${attemptsText}${duration}`;
            break;
          case 'failed':
            taskEmoji = '❌';
            taskStatus = 'Failed';
            break;
        }
        
        comment += `${taskEmoji} **${task.title}** - ${taskStatus}\n`;
      });
      
      comment += "\n";
    }

    // Progress summary
    const completedTasks = tasks.filter(t => t.status === 'completed');
    const totalTasks = tasks.length;
    
    if (totalTasks > 0) {
      comment += `**Progress:** ${completedTasks.length}/${totalTasks} tasks completed\n`;
      
      // Add completion statistics
      if (completedTasks.length > 0) {
        const firstAttemptSuccess = completedTasks.filter(t => t.completedOnAttempt === 1).length;
        const avgAttempts = completedTasks.reduce((sum, t) => sum + (t.completedOnAttempt || 1), 0) / completedTasks.length;
        comment += `**Success Rate:** ${firstAttemptSuccess}/${completedTasks.length} on first attempt (${Math.round(avgAttempts * 10) / 10} avg attempts)\n`;
      }
      comment += `\n`;
    }

    // Duration
    const duration = endTime ? endTime.getTime() - startTime.getTime() : Date.now() - startTime.getTime();
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    
    if (overallStatus === 'completed') {
      comment += `🎉 All tasks have been completed and changes have been pushed to this PR branch.\n\n`;
      comment += `**Duration:** ${minutes}m ${seconds}s\n\n`;
      comment += `**Next steps:**
- Review the changes in this PR
- Run any additional tests if needed
- Merge when ready`;
    } else if (overallStatus === 'failed') {
      comment += `💥 Execution failed. Check the [workflow logs](${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}) for details.\n\n`;
      comment += `**Duration:** ${minutes}m ${seconds}s`;
    } else {
      comment += `**Running for:** ${minutes}m ${seconds}s`;
    }

    comment += "\n\n---\n*This comment is updated automatically as tasks progress.*";
    
    return comment;
  }

  async updateComment(): Promise<void> {
    if (!this.context.isEnabled || !this.context.commentId) {
      return;
    }

    const commentBody = this.generateCommentBody();
    
    try {
      await this.callGitHubAPI('PATCH', `/repos/${process.env.GITHUB_REPOSITORY}/issues/comments/${this.context.commentId}`, {
        body: commentBody
      });
      
      console.log(`💬 Updated comment with current progress`);
    } catch (error) {
      console.error(`Failed to update comment: ${error}`);
    }
  }

  startPeriodicUpdates(intervalMs: number = 60000): void {
    if (!this.context.isEnabled || this.updateInterval) {
      return;
    }

    console.log(`🔄 Starting periodic comment updates every ${intervalMs / 1000} seconds`);
    
    // Update immediately, then start interval
    this.updateComment().catch(console.error);
    
    this.updateInterval = setInterval(() => {
      // Only update if we're still running
      if (this.state.overallStatus === 'running') {
        this.updateComment().catch(console.error);
      }
    }, intervalMs);
  }

  stopPeriodicUpdates(): void {
    if (this.updateInterval) {
      console.log(`🛑 Stopping periodic comment updates`);
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }
  }

  private async callGitHubAPI(method: string, endpoint: string, data?: any): Promise<any> {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error('GITHUB_TOKEN not available');
    }

    return new Promise((resolve, reject) => {
      const curl = spawn('curl', [
        '-X', method,
        '-H', 'Accept: application/vnd.github.v3+json',
        '-H', `Authorization: Bearer ${token}`,
        '-H', 'Content-Type: application/json',
        `https://api.github.com${endpoint}`,
        ...(data ? ['-d', JSON.stringify(data)] : [])
      ], {
        stdio: ['inherit', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      curl.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      curl.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      curl.on('close', (code) => {
        if (code === 0) {
          try {
            resolve(JSON.parse(stdout));
          } catch {
            resolve(stdout);
          }
        } else {
          reject(new Error(`GitHub API call failed: ${stderr}`));
        }
      });

      curl.on('error', reject);
    });
  }
}

export async function createCommentManager(
  context: PRContext, 
  specName: string, 
  allTasks: Task[] = []
): Promise<CommentManager> {
  const tasks: TaskProgress[] = allTasks.map((task) => ({
    taskId: task.id,
    title: task.title,
    status: task.completed ? 'completed' : 'pending',
    attempt: 1,
    completedOnAttempt: task.completed ? 1 : undefined
  }));

  const manager = new CommentManager(context, specName, tasks);
  
  // Initial comment update
  if (context.isEnabled) {
    await manager.updateComment();
  }
  
  return manager;
}