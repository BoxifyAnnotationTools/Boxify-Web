"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useDeleteImageMutation } from "@/lib/queries";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  useAnnotationStore,
  useCurrentImage,
  useCurrentAnnotations,
} from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  IconFileInfo,
  IconPhoto,
  IconStack2,
  IconTrash,
} from "@tabler/icons-react";

interface RightSidebarProps {
  saveAndGo: (targetIndex: number) => void;
  isSaving: boolean;
}

export default function RightSidebar({
  saveAndGo,
  isSaving,
}: RightSidebarProps) {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") || "";
  const deleteImageMutation = useDeleteImageMutation(projectId);
  const removeImage = useAnnotationStore((s) => s.removeImage);

  const images = useAnnotationStore((s) => s.images);
  const currentImageIndex = useAnnotationStore((s) => s.currentImageIndex);
  const annotations = useAnnotationStore((s) => s.annotations);
  const currentImage = useCurrentImage();
  const currentAnnotations = useCurrentAnnotations();
  const [searchQuery, setSearchQuery] = useState("");

  const handleImageClick = (index: number) => {
    if (index === currentImageIndex || isSaving) return;
    saveAndGo(index);
  };

  const handleDeleteImage = async (filename: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSaving || deleteImageMutation.isPending) return;

    try {
      await deleteImageMutation.mutateAsync(filename);
      removeImage(filename);
      toast.success("Image deleted");
    } catch (error) {
      toast.error("Failed to delete image");
    }
  };

  return (
    <div className="w-72 border-l border-border bg-card flex flex-col shrink-0 overflow-hidden">
      {/* File Information */}
      <div className="px-4 py-3 flex items-center gap-2">
        <IconFileInfo className="size-4 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          File Info
        </span>
      </div>
      <Separator />

      <div className="px-4 py-3 space-y-2.5 border-b border-border">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Filename
          </span>
          <span className="text-xs text-foreground font-medium truncate max-w-40 text-right">
            {currentImage?.name ?? "—"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Resolution
          </span>
          <span className="text-xs text-foreground tabular-nums">
            {currentImage && currentImage.width > 0
              ? `${currentImage.width} × ${currentImage.height}`
              : "Detecting…"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Annotations
          </span>
          <Badge variant="secondary" className="text-[10px] h-4 tabular-nums">
            {currentAnnotations.length}
          </Badge>
        </div>
      </div>

      {/* Image List */}
      <div className="px-4 py-3 flex items-center gap-2">
        <IconStack2 className="size-4 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Image Batch
        </span>
        <Badge
          variant="outline"
          className="ml-auto text-[10px] h-4 tabular-nums"
        >
          {images.length}
        </Badge>
      </div>
      <Separator />

      <div className="px-4 py-2 border-b border-border">
        <Input
          placeholder="Search image..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 text-xs"
        />
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 space-y-0.5">
          {images
            .map((img, idx) => ({ img, idx }))
            .filter(({ img }) =>
              img.name.toLowerCase().includes(searchQuery.toLowerCase()),
            )
            .map(({ img: image, idx: index }) => {
              const isCurrent = index === currentImageIndex;
              const liveAnnotations = annotations[image.id];
              const displayCount = liveAnnotations
                ? liveAnnotations.length
                : image.annotationCount || 0;

              return (
                <div key={image.id} className="flex group w-full items-center">
                  <button
                    id={`image-item-${image.id}`}
                    onClick={() => handleImageClick(index)}
                    disabled={isSaving}
                    className={cn(
                      "flex-1 flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors rounded-md",
                      "hover:bg-accent/50 disabled:opacity-50",
                      isCurrent && "bg-accent text-accent-foreground",
                    )}
                  >
                    <IconPhoto
                      className={cn(
                        "size-3.5 shrink-0",
                        isCurrent ? "text-primary" : "text-muted-foreground",
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "text-xs truncate",
                          isCurrent
                            ? "font-medium text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {image.name}
                      </p>
                    </div>
                    {displayCount > 0 && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] h-4 px-1.5 tabular-nums shrink-0"
                      >
                        {displayCount}
                      </Badge>
                    )}
                  </button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        disabled={isSaving || deleteImageMutation.isPending}
                      >
                        <IconTrash className="size-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Image</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this image and its
                          annotations? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={(e) =>
                            handleDeleteImage(
                              image.name,
                              e as unknown as React.MouseEvent,
                            )
                          }
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              );
            })}
        </div>
      </ScrollArea>
    </div>
  );
}
