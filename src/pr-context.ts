export interface PRContext {
  number: number;
  branch: string;
  commentId?: string;
  isEnabled: boolean;
}

export function getPRContext(): PRContext {
  const isPRMode = process.env.USTA_PR_MODE === "true";
  
  if (!isPRMode) {
    return {
      number: 0,
      branch: "",
      isEnabled: false,
    };
  }

  const prNumber = parseInt(process.env.USTA_PR_NUMBER || "0", 10);
  const prBranch = process.env.USTA_PR_BRANCH || "";
  const commentId = process.env.USTA_COMMENT_ID;

  if (!prNumber || !prBranch) {
    console.warn("⚠️ PR mode enabled but missing PR context");
    return {
      number: 0,
      branch: "",
      isEnabled: false,
    };
  }

  return {
    number: prNumber,
    branch: prBranch,
    commentId,
    isEnabled: true,
  };
}

export function logPRContext(context: PRContext): void {
  if (context.isEnabled) {
    console.log(`📍 PR Context: #${context.number} on branch '${context.branch}'`);
    if (context.commentId) {
      console.log(`💬 Comment ID: ${context.commentId}`);
    }
  } else {
    console.log("📍 Running in standalone mode (not triggered by PR)");
  }
}