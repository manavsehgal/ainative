# Quickstart

ChatGPT Plus, Pro, Business, Edu, and Enterprise plans include Codex. Using Codex with your ChatGPT subscription gives you access to the latest Codex models and features.

You can also use Codex with API credits by signing in with an OpenAI API key.

For a limited time, **try Codex for free in ChatGPT Free and Go**, or enjoy
  **2x Codex rate limits** with Plus, Pro, Business and Enterprise
  subscriptions.

## Setup

<script
  is:inline
  data-astro-rerun
  set:html={String.raw`
(() => {
  const platform =
    (navigator.userAgentData?.platform || navigator.platform || "").toLowerCase();
  const isMac =
    platform.includes("mac") ||
    /macintosh|mac os x/i.test(navigator.userAgent || "");
  if (!isMac) return;

  const shouldPreferApp = () => {
    try {
      const url = new URL(window.location.href);
      return !url.searchParams.get("setup");
    } catch {
      return true;
    }
  };

  if (!shouldPreferApp()) return;

  window.__tabsPreferred = window.__tabsPreferred || {};
  window.__tabsPreferred.setup = "app";
})();
`}
/>

<Tabs
  id="codex-quickstart-setup"
  param="setup"
  defaultTab="ide"
  size="3xl"
  block={true}
  blockThreshold={170}
  tabs={[
    {
      id: "app",
      label: "App",
      subtitle: "Recommended",
    },
    { id: "ide", label: "IDE extension", subtitle: "Codex in your IDE" },
    { id: "cli", label: "CLI", subtitle: "Codex in your terminal" },
    { id: "cloud", label: "Cloud", subtitle: "Codex in your browser" },
  ]}
>
  <div slot="app">
The Codex app is available on macOS (Apple Silicon).

