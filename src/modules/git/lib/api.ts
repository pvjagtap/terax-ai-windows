import { invoke } from "@tauri-apps/api/core";

// ─── Types ───────────────────────────────────────────────────────────────────

export type GitStatusEntry = {
  path: string;
  status: "modified" | "new" | "deleted" | "renamed" | "typechange" | "conflicted" | "unknown";
  staged: boolean;
  working_tree: boolean;
};

export type GitStatusResult = {
  branch: string | null;
  remote_branch: string | null;
  ahead: number;
  behind: number;
  entries: GitStatusEntry[];
  is_rebasing: boolean;
  is_merging: boolean;
};

export type GitLogEntry = {
  hash: string;
  short_hash: string;
  author: string;
  email: string;
  date: string;
  message: string;
  refs: string[];
};

export type GitBranch = {
  name: string;
  is_current: boolean;
  is_remote: boolean;
  upstream: string | null;
};

export type GitDiffLine = {
  origin: string;
  content: string;
  old_lineno: number | null;
  new_lineno: number | null;
};

export type GitDiffHunk = {
  header: string;
  lines: GitDiffLine[];
};

export type GitDiffFile = {
  path: string;
  hunks: GitDiffHunk[];
};

export type GitStashEntry = {
  index: number;
  message: string;
};

export type GitRemote = {
  name: string;
  url: string;
};

// ─── API functions ───────────────────────────────────────────────────────────

export async function gitStatus(path: string): Promise<GitStatusResult> {
  return invoke("git_status", { path });
}

export async function gitStage(path: string, files: string[]): Promise<void> {
  return invoke("git_stage", { path, files });
}

export async function gitUnstage(path: string, files: string[]): Promise<void> {
  return invoke("git_unstage", { path, files });
}

export async function gitStageAll(path: string): Promise<void> {
  return invoke("git_stage_all", { path });
}

export async function gitUnstageAll(path: string): Promise<void> {
  return invoke("git_unstage_all", { path });
}

export async function gitCommit(path: string, message: string): Promise<string> {
  return invoke("git_commit", { path, message });
}

export async function gitLog(path: string, maxCount?: number): Promise<GitLogEntry[]> {
  return invoke("git_log", { path, max_count: maxCount });
}

export async function gitBranches(path: string): Promise<GitBranch[]> {
  return invoke("git_branches", { path });
}

export async function gitDiff(path: string, staged: boolean): Promise<GitDiffFile[]> {
  return invoke("git_diff", { path, staged });
}

export async function gitDiffFile(path: string, filePath: string, staged: boolean): Promise<GitDiffFile[]> {
  return invoke("git_diff_file", { path, filePath, staged });
}

export async function gitCheckoutBranch(path: string, branchName: string): Promise<void> {
  return invoke("git_checkout_branch", { path, branchName });
}

export async function gitCreateBranch(path: string, branchName: string): Promise<void> {
  return invoke("git_create_branch", { path, branchName });
}

export async function gitDeleteBranch(path: string, branchName: string): Promise<void> {
  return invoke("git_delete_branch", { path, branchName });
}

export async function gitDiscardFile(path: string, filePath: string): Promise<void> {
  return invoke("git_discard_file", { path, filePath });
}

export async function gitDiscardAll(path: string): Promise<void> {
  return invoke("git_discard_all", { path });
}

export async function gitStashSave(path: string, message?: string): Promise<void> {
  return invoke("git_stash_save", { path, message });
}

export async function gitStashList(path: string): Promise<GitStashEntry[]> {
  return invoke("git_stash_list", { path });
}

export async function gitStashPop(path: string, index?: number): Promise<void> {
  return invoke("git_stash_pop", { path, index });
}

export async function gitStashDrop(path: string, index: number): Promise<void> {
  return invoke("git_stash_drop", { path, index });
}

export async function gitRemotes(path: string): Promise<GitRemote[]> {
  return invoke("git_remotes", { path });
}

export async function gitInit(path: string): Promise<void> {
  return invoke("git_init", { path });
}

export async function gitIsRepo(path: string): Promise<boolean> {
  return invoke("git_is_repo", { path });
}

export async function gitGitignoreAdd(path: string, patterns: string[]): Promise<void> {
  return invoke("git_gitignore_add", { path, patterns });
}
