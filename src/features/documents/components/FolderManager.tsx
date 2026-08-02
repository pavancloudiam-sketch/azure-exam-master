import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  ConfirmDialog,
  PrimaryButton,
  SecondaryButton,
  SurfaceCard,
  TextField,
  notify,
} from "@/features/shared/components/ui";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/features/shared/components/ui/form-fields";

import type { DocumentFolder } from "../types";
import { archiveFolder, createFolder, restoreFolder, updateFolder } from "../services/document-service";

export function FolderManager({
  folders,
  selectedFolderId,
  onSelectFolder,
}: {
  folders: DocumentFolder[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [editing, setEditing] = React.useState<DocumentFolder | null>(null);
  const [pendingArchive, setPendingArchive] = React.useState<DocumentFolder | null>(null);

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["document-folders"] });

  const saveMutation = useMutation({
    mutationFn: () =>
      editing
        ? updateFolder(editing.id, { name: name.trim(), description: description.trim() || null })
        : createFolder({ name: name.trim(), description: description.trim() || null }),
    onSuccess: () => {
      notify.success(editing ? "Folder updated." : "Folder created.");
      setName("");
      setDescription("");
      setEditing(null);
      invalidate();
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const archiveMutation = useMutation({
    mutationFn: (folder: DocumentFolder) =>
      folder.archived ? restoreFolder(folder.id) : archiveFolder(folder.id),
    onSuccess: (_data, folder) => {
      notify.success(folder.archived ? "Folder restored." : "Folder archived.");
      invalidate();
    },
    onError: (error: Error) => notify.error(error.message),
  });

  return (
    <SurfaceCard className="space-y-4 p-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Folders</h2>
        <p className="mt-1 text-xs text-muted-foreground">Organise documents into folders.</p>
      </div>

      <div className="space-y-1">
        <button
          type="button"
          onClick={() => onSelectFolder(null)}
          className={`w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
            selectedFolderId === null ? "bg-accent/10 font-medium text-accent-ink" : "hover:bg-surface"
          }`}
        >
          All documents
        </button>
        {folders.map((folder) => (
          <div key={folder.id} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onSelectFolder(folder.id)}
              className={`flex-1 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                selectedFolderId === folder.id ? "bg-accent/10 font-medium text-accent-ink" : "hover:bg-surface"
              } ${folder.archived ? "text-muted-foreground italic" : ""}`}
            >
              {folder.name}
              {folder.archived ? " (archived)" : ""}
            </button>
            <SecondaryButton
              type="button"
              size="sm"
              onClick={() => {
                setEditing(folder);
                setName(folder.name);
                setDescription(folder.description ?? "");
              }}
            >
              Edit
            </SecondaryButton>
            <SecondaryButton type="button" size="sm" onClick={() => setPendingArchive(folder)}>
              {folder.archived ? "Restore" : "Archive"}
            </SecondaryButton>
          </div>
        ))}
      </div>

      <form
        className="space-y-3 border-t border-border pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          saveMutation.mutate();
        }}
      >
        <TextField
          id="folder-name"
          label={editing ? "Rename folder" : "New folder"}
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
        <Field id="folder-description" label="Description">
          {({ id, describedBy }) => (
            <Textarea
              id={id}
              aria-describedby={describedBy}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
            />
          )}
        </Field>
        <div className="flex gap-2">
          <PrimaryButton type="submit" loading={saveMutation.isPending} disabled={!name.trim()}>
            {editing ? "Save" : "Create folder"}
          </PrimaryButton>
          {editing ? (
            <SecondaryButton
              type="button"
              onClick={() => {
                setEditing(null);
                setName("");
                setDescription("");
              }}
            >
              Cancel
            </SecondaryButton>
          ) : null}
        </div>
      </form>

      <ConfirmDialog
        open={Boolean(pendingArchive)}
        onOpenChange={(open) => !open && setPendingArchive(null)}
        title={pendingArchive?.archived ? "Restore folder?" : "Archive folder?"}
        description={
          pendingArchive?.archived
            ? "This folder will appear in the list again."
            : "Documents inside remain accessible directly but the folder is hidden from new uploads."
        }
        confirmLabel={pendingArchive?.archived ? "Restore" : "Archive"}
        onConfirm={() => {
          if (pendingArchive) archiveMutation.mutate(pendingArchive);
          setPendingArchive(null);
        }}
      />
    </SurfaceCard>
  );
}
