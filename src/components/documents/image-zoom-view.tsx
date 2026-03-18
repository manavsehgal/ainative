"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { ImageOff } from "lucide-react";

interface ImageZoomViewProps {
  src: string;
  alt: string;
}

export function ImageZoomView({ src, alt }: ImageZoomViewProps) {
  const [zoomed, setZoomed] = useState(false);
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
        <ImageOff className="h-10 w-10" />
        <p className="text-sm">Image unavailable</p>
        <a
          href={src}
          download
          className="text-xs underline underline-offset-2 hover:text-foreground"
        >
          Try downloading instead
        </a>
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-center">
        <img
          src={src}
          alt={alt}
          className="max-w-full mx-auto rounded-lg cursor-zoom-in shadow-sm"
          onClick={() => setZoomed(true)}
          onError={() => setError(true)}
        />
      </div>

      <Dialog open={zoomed} onOpenChange={setZoomed}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-2 overflow-auto">
          <DialogTitle className="sr-only">{alt}</DialogTitle>
          <img
            src={src}
            alt={alt}
            className="w-full h-full object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
