use git2::{
    BranchType, DiffOptions, Repository, StatusOptions, StatusShow,
};
use serde::Serialize;
use std::path::Path;
use std::process::Command;
use tokio::task::spawn_blocking;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

/// Windows: CREATE_NO_WINDOW flag prevents cmd.exe popups when spawning git CLI
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Helper: create a Command for git that hides the console window on Windows
fn git_cmd() -> Command {
    let mut cmd = Command::new("git");
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

// ─── Response types ──────────────────────────────────────────────────────────

#[derive(Serialize, Clone)]
pub struct GitStatusEntry {
    pub path: String,
    pub status: String,       // "modified", "new", "deleted", "renamed", "typechange", "conflicted"
    pub staged: bool,
    pub working_tree: bool,   // true = unstaged change present
}

#[derive(Serialize)]
pub struct GitStatusResult {
    pub branch: Option<String>,
    pub remote_branch: Option<String>,
    pub ahead: usize,
    pub behind: usize,
    pub entries: Vec<GitStatusEntry>,
    pub is_rebasing: bool,
    pub is_merging: bool,
}

#[derive(Serialize)]
pub struct GitLogEntry {
    pub hash: String,
    pub short_hash: String,
    pub author: String,
    pub email: String,
    pub date: String,        // ISO 8601
    pub message: String,
    pub refs: Vec<String>,   // branch/tag names
}

#[derive(Serialize)]
pub struct GitBranch {
    pub name: String,
    pub is_current: bool,
    pub is_remote: bool,
    pub upstream: Option<String>,
}

#[derive(Serialize)]
pub struct GitDiffFile {
    pub path: String,
    pub hunks: Vec<GitDiffHunk>,
}

#[derive(Serialize)]
pub struct GitDiffHunk {
    pub header: String,
    pub lines: Vec<GitDiffLine>,
}

#[derive(Serialize)]
pub struct GitDiffLine {
    pub origin: char,        // '+', '-', ' '
    pub content: String,
    pub old_lineno: Option<u32>,
    pub new_lineno: Option<u32>,
}

#[derive(Serialize)]
pub struct GitStashEntry {
    pub index: usize,
    pub message: String,
}

#[derive(Serialize)]
pub struct GitRemote {
    pub name: String,
    pub url: String,
}

// ─── Helper ──────────────────────────────────────────────────────────────────

fn open_repo(path: &str) -> Result<Repository, String> {
    Repository::discover(path).map_err(|e| format!("Not a git repository: {}", e))
}

// ─── Commands ────────────────────────────────────────────────────────────────

/// Fast git status using the native `git` CLI with --porcelain=v2.
/// This is 10-100x faster than libgit2 for large repos because it leverages:
/// - fsmonitor / watchman integration
/// - untracked cache
/// - multi-threaded status
/// - split index
/// Falls back to libgit2 if git CLI is not available.
/// ASYNC: runs on a blocking thread pool so it NEVER blocks terminal I/O.
#[tauri::command]
pub async fn git_status(path: String) -> Result<GitStatusResult, String> {
    spawn_blocking(move || {
        match git_status_cli(&path) {
            Ok(result) => Ok(result),
            Err(_) => git_status_libgit2(&path),
        }
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

fn git_status_cli(path: &str) -> Result<GitStatusResult, String> {
    let output = git_cmd()
        .args([
            "status",
            "--porcelain=v2",
            "--branch",
            "-unormal",        // Don't recurse into untracked dirs (show dir as single entry)
            "--no-renames",    // Skip expensive rename detection
        ])
        .current_dir(path)
        .output()
        .map_err(|e| format!("git CLI not available: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git status failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut branch: Option<String> = None;
    let mut remote_branch: Option<String> = None;
    let mut ahead: usize = 0;
    let mut behind: usize = 0;
    let mut entries: Vec<GitStatusEntry> = Vec::new();

    for line in stdout.lines() {
        if line.starts_with("# branch.head ") {
            let name = line.strip_prefix("# branch.head ").unwrap_or("");
            if name != "(detached)" {
                branch = Some(name.to_string());
            }
        } else if line.starts_with("# branch.upstream ") {
            remote_branch = line.strip_prefix("# branch.upstream ").map(|s| s.to_string());
        } else if line.starts_with("# branch.ab ") {
            // Format: # branch.ab +<ahead> -<behind>
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 4 {
                ahead = parts[2].trim_start_matches('+').parse().unwrap_or(0);
                behind = parts[3].trim_start_matches('-').parse().unwrap_or(0);
            }
        } else if line.starts_with("1 ") || line.starts_with("2 ") {
            // Tracked entry: "1 XY sub mH mI mW hH hI path"
            // or rename:     "2 XY sub mH mI mW hH hI X score path\torigPath"
            let parts: Vec<&str> = line.splitn(9, ' ').collect();
            if parts.len() >= 9 {
                let xy = parts[1];
                let file_path = if line.starts_with("2 ") {
                    // Rename entry has tab-separated paths
                    parts[8].split('\t').next().unwrap_or(parts[8])
                } else {
                    parts[8]
                };

                let x = xy.chars().next().unwrap_or('.');
                let y = xy.chars().nth(1).unwrap_or('.');

                let staged = x != '.' && x != '?';
                let working_tree = y != '.' && y != '?';

                let status_str = determine_status(x, y);
                entries.push(GitStatusEntry {
                    path: file_path.to_string(),
                    status: status_str.to_string(),
                    staged,
                    working_tree,
                });
            }
        } else if line.starts_with("u ") {
            // Unmerged (conflicted) entry: "u XY sub m1 m2 m3 mW h1 h2 h3 path"
            let parts: Vec<&str> = line.splitn(11, ' ').collect();
            if parts.len() >= 11 {
                entries.push(GitStatusEntry {
                    path: parts[10].to_string(),
                    status: "conflicted".to_string(),
                    staged: true,
                    working_tree: true,
                });
            }
        } else if line.starts_with("? ") {
            // Untracked: "? path"
            let file_path = line.strip_prefix("? ").unwrap_or("");
            entries.push(GitStatusEntry {
                path: file_path.to_string(),
                status: "new".to_string(),
                staged: false,
                working_tree: true,
            });
        }
    }

    // Detect rebase/merge state from filesystem markers
    let git_dir = find_git_dir(path);
    let is_rebasing = git_dir.as_ref().map_or(false, |d| {
        d.join("rebase-merge").exists() || d.join("rebase-apply").exists()
    });
    let is_merging = git_dir.as_ref().map_or(false, |d| {
        d.join("MERGE_HEAD").exists()
    });

    Ok(GitStatusResult {
        branch,
        remote_branch,
        ahead,
        behind,
        entries,
        is_rebasing,
        is_merging,
    })
}

fn determine_status(x: char, y: char) -> &'static str {
    // x = index status, y = worktree status
    // Priority: conflict > delete > rename > modified > new > typechange
    match (x, y) {
        ('U', _) | (_, 'U') | ('A', 'A') | ('D', 'D') => "conflicted",
        ('D', _) | (_, 'D') => "deleted",
        ('R', _) | (_, 'R') => "renamed",
        ('A', _) | (_, 'A') => "new",
        ('M', _) | (_, 'M') => "modified",
        ('T', _) | (_, 'T') => "typechange",
        _ => "modified",
    }
}

fn find_git_dir(path: &str) -> Option<std::path::PathBuf> {
    let output = git_cmd()
        .args(["rev-parse", "--git-dir"])
        .current_dir(path)
        .output()
        .ok()?;
    if output.status.success() {
        let dir = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let p = std::path::PathBuf::from(&dir);
        if p.is_absolute() {
            Some(p)
        } else {
            Some(std::path::PathBuf::from(path).join(dir))
        }
    } else {
        None
    }
}

/// Fallback: libgit2-based status (slower for large repos but no git CLI dependency)
fn git_status_libgit2(path: &str) -> Result<GitStatusResult, String> {
    let repo = open_repo(path)?;

    // Branch info
    let head = repo.head().ok();
    let branch = head
        .as_ref()
        .and_then(|h| h.shorthand().map(|s| s.to_string()));

    // Track ahead/behind
    let (ahead, behind) = if let Some(ref h) = head {
        if let Some(oid) = h.target() {
            if let Ok(upstream) = repo.branch_upstream_name(
                h.name().unwrap_or(""),
            ) {
                let upstream_name = upstream.as_str().unwrap_or("");
                if let Ok(upstream_ref) = repo.find_reference(upstream_name) {
                    if let Some(upstream_oid) = upstream_ref.target() {
                        repo.graph_ahead_behind(oid, upstream_oid).unwrap_or((0, 0))
                    } else { (0, 0) }
                } else { (0, 0) }
            } else { (0, 0) }
        } else { (0, 0) }
    } else { (0, 0) };

    let remote_branch = head.as_ref().and_then(|h| {
        repo.branch_upstream_name(h.name().unwrap_or(""))
            .ok()
            .and_then(|b| b.as_str().map(|s| {
                s.strip_prefix("refs/remotes/").unwrap_or(s).to_string()
            }))
    });

    // Status entries — no dir recursion for speed
    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(false)
        .show(StatusShow::IndexAndWorkdir);

    let statuses = repo.statuses(Some(&mut opts)).map_err(|e| e.to_string())?;
    let mut entries = Vec::new();

    for entry in statuses.iter() {
        let p = entry.path().unwrap_or("").to_string();
        let s = entry.status();

        let staged = s.intersects(
            git2::Status::INDEX_NEW
                | git2::Status::INDEX_MODIFIED
                | git2::Status::INDEX_DELETED
                | git2::Status::INDEX_RENAMED
                | git2::Status::INDEX_TYPECHANGE,
        );
        let working_tree = s.intersects(
            git2::Status::WT_NEW
                | git2::Status::WT_MODIFIED
                | git2::Status::WT_DELETED
                | git2::Status::WT_RENAMED
                | git2::Status::WT_TYPECHANGE,
        );
        let conflicted = s.contains(git2::Status::CONFLICTED);

        let status_str = if conflicted {
            "conflicted"
        } else if s.intersects(git2::Status::INDEX_NEW | git2::Status::WT_NEW) {
            "new"
        } else if s.intersects(git2::Status::INDEX_DELETED | git2::Status::WT_DELETED) {
            "deleted"
        } else if s.intersects(git2::Status::INDEX_RENAMED | git2::Status::WT_RENAMED) {
            "renamed"
        } else if s.intersects(git2::Status::INDEX_MODIFIED | git2::Status::WT_MODIFIED) {
            "modified"
        } else if s.intersects(git2::Status::INDEX_TYPECHANGE | git2::Status::WT_TYPECHANGE) {
            "typechange"
        } else {
            "unknown"
        };

        entries.push(GitStatusEntry {
            path: p,
            status: status_str.to_string(),
            staged,
            working_tree,
        });
    }

    // Check state
    let is_rebasing = repo.state() == git2::RepositoryState::Rebase
        || repo.state() == git2::RepositoryState::RebaseInteractive
        || repo.state() == git2::RepositoryState::RebaseMerge;
    let is_merging = repo.state() == git2::RepositoryState::Merge;

    Ok(GitStatusResult {
        branch,
        remote_branch,
        ahead,
        behind,
        entries,
        is_rebasing,
        is_merging,
    })
}

#[tauri::command]
pub async fn git_stage(path: String, files: Vec<String>) -> Result<(), String> {
    spawn_blocking(move || {
        let repo = open_repo(&path)?;
        let mut index = repo.index().map_err(|e| e.to_string())?;

        for file in &files {
            let full_path = Path::new(&path).join(file);
            if full_path.exists() {
                index.add_path(Path::new(file)).map_err(|e| e.to_string())?;
            } else {
                index.remove_path(Path::new(file)).map_err(|e| e.to_string())?;
            }
        }
        index.write().map_err(|e| e.to_string())?;
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn git_unstage(path: String, files: Vec<String>) -> Result<(), String> {
    spawn_blocking(move || {
    let repo = open_repo(&path)?;
    let head = repo.head().ok().and_then(|h| h.peel_to_tree().ok());

    let mut index = repo.index().map_err(|e| e.to_string())?;

    for file in &files {
        if let Some(ref tree) = head {
            // Reset to HEAD entry
            if let Ok(entry) = tree.get_path(Path::new(file)) {
                let _ = index.add(&git2::IndexEntry {
                    ctime: git2::IndexTime::new(0, 0),
                    mtime: git2::IndexTime::new(0, 0),
                    dev: 0,
                    ino: 0,
                    mode: entry.filemode() as u32,
                    uid: 0,
                    gid: 0,
                    file_size: 0,
                    id: entry.id(),
                    flags: 0,
                    flags_extended: 0,
                    path: file.as_bytes().to_vec(),
                });
            } else {
                // File doesn't exist in HEAD, remove from index
                let _ = index.remove_path(Path::new(file));
            }
        } else {
            // No HEAD (initial commit), just remove from index
            let _ = index.remove_path(Path::new(file));
        }
    }
    index.write().map_err(|e| e.to_string())?;
    Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn git_stage_all(path: String) -> Result<(), String> {
    spawn_blocking(move || {
        let repo = open_repo(&path)?;
        let mut index = repo.index().map_err(|e| e.to_string())?;
        index
            .add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)
            .map_err(|e| e.to_string())?;
        index.write().map_err(|e| e.to_string())?;
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn git_unstage_all(path: String) -> Result<(), String> {
    spawn_blocking(move || {
        let repo = open_repo(&path)?;
        let head = repo.head().ok().and_then(|h| h.peel_to_commit().ok());

        if let Some(commit) = head {
            let tree = commit.tree().map_err(|e| e.to_string())?;
            repo.reset_default(Some(tree.as_object()), Vec::<&str>::new())
                .map_err(|e| e.to_string())?;
        } else {
            let mut index = repo.index().map_err(|e| e.to_string())?;
            index.clear().map_err(|e| e.to_string())?;
            index.write().map_err(|e| e.to_string())?;
        }
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn git_commit(path: String, message: String) -> Result<String, String> {
    if message.trim().is_empty() {
        return Err("Commit message cannot be empty".to_string());
    }

    spawn_blocking(move || {
        let repo = open_repo(&path)?;
        let mut index = repo.index().map_err(|e| e.to_string())?;
        let tree_oid = index.write_tree().map_err(|e| e.to_string())?;
        let tree = repo.find_tree(tree_oid).map_err(|e| e.to_string())?;

        let sig = repo.signature().map_err(|e| {
            format!("Cannot determine author/committer. Configure git user.name and user.email: {}", e)
        })?;

        let parent_commit = repo.head().ok().and_then(|h| h.peel_to_commit().ok());
        let parents: Vec<&git2::Commit> = parent_commit.iter().collect();

        let oid = repo
            .commit(Some("HEAD"), &sig, &sig, &message, &tree, &parents)
            .map_err(|e| e.to_string())?;

        Ok(oid.to_string())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn git_log(path: String, max_count: Option<usize>) -> Result<Vec<GitLogEntry>, String> {
    spawn_blocking(move || git_log_sync(path, max_count))
        .await
        .map_err(|e| format!("Task join error: {}", e))?
}

fn git_log_sync(path: String, max_count: Option<usize>) -> Result<Vec<GitLogEntry>, String> {
    let repo = open_repo(&path)?;
    let mut revwalk = repo.revwalk().map_err(|e| e.to_string())?;
    revwalk.push_head().map_err(|e| e.to_string())?;
    revwalk
        .set_sorting(git2::Sort::TIME)
        .map_err(|e| e.to_string())?;

    let limit = max_count.unwrap_or(100);
    let mut entries = Vec::new();

    // Collect refs for annotation
    let mut ref_map: std::collections::HashMap<git2::Oid, Vec<String>> =
        std::collections::HashMap::new();
    for reference in repo.references().map_err(|e| e.to_string())?.flatten() {
        if let Some(target) = reference.target() {
            if let Some(name) = reference.shorthand() {
                ref_map.entry(target).or_default().push(name.to_string());
            }
        }
    }

    for oid_result in revwalk.take(limit) {
        let oid = oid_result.map_err(|e| e.to_string())?;
        let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;
        let time = commit.time();
        let secs = time.seconds();
        let offset = time.offset_minutes();

        // Format as ISO 8601
        let total_seconds = secs + (offset as i64) * 60;
        let date = format_timestamp(total_seconds, offset);

        entries.push(GitLogEntry {
            hash: oid.to_string(),
            short_hash: oid.to_string()[..7].to_string(),
            author: commit.author().name().unwrap_or("Unknown").to_string(),
            email: commit.author().email().unwrap_or("").to_string(),
            date,
            message: commit.summary().unwrap_or("").to_string(),
            refs: ref_map.get(&oid).cloned().unwrap_or_default(),
        });
    }

    Ok(entries)
}

#[tauri::command]
pub async fn git_branches(path: String) -> Result<Vec<GitBranch>, String> {
    spawn_blocking(move || {
        let repo = open_repo(&path)?;
        let mut branches = Vec::new();
        let head = repo.head().ok();
        let head_name = head.as_ref().and_then(|h| h.shorthand().map(|s| s.to_string()));

        // Local branches
        for branch_result in repo.branches(Some(BranchType::Local)).map_err(|e| e.to_string())? {
            let (branch, _) = branch_result.map_err(|e| e.to_string())?;
            let name = branch.name().map_err(|e| e.to_string())?.unwrap_or("").to_string();
            let upstream = branch
                .upstream()
                .ok()
                .and_then(|u| u.name().ok().flatten().map(|s| s.to_string()));

            branches.push(GitBranch {
                is_current: head_name.as_deref() == Some(&name),
                name,
                is_remote: false,
                upstream,
            });
        }

        // Remote branches
        for branch_result in repo.branches(Some(BranchType::Remote)).map_err(|e| e.to_string())? {
            let (branch, _) = branch_result.map_err(|e| e.to_string())?;
            let name = branch.name().map_err(|e| e.to_string())?.unwrap_or("").to_string();
            branches.push(GitBranch {
                name,
                is_current: false,
                is_remote: true,
                upstream: None,
            });
        }

        Ok(branches)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn git_diff(path: String, staged: bool) -> Result<Vec<GitDiffFile>, String> {
    spawn_blocking(move || {
        let repo = open_repo(&path)?;
        let mut diff_opts = DiffOptions::new();
        diff_opts.include_untracked(true);

        let diff = if staged {
            let head_tree = repo
                .head()
                .ok()
                .and_then(|h| h.peel_to_tree().ok());
            repo.diff_tree_to_index(head_tree.as_ref(), None, Some(&mut diff_opts))
        } else {
            repo.diff_index_to_workdir(None, Some(&mut diff_opts))
        }
        .map_err(|e| e.to_string())?;

        collect_diff_files(&diff)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn git_diff_file(path: String, file_path: String, staged: bool) -> Result<Vec<GitDiffFile>, String> {
    spawn_blocking(move || {
        let repo = open_repo(&path)?;
        let mut diff_opts = DiffOptions::new();
        diff_opts.include_untracked(true);
        diff_opts.pathspec(&file_path);

        let diff = if staged {
            let head_tree = repo.head().ok().and_then(|h| h.peel_to_tree().ok());
            repo.diff_tree_to_index(head_tree.as_ref(), None, Some(&mut diff_opts))
        } else {
            repo.diff_index_to_workdir(None, Some(&mut diff_opts))
        }
        .map_err(|e| e.to_string())?;

        collect_diff_files(&diff)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Collect diff output by iterating deltas and using `diff.print` which takes a single closure.
fn collect_diff_files(diff: &git2::Diff) -> Result<Vec<GitDiffFile>, String> {

    let mut file_map: Vec<GitDiffFile> = Vec::new();

    // First pass: collect file names from deltas
    let num_deltas = diff.deltas().len();
    for i in 0..num_deltas {
        let delta = diff.deltas().nth(i).unwrap();
        let p = delta
            .new_file()
            .path()
            .or_else(|| delta.old_file().path())
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();
        file_map.push(GitDiffFile {
            path: p,
            hunks: Vec::new(),
        });
    }

    // Second pass: use print to get hunks and lines
    let mut current_file_idx: Option<usize> = None;

    diff.print(git2::DiffFormat::Patch, |delta, hunk, line| {
        // Determine which file this belongs to
        let file_path = delta
            .new_file()
            .path()
            .or_else(|| delta.old_file().path())
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();

        // Find the file index
        let file_idx = file_map
            .iter()
            .position(|f| f.path == file_path)
            .unwrap_or(0);

        match line.origin() {
            'H' => {
                // Hunk header
                current_file_idx = Some(file_idx);
                if let Some(idx) = current_file_idx {
                    if let Some(file) = file_map.get_mut(idx) {
                        let header = if let Some(h) = hunk {
                            String::from_utf8_lossy(h.header()).trim().to_string()
                        } else {
                            String::new()
                        };
                        file.hunks.push(GitDiffHunk {
                            header,
                            lines: Vec::new(),
                        });
                    }
                }
            }
            '+' | '-' | ' ' => {
                let idx = current_file_idx.unwrap_or(file_idx);
                if let Some(file) = file_map.get_mut(idx) {
                    if file.hunks.is_empty() {
                        // Create a default hunk if missing
                        file.hunks.push(GitDiffHunk {
                            header: String::new(),
                            lines: Vec::new(),
                        });
                    }
                    if let Some(hunk_entry) = file.hunks.last_mut() {
                        hunk_entry.lines.push(GitDiffLine {
                            origin: line.origin(),
                            content: String::from_utf8_lossy(line.content()).to_string(),
                            old_lineno: line.old_lineno(),
                            new_lineno: line.new_lineno(),
                        });
                    }
                }
            }
            _ => {}
        }
        true
    })
    .map_err(|e| e.to_string())?;

    Ok(file_map)
}

#[tauri::command]
pub async fn git_checkout_branch(path: String, branch_name: String) -> Result<(), String> {
    spawn_blocking(move || {
        let repo = open_repo(&path)?;

        let (obj, reference) = repo
            .revparse_ext(&branch_name)
            .map_err(|e| format!("Branch '{}' not found: {}", branch_name, e))?;

        repo.checkout_tree(&obj, None).map_err(|e| e.to_string())?;

        if let Some(refer) = reference {
            repo.set_head(refer.name().unwrap_or(&format!("refs/heads/{}", branch_name)))
                .map_err(|e| e.to_string())?;
        } else {
            repo.set_head_detached(obj.id())
                .map_err(|e| e.to_string())?;
        }

        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn git_create_branch(path: String, branch_name: String) -> Result<(), String> {
    spawn_blocking(move || {
        let repo = open_repo(&path)?;
        let head = repo.head().map_err(|e| e.to_string())?;
        let commit = head.peel_to_commit().map_err(|e| e.to_string())?;

        repo.branch(&branch_name, &commit, false)
            .map_err(|e| e.to_string())?;

        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn git_delete_branch(path: String, branch_name: String) -> Result<(), String> {
    spawn_blocking(move || {
        let repo = open_repo(&path)?;
        let mut branch = repo
            .find_branch(&branch_name, BranchType::Local)
            .map_err(|e| format!("Branch '{}' not found: {}", branch_name, e))?;

        if branch.is_head() {
            return Err("Cannot delete the current branch".to_string());
        }

        branch.delete().map_err(|e| e.to_string())?;
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn git_discard_file(path: String, file_path: String) -> Result<(), String> {
    spawn_blocking(move || {
        let repo = open_repo(&path)?;
        let mut checkout_opts = git2::build::CheckoutBuilder::new();
        checkout_opts.force().path(&file_path);

        repo.checkout_head(Some(&mut checkout_opts))
            .map_err(|e| e.to_string())?;
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn git_discard_all(path: String) -> Result<(), String> {
    spawn_blocking(move || {
        let repo = open_repo(&path)?;
        let mut checkout_opts = git2::build::CheckoutBuilder::new();
        checkout_opts.force();

        repo.checkout_head(Some(&mut checkout_opts))
            .map_err(|e| e.to_string())?;

        // Also clean untracked files — use non-recursive scan for speed on large repos
        let mut opts = StatusOptions::new();
        opts.include_untracked(true)
            .recurse_untracked_dirs(false);
        let statuses = repo.statuses(Some(&mut opts)).map_err(|e| e.to_string())?;
        let workdir = repo.workdir().ok_or("No working directory")?;

        for entry in statuses.iter() {
            if entry.status().contains(git2::Status::WT_NEW) {
                if let Some(p) = entry.path() {
                    let full = workdir.join(p);
                    if full.is_file() {
                        let _ = std::fs::remove_file(&full);
                    } else if full.is_dir() {
                        let _ = std::fs::remove_dir_all(&full);
                    }
                }
            }
        }

        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn git_stash_save(path: String, message: Option<String>) -> Result<(), String> {
    spawn_blocking(move || {
        let mut repo = open_repo(&path)?;
        let sig = repo.signature().map_err(|e| e.to_string())?;
        let msg = message.as_deref().unwrap_or("WIP");

        repo.stash_save(&sig, msg, Some(git2::StashFlags::INCLUDE_UNTRACKED))
            .map_err(|e| e.to_string())?;
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn git_stash_list(path: String) -> Result<Vec<GitStashEntry>, String> {
    spawn_blocking(move || {
        let mut repo = open_repo(&path)?;
        let mut entries = Vec::new();
        repo.stash_foreach(|idx, msg, _oid| {
            entries.push(GitStashEntry {
                index: idx,
                message: msg.to_string(),
            });
            true
        })
        .map_err(|e| e.to_string())?;
        Ok(entries)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn git_stash_pop(path: String, index: Option<usize>) -> Result<(), String> {
    spawn_blocking(move || {
        let mut repo = open_repo(&path)?;
        let idx = index.unwrap_or(0);
        repo.stash_pop(idx, None).map_err(|e| e.to_string())?;
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn git_stash_drop(path: String, index: usize) -> Result<(), String> {
    spawn_blocking(move || {
        let mut repo = open_repo(&path)?;
        repo.stash_drop(index).map_err(|e| e.to_string())?;
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn git_remotes(path: String) -> Result<Vec<GitRemote>, String> {
    spawn_blocking(move || {
        let repo = open_repo(&path)?;
        let remote_names = repo.remotes().map_err(|e| e.to_string())?;
        let mut remotes = Vec::new();

        for name in remote_names.iter().flatten() {
            if let Ok(remote) = repo.find_remote(name) {
                remotes.push(GitRemote {
                    name: name.to_string(),
                    url: remote.url().unwrap_or("").to_string(),
                });
            }
        }

        Ok(remotes)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn git_init(path: String) -> Result<(), String> {
    spawn_blocking(move || {
        Repository::init(&path).map_err(|e| e.to_string())?;
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn git_is_repo(path: String) -> Result<bool, String> {
    spawn_blocking(move || {
        // Use CLI first (faster — no repo open overhead)
        if let Ok(output) = git_cmd()
            .args(["rev-parse", "--is-inside-work-tree"])
            .current_dir(&path)
            .output()
        {
            return Ok(output.status.success());
        }
        // Fallback to libgit2
        Ok(Repository::discover(&path).is_ok())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn git_gitignore_add(path: String, patterns: Vec<String>) -> Result<(), String> {
    spawn_blocking(move || {
        use std::fs;
        use std::io::Write;

        let root = Path::new(&path);
        let gitignore_path = root.join(".gitignore");

        // Read existing content (if any)
        let existing = fs::read_to_string(&gitignore_path).unwrap_or_default();
        let existing_lines: Vec<&str> = existing.lines().collect();

        // Filter out patterns already present
        let new_patterns: Vec<&String> = patterns
            .iter()
            .filter(|p| !existing_lines.iter().any(|line| line.trim() == p.trim()))
            .collect();

        if new_patterns.is_empty() {
            return Ok(());
        }

        // Append to .gitignore
        let mut file = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&gitignore_path)
            .map_err(|e| format!("Failed to open .gitignore: {}", e))?;

        // Add newline before our entries if file doesn't end with one
        if !existing.is_empty() && !existing.ends_with('\n') {
            writeln!(file).map_err(|e| e.to_string())?;
        }

        for pattern in &new_patterns {
            writeln!(file, "{}", pattern).map_err(|e| e.to_string())?;
        }

        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

fn format_timestamp(secs: i64, offset_minutes: i32) -> String {
    // Simple ISO 8601 formatting without chrono dependency
    let epoch = secs;
    let days = epoch / 86400;
    let time_of_day = (epoch % 86400) as u32;
    let hours = time_of_day / 3600;
    let minutes = (time_of_day % 3600) / 60;
    let seconds = time_of_day % 60;

    // Rough date calculation (not handling leap years perfectly, good enough for display)
    let mut y = 1970i64;
    let mut remaining_days = days;
    loop {
        let days_in_year: i64 = if is_leap(y) { 366 } else { 365 };
        if remaining_days < days_in_year {
            break;
        }
        remaining_days -= days_in_year;
        y += 1;
    }
    let months_days: [i64; 12] = if is_leap(y) {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };
    let mut m = 0;
    for (i, &md) in months_days.iter().enumerate() {
        if remaining_days < md {
            m = i;
            break;
        }
        remaining_days -= md;
    }
    let d = remaining_days + 1;

    let off_h = offset_minutes.abs() / 60;
    let off_m = offset_minutes.abs() % 60;
    let sign = if offset_minutes >= 0 { '+' } else { '-' };

    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}{}{:02}:{:02}",
        y,
        m + 1,
        d,
        hours,
        minutes,
        seconds,
        sign,
        off_h,
        off_m
    )
}

fn is_leap(y: i64) -> bool {
    (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
}
