"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ScreenshotLightboxProps {
  open: boolean;
  onClose: () => void;
  imageUrl: string;
  width: number;
  height: number;
}

export function ScreenshotLightbox({
  open,
  onClose,
  imageUrl,
  width,
  height,
}: ScreenshotLightboxProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setLoaded(false);
    }
  }, [open]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((prev) => Math.max(0.5, Math.min(5, prev - e.deltaY * 0.002)));
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (zoom <= 1) return;
      setDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY };
      panStart.current = { ...pan };
    },
    [zoom, pan]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging) return;
      setPan({
        x: panStart.current.x + (e.clientX - dragStart.current.x),
        y: panStart.current.y + (e.clientY - dragStart.current.y),
      });
    },
    [dragging]
  );

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 gap-0 overflow-hidden bg-black/95 border-none">
        <VisuallyHidden>
          <DialogTitle>Screenshot Preview</DialogTitle>
        </VisuallyHidden>

        {/* Close + open-in-tab buttons */}
        <div className="absolute top-3 right-3 z-10 flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
            onClick={() => window.open(imageUrl, "_blank")}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Image container */}
        <div
          className="flex items-center justify-center w-full h-[90vh] overflow-hidden select-none"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ cursor: zoom > 1 ? (dragging ? "grabbing" : "grab") : "default" }}
        >
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-8 w-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          )}
          <img
            src={imageUrl}
            alt="Screenshot"
            className="transition-transform duration-100"
            style={{
              transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              opacity: loaded ? 1 : 0,
            }}
            onLoad={() => setLoaded(true)}
            draggable={false}
          />
        </div>

        {/* Footer metadata */}
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-4 py-2 text-xs text-white/50 flex justify-between">
          <span>{width} × {height} px</span>
          <span>Scroll to zoom · Drag to pan</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