<WorkflowSteps variant="headings">
1. Download and install the Codex app

    Download the Codex app for Windows or macOS.

    <CodexAppDownloadCta client:load className="mb-4" />

    <div class="text-sm">
      [Get notified for Linux](https://openai.com/form/codex-app/)
    </div>

2. Open Codex and sign in

   Once you downloaded and installed the Codex app, open it and sign in with your ChatGPT account or an OpenAI API key.

   If you sign in with an OpenAI API key, some functionality such as [cloud threads](https://developers.openai.com/codex/prompting#threads) might not be available.

3. Select a project

   Choose a project folder that you want Codex to work in.

If you used the Codex app, CLI, or IDE Extension before you'll see past projects that you worked on.

4. Send your first message

   After choosing the project, make sure **Local** is selected to have Codex work on your machine and send your first message to Codex.

   You can ask Codex anything about the project or your computer in general. Here are some examples:

   <ExampleGallery>
     <ExampleTask
       client:load
       id="intro"
       prompt="Tell me about this project"
       iconName="brain"
     />
     <ExampleTask
       client:load
       id="snake-game"
       shortDescription="Build a classic Snake game in this repo."
       prompt={[
         "Build a classic Snake game in this repo.",
         "",
         "Scope & constraints:",
         "- Implement ONLY the classic Snake loop: grid movement, growing snake, food spawn, score, game-over, restart.",
         "- Reuse existing project tooling/frameworks; do NOT add new dependencies unless truly required.",
         "- Keep UI minimal and consistent with the repo’s existing styles (no new design systems, no extra animations).",
         "",
         "Implementation plan:",
         "1) Inspect the repo to find the right place to add a small interactive game (existing pages/routes/components).",
         "2) Implement game state (snake positions, direction, food, score, tick timer) with deterministic, testable logic.",
         "3) Render: simple grid + snake + food; support keyboard controls (arrow keys/WASD) and on-screen controls if mobile is present in the repo.",
         "4) Add basic tests for the core game logic (movement, collisions, growth, food placement) if the repo has a test runner.",
         "",
         "Deliverables:",
         "- A small set of files/changes with clear names.",
         "- Short run instructions (how to start dev server + where to navigate).",
         "- A brief checklist of what to manually verify (controls, pause/restart, boundaries).",
       ].join("\n")}
       iconName="gamepad"
     />
     <ExampleTask
       client:load
       id="fix-bugs"
       shortDescription="Find and fix bugs in my codebase with minimal, high-confidence changes."
       prompt={[
         "Find and fix bugs in my codebase with minimal, high-confidence changes.",
         "",
         "Method (grounded + disciplined):",
         "1) Reproduce: run tests/lint/build (or follow the existing repo scripts). If I provided an error, reproduce that exact failure.",
         "2) Localize: identify the smallest set of files/lines involved (stack traces, failing tests, logs).",
         "3) Fix: implement the minimal change that resolves the issue without refactors or unrelated cleanup.",
         "4) Prove: add/update a focused test (or a tight repro) that fails before and passes after.",
         "",
         "Constraints:",
         "- Do NOT invent errors or pretend to run commands you cannot run.",
         "- No scope drift: no new features, no UI embellishments, no style overhauls.",
         "- If information is missing, state what you can confirm from the repo and what remains unknown.",
         "",
         "Output:",
         "- Summary (3–6 sentences max): what was broken, why, and the fix.",
         "- Then ≤5 bullets: What changed, Where (paths), Evidence (tests/logs), Risks, Next steps.",
       ].join("\n")}
       iconName="search"
     />
   </ExampleGallery>

   If you need more inspiration, check out the [explore section](https://developers.openai.com/codex/explore).

    <CtaPillLink href="/codex/app" label="Learn more about the Codex app" class="mt-8" />
</WorkflowSteps>


  </div>

  <div slot="ide">
Install the Codex extension for your IDE.

<WorkflowSteps variant="headings">
1. Install the Codex extension

    Download it for your editor:

    - [Download for Visual Studio Code](vscode:extension/openai.chatgpt)
    - [Download for Cursor](cursor:extension/openai.chatgpt)
    - [Download for Windsurf](windsurf:extension/openai.chatgpt)
    - [Download for Visual Studio Code Insiders](https://marketplace.visualstudio.com/items?itemName=openai.chatgpt)

2. Open the Codex panel

    Once installed, the Codex extension appears in the sidebar alongside your other extensions. It may be hidden in the collapsed section. You can move the Codex panel to the right side of the editor if you prefer.

3. Sign in and start your first task

    Sign in with your ChatGPT account or an API key to get started.

    Codex starts in Agent mode by default, which lets it read files, run commands, and write changes in your project directory.
    
    <ExampleGallery>
     <ExampleTask
       client:load
       id="intro"
       prompt="Tell me about this project"
       iconName="brain"
     />
     <ExampleTask
       client:load
       id="snake-game"
       shortDescription="Build a classic Snake game in this repo."
       prompt={[
         "Build a classic Snake game in this repo.",
         "",
         "Scope & constraints:",
         "- Implement ONLY the classic Snake loop: grid movement, growing snake, food spawn, score, game-over, restart.",
         "- Reuse existing project tooling/frameworks; do NOT add new dependencies unless truly required.",
         "- Keep UI minimal and consistent with the repo’s existing styles (no new design systems, no extra animations).",
         "",
         "Implementation plan:",
         "1) Inspect the repo to find the right place to add a small interactive game (existing pages/routes/components).",
         "2) Implement game state (snake positions, direction, food, score, tick timer) with deterministic, testable logic.",
         "3) Render: simple grid + snake + food; support keyboard controls (arrow keys/WASD) and on-screen controls if mobile is present in the repo.",
         "4) Add basic tests for the core game logic (movement, collisions, growth, food placement) if the repo has a test runner.",
         "",
         "Deliverables:",
         "- A small set of files/changes with clear names.",
         "- Short run instructions (how to start dev server + where to navigate).",
         "- A brief checklist of what to manually verify (controls, pause/restart, boundaries).",
       ].join("\n")}
       iconName="gamepad"
     />
     <ExampleTask
       client:load
       id="fix-bugs"
       shortDescription="Find and fix bugs in my codebase with minimal, high-confidence changes."
       prompt={[
         "Find and fix bugs in my codebase with minimal, high-confidence changes.",
         "",
         "Method (grounded + disciplined):",
         "1) Reproduce: run tests/lint/build (or follow the existing repo scripts). If I provided an error, reproduce that exact failure.",
         "2) Localize: identify the smallest set of files/lines involved (stack traces, failing tests, logs).",
         "3) Fix: implement the minimal change that resolves the issue without refactors or unrelated cleanup.",
         "4) Prove: add/update a focused test (or a tight repro) that fails before and passes after.",
         "",
         "Constraints:",
         "- Do NOT invent errors or pretend to run commands you cannot run.",
         "- No scope drift: no new features, no UI embellishments, no style overhauls.",
         "- If information is missing, state what you can confirm from the repo and what remains unknown.",
         "",
         "Output:",
         "- Summary (3–6 sentences max): what was broken, why, and the fix.",
         "- Then ≤5 bullets: What changed, Where (paths), Evidence (tests/logs), Risks, Next steps.",
       ].join("\n")}
       iconName="search"
     />
   </ExampleGallery>

4. Use Git checkpoints

    Codex can modify your codebase, so consider creating Git checkpoints before and after each task so you can easily revert changes if needed.
    
    <CtaPillLink href="/codex/ide" label="Learn more about the Codex IDE extension" class="mt-8" />
</WorkflowSteps>


  </div>

  <div slot="cli">
The Codex CLI is supported on macOS, Windows, and Linux.

<WorkflowSteps variant="headings">
1. Install the Codex CLI

    Install with npm:

    ```bash
    npm install -g @openai/codex
    ```

    Install with Homebrew:

    ```bash
    brew install codex
    ```

2. Run `codex` and sign in

    Run `codex` in your terminal to get started. You'll be prompted to sign in with your ChatGPT account or an API key.

3. Ask Codex to work in your current directory

    Once authenticated, you can ask Codex to perform tasks in the current directory.

    <ExampleGallery>
     <ExampleTask
       client:load
       id="intro"
       prompt="Tell me about this project"
       iconName="brain"
     />
     <ExampleTask
       client:load
       id="snake-game"
       shortDescription="Build a classic Snake game in this repo."
       prompt={[
         "Build a classic Snake game in this repo.",
         "",
         "Scope & constraints:",
         "- Implement ONLY the classic Snake loop: grid movement, growing snake, food spawn, score, game-over, restart.",
         "- Reuse existing project tooling/frameworks; do NOT add new dependencies unless truly required.",
         "- Keep UI minimal and consistent with the repo’s existing styles (no new design systems, no extra animations).",
         "",
         "Implementation plan:",
         "1) Inspect the repo to find the right place to add a small interactive game (existing pages/routes/components).",
         "2) Implement game state (snake positions, direction, food, score, tick timer) with deterministic, testable logic.",
         "3) Render: simple grid + snake + food; support keyboard controls (arrow keys/WASD) and on-screen controls if mobile is present in the repo.",
         "4) Add basic tests for the core game logic (movement, collisions, growth, food placement) if the repo has a test runner.",
         "",
         "Deliverables:",
         "- A small set of files/changes with clear names.",
         "- Short run instructions (how to start dev server + where to navigate).",
         "- A brief checklist of what to manually verify (controls, pause/restart, boundaries).",
       ].join("\n")}
       iconName="gamepad"
     />
     <ExampleTask
       client:load
       id="fix-bugs"
       shortDescription="Find and fix bugs in my codebase with minimal, high-confidence changes."
       prompt={[
         "Find and fix bugs in my codebase with minimal, high-confidence changes.",
         "",
         "Method (grounded + disciplined):",
         "1) Reproduce: run tests/lint/build (or follow the existing repo scripts). If I provided an error, reproduce that exact failure.",
         "2) Localize: identify the smallest set of files/lines involved (stack traces, failing tests, logs).",
         "3) Fix: implement the minimal change that resolves the issue without refactors or unrelated cleanup.",
         "4) Prove: add/update a focused test (or a tight repro) that fails before and passes after.",
         "",
         "Constraints:",
         "- Do NOT invent errors or pretend to run commands you cannot run.",
         "- No scope drift: no new features, no UI embellishments, no style overhauls.",
         "- If information is missing, state what you can confirm from the repo and what remains unknown.",
         "",
         "Output:",
         "- Summary (3–6 sentences max): what was broken, why, and the fix.",
         "- Then ≤5 bullets: What changed, Where (paths), Evidence (tests/logs), Risks, Next steps.",
       ].join("\n")}
       iconName="search"
     />
   </ExampleGallery>

4. Use Git checkpoints

    Codex can modify your codebase, so consider creating Git checkpoints before and after each task so you can easily revert changes if needed.
</WorkflowSteps>

    <CtaPillLink href="/codex/cli" label="Learn more about the Codex CLI" class="mt-8" />

  </div>

  <div slot="cloud">
Use Codex in the cloud at [chatgpt.com/codex](https://chatgpt.com/codex).

<WorkflowSteps variant="headings">
1. Open Codex in your browser

    Go to [chatgpt.com/codex](https://chatgpt.com/codex). You can also delegate a task to Codex by tagging `@codex` in a GitHub pull request comment (requires signing in to ChatGPT).

2. Set up an environment

    Before starting your first task, set up an environment for Codex. Open the environment settings at [chatgpt.com/codex](https://chatgpt.com/codex/settings/environments) and follow the steps to connect a GitHub repository.

3. Launch a task and monitor progress

    Once your environment is ready, launch coding tasks from the [Codex interface](https://chatgpt.com/codex). You can monitor progress in real time by viewing logs, or let tasks run in the background.

    <ExampleGallery>
     <ExampleTask
       client:load
       id="intro"
       prompt="Tell me about this project"
       iconName="brain"
     />
     <ExampleTask
       client:load
       id="architecture-failure-modes"
       shortDescription="Explain the top failure modes of my application's architecture."
       prompt={[
         "Explain the top failure modes of my application's architecture.",
         "",
         "Approach:",
         "- Derive the architecture from repo evidence (services, DBs, queues, network calls, critical paths).",
         "- Identify realistic failure modes (availability, data loss, latency, scaling, consistency, security, dependency outages).",
         "",
         "Output:",
         "- 1 short overview paragraph.",
         "- Then ≤5 bullets: Failure mode, Trigger, Symptoms, Detection, Mitigation.",
         "- If key architecture details are missing, state what you inferred vs. what you confirmed.",
       ].join("\n")}
       iconName="brain"
     />
     <ExampleTask
       client:load
       id="fix-bugs"
       shortDescription="Find and fix bugs in my codebase with minimal, high-confidence changes."
       prompt={[
         "Find and fix bugs in my codebase with minimal, high-confidence changes.",
         "",
         "Method (grounded + disciplined):",
         "1) Reproduce: run tests/lint/build (or follow the existing repo scripts). If I provided an error, reproduce that exact failure.",
         "2) Localize: identify the smallest set of files/lines involved (stack traces, failing tests, logs).",
         "3) Fix: implement the minimal change that resolves the issue without refactors or unrelated cleanup.",
         "4) Prove: add/update a focused test (or a tight repro) that fails before and passes after.",
         "",
         "Constraints:",
         "- Do NOT invent errors or pretend to run commands you cannot run.",
         "- No scope drift: no new features, no UI embellishments, no style overhauls.",
         "- If information is missing, state what you can confirm from the repo and what remains unknown.",
         "",
         "Output:",
         "- Summary (3–6 sentences max): what was broken, why, and the fix.",
         "- Then ≤5 bullets: What changed, Where (paths), Evidence (tests/logs), Risks, Next steps.",
       ].join("\n")}
       iconName="search"
     />
   </ExampleGallery>

4. Review changes and create a pull request

    When a task completes, review the proposed changes in the diff view. You can iterate on the results or create a pull request directly in your GitHub repository.

    Codex also provides a preview of the changes. You can accept the PR as is, or check out the branch locally to test the changes:

    ```bash
    git fetch
    git checkout <branch-name>
    ```

    <CtaPillLink href="/codex/cloud" label="Learn more about Codex cloud" class="mt-8" />
</WorkflowSteps>

  </div>
</Tabs>