"use client";

import { useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useCreateProjectMutation } from "@/lib/projectQueries";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field";
import { IconLoader2, IconUpload } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

// ── Zod schema ──
const createProjectSchema = z.object({
  name: z
    .string()
    .min(3, "Project name must be at least 3 characters")
    .max(100, "Project name is too long"),
  file: z
    .custom<FileList>((val) => val instanceof FileList && val.length > 0, {
      message: "Please select a .zip file",
    })
    .refine(
      (files) => files[0]?.name.toLowerCase().endsWith(".zip"),
      "Only .zip files are accepted",
    )
    .refine(
      (files) => files[0]?.size <= 500 * 1024 * 1024,
      "File must be 500 MB or smaller",
    ),
});
type CreateProjectFormValues = z.infer<typeof createProjectSchema>;

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateProjectDialog({
  open,
  onOpenChange,
}: CreateProjectDialogProps) {
  const createMutation = useCreateProjectMutation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<CreateProjectFormValues>({
    resolver: zodResolver(createProjectSchema),
  });

  const watchedFiles = watch("file");
  const selectedFileName =
    watchedFiles && watchedFiles.length > 0 ? watchedFiles[0]?.name : null;

  const handleClose = () => {
    if (createMutation.isPending) return; // don't close while uploading
    reset();
    onOpenChange(false);
  };

  const onSubmit = (values: CreateProjectFormValues) => {
    const formData = new FormData();
    formData.append("name", values.name);
    formData.append("file", values.file[0]);

    createMutation.mutate(formData, {
      onSuccess: (data) => {
        toast.success(
          `Project "${data.name}" created with ${data.image_count} images!`,
        );
        reset();
        onOpenChange(false);
      },
      onError: (error) => {
        const detail = (error as { response?: { data?: { detail?: string } } })
          ?.response?.data?.detail;
        toast.error(detail ?? "Failed to create project. Please try again.");
      },
    });
  };

  const { ref: fileRegisterRef, ...fileRegisterRest } = register("file");

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="pb-4">
          <DialogTitle>New Project</DialogTitle>
          <DialogDescription className="text-xs">
            Upload a .zip archive of images to create a new annotation project.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          {/* Project Name */}
          <div className="space-y-1.5">
            <Label htmlFor="project-name" className="text-xs">
              Project Name
            </Label>
            <Input
              id="project-name"
              placeholder="e.g. Traffic Detection v1"
              autoFocus
              {...register("name")}
            />
            <FieldError errors={[errors.name]} />
          </div>

          {/* File Upload */}
          <div className="space-y-1.5">
            <Label htmlFor="project-file" className="text-xs">
              Dataset (.zip)
            </Label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "w-full flex flex-col items-center justify-center gap-2 px-4 py-6",
                "border border-dashed rounded-md transition-colors",
                "text-xs text-muted-foreground hover:border-primary/50 hover:bg-accent/30",
                errors.file && "border-destructive",
              )}
            >
              <IconUpload className="size-5 text-muted-foreground" />
              {selectedFileName ? (
                <span className="font-medium text-foreground truncate max-w-full px-2">
                  {selectedFileName}
                </span>
              ) : (
                <span>Click to select a .zip file (max 500 MB)</span>
              )}
            </button>
            <input
              id="project-file"
              type="file"
              accept=".zip"
              className="sr-only"
              {...fileRegisterRest}
              ref={(e) => {
                fileRegisterRef(e);
                fileInputRef.current = e;
              }}
            />
            <FieldError errors={[errors.file as { message?: string }]} />
          </div>

          {/* Uploading progress hint */}
          {createMutation.isPending && (
            <p className="text-xs text-muted-foreground text-center animate-pulse">
              Uploading and extracting images… This may take a moment for large
              datasets.
            </p>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              id="btn-create-project-submit"
              type="submit"
              disabled={createMutation.isPending}
              className="gap-1.5"
            >
              {createMutation.isPending ? (
                <>
                  <IconLoader2 className="size-4 animate-spin" />
                  Uploading…
                </>
              ) : (
                "Create Project"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
