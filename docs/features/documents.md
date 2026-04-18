---
title: "Documents"
category: "feature-reference"
section: "documents"
route: "/documents"
tags: [documents, upload, preprocessing, pdf, office, text-extraction, agent-context]
features: ["document-manager", "file-attachment-data-layer", "document-preprocessing", "agent-document-context", "document-output-generation", "chat-filter-namespace", "chat-pinned-saved-searches"]
screengrabCount: 2
lastUpdated: "2026-04-15"
---

# Documents

The Document Library is where you upload, manage, and organize files that agents can reference during task execution. ainative automatically preprocesses uploaded files to extract text, making their content available as context for agents without manual copy-pasting.

## Screenshots

![Documents table view](../screengrabs/documents-list.png)
*Document library in table view showing file name, type, size, and processing status*

![Documents grid view](../screengrabs/documents-grid.png)
*Grid view displaying document thumbnails and metadata cards*

## Key Features

### Table and Grid Views
Toggle between a table view for dense scanning (file name, type, size, processing status, timestamps) and a grid view with visual cards. Both views support selection for bulk operations.

### FilterInput and Saved Searches
The `/documents` list page is the reference consumer for the shared **FilterInput** component. Type `#type:pdf` or `#scope:"legal review"` to filter by namespace — double-quoted values cleanly handle phrases with spaces. Combine filters with a free-text search, then click **Save view** in the footer to pin the combination as a saved search. Saved searches are available across surfaces (Chat, Tables, Documents) via the `⌘K` palette **Saved** group.

### Upload Dialog with Drag-and-Drop
The upload dialog accepts files via drag-and-drop or file picker. A visual indicator shows supported file types. Multiple files can be uploaded in a single batch.

### Supported File Types
ainative processes a range of document formats:
- **PDF** -- Text extraction via pdf-parse.
- **Text** -- Plain text, Markdown, code files.
- **Images** -- Metadata extraction (dimensions, format).
- **Office Documents** -- Word documents, presentations, and archives.
- **Spreadsheets** -- Excel and CSV files.

### Automatic Preprocessing
After upload, ainative automatically extracts text content from supported file types. The extracted text is stored alongside the original file, ready to be injected into agent context. Processing status is visible on each document card.

### Agent Document Context
Documents can be attached to tasks. When an agent executes a task with attached documents, the extracted text is included in the agent's context window, giving it direct access to the document content without needing file-system access.

### Document Output Generation
Agents can generate documents as output during task execution. Generated files are added to the document library automatically, linked back to the originating task.

## How To

### Upload Documents
1. Navigate to `/documents` and click "Upload."
2. Drag and drop files into the upload zone, or click to browse.
3. Select one or more files -- supported types are shown in the dialog.
4. Click "Upload" to start the process.
5. Preprocessing begins automatically -- watch the status indicator on each document.

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
