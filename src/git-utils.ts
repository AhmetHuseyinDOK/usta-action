import { spawn } from "child_process";

export async function gitCommit(message: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", ["add", "."], { stdio: "inherit" });
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`git add failed with code ${code}`));
        return;
      }

      const commitChild = spawn("git", ["commit", "-m", message], {
        stdio: "inherit",
      });
      commitChild.on("close", (commitCode) => {
        if (commitCode === 0) {
          resolve();
        } else {
          // Code 1 usually means no changes to commit
          console.log("📋 No changes to commit");
          resolve();
        }
      });
      commitChild.on("error", reject);
    });
    child.on("error", reject);
  });
}

export async function gitPush(branch: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`🚀 Pushing changes to branch: ${branch}`);
    const child = spawn("git", ["push", "origin", branch], {
      stdio: "inherit",
    });
    child.on("close", (code) => {
      if (code === 0) {
        console.log(`✅ Successfully pushed to ${branch}`);
        resolve();
      } else {
        reject(new Error(`git push failed with code ${code}`));
      }
    });
    child.on("error", reject);
  });
}

export async function gitCommitAndPush(message: string, branch: string): Promise<void> {
  await gitCommit(message);
  
  // Only push if we're in PR mode
  if (process.env.USTA_PR_MODE === "true" && branch) {
    await gitPush(branch);
  }
}

export async function getCurrentBranch(): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", ["branch", "--show-current"], {
      stdio: ["inherit", "pipe", "inherit"],
    });
    
    let output = "";
    child.stdout?.on("data", (data) => {
      output += data.toString();
    });
    
    child.on("close", (code) => {
      if (code === 0) {
        resolve(output.trim());
      } else {
        reject(new Error(`git branch --show-current failed with code ${code}`));
      }
    });
    child.on("error", reject);
  });
}

export async function gitRollback(): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", ["reset", "--hard", "HEAD"], {
      stdio: "inherit",
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`git reset failed with code ${code}`));
      }
    });
    child.on("error", reject);
  });
}
