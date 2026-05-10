"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";

import { useAuthStore } from "@/lib/authStore";
import { useProjectsQuery } from "@/lib/projectQueries";

import type { ProjectListItem } from "@/lib/types";

import CreateProjectDialog from "@/components/dashboard/create-project-dialog";
import ClassManagerDialog from "@/components/dashboard/class-manager-dialog";
import ProjectSettingsDialog from "@/components/dashboard/project-settings-dialog";

import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { Badge } from "@/components/ui/badge";

import { useQueryClient } from "@tanstack/react-query";

import {
  IconPlus,
  IconFolder,
  IconPhoto,
  IconCheck,
  IconLogout,
  IconPhotoOff,
  IconSettings,
} from "@tabler/icons-react";

function ProjectCard({
  project,
  onOpenSettings,
}: {
  project: ProjectListItem;
  onOpenSettings: () => void;
}) {
  const progress =
    project.image_count > 0
      ? Math.round(
          (project.annotated_count / project.image_count) * 100
        )
      : 0;

  return (
    <Link
      href={`/editor?projectId=${project.id}`}
      className="group block"
    >
      <Card className="h-full">
        <CardHeader className="pb-4 min-w-0">
          <div className="flex items-start justify-between gap-2 w-full min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="size-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0 border border-primary">
                <IconFolder className="size-4 text-primary" />
              </div>

              <Tooltip>
                <TooltipTrigger asChild>
                  <CardTitle className="text-sm font-semibold truncate group-hover:text-primary transition-colors cursor-default">
                    {project.name}
                  </CardTitle>
                </TooltipTrigger>

                <TooltipContent
                  side="top"
                  className="max-w-[300px] break-words"
                >
                  {project.name}
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onOpenSettings();
                }}
              >
                <IconSettings className="size-4" />
              </Button>

              <Badge
                variant="outline"
                className="text-[10px] tabular-nums"
              >
                #{project.id}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <IconPhoto className="size-3.5" />
              <span className="text-xs tabular-nums">
                {project.image_count} images
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-muted-foreground">
              <IconCheck className="size-3.5" />
              <span className="text-xs tabular-nums">
                {project.annotated_count} annotated
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>

            <p className="text-[10px] text-muted-foreground tabular-nums">
              {progress}% complete
            </p>
          </div>
        </CardContent>

        <CardFooter>
          <p className="text-[10px] text-muted-foreground">
            Created{" "}
            {format(
              new Date(project.created_at),
              "MMM d, yyyy"
            )}
          </p>
        </CardFooter>
      </Card>
    </Link>
  );
}

export default function DashboardPage() {
  const [isCreateOpen, setIsCreateOpen] =
    useState(false);

  const [
    managingClassProjectId,
    setManagingClassProjectId,
  ] = useState<number | null>(null);

  const [settingsProject, setSettingsProject] =
    useState<ProjectListItem | null>(null);

  const router = useRouter();
  const queryClient = useQueryClient();

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const { data, isPending, isError } =
    useProjectsQuery();

  const projects = data?.projects;
  const hasProjects =
    !!projects && projects.length > 0;

  const handleLogout = async () => {
    queryClient.clear();
    logout();
    router.replace("/login");
  };

  return (
    <div className="min-h-screen bg-background">
      <div
        className="fixed inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <header className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <Image
              src="/boxify.svg"
              alt="Boxify"
              width={36}
              height={36}
              className="size-9"
            />

            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                Welcome back,{" "}
                {user?.username ?? "Annotator"}
              </h1>

              <p className="text-xs text-muted-foreground">
                Select a project to start annotating
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() =>
                setIsCreateOpen(true)
              }
              size="sm"
              className="gap-1.5"
            >
              <IconPlus className="size-4" />
              New Project
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="gap-1.5"
            >
              <IconLogout className="size-4" />
              Log out
            </Button>
          </div>
        </header>

        {/* Summary */}
        {!isPending && hasProjects && (
          <div className="flex items-center gap-6 mb-8 px-1">
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {projects?.length ?? 0}
              </p>
              <p className="text-xs text-muted-foreground">
                Projects
              </p>
            </div>

            <div className="w-px h-8 bg-border" />

            <div>
              <p className="text-2xl font-bold tabular-nums">
                {projects?.reduce(
                  (sum, p) =>
                    sum + p.image_count,
                  0
                ) ?? 0}
              </p>

              <p className="text-xs text-muted-foreground">
                Total images
              </p>
            </div>

            <div className="w-px h-8 bg-border" />

            <div>
              <p className="text-2xl font-bold tabular-nums">
                {projects?.reduce(
                  (sum, p) =>
                    sum +
                    p.annotated_count,
                  0
                ) ?? 0}
              </p>

              <p className="text-xs text-muted-foreground">
                Annotated
              </p>
            </div>
          </div>
        )}

        {/* Loading */}
        {isPending && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Error */}
        {!isPending && isError && (
          <div className="flex justify-center py-24">
            <div className="text-center">
              <IconPhotoOff className="size-8 mx-auto mb-4 text-destructive" />
              <p className="font-medium">
                Failed to load projects
              </p>
              <p className="text-xs text-muted-foreground">
                Backend mungkin belum jalan
              </p>
            </div>
          </div>
        )}

        {/* Empty */}
        {!isPending &&
          !isError &&
          projects &&
          projects.length === 0 && (
            <div className="flex justify-center py-24">
              <div className="text-center max-w-sm">
                <IconFolder className="size-12 mx-auto mb-4 text-muted-foreground" />

                <p className="font-medium">
                  No projects yet
                </p>

                <p className="text-xs text-muted-foreground mt-2">
                  Create your first project
                  by uploading dataset
                  zip
                </p>

                <Button
                  className="mt-4 gap-1.5"
                  onClick={() =>
                    setIsCreateOpen(true)
                  }
                >
                  <IconPlus className="size-4" />
                  New Project
                </Button>
              </div>
            </div>
          )}

        {/* Grid */}
        {!isPending &&
          !isError &&
          hasProjects && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {projects!.map(
                (project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onOpenSettings={() =>
                      setSettingsProject(
                        project
                      )
                    }
                  />
                )
              )}
            </div>
          )}
      </div>

      <CreateProjectDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />

      <ProjectSettingsDialog
        project={settingsProject}
        open={!!settingsProject}
        onOpenChange={(open) =>
          !open &&
          setSettingsProject(null)
        }
        onManageClasses={(id) =>
          setManagingClassProjectId(id)
        }
      />

      {managingClassProjectId !== null && (
        <ClassManagerDialog
          projectId={
            managingClassProjectId
          }
          open
          onOpenChange={(open) => {
            if (!open)
              setManagingClassProjectId(
                null
              );
          }}
        />
      )}
    </div>
  );
}