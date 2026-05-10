"use client";

import { useEffect, useCallback, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAnnotationStore } from "@/lib/store";
import {
  useImagesQuery,
  useSaveAndNavigate,
  useAnnotationsQuery,
} from "@/lib/queries";
import TopToolbar from "@/components/editor/top-toolbar";
import LeftSidebar from "@/components/editor/left-sidebar";
import RightSidebar from "@/components/editor/right-sidebar";
import AnnotationCanvas from "@/components/editor/annotation-canvas";
import { Skeleton } from "@/components/ui/skeleton";
import { IconPhotoOff, IconLoader2 } from "@tabler/icons-react";

function EditorSkeleton() {
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      {/* Top Toolbar Skeleton */}
      <div className="h-14 flex items-center justify-between border-b border-border bg-card px-4 shrink-0">
        <div className="flex items-center gap-4">
          <Skeleton className="size-8 rounded-md" />
          <div className="flex items-center gap-2.5">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="size-8 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
      </div>

      {/* Main Content Skeleton */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar Skeleton */}
        <div className="w-64 border-r border-border bg-card flex flex-col shrink-0">
          <div className="px-4 py-4 border-b border-border">
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="p-4 space-y-3">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>

        {/* Center Canvas Skeleton */}
        <div className="flex-1 bg-[#0a0a0a] flex items-center justify-center p-8 relative">
          {/* Subtle grid pattern overlay for loading canvas */}
          <div
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
          <div className="flex flex-col items-center gap-4">
            <IconLoader2 className="size-8 text-muted-foreground animate-spin opacity-50" />
            <span className="text-sm text-muted-foreground opacity-50">
              Loading dataset...
            </span>
          </div>
        </div>

        {/* Right Sidebar Skeleton */}
        <div className="w-72 border-l border-border bg-card flex flex-col shrink-0">
          <div className="px-4 py-4 border-b border-border">
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="px-4 py-5 border-b border-border space-y-4">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <div className="px-4 py-4 border-b border-border flex justify-between items-center">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-8" />
          </div>
          <div className="p-2 space-y-2">
            {[...Array(12)].map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function EditorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");

  // Redirect to dashboard if no projectId
  useEffect(() => {
    if (!projectId) {
      router.replace("/dashboard");
    }
  }, [projectId, router]);

  const [initializedProjectId, setInitializedProjectId] = useState<
    string | null
  >(null);

  // ── Reset global state when entering project ──
  useEffect(() => {
    if (projectId && projectId !== initializedProjectId) {
      useAnnotationStore.getState().resetEditorState();
      setInitializedProjectId(projectId);
    }
  }, [projectId, initializedProjectId]);

  // Clean up when leaving entirely
  useEffect(() => {
    return () => useAnnotationStore.getState().resetEditorState();
  }, []);

  const store = useAnnotationStore();
  const {
    data: images,
    isPending,
    isError,
    error,
  } = useImagesQuery(projectId || "");
  const { saveAndGo, isSaving } = useSaveAndNavigate(projectId || "");
  const currentImage = store.images[store.currentImageIndex];

  // Fetch annotations when current image changes
  const { data: annotationsData } = useAnnotationsQuery(
    projectId || "",
    currentImage?.name,
  );

  // Sync fetched annotations to store
  useEffect(() => {
    // Only apply if we have data AND the current image matches the data we fetched
    if (currentImage && annotationsData) {
      // Security check: Ensure the filename in the payload matches the image we are viewing
      if (annotationsData.filename && annotationsData.filename !== currentImage.name) {
        console.warn(`[Sync] Skipping annotation sync: Filename mismatch (Expected ${currentImage.name}, got ${annotationsData.filename})`);
        return;
      }
      
      const colorMap = new Map(store.classLabels.map((l) => [l.name, l.color]));
      const newAnnotations = annotationsData.boxes.map((box) => ({
        id: crypto.randomUUID(),
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        label: box.label,
        type: box.type || "bbox",
        points: box.points?.map((p) => ({
          x: p.x * annotationsData.image_width,
          y: p.y * annotationsData.image_height,
        })),
        color: colorMap.get(box.label) || "#FFFFFF",
      }));

      // Double check dimensions vs backend reported dimensions
      if (
        annotationsData.image_width > 0 &&
        (currentImage.width === 0 || currentImage.height === 0)
      ) {
        store.setCurrentImageDimensions(
          currentImage.id,
          annotationsData.image_width,
          annotationsData.image_height,
        );
      }

      store.setAnnotations(currentImage.id, newAnnotations);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotationsData, currentImage?.id]);

  // ── Keyboard event handler ──
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      // Prevent spamming when holding the key
      if (e.repeat) return;

      // Delete / Backspace → remove selected annotation
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        store.deleteSelectedAnnotation();
        return;
      }

      // Number keys 1-8 → switch class label
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 8) {
        const label = store.classLabels[num - 1];
        if (label) {
          store.setActiveClassLabel(label);
        }
        return;
      }

      // Arrow keys for navigation (with auto-save)
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        if (!isSaving) {
          const state = useAnnotationStore.getState();
          if (state.currentImageIndex < state.images.length - 1) {
            saveAndGo(state.currentImageIndex + 1);
          }
        }
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!isSaving) {
          const state = useAnnotationStore.getState();
          if (state.currentImageIndex > 0) {
            saveAndGo(state.currentImageIndex - 1);
          }
        }
        return;
      }
    },
    [store, saveAndGo, isSaving],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!projectId) {
    return null; // will redirect in useEffect
  }

  // ── Wait for reset before rendering children ──
  if (projectId !== initializedProjectId) {
    return <EditorSkeleton />;
  }

  // ── Loading state ──
  if (isPending) {
    return <EditorSkeleton />;
  }

  // ── Error state ──
  if (isError) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 max-w-md text-center px-6">
          <div className="size-12 flex items-center justify-center rounded-full bg-destructive/10">
            <IconPhotoOff className="size-6 text-destructive" />
          </div>
          <p className="text-sm font-medium text-foreground">
            Failed to connect to backend
          </p>
          <p className="text-xs text-muted-foreground">
            {error instanceof Error
              ? error.message
              : "Make sure the FastAPI server is running at http://localhost:8000"}
          </p>
        </div>
      </div>
    );
  }

  // ── Empty state (no images uploaded) ──
  if (!images || images.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 max-w-md text-center px-6">
          <div className="size-12 flex items-center justify-center rounded-full bg-muted">
            <IconPhotoOff className="size-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">
            No images in project
          </p>
          <p className="text-xs text-muted-foreground">
            Upload a dataset .zip to this project via the dashboard to get
            started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      {/* Top Toolbar */}
      <TopToolbar
        saveAndGo={saveAndGo}
        isSaving={isSaving}
        projectId={projectId}
      />

      {/* Main content area: left sidebar, canvas, right sidebar */}
      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar projectId={Number(projectId)} />

        {/* Center canvas area */}
        <div className="flex-1 overflow-hidden relative">
          <AnnotationCanvas />
        </div>

        <RightSidebar saveAndGo={saveAndGo} isSaving={isSaving} />
      </div>
    </div>
  );
}

export default function EditorPage() {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <EditorContent />
    </Suspense>
  );
}
