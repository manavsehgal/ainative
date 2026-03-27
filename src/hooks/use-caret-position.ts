import { useCallback, useRef } from "react";

interface CaretCoordinates {
  top: number;
  left: number;
  height: number;
}

const MIRROR_STYLES = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "letterSpacing",
  "lineHeight",
  "textTransform",
  "wordSpacing",
  "textIndent",
  "whiteSpace",
  "wordWrap",
  "overflowWrap",
  "tabSize",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "boxSizing",
] as const;

/**
 * Returns a function that computes the pixel coordinates of the caret
 * inside a <textarea>, relative to the viewport.
 *
 * Uses a hidden mirror <div> that replicates the textarea's text metrics.
 * A probe <span> is placed at the caret position and measured.
 */
export function useCaretPosition() {
  const mirrorRef = useRef<HTMLDivElement | null>(null);

  const getCaretCoordinates = useCallback(
    (textarea: HTMLTextAreaElement, caretIndex: number): CaretCoordinates | null => {
      if (!textarea) return null;

      // Lazily create the mirror div
      if (!mirrorRef.current) {
        const mirror = document.createElement("div");
        mirror.style.position = "absolute";
        mirror.style.visibility = "hidden";
        mirror.style.overflow = "hidden";
        mirror.style.height = "0";
        mirror.style.width = "0";
        mirror.style.top = "0";
        mirror.style.left = "0";
        mirror.setAttribute("aria-hidden", "true");
        document.body.appendChild(mirror);
        mirrorRef.current = mirror;
      }

      const mirror = mirrorRef.current;
      const computed = window.getComputedStyle(textarea);

      // Sync styles
      for (const prop of MIRROR_STYLES) {
        const cssProperty = prop.replace(/([A-Z])/g, "-$1").toLowerCase();
          mirror.style.setProperty(cssProperty, computed.getPropertyValue(cssProperty));
      }
      mirror.style.width = `${textarea.clientWidth}px`;
      mirror.style.height = "auto";
      mirror.style.overflow = "auto";
      mirror.style.visibility = "hidden";
      mirror.style.position = "absolute";

      // Build content with probe span
      const textBefore = textarea.value.substring(0, caretIndex);
      const textNode = document.createTextNode(textBefore);
      const probe = document.createElement("span");
      probe.textContent = "\u200b"; // zero-width space

      mirror.textContent = "";
      mirror.appendChild(textNode);
      mirror.appendChild(probe);

      // Account for scroll position
      mirror.scrollTop = textarea.scrollTop;
      mirror.scrollLeft = textarea.scrollLeft;

      const probeRect = probe.getBoundingClientRect();
      const textareaRect = textarea.getBoundingClientRect();

      return {
        top: textareaRect.top + (probeRect.top - mirror.getBoundingClientRect().top) - textarea.scrollTop,
        left: textareaRect.left + (probeRect.left - mirror.getBoundingClientRect().left) - textarea.scrollLeft,
        height: probeRect.height || parseInt(computed.lineHeight) || parseInt(computed.fontSize) * 1.2,
      };
    },
    []
  );

  return getCaretCoordinates;
}
