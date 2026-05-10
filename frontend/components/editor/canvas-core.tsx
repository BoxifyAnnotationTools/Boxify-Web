"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Stage,
  Layer,
  Rect,
  Image as KonvaImage,
  Line,
  Transformer,
  Label,
  Tag,
  Text,
  Group,
  Circle,
} from "react-konva";
import type Konva from "konva";
import {
  useAnnotationStore,
  useCurrentImage,
  useCurrentAnnotations,
} from "@/lib/store";
import type { Annotation } from "@/lib/types";

function useImage(
  url: string,
): [HTMLImageElement | null, "loading" | "loaded" | "error"] {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    "loading",
  );

  useEffect(() => {
    if (!url) {
      setImage(null);
      setStatus("error");
      return;
    }
    setImage(null);
    setStatus("loading");
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    img.onload = () => {
      setImage(img);
      setStatus("loaded");
    };
    img.onerror = () => setStatus("error");
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [url]);

  return [image, status];
}

interface CanvasCoreProps {
  containerWidth: number;
  containerHeight: number;
}

export default function CanvasCore({
  containerWidth,
  containerHeight,
}: CanvasCoreProps) {
  const store = useAnnotationStore();
  const currentImage = useCurrentImage();
  const annotations = useCurrentAnnotations();
  const imageUrl = currentImage?.url ?? "";
  const [loadedImage, imageStatus] = useImage(imageUrl);

  const [viewState, setViewState] = useState({ scale: 1, x: 0, y: 0 });
  const [imgDim, setImgDim] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (!loadedImage || containerWidth === 0 || containerHeight === 0) return;
    const w = loadedImage.naturalWidth || loadedImage.width;
    const h = loadedImage.naturalHeight || loadedImage.height;
    const scaleX = containerWidth / w;
    const scaleY = containerHeight / h;
    const s = Math.min(scaleX, scaleY) * 1;

    setViewState({
      scale: s,
      x: (containerWidth - w * s) / 2,
      y: (containerHeight - h * s) / 2,
    });
    setImgDim({ w, h });

    if (currentImage?.id) {
      store.setCurrentImageDimensions(currentImage.id, w, h);
    }
  }, [
    loadedImage,
    containerWidth,
    containerHeight,
    imageUrl,
    currentImage?.id,
    store,
  ]);

  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [drawingRect, setDrawingRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [crosshairPos, setCrosshairPos] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [isSpaceDown, setIsSpaceDown] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        e.preventDefault();
        setIsSpaceDown(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpaceDown(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  const classColorMap = useMemo(() => {
    return new Map(store.classLabels.map((l) => [l.name, l.color]));
  }, [store.classLabels]);

  const stageToImage = useCallback(
    (stageX: number, stageY: number) => ({
      x: Math.max(
        0,
        Math.min((stageX - viewState.x) / viewState.scale, imgDim.w),
      ),
      y: Math.max(
        0,
        Math.min((stageY - viewState.y) / viewState.scale, imgDim.h),
      ),
    }),
    [viewState.x, viewState.y, viewState.scale, imgDim.w, imgDim.h],
  );

  const imgBounds = useMemo(
    () => ({
      left: viewState.x,
      top: viewState.y,
      right: viewState.x + imgDim.w * viewState.scale,
      bottom: viewState.y + imgDim.h * viewState.scale,
    }),
    [viewState.x, viewState.y, viewState.scale, imgDim.w, imgDim.h],
  );

  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    const stage = tr.getStage();
    
    if (store.selectedAnnotationId && stage) {
      const node = stage.findOne(`#${store.selectedAnnotationId}-shape`);
      if (node) {
        tr.nodes([node]);
      } else {
        tr.nodes([]);
      }
    } else {
      tr.nodes([]);
    }
    tr.getLayer()?.batchDraw();
  }, [store.selectedAnnotationId, annotations]);

  useEffect(() => {
    setIsDrawing(false);
    setDrawStart(null);
    setDrawingRect(null);
    setIsPanning(false);
  }, [store.currentImageIndex]);

  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const scaleBy = 1.1;
      const stage = stageRef.current;
      if (!stage || imgDim.w === 0) return;

      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const oldScale = viewState.scale;
      
      const minScale = Math.min(containerWidth / imgDim.w, containerHeight / imgDim.h);

      const newScale =
        e.evt.deltaY > 0
          ? Math.max(oldScale / scaleBy, minScale)
          : Math.min(oldScale * scaleBy, 10);

      if (newScale === minScale) {
        setViewState({
          scale: newScale,
          x: (containerWidth - imgDim.w * newScale) / 2,
          y: (containerHeight - imgDim.h * newScale) / 2,
        });
      } else {
        const mousePointTo = {
          x: (pointer.x - viewState.x) / oldScale,
          y: (pointer.y - viewState.y) / oldScale,
        };

        setViewState({
          scale: newScale,
          x: pointer.x - mousePointTo.x * newScale,
          y: pointer.y - mousePointTo.y * newScale,
        });
      }
    },
    [viewState, imgDim, containerWidth, containerHeight]
  );

  const finalizePolygon = useCallback(() => {
    const pts = store.currentPolygonPoints;
    if (pts.length > 2) {
      let minX = pts[0].x,
        maxX = pts[0].x,
        minY = pts[0].y,
        maxY = pts[0].y;
      pts.forEach((p) => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      });
      const newAnnotation: Annotation = {
        id: crypto.randomUUID(),
        type: "polygon",
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        points: pts,
        label: store.activeClassLabel.name,
        color: store.activeClassLabel.color,
      };
      store.addAnnotation(newAnnotation);
    }
    store.clearCurrentPolygon();
  }, [store]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        store.clearCurrentPolygon();
      }
      if (e.code === "Enter") {
        finalizePolygon();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [store, finalizePolygon]);

  const handleDragMoveGroup = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>, ann: Annotation) => {
      const node = e.target;
      // Sekarang node.x() ADALAH posisi x yang sebenarnya
      const newX = Math.max(0, Math.min(node.x(), imgDim.w - ann.width));
      const newY = Math.max(0, Math.min(node.y(), imgDim.h - ann.height));
      node.x(newX);
      node.y(newY);
    },
    [imgDim.w, imgDim.h]
  );

  const handleDragEndGroup = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>, annotationId: string) => {
      const node = e.target;
      // Ambil posisi baru grup secara absolut
      store.updateAnnotation(annotationId, {
        x: node.x(),
        y: node.y(),
      });
    },
    [store]
  );

  const handlePolygonPointDrag = useCallback(
    (ann: Annotation, pointIndex: number, newPoint: { x: number; y: number }) => {
      const newPoints = (ann.points ?? []).map((p, i) =>
        i === pointIndex ? newPoint : p,
      );
      // Recalculate bounding box from updated points
      let minX = newPoints[0].x, maxX = newPoints[0].x;
      let minY = newPoints[0].y, maxY = newPoints[0].y;
      newPoints.forEach((p) => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      });
      store.updateAnnotation(ann.id, {
        points: newPoints,
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      });
    },
    [store],
  );

  // ── Mouse handlers ──
  const handleMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!loadedImage) return;

    const target = e.target;
    const parent = target.getParent();
    if (parent && parent.className === "Transformer") return;

    if (e.evt.button === 1 || e.evt.button === 2 || (e.evt.button === 0 && isSpaceDown)) {
      setIsPanning(true);
      setPanStart({ x: e.evt.clientX - viewState.x, y: e.evt.clientY - viewState.y });
      return;
    }
    if (e.evt.button !== 0) return;

    const stage = e.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;
    const imgPos = stageToImage(pointer.x, pointer.y);

    let curr: Konva.Node | null = e.target;
    let foundId: string | null = null;

    while (curr && curr !== stage) {
      if (curr.name() === "annotation-group" && curr.id()) {
        foundId = curr.id();
        break;
      }
      curr = curr.getParent();
    }

    if (!store.isForceCreateMode) {
      if (foundId) {
        store.setSelectedAnnotation(foundId);
      } else {
        store.setSelectedAnnotation(null);
      }
      return; 
    }

      if (store.isForceCreateMode && store.activeClassLabel.name) {
        store.setSelectedAnnotation(null);

        if (store.drawingMode === "polygon") {
          const pts = store.currentPolygonPoints;
          if (pts.length > 0) {
            const dx = imgPos.x - pts[0].x;
            const dy = imgPos.y - pts[0].y;
            if (Math.sqrt(dx * dx + dy * dy) * viewState.scale < 10) {
              finalizePolygon();
              return;
            }
          }
          store.addPolygonPoint(imgPos);
        } else {
          setDrawStart(imgPos);
          setDrawingRect({ x: imgPos.x, y: imgPos.y, width: 0, height: 0 });
          setIsDrawing(true);
        }
      }
    },
    [loadedImage, store, stageToImage, viewState, isSpaceDown, finalizePolygon]
  );

  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (isPanning && panStart) {
        setViewState((prev) => ({
          ...prev,
          x: e.evt.clientX - panStart.x,
          y: e.evt.clientY - panStart.y,
        }));
        return;
      }

      const pointer = e.target.getStage()?.getPointerPosition();
      if (!pointer) return;

      // Update crosshair (in stage coordinates)
      setCrosshairPos({ x: pointer.x, y: pointer.y });

      // Update drawing rect
      if (isDrawing && drawStart) {
        const imgPos = stageToImage(pointer.x, pointer.y);
        setDrawingRect({
          x: Math.min(drawStart.x, imgPos.x),
          y: Math.min(drawStart.y, imgPos.y),
          width: Math.abs(imgPos.x - drawStart.x),
          height: Math.abs(imgPos.y - drawStart.y),
        });
      }
    },
    [isDrawing, drawStart, stageToImage, isPanning, panStart],
  );

  const handleMouseUp = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (isPanning) {
        setIsPanning(false);
        setPanStart(null);
        return;
      }

      if (store.drawingMode === "polygon") return;

      if (isDrawing && drawingRect) {
        if (drawingRect.width > 5 && drawingRect.height > 5) {
          const newAnnotation: Annotation = {
            id: crypto.randomUUID(),
            x: drawingRect.x,
            y: drawingRect.y,
            width: drawingRect.width,
            height: drawingRect.height,
            label: store.activeClassLabel.name,
            color: store.activeClassLabel.color,
          };
          store.addAnnotation(newAnnotation);
        }
      }
      setIsDrawing(false);
      setDrawStart(null);
      setDrawingRect(null);
    },
    [isDrawing, drawingRect, store, isPanning],
  );

  const handleMouseLeave = useCallback(() => {
    setCrosshairPos(null);
    setIsPanning(false);
    setPanStart(null);
  }, []);

  const handleTransformEnd = useCallback(
    (e: Konva.KonvaEventObject<Event>, annotationId: string, ann: Annotation) => {
      const node = e.target;
      const sx = node.scaleX();
      const sy = node.scaleY();

      const newX = ann.x + node.x();
      const newY = ann.y + node.y();
      const newW = Math.max(5, ann.width * sx);
      const newH = Math.max(5, ann.height * sy);

      node.setAttrs({
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
      });

      store.updateAnnotation(annotationId, {
        x: newX,
        y: newY,
        width: newW,
        height: newH,
      });
    },
    [store]
  );

  const showCrosshair =
    !isPanning &&
    !isSpaceDown &&
    crosshairPos &&
    crosshairPos.x >= imgBounds.left &&
    crosshairPos.x <= imgBounds.right &&
    crosshairPos.y >= imgBounds.top &&
    crosshairPos.y <= imgBounds.bottom;

  if (imageStatus === "loading" || imgDim.w === 0 || imgDim.h === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-muted-foreground">Loading image…</span>
        </div>
      </div>
    );
  }

  if (imageStatus === "error") {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <span className="text-xs text-destructive">Failed to load image</span>
      </div>
    );
  }

  return (
    <Stage
      ref={stageRef}
      width={containerWidth}
      height={containerHeight}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onWheel={handleWheel}
      onContextMenu={(e) => e.evt.preventDefault()}
      style={{
        cursor: isPanning
          ? "grabbing"
          : isSpaceDown
            ? "grab"
            : showCrosshair
              ? "none"
              : "default",
      }}
    >
      <Layer>
        <Group
          x={viewState.x}
          y={viewState.y}
          scaleX={viewState.scale}
          scaleY={viewState.scale}
        >
          {loadedImage && (
            <KonvaImage
              image={loadedImage}
              width={imgDim.w}
              height={imgDim.h}
              name="background-image"
            />
          )}

          {annotations
            .filter((ann) => !store.hiddenClasses.includes(ann.label))
            .map((ann) =>
              ann.type === "polygon" ? (
                <AnnotationPolygon
                  key={ann.id}
                  annotation={ann}
                  dynamicColor={
                    classColorMap.get(ann.label) || ann.color || "#FFFFFF"
                  }
                  isSelected={ann.id === store.selectedAnnotationId}
                  scale={viewState.scale}
                  showLabels={store.showLabels}
                  imgDim={imgDim}
                  onDragMove={handleDragMoveGroup}
                  onDragEnd={handleDragEndGroup}
                  onTransformEnd={(e) => handleTransformEnd(e, ann.id, ann)}
                  onSelect={() => store.setSelectedAnnotation(ann.id)}
                  onPointDrag={(ptIdx, newPt) =>
                    handlePolygonPointDrag(ann, ptIdx, newPt)
                  }
                />
              ) : (
                <AnnotationRect
                  key={ann.id}
                  annotation={ann}
                  dynamicColor={
                    classColorMap.get(ann.label) || ann.color || "#FFFFFF"
                  }
                  isSelected={ann.id === store.selectedAnnotationId}
                  scale={viewState.scale}
                  showLabels={store.showLabels}
                  onDragMove={handleDragMoveGroup}
                  onDragEnd={handleDragEndGroup}
                  onSelect={() => store.setSelectedAnnotation(ann.id)}
                  onTransformEnd={(e) => handleTransformEnd(e, ann.id, ann)}
                />
              ),
            )}

          {/* Active Polygon drawing */}
          {store.drawingMode === "polygon" &&
            store.currentPolygonPoints.length > 0 && (
              <Group>
                <Line
                  points={store.currentPolygonPoints.flatMap((p) => [p.x, p.y])}
                  stroke={store.activeClassLabel.color}
                  strokeWidth={2 / viewState.scale}
                  strokeScaleEnabled={false}
                  listening={false}
                />
                {crosshairPos && (
                  <Line
                    points={[
                      store.currentPolygonPoints[
                        store.currentPolygonPoints.length - 1
                      ].x,
                      store.currentPolygonPoints[
                        store.currentPolygonPoints.length - 1
                      ].y,
                      stageToImage(crosshairPos.x, crosshairPos.y).x,
                      stageToImage(crosshairPos.x, crosshairPos.y).y,
                    ]}
                    stroke={store.activeClassLabel.color}
                    strokeWidth={2 / viewState.scale}
                    dash={[6 / viewState.scale, 4 / viewState.scale]}
                    strokeScaleEnabled={false}
                    listening={false}
                  />
                )}

                {/* Draggable handles for each polygon point */}
                {store.currentPolygonPoints.map((pt, idx) => {
                  const isFirst = idx === 0;
                  const handleRadius = (isFirst ? 7 : 5) / viewState.scale;
                  return (
                    <Circle
                      key={idx}
                      x={pt.x}
                      y={pt.y}
                      radius={handleRadius}
                      fill={isFirst ? store.activeClassLabel.color : "#ffffff"}
                      stroke={store.activeClassLabel.color}
                      strokeWidth={2 / viewState.scale}
                      strokeScaleEnabled={false}
                      draggable
                      // Only non-first points block bubble — first point must let
                      // mousedown reach the stage so the "close polygon" logic fires.
                      onMouseDown={(e) => {
                        if (!isFirst) e.cancelBubble = true;
                      }}
                      onDragMove={(e) => {
                        // Clamp to image bounds while dragging
                        const pos = e.target.position();
                        e.target.x(Math.max(0, Math.min(pos.x, imgDim.w)));
                        e.target.y(Math.max(0, Math.min(pos.y, imgDim.h)));
                      }}
                      onDragEnd={(e) => {
                        e.cancelBubble = true;
                        const pos = e.target.position();
                        const newX = Math.max(0, Math.min(pos.x, imgDim.w));
                        const newY = Math.max(0, Math.min(pos.y, imgDim.h));
                        store.updatePolygonPoint(idx, { x: newX, y: newY });
                      }}
                      // Cursor hint
                      onMouseEnter={(e) => {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = "move";
                      }}
                      onMouseLeave={(e) => {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = "none";
                      }}
                    />
                  );
                })}
              </Group>
            )}

          {isDrawing &&
            drawingRect &&
            drawingRect.width > 0 &&
            drawingRect.height > 0 && (
              <Rect
                x={drawingRect.x}
                y={drawingRect.y}
                width={drawingRect.width}
                height={drawingRect.height}
                fill={store.activeClassLabel.color + "26"}
                stroke={store.activeClassLabel.color}
                strokeWidth={2}
                strokeScaleEnabled={false}
                dash={[6 / viewState.scale, 4 / viewState.scale]}
              />
            )}

          <Transformer
            ref={transformerRef}
            flipEnabled={false}
            rotateEnabled={false}
            borderStroke="#fff"
            borderStrokeWidth={1}
            anchorFill="#fff"
            anchorStroke="#333"
            anchorSize={8}
            anchorCornerRadius={0}
            padding={0}
          />
        </Group>

        {showCrosshair && (
          <>
            <Line
              points={[
                crosshairPos.x,
                imgBounds.top,
                crosshairPos.x,
                imgBounds.bottom,
              ]}
              stroke="rgba(255,255,255,0.6)"
              strokeWidth={1}
              dash={[4, 4]}
              listening={false}
            />
            <Line
              points={[
                imgBounds.left,
                crosshairPos.y,
                imgBounds.right,
                crosshairPos.y,
              ]}
              stroke="rgba(255,255,255,0.6)"
              strokeWidth={1}
              dash={[4, 4]}
              listening={false}
            />
            <Label
              x={crosshairPos.x + 12}
              y={crosshairPos.y + 12}
              listening={false}
            >
              <Tag fill="rgba(0,0,0,0.75)" />
              <Text
                text={`${Math.round((crosshairPos.x - imgBounds.left) / viewState.scale)} , ${Math.round((crosshairPos.y - imgBounds.top) / viewState.scale)}`}
                fontSize={10}
                fill="#fff"
                fontFamily="monospace"
                padding={3}
              />
            </Label>
          </>
        )}
      </Layer>
    </Stage>
  );
}

