"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  BookOpen,
  BookmarkPlus,
  BookmarkMinus,
  ChevronLeft,
  ChevronRight,
  List,
  Settings2,
  Clock,
  Check,
  Sparkles,
  Bookmark as BookmarkIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { PARTS } from "@/lib/book/content";
import type { BookChapter, ReaderPreferences, ReadingProgress, Bookmark } from "@/lib/book/types";
import { DEFAULT_READER_PREFS } from "@/lib/book/types";
import { useRouter } from "next/navigation";
import { ContentBlockRenderer } from "./content-blocks";
import { TryItNow } from "./try-it-now";
import { ChapterGenerationBar } from "./chapter-generation-bar";
import { PathSelector } from "./path-selector";
import { PathProgress } from "./path-progress";
import { getReadingPath, getNextPathChapter, isChapterInPath } from "@/lib/book/reading-paths";

const PREFS_KEY = "stagent-book-prefs";
const PROGRESS_KEY = "stagent-book-progress";
const SYNC_DEBOUNCE_MS = 2000;

function loadPrefs(): ReaderPreferences {
  if (typeof window === "undefined") return DEFAULT_READER_PREFS;
  try {
    const saved = localStorage.getItem(PREFS_KEY);
    return saved ? { ...DEFAULT_READER_PREFS, ...JSON.parse(saved) } : DEFAULT_READER_PREFS;
  } catch {
    return DEFAULT_READER_PREFS;
  }
}

function savePrefs(prefs: ReaderPreferences) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

function loadProgress(): Record<string, ReadingProgress> {
  if (typeof window === "undefined") return {};
  try {
    const saved = localStorage.getItem(PROGRESS_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function saveProgress(progress: Record<string, ReadingProgress>) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

/** Debounced sync of a single chapter's progress to the DB */
function syncProgressToDb(chapterId: string, pct: number, scrollPosition: number) {
  fetch("/api/book/progress", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chapterId, progress: pct, scrollPosition }),
  }).catch(() => {
    // Silently fail — localStorage is the primary fallback
  });
}

