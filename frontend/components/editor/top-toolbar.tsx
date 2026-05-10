"use client";

import { useCallback, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAnnotationStore, useCurrentAnnotations } from "@/lib/store";
import {
  useExportDataset,
  useManualSave,
  useAutoLabelMutation,
} from "@/lib/queries";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconLoader2,
  IconDeviceFloppy,
  IconCheck,
  IconArrowLeft,
  IconKeyboard,
  IconEye,
  IconEyeOff,
  IconRepeat,
  IconSquarePlus,
  IconSquare,
  IconPolygon,
} from "@tabler/icons-react";

interface TopToolbarProps {
  saveAndGo: (targetIndex: number) => void;
  isSaving: boolean;
  projectId: string;
}

export default function TopToolbar({
  saveAndGo,
  isSaving,
  projectId,
}: TopToolbarProps) {
  const store = useAnnotationStore();
  const currentImageIndex = store.currentImageIndex;
  const images = store.images;
  const annotations = useCurrentAnnotations();
  const exportMutation = useExportDataset(projectId);
  const autoLabelMutation = useAutoLabelMutation(projectId);
  const activeModelName = store.activeModelName;
  const {
    handleManualSave,
    isSaving: isManualSaving,
    isJustSaved,
  } = useManualSave(projectId);

  const isFirst = currentImageIndex === 0;
  const isLast = currentImageIndex === images.length - 1;

  const handlePrev = () => {
    if (!isFirst && !isSaving) {
      saveAndGo(currentImageIndex - 1);
    }
  };

  const handleNext = () => {
    if (!isLast && !isSaving) {
      saveAndGo(currentImageIndex + 1);
    }
  };

  const handleExport = () => {
    exportMutation.mutate();
  };

  const handleClearAll = () => {
    store.clearAnnotations();
  };

  const handleAutoLabel = async () => {
    if (!activeModelName || isSaving || autoLabelMutation.isPending) return;
    const currentImage = images[currentImageIndex];
    if (!currentImage) return;

    try {
      const response = await autoLabelMutation.mutateAsync({
        filename: currentImage.name,
        modelName: activeModelName,
      });
      toast.success(response.message);
    } catch (error) {
      toast.error("Auto-labeling failed");
    }
  };

  const handleRepeatPrevious = useCallback(() => {
    if (isFirst || isSaving) {
      if (isFirst) toast.error("This is the first image");
      return;
    }
    const prevImage = images[currentImageIndex - 1];
    if (!prevImage) return;

    const prevAnnotations = store.annotations[prevImage.id] || [];
    if (prevAnnotations.length === 0) {
      toast.info("Previous image has no annotations");
      return;
    }

    const newAnnotations = prevAnnotations.map((ann) => ({
      ...ann,
      id: crypto.randomUUID(),
    }));

    const currentImageId = images[currentImageIndex].id;
    const existingAnnotations = store.annotations[currentImageId] || [];
    store.setAnnotations(currentImageId, [
      ...existingAnnotations,
      ...newAnnotations,
    ]);
    toast.success("Annotations copied from previous image");
  }, [isFirst, isSaving, currentImageIndex, images, store]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const key = e.key.toLowerCase();

      // R = repeat previous
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (key === "r") {
          e.preventDefault();
          handleRepeatPrevious();
        }

        // F = toggle force create
        if (key === "f") {
          e.preventDefault();
          store.toggleForceCreateMode();
        }

        // A = prev image
        if (key === "a") {
          e.preventDefault();
          handlePrev();
        }

        // D = next image
        if (key === "d") {
          e.preventDefault();
          handleNext();
        }

        // E = delete selected annotation
        if (key === "e") {
          e.preventDefault();
          store.deleteSelectedAnnotation();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    handleRepeatPrevious,
    handlePrev,
    handleNext,
    store,
  ]);

  return (
    <div className="h-14 flex items-center justify-between border-b border-border bg-card px-4 shrink-0">
      {/* Left: Logo & Back */}
      <div className="flex items-center gap-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              asChild
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-foreground"
            >
              <Link href="/dashboard">
                <IconArrowLeft className="size-4" />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Back to Dashboard</TooltipContent>
        </Tooltip>

        <div className="flex items-center gap-2.5">
          <Image
            src="/boxify.svg"
            alt="Boxify"
            width={32}
            height={32}
            className="size-8"
          />
          <span className="text-sm font-semibold tracking-tight text-foreground">
            BOXIFY
          </span>
        </div>
      </div>

      {/* Center: Navigation */}
      <div className="flex items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              id="btn-prev-image"
              variant="outline"
              size="icon-sm"
              onClick={handlePrev}
              disabled={isFirst || isSaving}
            >
              <IconChevronLeft className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Previous image (saves current)</TooltipContent>
        </Tooltip>

        <div className="flex items-center gap-1 px-3 min-w-[80px] justify-center">
          <span className="text-sm font-medium tabular-nums text-foreground">
            {currentImageIndex + 1}
          </span>
          <span className="text-xs text-muted-foreground">/</span>
          <span className="text-sm text-muted-foreground tabular-nums">
            {images.length}
          </span>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              id="btn-next-image"
              variant="outline"
              size="icon-sm"
              onClick={handleNext}
              disabled={isLast || isSaving}
            >
              <IconChevronRight className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Next image (saves current)</TooltipContent>
        </Tooltip>
      </div>

      {/* Right: Status + Clear All + Export */}
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className="gap-1.5 tabular-nums mr-2 hidden sm:inline-flex"
        >
          <span
            className="size-1.5 rounded-full inline-block"
            style={{
              backgroundColor:
                annotations.length > 0 ? "#22C55E" : "var(--muted-foreground)",
            }}
          />
          {annotations.length} annotation{annotations.length !== 1 ? "s" : ""}
        </Badge>

        <Dialog>
          <Tooltip>
            <TooltipTrigger asChild>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <IconKeyboard className="size-3.5" />
                  <span className="hidden md:inline">Shortcuts</span>
                </Button>
              </DialogTrigger>
            </TooltipTrigger>
            <TooltipContent>View keyboard shortcuts</TooltipContent>
          </Tooltip>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Keyboard Shortcuts</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="text-sm font-medium text-muted-foreground">
                  Action
                </span>
                <span className="text-sm font-medium text-muted-foreground">
                  Shortcut
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-sm">Select Class Label</span>
                <div className="flex gap-1">
                  <kbd className="px-2 py-1 bg-muted rounded text-[10px] font-mono font-semibold border border-border">
                    1
                  </kbd>
                  <span className="text-muted-foreground text-xs my-auto">
                    -
                  </span>
                  <kbd className="px-2 py-1 bg-muted rounded text-[10px] font-mono font-semibold border border-border">
                    8
                  </kbd>
                </div>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-sm">Delete Selected Box</span>
                <div className="flex gap-1">
                  <kbd className="px-2 py-1 bg-muted rounded text-[10px] font-mono font-semibold border border-border">
                    Del
                  </kbd>
                  <span className="text-muted-foreground text-xs my-auto">
                    /
                  </span>
                  <kbd className="px-2 py-1 bg-muted rounded text-[10px] font-mono font-semibold border border-border">
                    Backspace
                  </kbd>
                  <span className="text-muted-foreground text-xs my-auto">
                    /
                  </span>
                  <kbd className="px-2 py-1 bg-muted rounded text-[10px] font-mono font-semibold border border-border">
                    E
                  </kbd>
                </div>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-sm">Previous Image</span>
                <div className="flex gap-1">
                  <kbd className="px-2 py-1 bg-muted rounded text-[10px] font-mono font-semibold border border-border">
                    ←
                  </kbd>
                  <span className="text-muted-foreground text-xs my-auto">
                    /
                  </span>
                  <kbd className="px-2 py-1 bg-muted rounded text-[10px] font-mono font-semibold border border-border">
                    ↑
                  </kbd>
                  <span className="text-muted-foreground text-xs my-auto">
                    /
                  </span>
                  <kbd className="px-2 py-1 bg-muted rounded text-[10px] font-mono font-semibold border border-border">
                    A
                  </kbd>
                </div>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-sm">Next Image</span>
                <div className="flex gap-1">
                  <kbd className="px-2 py-1 bg-muted rounded text-[10px] font-mono font-semibold border border-border">
                    →
                  </kbd>
                  <span className="text-muted-foreground text-xs my-auto">
                    /
                  </span>
                  <kbd className="px-2 py-1 bg-muted rounded text-[10px] font-mono font-semibold border border-border">
                    ↓
                  </kbd>
                  <span className="text-muted-foreground text-xs my-auto">
                    /
                  </span>
                  <kbd className="px-2 py-1 bg-muted rounded text-[10px] font-mono font-semibold border border-border">
                    D
                  </kbd>
                </div>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-sm">Pan Canvas</span>
                <kbd className="px-2 py-1 bg-muted rounded text-[10px] font-mono font-semibold border border-border">
                  Space + Drag
                </kbd>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-sm">Zoom In/Out</span>
                <kbd className="px-2 py-1 bg-muted rounded text-[10px] font-mono font-semibold border border-border">
                  Scroll Wheel
                </kbd>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-sm">Repeat Previous</span>
                <kbd className="px-2 py-1 bg-muted rounded text-[10px] font-mono font-semibold border border-border">
                  R
                </kbd>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-sm">Create Annotation</span>
                <kbd className="px-2 py-1 bg-muted rounded text-[10px] font-mono font-semibold border border-border">
                  F
                </kbd>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              id="btn-auto-detect"
              variant="outline"
              size="sm"
              onClick={handleAutoLabel}
              disabled={
                !activeModelName || autoLabelMutation.isPending || isSaving
              }
              className="gap-1.5 border-purple-500/30 text-purple-600 hover:bg-purple-500/10 hover:text-purple-600 dark:text-purple-400 dark:hover:text-purple-300"
            >
              {autoLabelMutation.isPending ? (
                <IconLoader2 className="size-3.5 animate-spin" />
              ) : (
                <span className="text-base leading-none">🪄</span>
              )}
              <span className="hidden sm:inline">Auto-Detect</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {!activeModelName
              ? "Upload a model first to enable AI Auto-Detect"
              : "Run AI auto-labeling on this image"}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              id="btn-force-draw"
              variant={store.isForceCreateMode ? "secondary" : "outline"}
              size="sm"
              onClick={store.toggleForceCreateMode}
              className={cn(
                "gap-1.5",
                store.isForceCreateMode && "border-primary text-primary",
              )}
            >
              <IconSquarePlus className="size-3.5" />
              <span className="hidden sm:inline">Create Annotation</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Draw new annotation (F)</TooltipContent>
        </Tooltip>

        <div className="flex items-center bg-muted/50 p-0.5 h-7 border border-border">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={store.drawingMode === "bbox" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => store.setDrawingMode("bbox")}
                className={cn(
                  "gap-1.5 h-full px-2 transition-all",
                  store.drawingMode === "bbox" &&
                    "shadow-sm bg-primary text-primary-foreground border border-primary",
                )}
              >
                <IconSquare className="size-3.5" />
                <span className="hidden xl:inline">Box</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Bounding Box Mode</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={
                  store.drawingMode === "polygon" ? "secondary" : "ghost"
                }
                size="sm"
                onClick={() => store.setDrawingMode("polygon")}
                className={cn(
                  "gap-1.5 h-full px-2 transition-all",
                  store.drawingMode === "polygon" &&
                    "shadow-sm bg-primary text-primary-foreground border border-primary",
                )}
              >
                <IconPolygon className="size-3.5" />
                <span className="hidden xl:inline">Polygon</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Polygon Mode</TooltipContent>
          </Tooltip>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              id="btn-repeat-previous"
              variant="outline"
              size="sm"
              onClick={handleRepeatPrevious}
              disabled={isFirst || isSaving}
              className="gap-1.5"
            >
              <IconRepeat className="size-3.5" />
              <span className="hidden sm:inline">Repeat</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Copy annotations from previous image (R)
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              id="btn-toggle-labels"
              variant="outline"
              size="sm"
              onClick={store.toggleLabels}
              disabled={isSaving}
              className="gap-1.5"
            >
              {store.showLabels ? (
                <IconEye className="size-3.5" />
              ) : (
                <IconEyeOff className="size-3.5" />
              )}
              <span className="hidden sm:inline">Labels</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {store.showLabels ? "Hide Labels" : "Show Labels"}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              id="btn-clear-all"
              variant="outline"
              size="sm"
              onClick={handleClearAll}
              disabled={annotations.length === 0 || isSaving}
            >
              Clear All
            </Button>
          </TooltipTrigger>
          <TooltipContent>Delete all annotations on this image</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              id="btn-manual-save"
              variant="outline"
              size="sm"
              onClick={handleManualSave}
              disabled={isManualSaving || isSaving || isJustSaved}
              className={cn(
                "gap-1.5 transition-all w-24",
                isJustSaved && "border-green-500 text-green-500",
              )}
            >
              {isManualSaving ? (
                <IconLoader2 className="size-3.5 animate-spin" />
              ) : isJustSaved ? (
                <IconCheck className="size-3.5" />
              ) : (
                <IconDeviceFloppy className="size-3.5" />
              )}
              {isManualSaving ? "Saving" : isJustSaved ? "Saved!" : "Save"}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Save annotations without navigating</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              id="btn-export-dataset"
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={exportMutation.isPending}
              className="gap-1.5"
            >
              {exportMutation.isPending ? (
                <IconLoader2 className="size-3.5 animate-spin" />
              ) : (
                <IconDownload className="size-3.5" />
              )}
              Export
            </Button>
          </TooltipTrigger>
          <TooltipContent>Download dataset as .zip</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
