import { useQuery } from "@tanstack/react-query";

import { CheckboxField, SelectField, TextField, type SelectOption } from "@/features/shared/components/ui";
import { listCertifications } from "@/features/admin/services/taxonomy-service";

import {
  DOCUMENT_CATEGORY_OPTIONS,
  DOCUMENT_VISIBILITY_OPTIONS,
  type DocumentCategory,
  type DocumentVisibility,
} from "../types";

export type DocumentFilterState = {
  search: string;
  category: DocumentCategory | "all";
  visibility: DocumentVisibility | "all";
  certificationId: string;
  includeArchived: boolean;
};

export function DocumentFilters({
  value,
  onChange,
}: {
  value: DocumentFilterState;
  onChange: (value: DocumentFilterState) => void;
}) {
  const certifications = useQuery({ queryKey: ["certifications"], queryFn: listCertifications });

  const certificationOptions: SelectOption[] = [
    { value: "all", label: "All certifications" },
    ...(certifications.data ?? []).map((c) => ({ value: c.id, label: `${c.name} (${c.version})` })),
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
      <TextField
        id="document-search"
        label="Search"
        placeholder="Title or description"
        value={value.search}
        onChange={(event) => onChange({ ...value, search: event.target.value })}
      />
      <SelectField
        id="document-filter-category"
        label="Category"
        options={[{ value: "all", label: "All categories" }, ...DOCUMENT_CATEGORY_OPTIONS]}
        value={value.category}
        onValueChange={(next) => onChange({ ...value, category: next as DocumentCategory | "all" })}
      />
      <SelectField
        id="document-filter-visibility"
        label="Visibility"
        options={[{ value: "all", label: "All visibilities" }, ...DOCUMENT_VISIBILITY_OPTIONS]}
        value={value.visibility}
        onValueChange={(next) => onChange({ ...value, visibility: next as DocumentVisibility | "all" })}
      />
      <SelectField
        id="document-filter-certification"
        label="Certification"
        options={certificationOptions}
        value={value.certificationId}
        onValueChange={(next) => onChange({ ...value, certificationId: next })}
      />
      <CheckboxField
        id="document-filter-archived"
        label="Include archived"
        checked={value.includeArchived}
        onCheckedChange={(checked) => onChange({ ...value, includeArchived: checked })}
      />
    </div>
  );
}
