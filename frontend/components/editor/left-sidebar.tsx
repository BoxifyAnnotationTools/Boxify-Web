"use client";

import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { useUploadModelMutation, useGetModelsQuery } from "@/lib/queries";
import { useAnnotationStore, useCurrentAnnotations } from "@/lib/store";
import ClassManagerDialog from "@/components/dashboard/class-manager-dialog";
import type { ClassLabel } from "@/lib/types";
import type { ProjectClass } from "@/lib/types";
import { useClassesQuery } from "@/lib/classQueries";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  IconPointer,
  IconBrush,
  IconEye,
  IconEyeOff,
  IconAlertTriangle,
  IconSettings,
  IconBrain,
  IconUpload,
  IconLoader2,
  IconX,
} from "@tabler/icons-react";

// Map a ProjectClass (from DB) to the ClassLabel shape the store uses.
// We drop `shortcut` since classes are now DB-driven; we generate it from index.
function toClassLabel(cls: ProjectClass, index: number): ClassLabel {
  return {
    name: cls.name,
    color: cls.color,
    shortcut: String(index + 1), // 1-based shortcut for first 9 classes
  };
}

export default function LeftSidebar({ projectId }: { projectId: number }) {
  const [isClassManagerOpen, setIsClassManagerOpen] = useState(false);
  const { data: dbClasses, isPending } = useClassesQuery(projectId);

  const setClassLabels = useAnnotationStore((s) => s.setClassLabels);
  const classLabels = useAnnotationStore((s) => s.classLabels);
  const activeClassLabel = useAnnotationStore((s) => s.activeClassLabel);
  const setActiveClassLabel = useAnnotationStore((s) => s.setActiveClassLabel);
  const hiddenClasses = useAnnotationStore((s) => s.hiddenClasses);
  const toggleVisibility = useAnnotationStore((s) => s.toggleVisibility);

  const activeModelName = useAnnotationStore((s) => s.activeModelName);
  const setActiveModelName = useAnnotationStore((s) => s.setActiveModelName);
  const uploadModelMutation = useUploadModelMutation(projectId.toString());
  const { data: savedModels, isPending: isModelsLoading } = useGetModelsQuery(
    projectId.toString(),
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-select the first model when the project loads
  useEffect(() => {
    if (!activeModelName && savedModels && savedModels.length > 0) {
      setActiveModelName(savedModels[0].name);
    }
  }, [savedModels, activeModelName, setActiveModelName]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".pt")) {
      toast.error("Please upload a valid .pt YOLO model file.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await uploadModelMutation.mutateAsync(formData);
      setActiveModelName(response.model_name);
      toast.success(response.message);
    } catch (error) {
      toast.error("Failed to upload model.");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // ── Sync DB → Zustand whenever the fetched list changes ──
  useEffect(() => {
    if (!dbClasses) return;
    const mapped = dbClasses.map(toClassLabel);
    setClassLabels(mapped);
  }, [dbClasses, setClassLabels]);

  const annotations = useCurrentAnnotations();
  const classCounts = annotations.reduce(
    (acc, ann) => {
      acc[ann.label] = (acc[ann.label] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const hasClasses = classLabels.length > 0;
  const activeIsValid = hasClasses && !!activeClassLabel.name;

  return (
    <div className="w-64 border-r border-border bg-card flex flex-col shrink-0">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconBrush className="size-4 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Classes
          </span>
        </div>
        <button
          onClick={() => setIsClassManagerOpen(true)}
          className="text-muted-foreground hover:text-foreground transition-colors p-1 -mr-1 rounded-md hover:bg-accent"
        >
          <IconSettings className="size-4" />
        </button>
      </div>
      <Separator />

      {/* Active class indicator */}
      <div className="px-4 py-3 border-b border-border">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
          Active
        </p>
        {activeIsValid ? (
          <div className="flex items-center gap-2">
            <span
              className="size-3 shrink-0 border border-white/20"
              style={{ backgroundColor: activeClassLabel.color }}
            />
            <span className="text-sm font-medium text-foreground">
              {activeClassLabel.name}
            </span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground italic">None</span>
        )}
      </div>

      {/* Class list */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 space-y-0.5">
          {/* Loading skeleton */}
          {isPending && (
            <div className="space-y-1 px-1">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-9 w-full rounded-md bg-muted/50 animate-pulse"
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isPending && !hasClasses && (
            <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
              <IconAlertTriangle className="size-5 text-muted-foreground/60" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                No classes found.
                <br />
                Add them in the{" "}
                <span className="font-medium text-foreground/70">
                  Project Settings
                </span>
                .
              </p>
            </div>
          )}

          {/* Class rows */}
          {!isPending &&
            classLabels.map((label) => {
              const isActive = activeClassLabel.name === label.name;
              const isHidden = hiddenClasses.includes(label.name);
              return (
                <button
                  key={label.name}
                  id={`class-label-${label.name.toLowerCase().replace(/\s+/g, "-")}`}
                  onClick={() => setActiveClassLabel(label)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors",
                    "hover:bg-accent/50",
                    isActive && "bg-accent text-accent-foreground",
                  )}
                >
                  {/* Color dot */}
                  <span
                    className="size-3 shrink-0 border border-white/20"
                    style={{ backgroundColor: label.color }}
                  />

                  {/* Name & Count */}
                  <div className="flex-1 flex items-center justify-between min-w-0 pr-1">
                    <span
                      className={cn(
                        "text-sm truncate",
                        isActive
                          ? "font-medium text-foreground"
                          : "text-muted-foreground",
                        isHidden && "opacity-50 line-through",
                      )}
                    >
                      {label.name}
                    </span>
                    {(classCounts[label.name] || 0) > 0 && (
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-[10px] h-4 px-1.5 tabular-nums",
                          isHidden && "opacity-50",
                        )}
                      >
                        {classCounts[label.name]}
                      </Badge>
                    )}
                  </div>

                  {/* Shortcut key (only show for first 9) */}
                  {label.shortcut && Number(label.shortcut) <= 9 && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] px-1.5 h-4 tabular-nums shrink-0",
                        isActive
                          ? "border-foreground/30 text-foreground"
                          : "border-muted-foreground/30 text-muted-foreground",
                      )}
                    >
                      {label.shortcut}
                    </Badge>
                  )}

                  {/* Visibility Toggle */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleVisibility(label.name);
                    }}
                    className={cn(
                      "p-1 -mr-1 rounded-md transition-colors cursor-pointer shrink-0",
                      isHidden
                        ? "text-muted-foreground hover:text-foreground"
                        : "text-foreground/70 hover:text-foreground",
                    )}
                  >
                    {isHidden ? (
                      <IconEyeOff className="size-3.5" />
                    ) : (
                      <IconEye className="size-3.5" />
                    )}
                  </div>
                </button>
              );
            })}
        </div>
      </ScrollArea>

      <Separator />

      {/* AI Assistant Section */}
      <div className="px-4 py-3 flex flex-col gap-2 bg-accent/20">
        <div className="flex items-center gap-2">
          <IconBrain className="size-4 text-purple-500" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            AI Assistant
          </span>
        </div>

        {/* Saved models list */}
        {isModelsLoading ? (
          <div className="space-y-1">
            {[...Array(2)].map((_, i) => (
              <div
                key={i}
                className="h-8 w-full rounded-md bg-muted/50 animate-pulse"
              />
            ))}
          </div>
        ) : savedModels && savedModels.length > 0 ? (
          <div className="flex flex-col gap-1">
            {savedModels.map((model) => {
              const isActive = activeModelName === model.name;
              return (
                <button
                  key={model.id}
                  onClick={() => setActiveModelName(model.name)}
                  title={model.name}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors text-xs",
                    isActive
                      ? "bg-purple-500/15 border border-purple-500/30 text-purple-600 dark:text-purple-400"
                      : "bg-background border border-border text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full shrink-0",
                      isActive ? "bg-purple-500" : "bg-muted-foreground/40",
                    )}
                  />
                  <span className="truncate flex-1 font-medium">
                    {model.name}
                  </span>
                  {isActive && (
                    <span className="text-[10px] shrink-0 text-purple-500 font-semibold">
                      ACTIVE
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground/70 italic">
            No models uploaded yet.
          </p>
        )}

        {/* Upload button */}
        <input
          type="file"
          accept=".pt"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileUpload}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadModelMutation.isPending}
          className="w-full flex items-center justify-center gap-2 border border-dashed border-border p-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors text-xs text-muted-foreground mt-1"
        >
          {uploadModelMutation.isPending ? (
            <>
              <IconLoader2 className="size-3.5 animate-spin" />
              <span>Uploading...</span>
            </>
          ) : (
            <>
              <IconUpload className="size-3.5" />
              <span>Upload .pt Model</span>
            </>
          )}
        </button>
      </div>

      {/* Footer hint */}
      <Separator />
      <div className="px-4 py-2.5">
        {hasClasses ? (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <IconPointer className="size-3" />
            <span className="text-[10px]">
              Press <kbd className="font-mono font-bold">1</kbd>–
              <kbd className="font-mono font-bold">9</kbd> to switch class
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-muted-foreground/60">
            <IconPointer className="size-3" />
            <span className="text-[10px] italic">Drawing disabled</span>
          </div>
        )}
      </div>

      {/* Class Manager Modal */}
      <ClassManagerDialog
        projectId={projectId}
        open={isClassManagerOpen}
        onOpenChange={setIsClassManagerOpen}
      />
    </div>
  );
}
