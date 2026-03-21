---
title: Document Manager
status: completed
priority: P2
milestone: post-mvp
dependencies:
  - file-attachment-data-layer
  - document-preprocessing
---

# Document Manager

## Description

A dedicated `/documents` route with a full file browser and management UI. Users can view, search, filter, preview, upload, and manage all documents across the platform. Documents can be linked or unlinked from tasks and projects.

## User Story

As a user, I want a central place to browse and manage all documents in Stagent, so I can find files, see their processing status, preview content, and organize them across tasks and projects.

## Technical Approach

### Route & Navigation

- New `/documents` route accessible from sidebar
- Server Component page querying documents table directly
- Sidebar navigation item with file icon

### Views

- **Table view**: sortable columns — name, type icon, size, linked task/project, date, status
- **Grid view**: thumbnail/icon cards (toggle between table/grid)
- **Document detail Sheet**: preview, metadata, linked task/project, extracted text

### Features

- **Filter**: by project, category, date range, processing status
- **Search**: by filename and extracted text content
- **Upload**: independent document upload (not tied to task creation)
- **Bulk operations**: multi-select with bulk delete
- **Link management**: link/unlink documents to tasks and projects
- **Preview**: images (inline), PDFs (embedded), text/markdown (rendered)

### API

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/documents` | GET | List documents with filters |
| `/api/documents/[id]` | PATCH | Update document metadata (link/unlink) |
| `/api/documents/[id]` | DELETE | Delete document + file |

## Key Files

| File | Purpose |
|------|---------|
| `src/app/documents/page.tsx` | Server Component page |
| `src/components/documents/document-table.tsx` | Table/grid view |
| `src/components/documents/document-filters.tsx` | Filter controls |
| `src/components/documents/document-detail-sheet.tsx` | Detail side panel |
| `src/components/documents/document-preview.tsx` | Content preview renderer |
| `src/components/documents/document-upload-button.tsx` | Standalone upload |
| `src/components/shared/app-sidebar.tsx` | Add Documents nav item |

## Acceptance Criteria

- [ ] `/documents` route accessible from sidebar navigation
- [ ] Table/grid view showing: name, type icon, size, linked task/project, date, status
- [ ] Filter by: project, category, date range, processing status
- [ ] Search by filename and extracted text content
- [ ] Document detail Sheet: preview, metadata, linked task/project, extracted text
- [ ] Preview support: images (inline), PDFs (embedded), text/markdown (rendered)
- [ ] Upload documents independently (not just during task creation)
- [ ] Bulk delete with multi-select
- [ ] Link/unlink documents to tasks and projects
- [ ] Empty state and skeleton loading patterns

## Scope Boundaries

**Included:**
- Full document browser with table/grid views
- Search, filter, and sort capabilities
- Document preview for common formats
- Standalone upload
- Bulk operations
- Link management

**Excluded:**
- Drag-and-drop reordering
- Folder/directory hierarchy
- Document versioning (see document-output-generation)
- Collaborative annotations
- Cloud storage integration