interface AnnotationRectProps {
  annotation: Annotation;
  dynamicColor: string;
  isSelected: boolean;
  scale: number;
  showLabels: boolean;
  onDragMove: (e: Konva.KonvaEventObject<DragEvent>, ann: Annotation) => void;
  onDragEnd: (
    e: Konva.KonvaEventObject<DragEvent>,
    annotationId: string,
    ann: Annotation,
  ) => void;
  onTransformEnd: (
    e: Konva.KonvaEventObject<Event>,
    annotationId: string,
    ann: Annotation,
  ) => void;
  onSelect: () => void;
}

function AnnotationRect({
  annotation: ann,
  dynamicColor,
  isSelected,
  scale,
  showLabels,
  onSelect,
  onDragMove,
  onDragEnd,
  onTransformEnd,
}: AnnotationRectProps) {
  const [isResizing, setIsResizing] = useState(false);
  
  // Hitung ukuran label agar proporsional dengan zoom
  const labelFontSize = Math.max(10, 12 / scale);
  const labelPadding = 3 / scale;
  const labelOffset = labelFontSize + (labelPadding * 2) + (4 / scale);

  return (
    <Group
      id={ann.id}
      name="annotation-group"
      x={ann.x}
      y={ann.y}
      draggable={isSelected && !isResizing}
      onClick={onSelect}
      onTap={onSelect}
      onDragMove={(e) => onDragMove(e, ann)}
      onDragEnd={(e) => onDragEnd(e, ann.id, ann)}
    >

      {showLabels && !isResizing && (
        <Label x={0} y={-labelOffset} listening={false}>
          <Tag fill={dynamicColor} />
          <Text
            text={ann.label}
            fontSize={labelFontSize}
            fill="#000"
            fontFamily="monospace"
            padding={labelPadding}
          />
        </Label>
      )}

      <Rect
        id={`${ann.id}-shape`}
        x={0}
        y={0}
        width={ann.width}
        height={ann.height}
        fill={dynamicColor + (isSelected ? "33" : "1A")}
        stroke={dynamicColor}
        strokeWidth={isSelected ? 2 : 1.5}
        strokeScaleEnabled={false}
        onTransformStart={() => setIsResizing(true)}
        onTransformEnd={(e) => {
          setIsResizing(false);
          onTransformEnd(e, ann.id, ann);
        }}
      />
    </Group>
  );
}

