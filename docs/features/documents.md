---
title: "Documents"
category: "feature-reference"
section: "documents"
route: "/documents"
tags: [documents, upload, preprocessing, pdf, office, text-extraction, agent-context]
features: ["document-manager", "file-attachment-data-layer", "document-preprocessing", "agent-document-context", "document-output-generation"]
screengrabCount: 3
lastUpdated: "2026-03-21"
---

# Documents

The Document Library is where you upload, manage, and organize files that agents can reference during task execution. Stagent automatically preprocesses uploaded files to extract text, making their content available as context for agents without manual copy-pasting.

## Screenshots

![Documents table view](../screengrabs/documents-list.png)
*Document library in table view showing file name, type, size, and processing status*

![Documents grid view](../screengrabs/documents-grid.png)
*Grid view displaying document thumbnails and metadata cards*

![Document upload form](../screengrabs/documents-upload-form.png)
*Upload dialog with drag-and-drop zone and file type support indicators*

## Key Features

### Table and Grid Views
Toggle between a table view for dense scanning (file name, type, size, processing status, timestamps) and a grid view with visual cards. Both views support selection for bulk operations.

### Upload Dialog with Drag-and-Drop
The upload dialog accepts files via drag-and-drop or file picker. A visual indicator shows supported file types. Multiple files can be uploaded in a single batch.

### Supported File Types
Stagent processes a range of document formats:
- **PDF** — Text extraction via pdf-parse.
- **Text** — Plain text, Markdown, code files.
- **Images** — Metadata extraction (dimensions, format) via image-size.
- **Office Documents** — Word documents via mammoth, presentations and archives via jszip.
- **Spreadsheets** — Excel and CSV files via xlsx parser.

### Automatic Preprocessing
After upload, Stagent automatically extracts text content from supported file types. The extracted text is stored alongside the original file, ready to be injected into agent context. Processing status is visible on each document card.

### Agent Document Context
Documents can be attached to tasks. When an agent executes a task with attached documents, the extracted text is included in the agent's context window, giving it direct access to the document content without needing file-system access.

### Document Output Generation
Agents can generate documents as output during task execution. Generated files are added to the document library automatically, linked back to the originating task.

## How To

### Upload Documents
1. Navigate to `/documents` and click "Upload."
2. Drag and drop files into the upload zone, or click to browse.
3. Select one or more files — supported types are shown in the dialog.
4. Click "Upload" to start the process.
5. Preprocessing begins automatically — watch the status indicator on each document.

### Attach Documents to a Task
1. When creating or editing a task, look for the document attachment field.
2. Select one or more documents from the library.
3. The agent will receive the extracted text as part of its context when executing the task.

### Switch Between Views
1. Use the view toggle at the top of the documents page.
2. Table view is best for scanning many documents by metadata.
3. Grid view is best for visual browsing when file types include images.

### Delete Documents
1. Select one or more documents using the checkboxes.
2. Click "Delete" to remove them from the library.
3. Bulk delete is supported for cleaning up multiple files at once.

## Related
- [Projects](./projects.md)
- [Dashboard Kanban](./dashboard-kanban.md)
- [Workflows](./workflows.md)
