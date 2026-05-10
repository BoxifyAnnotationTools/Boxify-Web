import { create } from "zustand";
import { type Annotation, type ImageItem, type ClassLabel } from "./types";

interface AnnotationState {
  // Data
  images: ImageItem[];
  currentImageIndex: number;
  annotations: Record<string, Annotation[]>; // keyed by image id (filename)
  selectedAnnotationId: string | null;
  activeClassLabel: ClassLabel;
  classLabels: ClassLabel[];
  hiddenClasses: string[];
  showLabels: boolean;
  isForceCreateMode: boolean;
  activeModelName: string | null;
  drawingMode: "bbox" | "polygon";
  currentPolygonPoints: { x: number; y: number }[];
  updatePolygonPoint: (index: number, point: { x: number; y: number }) => void;

  // Actions
  setImages: (images: ImageItem[]) => void;
  removeImage: (imageId: string) => void;
  setCurrentImageDimensions: (
    imageId: string,
    width: number,
    height: number,
  ) => void;
  nextImage: () => void;
  prevImage: () => void;
  goToImage: (index: number) => void;
  addAnnotation: (annotation: Annotation) => void;
  updateAnnotation: (id: string, changes: Partial<Annotation>) => void;
  deleteAnnotation: (id: string) => void;
  setAnnotations: (imageId: string, annotations: Annotation[]) => void;
  clearAnnotations: () => void;
  setSelectedAnnotation: (id: string | null) => void;
  setActiveClassLabel: (label: ClassLabel) => void;
  setClassLabels: (labels: ClassLabel[]) => void;
  purgeClass: (className: string) => void;
  deleteSelectedAnnotation: () => void;
  toggleVisibility: (className: string) => void;
  toggleLabels: () => void;
  toggleForceCreateMode: () => void;
  setActiveModelName: (name: string | null) => void;
  resetEditorState: () => void;
  setDrawingMode: (mode: "bbox" | "polygon") => void;
  addPolygonPoint: (point: { x: number; y: number }) => void;
  clearCurrentPolygon: () => void;
}

const initialState = {
  images: [],
  currentImageIndex: 0,
  annotations: {},
  selectedAnnotationId: null,
  activeClassLabel: { name: "", color: "#ef4444", shortcut: "" },
  classLabels: [],
  hiddenClasses: [],
  showLabels: true,
  isForceCreateMode: false,
  activeModelName: null,
  drawingMode: "bbox" as "bbox" | "polygon",
  currentPolygonPoints: [],
};

