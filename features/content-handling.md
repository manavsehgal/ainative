---
title: Rich Content Handling
status: completed
priority: P2
milestone: mvp
source: ideas/mvp-vision.md
dependencies: [task-board, agent-integration]
---

# Rich Content Handling

## Description

Tasks can consume and produce rich content beyond plain text. Inputs include images, documents, data files, and URLs. Outputs include generated documents, code, reports, and working applications. The UX handles previewing, downloading, and iterating on these outputs directly within the task view.

This feature adds content attachment to task creation and output rendering to task completion.

## User Story

As a user, I want to attach files and URLs to tasks and preview agent outputs directly in ainative, so that I can work with rich content without switching to external tools.

## Technical Approach

- **Input**: File upload component in the task create dialog — stores files in `~/.ainative/uploads/`
- **Output**: Agent results stored in `tasks.result` as JSON with content type metadata
- **Preview**: Render previews based on content type:
  - Text/Markdown: rendered inline with `@tailwindcss/typography`
  - Code: syntax-highlighted code block
  - Images: inline preview with download link
  - Other files: download link with file metadata
- **Storage**: Local filesystem at `~/.ainative/uploads/` and `~/.ainative/outputs/`

### Components

- `FileUpload` — drag-and-drop file upload in task create dialog
- `ContentPreview` — type-aware preview renderer for task outputs
- `OutputDownload` — download button for generated files

### API Routes

- `POST /api/uploads` — upload a file, returns a reference ID
- `GET /api/uploads/[id]` — serve an uploaded file
- `GET /api/tasks/[id]/output` — get task output with content metadata

## Acceptance Criteria

- [ ] Users can attach files to tasks during creation
- [ ] Attached files are stored in `~/.ainative/uploads/` and linked to the task
- [ ] Task detail view shows attached files with appropriate previews
- [ ] Agent outputs (text, code, files) are rendered with type-aware previews
- [ ] Users can download output files directly from the task view
- [ ] Markdown output renders with proper typography
- [ ] Code output renders with syntax highlighting
- [x] Markdown rendering uses `react-markdown` + `remark-gfm` for full GFM support (C3)
- [x] JSON.parse in ContentPreview wrapped in try/catch to prevent crashes (M4)
- [x] ContentPreview has expand/collapse button to view large outputs (M7)
- [x] File upload `fileIds` included in task creation POST payload (C2)
- [x] Icon-only buttons have `aria-label` attributes for accessibility (A2)

## Scope Boundaries

**Included:**
- File upload on task creation
- Local file storage (`~/.ainative/uploads/`, `~/.ainative/outputs/`)
- Type-aware content preview (text, markdown, code, images)
- Download capability for outputs
- File reference in task data

**Excluded (deferred to document management features):**
- File-to-task linking in database — deferred to [file-attachment-data-layer](file-attachment-data-layer.md)
- Document text extraction and format conversion — deferred to [document-preprocessing](document-preprocessing.md)
- Agent access to uploaded files — deferred to [agent-document-context](agent-document-context.md)
- Document browser and management UI — deferred to [document-manager](document-manager.md)
- Agent output file tracking — deferred to [document-output-generation](document-output-generation.md)
- Cloud storage or CDN
- File versioning
- Collaborative editing of outputs
- Video or audio preview
- Large file handling (>50MB)

## References

- Source: `ideas/mvp-vision.md` — Content Types section
- Related features: `task-board` (task detail view hosts previews), `agent-integration` (produces outputs)
