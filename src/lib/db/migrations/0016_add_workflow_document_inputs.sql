CREATE TABLE IF NOT EXISTS workflow_document_inputs (
  id TEXT PRIMARY KEY NOT NULL,
  workflow_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  step_id TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON UPDATE NO ACTION ON DELETE NO ACTION,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE INDEX IF NOT EXISTS idx_wdi_workflow ON workflow_document_inputs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_wdi_document ON workflow_document_inputs(document_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wdi_workflow_doc_step ON workflow_document_inputs(workflow_id, document_id, step_id);
