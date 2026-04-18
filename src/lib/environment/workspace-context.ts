import { basename, dirname } from "path";
import { homedir } from "os";
import { execFileSync } from "child_process";
import { statSync } from "fs";
import { join } from "path";
import { getAinativeDataDir } from "@/lib/utils/ainative-paths";
import { isDevMode, isPrivateInstance } from "@/lib/instance/detect";

/** The directory the user launched stagent from (falls back to process.cwd()). */
export function getLaunchCwd(): string {
  return process.env.AINATIVE_LAUNCH_CWD || process.cwd();
}

export interface WorkspaceContext {
  cwd: string;
  folderName: string;
  parentPath: string;
  gitBranch: string | null;
  isWorktree: boolean;
  dataDir: string;
  dataDirMismatch: boolean;
}

export function getWorkspaceContext(): WorkspaceContext {
  const cwd = getLaunchCwd();
  const home = homedir();
  const folderName = basename(cwd);
  const parent = dirname(cwd);
  const parentPath = parent.startsWith(home)
    ? "~" + parent.slice(home.length)
    : parent;

  let gitBranch: string | null = null;
  try {
    gitBranch =
      execFileSync("git", ["branch", "--show-current"], {
        cwd,
        encoding: "utf-8",
        timeout: 3000,
      }).trim() || null;
  } catch {
    // not a git repo or git not available
  }

  let isWorktree = false;
  try {
    const gitPath = join(cwd, ".git");
    const stat = statSync(gitPath);
    isWorktree = stat.isFile(); // worktrees have a .git file, not directory
  } catch {
    // no .git at all
  }

  const rawDataDir = getAinativeDataDir();
  const dataDir = rawDataDir.startsWith(home)
    ? "~" + rawDataDir.slice(home.length)
    : rawDataDir;

  // Red flag: non-main repo using the default shared DB instead of its own
  const dataDirMismatch = !isDevMode(cwd) && !isPrivateInstance();

  return { cwd, folderName, parentPath, gitBranch, isWorktree, dataDir, dataDirMismatch };
}
