const MIN_BRIEFING_MS = 4200;
const ROTATION_MS = 2600;
const HANDOFF_FADE_MS = 360;

const slides = [
  {
    kind: "Feature",
    title: "One control room for active work.",
    copy:
      "Projects, inbox, approvals, runtimes, and workflow signals stay visible before you take action.",
    statLabel: "Operator move",
    stat: "Scan the workspace before drilling into a single task.",
  },
  {
    kind: "Technique",
    title: "Blueprint first. Specialize only where the work forks.",
    copy:
      "Workflow blueprints keep repeatable orchestration stable, so you spend your energy tuning the steps that actually change.",
    statLabel: "Use this when",
    stat: "A recurring job deserves structure instead of another one-off prompt.",
  },
  {
    kind: "Tip",
    title: "Keep approvals ambient instead of blocking your flow.",
    copy:
      "Use the inbox as a control tower: batch review requests, clear decisions quickly, and let agents continue without reopening every task.",
    statLabel: "Fastest habit",
    stat: "Review approvals in passes while the rest of the workspace stays live.",
  },
];

const root = document.body;
const phasePill = document.getElementById("phase-pill");
const statusCopy = document.getElementById("status-copy");
const countdownCopy = document.getElementById("countdown-copy");
const elapsedCopy = document.getElementById("elapsed-copy");
const meterFill = document.getElementById("boot-meter-fill");
const slideKind = document.getElementById("slide-kind");
const slideTitle = document.getElementById("slide-title");
const slideCopy = document.getElementById("slide-copy");
const slideStatLabel = document.getElementById("slide-stat-label");
const slideStat = document.getElementById("slide-stat");
const slideIndex = document.getElementById("slide-index");
const shotCards = Array.from(document.querySelectorAll(".shot-card"));
const dotEls = Array.from(document.querySelectorAll(".slide-dots span"));

const state = {
  startTime: performance.now(),
  phase: "Launching desktop sidecar",
  status:
    "Preparing the local sidecar and waiting for the web app to answer.",
  activeSlide: 0,
  readyUrl: null,
  readyPhase: "Workspace interface ready",
  readyMessage:
    "The live workspace answered on localhost. Holding for a smooth handoff.",
  error: null,
  handoffStarted: false,
};

function setSlide(index) {
  state.activeSlide = index;
  const slide = slides[index];
  root.dataset.activeSlide = String(index);

  slideKind.textContent = slide.kind;
  slideTitle.textContent = slide.title;
  slideCopy.textContent = slide.copy;
  slideStatLabel.textContent = slide.statLabel;
  slideStat.textContent = slide.stat;
  slideIndex.textContent = `${String(index + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`;

  shotCards.forEach((card) => {
    card.classList.toggle("is-active", Number(card.dataset.slide) === index);
  });

  dotEls.forEach((dot, dotIndex) => {
    dot.classList.toggle("is-active", dotIndex === index);
  });
}

function setStatus(phase, message) {
  if (phase) {
    state.phase = phase;
  }

  if (message) {
    state.status = message;
  }

  phasePill.textContent = state.phase;
  statusCopy.textContent = state.status;
}

function markReady(url, phase, message) {
  state.readyUrl = url;
  state.error = null;
  root.dataset.bootState = "ready";
  setStatus(phase || state.readyPhase, message || state.readyMessage);
}

function markError(phase, message) {
  state.readyUrl = null;
  state.error = message || phase || "The desktop sidecar did not answer in time.";
  root.dataset.bootState = "error";
  setStatus(phase || "Launch timeout", state.error);
}

function updateProgress(elapsedMs) {
  let progress = 0.12;

  if (state.error) {
    progress = 1;
  } else if (state.readyUrl) {
    if (elapsedMs < MIN_BRIEFING_MS) {
      progress = 0.82 + ((elapsedMs / MIN_BRIEFING_MS) * 0.08);
    } else {
      const handoffProgress = Math.min(
        1,
        (elapsedMs - MIN_BRIEFING_MS) / 800,
      );
      progress = 0.9 + handoffProgress * 0.1;
    }
  } else {
    const floor = Math.min(0.8, 0.16 + (elapsedMs / MIN_BRIEFING_MS) * 0.58);
    progress = floor + Math.sin(elapsedMs / 320) * 0.02;
  }

  meterFill.style.transform = `scaleX(${Math.max(0.08, Math.min(progress, 1))})`;
}

function updateMeta(elapsedMs) {
  elapsedCopy.textContent = `T+${(elapsedMs / 1000).toFixed(1)}s`;

  if (state.error) {
    countdownCopy.textContent = "Boot briefing stopped on timeout";
    return;
  }

  if (state.readyUrl && elapsedMs < MIN_BRIEFING_MS) {
    countdownCopy.textContent = `Ready. Entering workspace in ${((MIN_BRIEFING_MS - elapsedMs) / 1000).toFixed(1)}s`;
    return;
  }

  if (!state.readyUrl && elapsedMs < MIN_BRIEFING_MS) {
    countdownCopy.textContent = `Briefing window ${((MIN_BRIEFING_MS - elapsedMs) / 1000).toFixed(1)}s`;
    return;
  }

  if (state.readyUrl) {
    countdownCopy.textContent = "Opening the live workspace";
    return;
  }

  countdownCopy.textContent = "Waiting for the localhost app to answer";
}

function maybeHandoff(elapsedMs) {
  if (!state.readyUrl || state.handoffStarted || elapsedMs < MIN_BRIEFING_MS) {
    return;
  }

  state.handoffStarted = true;
  root.dataset.bootState = "handoff";
  setStatus(
    "Opening workspace",
    "Briefing complete. Transitioning into the live desktop workspace.",
  );
  countdownCopy.textContent = "Opening the live workspace";
  meterFill.style.transform = "scaleX(1)";

  window.setTimeout(() => {
    window.location.replace(state.readyUrl);
  }, HANDOFF_FADE_MS);
}

function tick() {
  const elapsedMs = performance.now() - state.startTime;
  updateProgress(elapsedMs);
  updateMeta(elapsedMs);
  maybeHandoff(elapsedMs);
}

function installController() {
  const queued = window.__STAGENT_BOOT__?._queue || [];

  window.__STAGENT_BOOT__ = {
    setStatus,
    markReady,
    markError,
  };

  for (const entry of queued) {
    const method = window.__STAGENT_BOOT__[entry.type];
    if (typeof method === "function") {
      method(...entry.args);
    }
  }
}

setSlide(0);
setStatus(state.phase, state.status);
installController();
tick();

window.setInterval(() => {
  if (state.error || state.handoffStarted) {
    return;
  }

  setSlide((state.activeSlide + 1) % slides.length);
}, ROTATION_MS);

window.setInterval(tick, 80);