export function BookReader({ chapters: CHAPTERS }: { chapters: BookChapter[] }) {
  const router = useRouter();
  const [currentChapter, setCurrentChapter] = useState<BookChapter>(CHAPTERS[0]);
  const [prefs, setPrefs] = useState<ReaderPreferences>(DEFAULT_READER_PREFS);
  const [progress, setProgress] = useState<Record<string, ReadingProgress>>({});
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [tocOpen, setTocOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tocTab, setTocTab] = useState<"chapters" | "bookmarks">("chapters");
  const [activePath, setActivePath] = useState<string | null>(null);
  const [recommendedPath, setRecommendedPath] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync currentChapter when chapters prop refreshes (e.g., after regeneration)
  useEffect(() => {
    const refreshed = CHAPTERS.find((ch) => ch.id === currentChapter.id);
    if (refreshed && refreshed !== currentChapter) {
      setCurrentChapter(refreshed);
    }
  }, [CHAPTERS]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load progress from DB first, fall back to localStorage
  useEffect(() => {
    setPrefs(loadPrefs());
    const localProgress = loadProgress();
    setProgress(localProgress);

    // Fetch from DB and merge (DB wins for higher progress)
    fetch("/api/book/progress")
      .then((r) => r.json())
      .then((dbProgress: Record<string, { progress: number; scrollPosition: number; lastReadAt: string }>) => {
        setProgress((prev) => {
          const merged = { ...prev };
          for (const [chId, dbEntry] of Object.entries(dbProgress)) {
            const localEntry = merged[chId];
            if (!localEntry || dbEntry.progress > localEntry.progress) {
              merged[chId] = {
                chapterId: chId,
                progress: dbEntry.progress,
                scrollPosition: dbEntry.scrollPosition,
                lastReadAt: dbEntry.lastReadAt,
              };
            }
          }
          saveProgress(merged);
          return merged;
        });
      })
      .catch(() => {
        // DB unavailable — use localStorage only
      });

    // Fetch bookmarks from DB
    fetch("/api/book/bookmarks")
      .then((r) => r.json())
      .then((bms: Bookmark[]) => setBookmarks(bms))
      .catch(() => {});
  }, []);

  // Load reading path preference and fetch recommendation
  useEffect(() => {
    const saved = localStorage.getItem("stagent-book-path");
    if (saved) setActivePath(saved);

    fetch("/api/book/stage")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.recommendedPath) setRecommendedPath(data.recommendedPath);
      })
      .catch(() => {}); // Silently fail — recommendation is optional
  }, []);

  const handlePathChange = useCallback((pathId: string | null) => {
    setActivePath(pathId);
    if (pathId) {
      localStorage.setItem("stagent-book-path", pathId);
    } else {
      localStorage.removeItem("stagent-book-path");
    }
  }, []);

  // Track scroll progress
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const handleScroll = () => {
      const scrollTop = el.scrollTop;
      const scrollHeight = el.scrollHeight - el.clientHeight;
      if (scrollHeight <= 0) return;
      const pct = Math.min(1, scrollTop / scrollHeight);

      setProgress((prev) => {
        const highWater = Math.max(pct, prev[currentChapter.id]?.progress ?? 0);
        const updated = {
          ...prev,
          [currentChapter.id]: {
            chapterId: currentChapter.id,
            progress: highWater,
            scrollPosition: scrollTop,
            lastReadAt: new Date().toISOString(),
          },
        };
        saveProgress(updated);

        // Debounced DB sync
        if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
        syncTimerRef.current = setTimeout(() => {
          syncProgressToDb(currentChapter.id, highWater, scrollTop);
        }, SYNC_DEBOUNCE_MS);

        return updated;
      });
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", handleScroll);
      // Flush pending sync on cleanup
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
        const entry = progress[currentChapter.id];
        if (entry) {
          syncProgressToDb(currentChapter.id, entry.progress, entry.scrollPosition);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChapter.id]);

  const updatePrefs = useCallback((patch: Partial<ReaderPreferences>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      savePrefs(next);
      return next;
    });
  }, []);

  const goToChapter = useCallback(
    (chapter: BookChapter, scrollTo?: number) => {
      setCurrentChapter(chapter);
      setTocOpen(false);
      if (scrollTo !== undefined && scrollTo > 0) {
        // Delay to let content render
        setTimeout(() => {
          contentRef.current?.scrollTo({ top: scrollTo, behavior: "smooth" });
        }, 100);
      } else {
        contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    []
  );

  // Bookmark: add for current position
  const addBookmark = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;

    // Find the nearest visible section
    let nearestSection: { id: string; title: string } | null = null;
    for (const section of currentChapter.sections) {
      const sectionEl = document.getElementById(section.id);
      if (sectionEl) {
        const rect = sectionEl.getBoundingClientRect();
        const containerRect = el.getBoundingClientRect();
        if (rect.top <= containerRect.top + 200) {
          nearestSection = section;
        }
      }
    }

    const label = nearestSection
      ? `Ch. ${currentChapter.number}: ${nearestSection.title}`
      : `Ch. ${currentChapter.number}: ${currentChapter.title}`;

    fetch("/api/book/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chapterId: currentChapter.id,
        sectionId: nearestSection?.id ?? null,
        scrollPosition: el.scrollTop,
        label,
      }),
    })
      .then((r) => r.json())
      .then((bm: Bookmark) => {
        setBookmarks((prev) => [...prev, bm]);
      })
      .catch(() => {});
  }, [currentChapter]);

  // Bookmark: remove
  const removeBookmark = useCallback((id: string) => {
    fetch(`/api/book/bookmarks?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      .then(() => {
        setBookmarks((prev) => prev.filter((b) => b.id !== id));
      })
      .catch(() => {});
  }, []);

  // Navigate to bookmark
  const goToBookmark = useCallback(
    (bm: Bookmark) => {
      const chapter = CHAPTERS.find((ch) => ch.id === bm.chapterId);
      if (chapter) {
        goToChapter(chapter, bm.scrollPosition);
      }
    },
    [goToChapter]
  );

  // Check if current position has a bookmark nearby
  const currentChapterBookmarks = bookmarks.filter((b) => b.chapterId === currentChapter.id);

  const currentIndex = CHAPTERS.findIndex((ch) => ch.id === currentChapter.id);

  // Path-aware navigation: when a path is active, prev/next follow the path order
  const prevChapter = (() => {
    if (!activePath) {
      return currentIndex > 0 ? CHAPTERS[currentIndex - 1] : null;
    }
    const path = getReadingPath(activePath);
    if (!path) return currentIndex > 0 ? CHAPTERS[currentIndex - 1] : null;
    const pathIdx = path.chapterIds.indexOf(currentChapter.id);
    if (pathIdx <= 0) return null;
    return CHAPTERS.find((ch) => ch.id === path.chapterIds[pathIdx - 1]) ?? null;
  })();

  const nextChapter = (() => {
    if (!activePath) {
      return currentIndex < CHAPTERS.length - 1 ? CHAPTERS[currentIndex + 1] : null;
    }
    const nextId = getNextPathChapter(activePath, currentChapter.id);
    if (!nextId) return null;
    return CHAPTERS.find((ch) => ch.id === nextId) ?? null;
  })();

  // Keyboard navigation: Left/Right arrow keys for chapter nav
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft" && prevChapter) {
        e.preventDefault();
        goToChapter(prevChapter);
      } else if (e.key === "ArrowRight" && nextChapter) {
        e.preventDefault();
        goToChapter(nextChapter);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [prevChapter, nextChapter, goToChapter]);

  const chaptersByPart = (() => {
    const grouped = new Map<number, BookChapter[]>();
    for (const ch of CHAPTERS) {
      const part = ch.part.number;
      if (!grouped.has(part)) grouped.set(part, []);
      grouped.get(part)!.push(ch);
    }
    return grouped;
  })();

  const fontFamilyClass =
    prefs.fontFamily === "serif"
      ? "font-serif"
      : prefs.fontFamily === "mono"
        ? "font-mono"
        : "font-sans";

  const themeClass = "book-reader-container";

  const overallProgress =
    CHAPTERS.length > 0
      ? CHAPTERS.reduce((sum, ch) => sum + (progress[ch.id]?.progress ?? 0), 0) /
        CHAPTERS.length
      : 0;

  const completedChapters = CHAPTERS.filter((ch) => (progress[ch.id]?.progress ?? 0) >= 0.9).length;

  return (
    <div className={cn("flex flex-col h-[calc(100vh-3.5rem)]", themeClass)} data-book-theme={prefs.theme}>
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-border px-4 py-2 shrink-0">
        <div className="flex items-center gap-2">
          {/* TOC toggle */}
          <Sheet open={tocOpen} onOpenChange={setTocOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <List className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80">
              <SheetHeader className="p-4">
                <SheetTitle className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Contents
                </SheetTitle>
              </SheetHeader>
              <div className="px-4 pb-4 space-y-4 overflow-y-auto">
                {/* Tab switcher */}
                <div className="flex gap-1 p-1 rounded-lg bg-muted">
                  <button
                    onClick={() => setTocTab("chapters")}
                    className={cn(
                      "flex-1 text-xs font-medium py-1.5 rounded-md transition-colors cursor-pointer",
                      tocTab === "chapters"
                        ? "bg-background shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Chapters
                  </button>
                  <button
                    onClick={() => setTocTab("bookmarks")}
                    className={cn(
                      "flex-1 text-xs font-medium py-1.5 rounded-md transition-colors cursor-pointer",
                      tocTab === "bookmarks"
                        ? "bg-background shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Bookmarks{bookmarks.length > 0 && ` (${bookmarks.length})`}
                  </button>
                </div>

                {/* Overall progress summary */}
                {tocTab === "chapters" && (
                  <div className="flex items-center gap-3 px-1">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${overallProgress * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {completedChapters}/{CHAPTERS.length} complete
                    </span>
                  </div>
                )}

                {tocTab === "chapters" ? (
                  <div className="space-y-6">
                    {/* Reading path selector */}
                    <PathSelector
                      activePath={activePath}
                      recommendedPath={recommendedPath}
                      onSelectPath={handlePathChange}
                    />

                    {PARTS.map((part) => (
                      <div key={part.number}>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                          Part {part.number}: {part.title}
                        </p>
                        <p className="text-xs text-muted-foreground mb-3">
                          {part.description}
                        </p>
                        <div className="space-y-1">
                          {(chaptersByPart.get(part.number) ?? []).map((ch) => {
                            const chProgress = progress[ch.id]?.progress ?? 0;
                            const chPct = Math.round(chProgress * 100);
                            const inPath = !activePath || isChapterInPath(activePath, ch.id);
                            return (
                              <button
                                key={ch.id}
                                onClick={() => goToChapter(ch)}
                                className={cn(
                                  "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer",
                                  ch.id === currentChapter.id
                                    ? "bg-primary/10 text-primary font-medium"
                                    : "hover:bg-muted",
                                  !inPath && "opacity-40"
                                )}
                              >
                                <div className="flex items-center justify-between">
                                  <span>
                                    {ch.number}. {ch.title}
                                  </span>
                                  <span className="flex items-center gap-1.5">
                                    {!inPath && (
                                      <span className="text-[10px] text-muted-foreground">Not in path</span>
                                    )}
                                    {ch.sections.length === 0 ? (
                                      <Sparkles className="h-3.5 w-3.5 text-muted-foreground/40" />
                                    ) : chProgress >= 0.9 ? (
                                      <Check className="h-3.5 w-3.5 text-status-completed" />
                                    ) : chProgress > 0 ? (
                                      <span className="text-xs text-muted-foreground">{chPct}%</span>
                                    ) : null}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                  {ch.subtitle}
                                </p>
                                {chProgress > 0 && chProgress < 0.9 && (
                                  <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
                                    <div
                                      className="h-full bg-primary/40 rounded-full transition-all"
                                      style={{ width: `${chPct}%` }}
                                    />
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {bookmarks.length === 0 ? (
                      <div className="text-center py-8">
                        <BookmarkIcon className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No bookmarks yet</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Use the bookmark button while reading to save your place
                        </p>
                      </div>
                    ) : (
                      bookmarks.map((bm) => (
                        <div
                          key={bm.id}
                          className="flex items-start gap-2 px-3 py-2 rounded-lg hover:bg-muted group"
                        >
                          <button
                            onClick={() => goToBookmark(bm)}
                            className="flex-1 text-left cursor-pointer"
                          >
                            <p className="text-sm font-medium">{bm.label}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {new Date(bm.createdAt).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </p>
                          </button>
                          <button
                            onClick={() => removeBookmark(bm.id)}
                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all cursor-pointer p-1"
                            title="Remove bookmark"
                          >
                            <BookmarkMinus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>

          <div className="hidden sm:block">
            <p className="text-sm font-medium">
              Chapter {currentChapter.number}: {currentChapter.title}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-2 hidden sm:inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {currentChapter.readingTime} min
          </span>

          {/* Overall progress or path progress */}
          {activePath ? (
            <div className="hidden sm:flex mr-2">
              <PathProgress pathId={activePath} progress={progress} />
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2 mr-2">
              <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${overallProgress * 100}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {Math.round(overallProgress * 100)}%
              </span>
            </div>
          )}

          {/* Bookmark button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={addBookmark}
            title="Bookmark this position"
          >
            {currentChapterBookmarks.length > 0 ? (
              <BookmarkIcon className="h-4 w-4 fill-primary text-primary" />
            ) : (
              <BookmarkPlus className="h-4 w-4" />
            )}
          </Button>

          {/* Settings */}
          <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Settings2 className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80">
              <SheetHeader className="p-4">
                <SheetTitle>Reading Settings</SheetTitle>
              </SheetHeader>
              <div className="px-6 pb-6 space-y-6">
                {/* Font size */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Font Size: {prefs.fontSize}px
                  </label>
                  <Slider
                    value={[prefs.fontSize]}
                    min={14}
                    max={22}
                    step={2}
                    onValueChange={([v]) => updatePrefs({ fontSize: v })}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Small</span>
                    <span>Large</span>
                  </div>
                </div>

                {/* Line height */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Line Height: {prefs.lineHeight.toFixed(2)}
                  </label>
                  <Slider
                    value={[prefs.lineHeight * 100]}
                    min={150}
                    max={200}
                    step={5}
                    onValueChange={([v]) => updatePrefs({ lineHeight: v / 100 })}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Compact</span>
                    <span>Relaxed</span>
                  </div>
                </div>

                {/* Font family */}
                <div>
                  <label className="text-sm font-medium mb-3 block">Font</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["sans", "serif", "mono"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => updatePrefs({ fontFamily: f })}
                        className={cn(
                          "px-3 py-2 rounded-lg border text-sm capitalize transition-colors cursor-pointer",
                          prefs.fontFamily === f
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:bg-muted"
                        )}
                      >
                        <span className={f === "serif" ? "font-serif" : f === "mono" ? "font-mono" : "font-sans"}>
                          {f}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Theme */}
                <div>
                  <label className="text-sm font-medium mb-3 block">Reader Theme</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["light", "sepia", "dark"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => updatePrefs({ theme: t })}
                        className={cn(
                          "px-3 py-2 rounded-lg border text-sm capitalize transition-colors cursor-pointer",
                          `book-theme-preview-${t}`,
                          prefs.theme === t
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:bg-muted"
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Reading area */}
      <div ref={contentRef} className="flex-1 overflow-y-auto">
        <article
          className={cn("mx-auto max-w-2xl px-6 py-10 sm:px-8 sm:py-14", fontFamilyClass)}
          style={{ fontSize: `${prefs.fontSize}px`, lineHeight: prefs.lineHeight }}
        >
          {/* Chapter header */}
          <header className="mb-12">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Part {currentChapter.part.number}: {currentChapter.part.title}
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
              Chapter {currentChapter.number}: {currentChapter.title}
            </h1>
            <p className="text-lg text-muted-foreground">{currentChapter.subtitle}</p>
            <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {currentChapter.readingTime} min read
              </span>
              <span>
                {currentChapter.sections.length} section{currentChapter.sections.length !== 1 && "s"}
              </span>
              {(progress[currentChapter.id]?.progress ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1">
                  {Math.round((progress[currentChapter.id]?.progress ?? 0) * 100)}% read
                </span>
              )}
            </div>

            {/* Chapter generation bar */}
            <ChapterGenerationBar
              chapterId={currentChapter.id}
              chapterTitle={currentChapter.title}
              chapterNumber={currentChapter.number}
              hasContent={currentChapter.sections.length > 0}
              onComplete={() => router.refresh()}
            />

            <hr className="mt-8 border-border/50" />
          </header>

          {/* Sections or empty state */}
          {currentChapter.sections.length > 0 ? (
            currentChapter.sections.map((section) => (
              <section key={section.id} id={section.id} className="mb-12">
                <h2 className="text-2xl font-semibold tracking-tight mb-6">
                  {section.title}
                </h2>
                <div className="space-y-2">
                  {section.content.map((block, i) => (
                    <ContentBlockRenderer key={i} block={block} />
                  ))}
                </div>
              </section>
            ))
          ) : (
            <div className="text-center py-16 space-y-4">
              <Sparkles className="h-12 w-12 text-muted-foreground/30 mx-auto" />
              <h3 className="text-lg font-medium">This chapter hasn&apos;t been written yet</h3>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                Generate it from the source material using the button above.
              </p>
            </div>
          )}

          {/* Chapter footer */}
          <footer className="mt-12 pt-6 border-t border-border/30 text-xs text-muted-foreground/60">
            <span>
              Chapter {currentChapter.number} of {CHAPTERS.length}
            </span>
          </footer>

          {/* Try It Now — related Playbook docs */}
          {currentChapter.relatedDocs && currentChapter.relatedDocs.length > 0 && (
            <TryItNow
              relatedDocs={currentChapter.relatedDocs}
              relatedJourney={currentChapter.relatedJourney}
            />
          )}

          {/* Chapter navigation */}
          <nav className="flex items-center justify-between border-t border-border/50 pt-8 mt-16">
            {prevChapter ? (
              <button
                onClick={() => goToChapter(prevChapter)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer rounded-lg px-3 py-2 -mx-3 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <ChevronLeft className="h-4 w-4" />
                <div className="text-left">
                  <p className="text-xs text-muted-foreground">Previous</p>
                  <p className="font-medium">Ch. {prevChapter.number}: {prevChapter.title}</p>
                </div>
              </button>
            ) : (
              <div />
            )}
            {nextChapter ? (
              <button
                onClick={() => goToChapter(nextChapter)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer rounded-lg px-3 py-2 -mx-3 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Next</p>
                  <p className="font-medium">Ch. {nextChapter.number}: {nextChapter.title}</p>
                </div>
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <div />
            )}
          </nav>
        </article>
      </div>
    </div>
  );
}
