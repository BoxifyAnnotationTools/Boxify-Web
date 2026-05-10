"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useUpdateProjectMutation, useDeleteProjectMutation } from "@/lib/projectQueries";
import type { ProjectListItem } from "@/lib/types";

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
import { 
  IconSettings, 
  IconTrash, 
  IconDeviceFloppy, 
  IconTags,
  IconAlertTriangle 
} from "@tabler/icons-react";

interface ProjectSettingsDialogProps {
  project: ProjectListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onManageClasses: (id: number) => void;
}

export default function ProjectSettingsDialog({
  project,
  open,
  onOpenChange,
  onManageClasses,
}: ProjectSettingsDialogProps) {
  const [name, setName] = useState("");
  const [isConfirmDelete, setIsConfirmDelete] = useState(false);

  const updateMutation = useUpdateProjectMutation();
  const deleteMutation = useDeleteProjectMutation();

  // Reset state pas dialog dibuka
  useEffect(() => {
    if (project && open) {
      setName(project.name);
      setIsConfirmDelete(false);
    }
  }, [project, open]);

  if (!project) return null;

  const handleUpdate = () => {
    if (name.length < 3) {
      toast.error("Project name must be at least 3 characters");
      return;
    }
    updateMutation.mutate(
      { id: project.id, name },
      {
        onSuccess: () => {
          toast.success("Project updated successfully");
          onOpenChange(false);
        },
      }
    );
  };

  const handleDelete = () => {
    deleteMutation.mutate(project.id, {
      onSuccess: () => {
        toast.success("Project deleted successfully");
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <IconSettings className="size-5 text-primary" />
            <DialogTitle>Project Settings</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Manage your project configuration and dataset.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Section: General */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name" className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
                Project Name
              </Label>
              <div className="flex gap-2">
                <Input
                  id="edit-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter project name"
                  className="h-9"
                />
                <Button 
                  size="sm" 
                  onClick={handleUpdate}
                  disabled={updateMutation.isPending || name === project.name}
                >
                  <IconDeviceFloppy className="size-4 mr-1.5" />
                  Save
                </Button>
              </div>
            </div>
          </div>

          {/* Section: Shortcuts */}
          <div className="space-y-2">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
              Quick Actions
            </Label>
            <Button
              variant="outline"
              className="w-full justify-start gap-2 h-10 border-dashed hover:border-primary/50"
              onClick={() => {
                onOpenChange(false);
                onManageClasses(project.id);
              }}
            >
              <IconTags className="size-4 text-primary" />
              Manage Annotation Classes
            </Button>
          </div>

          {/* Section: Danger Zone */}
          <div className="pt-4 border-t border-destructive/10">
            {!isConfirmDelete ? (
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 h-9 text-destructive hover:text-destructive hover:bg-destructive/5"
                onClick={() => setIsConfirmDelete(true)}
              >
                <IconTrash className="size-4" />
                Delete Project
              </Button>
            ) : (
              <div className="bg-destructive/5 border border-destructive/20 rounded-md p-3 space-y-3">
                <div className="flex items-start gap-2">
                  <IconAlertTriangle className="size-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-[11px] text-destructive font-medium leading-tight">
                    Are you sure? This will permanently delete all images, labels, and models.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex-1 h-8 text-[11px]"
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                  >
                    Yes, Delete Everything
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-[11px]"
                    onClick={() => setIsConfirmDelete(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}