export const useAnnotationStore = create<AnnotationState>((set, get) => ({
  ...initialState,

  resetEditorState: () => set(initialState),

  setImages: (images: ImageItem[]) => {
    const { currentImageIndex, images: currentImages } = get();
    if (currentImages.length === 0) {
      set({ images, currentImageIndex: 0, selectedAnnotationId: null });
    } else {
      const nextIndex = Math.min(
        currentImageIndex,
        Math.max(0, images.length - 1),
      );
      set({ images, currentImageIndex: nextIndex });
    }
  },
  
  updatePolygonPoint: (index: number, point: { x: number; y: number }) => {
    set((state) => {
      const updated = [...state.currentPolygonPoints];
      updated[index] = point;
      return { currentPolygonPoints: updated };
    });
  },

  removeImage: (imageId: string) => {
    const { images, currentImageIndex } = get();
    const indexToRemove = images.findIndex((img) => img.id === imageId);
    if (indexToRemove === -1) return;

    const newImages = images.filter((_, i) => i !== indexToRemove);
    if (newImages.length === 0) {
      set({ images: [], currentImageIndex: 0, selectedAnnotationId: null });
      return;
    }

    let newIndex = currentImageIndex;
    if (indexToRemove === currentImageIndex) {
      newIndex = Math.min(currentImageIndex, newImages.length - 1);
      set({ selectedAnnotationId: null });
    } else if (indexToRemove < currentImageIndex) {
      newIndex = currentImageIndex - 1;
    }

    set({ images: newImages, currentImageIndex: newIndex });
  },

  setCurrentImageDimensions: (
    imageId: string,
    width: number,
    height: number,
  ) => {
    const { images } = get();
    const index = images.findIndex((img) => img.id === imageId);
    if (index === -1) return;

    const current = images[index];
    // Only update if dimensions changed (avoid unnecessary re-renders)
    if (current.width === width && current.height === height) return;

    const updated = [...images];
    updated[index] = { ...current, width, height };
    set({ images: updated });
  },

  nextImage: () => {
    const { currentImageIndex, images } = get();
    if (currentImageIndex < images.length - 1) {
      set({
        currentImageIndex: currentImageIndex + 1,
        selectedAnnotationId: null,
      });
    }
  },

  prevImage: () => {
    const { currentImageIndex } = get();
    if (currentImageIndex > 0) {
      set({
        currentImageIndex: currentImageIndex - 1,
        selectedAnnotationId: null,
      });
    }
  },

  goToImage: (index: number) => {
    const { images } = get();
    if (index >= 0 && index < images.length) {
      set({ currentImageIndex: index, selectedAnnotationId: null });
    }
  },

  addAnnotation: (annotation: Annotation) => {
    const { images, currentImageIndex, annotations } = get();
    if (images.length === 0) return;
    const imageId = images[currentImageIndex].id;
    const existing = annotations[imageId] || [];
    set({
      annotations: {
        ...annotations,
        [imageId]: [...existing, annotation],
      },
    });
  },

  updateAnnotation: (id: string, changes: Partial<Annotation>) => {
    const { images, currentImageIndex, annotations } = get();
    if (images.length === 0) return;
    const imageId = images[currentImageIndex].id;
    const existing = annotations[imageId] || [];
    set({
      annotations: {
        ...annotations,
        [imageId]: existing.map((a) =>
          a.id === id ? { ...a, ...changes } : a,
        ),
      },
    });
  },

  deleteAnnotation: (id: string) => {
    const { images, currentImageIndex, annotations } = get();
    if (images.length === 0) return;
    const imageId = images[currentImageIndex].id;
    const existing = annotations[imageId] || [];
    set({
      annotations: {
        ...annotations,
        [imageId]: existing.filter((a) => a.id !== id),
      },
      selectedAnnotationId: null,
    });
  },

  setAnnotations: (imageId: string, newAnnotations: Annotation[]) => {
    set((state) => ({
      annotations: {
        ...state.annotations,
        [imageId]: newAnnotations,
      },
    }));
  },

  clearAnnotations: () => {
    const { images, currentImageIndex, annotations } = get();
    if (images.length === 0) return;
    const imageId = images[currentImageIndex].id;
    set({
      annotations: {
        ...annotations,
        [imageId]: [],
      },
      selectedAnnotationId: null,
    });
  },

  setSelectedAnnotation: (id: string | null) => {
    const { annotations, currentImageIndex, images, classLabels } = get();
    set({ selectedAnnotationId: id });

    if (id && images.length > 0) {
      const imageId = images[currentImageIndex].id;
      const existing = annotations[imageId] || [];
      const ann = existing.find((a) => a.id === id);
      if (ann) {
        const labelObj = classLabels.find((c) => c.name === ann.label);
        if (labelObj) {
          set({ activeClassLabel: labelObj });
        }
      }
    }
  },

  setActiveClassLabel: (label: ClassLabel) => {
    const { selectedAnnotationId } = get();
    set({ activeClassLabel: label });

    if (selectedAnnotationId) {
      get().updateAnnotation(selectedAnnotationId, {
        label: label.name,
        color: label.color,
      });
    }
  },

  setClassLabels: (labels: ClassLabel[]) => {
    const { activeClassLabel } = get();
    // Check if current active label still exists in new list
    const stillExists = labels.some((l) => l.name === activeClassLabel.name);
    set({
      classLabels: labels,
      // If active label gone or blank, default to first in new list
      activeClassLabel: stillExists
        ? activeClassLabel
        : (labels[0] ?? { name: "", color: "#ef4444", shortcut: "" }),
    });
  },

  purgeClass: (className: string) => {
    const { annotations, activeClassLabel, classLabels, selectedAnnotationId } =
      get();
    const newAnnotations: Record<string, Annotation[]> = {};
    for (const [imgId, anns] of Object.entries(annotations)) {
      newAnnotations[imgId] = anns.filter((a) => a.label !== className);
    }

    // Also reset selectedAnnotationId if the selected annotation was purged
    let newSelectedId = selectedAnnotationId;
    if (selectedAnnotationId) {
      const stillExists = Object.values(newAnnotations).some((anns) =>
        anns.some((a) => a.id === selectedAnnotationId),
      );
      if (!stillExists) newSelectedId = null;
    }

    set({
      annotations: newAnnotations,
      selectedAnnotationId: newSelectedId,
    });

    // If the purged class was active, reset to the first available class
    if (activeClassLabel.name === className) {
      const remainingClasses = classLabels.filter((c) => c.name !== className);
      set({
        activeClassLabel: remainingClasses[0] ?? {
          name: "",
          color: "#ef4444",
          shortcut: "",
        },
        classLabels: remainingClasses,
      });
    } else {
      set({ classLabels: classLabels.filter((c) => c.name !== className) });
    }
  },

  deleteSelectedAnnotation: () => {
    const { selectedAnnotationId } = get();
    if (selectedAnnotationId) {
      get().deleteAnnotation(selectedAnnotationId);
    }
  },

  toggleVisibility: (className: string) => {
    const { hiddenClasses } = get();
    if (hiddenClasses.includes(className)) {
      set({ hiddenClasses: hiddenClasses.filter((c) => c !== className) });
    } else {
      set({ hiddenClasses: [...hiddenClasses, className] });
    }
  },

  toggleLabels: () => {
    set((state) => ({ showLabels: !state.showLabels }));
  },

  toggleForceCreateMode: () => {
    set((state) => ({ isForceCreateMode: !state.isForceCreateMode }));
  },

  setActiveModelName: (name: string | null) => {
    set({ activeModelName: name });
  },

  setDrawingMode: (mode: "bbox" | "polygon") => {
    set({ drawingMode: mode });
  },

  addPolygonPoint: (point: { x: number; y: number }) => {
    set((state) => ({
      currentPolygonPoints: [...state.currentPolygonPoints, point],
    }));
  },

  clearCurrentPolygon: () => {
    set({ currentPolygonPoints: [] });
  },
}));

// Selector: get current image (returns undefined if no images loaded)
export const useCurrentImage = () =>
  useAnnotationStore((s) =>
    s.images.length > 0 ? s.images[s.currentImageIndex] : undefined,
  );

const EMPTY_ANNOTATIONS: Annotation[] = [];

// Selector: get annotations for current image
export const useCurrentAnnotations = () =>
  useAnnotationStore((s) => {
    if (s.images.length === 0) return EMPTY_ANNOTATIONS;
    const imageId = s.images[s.currentImageIndex].id;
    return s.annotations[imageId] || EMPTY_ANNOTATIONS;
  });
