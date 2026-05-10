"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconTrash, IconEdit, IconCheck, IconX } from "@tabler/icons-react";
import { useAnnotationStore } from "@/lib/store";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import {
  useClassesQuery,
  useCreateClassMutation,
  useDeleteClassMutation,
  useUpdateClassMutation,
} from "@/lib/classQueries";

const COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
];

const classSchema = z.object({
  name: z.string().min(1, "Name is required"),
  color: z.string(),
});

export default function ClassManagerDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: classes, isPending } = useClassesQuery(projectId);
  const createClass = useCreateClassMutation(projectId);
  const deleteClass = useDeleteClassMutation(projectId);
  const updateClass = useUpdateClassMutation(projectId);
  const purgeClass = useAnnotationStore((s) => s.purgeClass);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof classSchema>>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      name: "",
      color: "#ef4444",
    },
  });

  const selectedColor = watch("color");

  const onSubmit = async (data: z.infer<typeof classSchema>) => {
    try {
      await createClass.mutateAsync(data);
      toast.success("Class created successfully");
      reset();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to create class");
    }
  };

  const handleDelete = async (classId: number, className: string) => {
    try {
      await deleteClass.mutateAsync(classId);
      purgeClass(className);
      toast.success("Class deleted successfully");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to delete class");
    }
  };

  const handleUpdate = async (classId: number) => {
    if (!editName.trim()) {
      toast.error("Class name cannot be empty");
      return;
    }
    try {
      await updateClass.mutateAsync({ classId, payload: { name: editName, color: editColor } });
      toast.success("Class updated successfully");
      setEditingId(null);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to update class");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Classes</DialogTitle>
          <DialogDescription>
            Manage object classes for this project.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add Class Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 border p-4 rounded-lg bg-muted/50">
            <div className="space-y-2">
              <Label htmlFor="className">Class Name</Label>
              <Input
                id="className"
                placeholder="e.g. Car, Pedestrian"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setValue("color", color)}
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center border-2",
                      selectedColor === color
                        ? "border-foreground ring-2 ring-background"
                        : "border-transparent"
                    )}
                    style={{ backgroundColor: color }}
                  >
                    {selectedColor === color && (
                      <IconCheck className="size-3 text-white" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting || createClass.isPending}>
              {createClass.isPending ? "Adding..." : "Add Class"}
            </Button>
          </form>

          {/* List View */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Existing Classes</h4>
            
            {isPending && (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            )}

            {!isPending && classes?.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                No classes found. Add one above.
              </p>
            )}

            {!isPending && classes?.map((cls) => {
              const isEditing = editingId === cls.id;
              
              return (
                <div key={cls.id} className="flex items-center justify-between p-2 border rounded-md">
                  {isEditing ? (
                    <div className="flex items-center gap-2 flex-1 mr-2 min-w-0">
                      <Input 
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-8 text-sm"
                        autoFocus
                      />
                      <div className="flex gap-1 shrink-0">
                        {COLORS.map((color) => (
                           <button
                             key={color}
                             type="button"
                             onClick={() => setEditColor(color)}
                             className={cn(
                               "w-5 h-5 rounded-full flex items-center justify-center border",
                               editColor === color
                                 ? "border-foreground ring-1 ring-background"
                                 : "border-transparent"
                             )}
                             style={{ backgroundColor: color }}
                           />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full shrink-0"
                        style={{ backgroundColor: cls.color }}
                      />
                      <span className="text-sm font-medium">{cls.name}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-1 shrink-0">
                    {isEditing ? (
                      <>
                        <Button variant="ghost" size="icon" className="size-7 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => handleUpdate(cls.id)}>
                          <IconCheck className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-7" onClick={() => setEditingId(null)}>
                          <IconX className="size-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button variant="ghost" size="icon" className="size-7" onClick={() => {
                          setEditingId(cls.id);
                          setEditName(cls.name);
                          setEditColor(cls.color);
                        }}>
                          <IconEdit className="size-4" />
                        </Button>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive hover:bg-destructive/10">
                              <IconTrash className="size-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription className="text-destructive font-medium">
                                Deleting this class will also permanently delete all bounding boxes associated with it in this project. This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(cls.id, cls.name)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Delete Class
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