interface AnnotationPolygonProps {
  annotation: Annotation;
  dynamicColor: string;
  isSelected: boolean;
  scale: number;
  showLabels: boolean;
  imgDim: { w: number; h: number };
  onDragMove: (e: Konva.KonvaEventObject<DragEvent>, ann: Annotation) => void;
  onDragEnd: (
    e: Konva.KonvaEventObject<DragEvent>,
    annotationId: string,
    ann: Annotation,
  ) => void;
  onTransformEnd: (
    e: Konva.KonvaEventObject<Event>,
    annotationId: string,
    ann: Annotation,
  ) => void;
  onSelect: () => void;
  onPointDrag: (pointIndex: number, newPoint: { x: number; y: number }) => void;
}

function AnnotationPolygon({
  annotation: ann,
  dynamicColor,
  isSelected,
  scale,
  showLabels,
  imgDim,
  onDragMove,
  onDragEnd,
  onTransformEnd,
  onSelect,
  onPointDrag,
}: AnnotationPolygonProps) {
  const groupRef = useRef<Konva.Group>(null);
  const [isDraggingPoint, setIsDraggingPoint] = useState(false);

  const labelFontSize = Math.max(10, 12 / scale);
  const labelPadding = 3 / scale;
  const flatPoints = ann.points?.flatMap((p) => [p.x, p.y]) || [];

  return (
    <>
      <Group
        ref={groupRef}
        id={ann.id}
        name="annotation-rect"
        draggable={isSelected && !isDraggingPoint}
        onClick={onSelect}
        onTap={onSelect}
        onDragMove={(e) => onDragMove(e, ann)}
        onDragEnd={(e) => onDragEnd(e, ann.id, ann)}
        onTransformEnd={(e) => onTransformEnd(e, ann.id, ann)}
      >
        <Rect
          x={ann.x}
          y={ann.y}
          width={ann.width}
          height={ann.height}
          fill="transparent"
        />

        {showLabels && (
          <Label
            x={ann.x}
            y={ann.y - (labelFontSize + labelPadding * 2 + 2 / scale)}
            listening={false}
          >
            <Tag fill={dynamicColor} />
            <Text
              text={ann.label}
              fontSize={labelFontSize}
              fill="#000"
              fontFamily="monospace"
              padding={labelPadding}
            />
          </Label>
        )}

        <Line
          name="annotation-rect"
          points={flatPoints}
          closed={true}
          fill={dynamicColor + (isSelected ? "33" : "1A")}
          stroke={dynamicColor}
          strokeWidth={isSelected ? 2.5 : 1.5}
          strokeScaleEnabled={false}
          hitStrokeWidth={Math.max(10, 10 / scale)}
        />

        {/* Draggable point handles — visible only when selected */}
        {isSelected &&
          ann.points?.map((pt, idx) => (
            <Circle
              key={`handle-${idx}`}
              x={pt.x}
              y={pt.y}
              radius={5 / scale}
              fill="#ffffff"
              stroke={dynamicColor}
              strokeWidth={1.5 / scale}
              strokeScaleEnabled={false}
              draggable
              onMouseDown={(e) => { e.cancelBubble = true; }}
              onDragStart={(e) => {
                e.cancelBubble = true;
                setIsDraggingPoint(true);
              }}
              onDragMove={(e) => {
                e.cancelBubble = true;
                const gx = groupRef.current?.x() ?? 0;
                const gy = groupRef.current?.y() ?? 0;
                const absX = gx + e.target.x();
                const absY = gy + e.target.y();
                e.target.x(Math.max(0, Math.min(absX, imgDim.w)) - gx);
                e.target.y(Math.max(0, Math.min(absY, imgDim.h)) - gy);
              }}
              onDragEnd={(e) => {
                e.cancelBubble = true;
                setIsDraggingPoint(false);
                const gx = groupRef.current?.x() ?? 0;
                const gy = groupRef.current?.y() ?? 0;
                const absX = Math.max(0, Math.min(gx + e.target.x(), imgDim.w));
                const absY = Math.max(0, Math.min(gy + e.target.y(), imgDim.h));
                onPointDrag(idx, { x: absX, y: absY });
              }}
              onMouseEnter={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = "move";
              }}
              onMouseLeave={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = "default";
              }}
            />
          ))}
      </Group>
    </>
  );
}