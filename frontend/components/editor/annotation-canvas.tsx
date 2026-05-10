"use client";

import { useRef, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useCurrentImage } from "@/lib/store";

const CanvasCore = dynamic(() => import("./canvas-core"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-muted-foreground">
          Initializing canvas…
        </span>
      </div>
    </div>
  ),
});

export default function AnnotationCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const currentImage = useCurrentImage();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const { width, height } = container.getBoundingClientRect();
      setDimensions({ width, height });
    };

    // Initial measurement
    updateSize();

    const observer = new ResizeObserver(() => {
      updateSize();
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden bg-[#0a0a0a]"
    >
      {dimensions.width > 0 && dimensions.height > 0 && currentImage && (
        <CanvasCore
          key={currentImage.id}
          containerWidth={dimensions.width}
          containerHeight={dimensions.height}
        />
      )}
    </div>
  );
}
