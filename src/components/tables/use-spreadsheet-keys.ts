import { useCallback, useEffect, useState } from "react";

export interface CellPosition {
  rowIndex: number;
  colIndex: number;
}

export type SpreadsheetMode = "idle" | "navigating" | "editing";

interface UseSpreadsheetKeysOptions {
  rowCount: number;
  colCount: number;
  onStartEdit: (pos: CellPosition) => void;
  onConfirmEdit: () => void;
  onCancelEdit: () => void;
  onClearCell: (pos: CellPosition) => void;
  onAddRow: () => void;
}

interface UseSpreadsheetKeysReturn {
  activeCell: CellPosition | null;
  mode: SpreadsheetMode;
  setActiveCell: (pos: CellPosition | null) => void;
  setMode: (mode: SpreadsheetMode) => void;
  handleCellClick: (pos: CellPosition) => void;
  handleCellDoubleClick: (pos: CellPosition) => void;
}

export function useSpreadsheetKeys(
  opts: UseSpreadsheetKeysOptions
): UseSpreadsheetKeysReturn {
  const [activeCell, setActiveCell] = useState<CellPosition | null>(null);
  const [mode, setMode] = useState<SpreadsheetMode>("idle");

  const { rowCount, colCount, onStartEdit, onConfirmEdit, onCancelEdit, onClearCell, onAddRow } = opts;

  const moveTo = useCallback(
    (pos: CellPosition) => {
      const clamped: CellPosition = {
        rowIndex: Math.max(0, Math.min(pos.rowIndex, rowCount - 1)),
        colIndex: Math.max(0, Math.min(pos.colIndex, colCount - 1)),
      };
      setActiveCell(clamped);
    },
    [rowCount, colCount]
  );

  const handleCellClick = useCallback(
    (pos: CellPosition) => {
      setActiveCell(pos);
      if (mode === "editing") {
        onConfirmEdit();
      }
      setMode("navigating");
    },
    [mode, onConfirmEdit]
  );

  const handleCellDoubleClick = useCallback(
    (pos: CellPosition) => {
      setActiveCell(pos);
      setMode("editing");
      onStartEdit(pos);
    },
    [onStartEdit]
  );

  useEffect(() => {
    if (!activeCell) return;

    function handleKeyDown(e: KeyboardEvent) {
      // Don't interfere with inputs outside the spreadsheet
      const target = e.target as HTMLElement;
      const isInSheet = target.closest("[data-spreadsheet]");
      const isInInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";

      if (mode === "editing") {
        if (e.key === "Escape") {
          e.preventDefault();
          onCancelEdit();
          setMode("navigating");
        } else if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          onConfirmEdit();
          setMode("navigating");
          // Move down after confirm
          if (activeCell) {
            if (activeCell.rowIndex < rowCount - 1) {
              moveTo({ rowIndex: activeCell.rowIndex + 1, colIndex: activeCell.colIndex });
            }
          }
        } else if (e.key === "Tab") {
          e.preventDefault();
          onConfirmEdit();
          setMode("navigating");
          // Move right (or wrap to next row)
          if (activeCell) {
            if (activeCell.colIndex < colCount - 1) {
              moveTo({ rowIndex: activeCell.rowIndex, colIndex: activeCell.colIndex + 1 });
            } else if (activeCell.rowIndex < rowCount - 1) {
              moveTo({ rowIndex: activeCell.rowIndex + 1, colIndex: 0 });
            }
          }
        }
        return;
      }

      // Navigating mode — only handle if we're in the spreadsheet area
      if (!isInSheet && isInInput) return;

      if (mode === "navigating" && activeCell) {
        switch (e.key) {
          case "ArrowUp":
            e.preventDefault();
            moveTo({ rowIndex: activeCell.rowIndex - 1, colIndex: activeCell.colIndex });
            break;
          case "ArrowDown":
            e.preventDefault();
            moveTo({ rowIndex: activeCell.rowIndex + 1, colIndex: activeCell.colIndex });
            break;
          case "ArrowLeft":
            e.preventDefault();
            moveTo({ rowIndex: activeCell.rowIndex, colIndex: activeCell.colIndex - 1 });
            break;
          case "ArrowRight":
            e.preventDefault();
            moveTo({ rowIndex: activeCell.rowIndex, colIndex: activeCell.colIndex + 1 });
            break;
          case "Enter":
          case "F2":
            e.preventDefault();
            setMode("editing");
            onStartEdit(activeCell);
            break;
          case "Delete":
          case "Backspace":
            e.preventDefault();
            onClearCell(activeCell);
            break;
          case "Tab":
            e.preventDefault();
            if (activeCell.colIndex < colCount - 1) {
              moveTo({ rowIndex: activeCell.rowIndex, colIndex: activeCell.colIndex + 1 });
            } else if (activeCell.rowIndex < rowCount - 1) {
              moveTo({ rowIndex: activeCell.rowIndex + 1, colIndex: 0 });
            }
            break;
          default:
            // Start editing on printable character
            if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
              setMode("editing");
              onStartEdit(activeCell);
            }
            break;
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activeCell, mode, rowCount, colCount, moveTo, onStartEdit, onConfirmEdit, onCancelEdit, onClearCell, onAddRow]);

  return {
    activeCell,
    mode,
    setActiveCell,
    setMode,
    handleCellClick,
    handleCellDoubleClick,
  };
}
