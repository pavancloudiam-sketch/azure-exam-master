# Bulk question import — file format (Phase 1B)

Admins upload question files at **Admin → Bulk import** (`/admin/import`).
Templates in CSV and Excel are downloadable from that page and contain the
header row plus three original demonstration questions.

## Content policy

Only original or properly licensed material may be imported. The format is
deliberately built around authored practice content, not copied, leaked or
proprietary examination material.

## Files accepted

- `.csv` — UTF-8, comma separated, first row is the header. A byte-order mark
  is written into the template so Excel opens it correctly.
- `.xlsx` — the first worksheet is read. The template ships a second
  `instructions` sheet, which is ignored on upload.
- Limits: 5 MB and 1,000 data rows per upload.

Header matching is case-insensitive and tolerant of spaces/hyphens
(`Question Text` becomes `question_text`). Unrecognised columns are ignored and
reported. Column order does not matter.

## Columns

| Column | Required | Accepted values | Notes |
| --- | --- | --- | --- |
| `external_id` | yes | text, 64 chars max | Your stable reference. Must be unique within the file. |
| `certification` | yes | code or name | Must already exist and be active, e.g. `ENTRA-ID`. |
| `domain` | yes | domain name | Must exist under that certification. |
| `topic` | yes | topic name | Must exist under that domain. |
| `question_type` | yes | `single_choice`, `multiple_choice`, `scenario_single_choice`, `scenario_multiple_choice` | Case-insensitive. |
| `scenario_text` | conditional | text | Required for `scenario_*` types; must be empty otherwise. |
| `question_text` | yes | text, 4000 chars max | The question stem. |
| `option_a` | yes | text | First option. |
| `option_b` | yes | text | Second option. |
| `option_c` | no | text | Optional third option. |
| `option_d` | no | text | Only when `option_c` is filled. |
| `option_e` | no | text | Only when `option_d` is filled. |
| `correct_options` | yes | option letters | See below. |
| `explanation` | no | text, 4000 chars max | Revealed to a student only after submission. |
| `difficulty` | yes | `easy`, `medium`, `hard` | Case-insensitive. |
| `point_value` | no | whole number 1-10 | Defaults to `1`. |
| `tags` | no | labels separated by a pipe, comma or semicolon | Optional grouping labels. |
| `status` | yes | `active`, `draft`, `inactive` | See below. |

### Variable option counts

Between two and five options are supported. Fill the option columns in order
and leave the unused ones empty — a gap (for example `option_c` empty while
`option_d` is filled) is rejected.

### Representing multiple correct options

`correct_options` holds one or more option letters (`A`-`E`), case-insensitive,
separated by a pipe, comma or semicolon. The pipe is preferred because it never
collides with CSV quoting.

- `single_choice` / `scenario_single_choice`: exactly one letter, e.g. `A`.
- `multiple_choice` / `scenario_multiple_choice`: two or more letters, e.g.
  `A|C`, and never every option — at least one distractor is required.

Every letter must reference a filled option column, and no letter may repeat.

### Status values

| Value | Meaning |
| --- | --- |
| `active` | Live content, deliverable to students once assigned to an exam. |
| `draft` | Imported and stored, withheld from delivery until an admin activates it. |
| `inactive` | Retired content, kept for history and never delivered. |

Nothing is deleted by an import; retirement is always a status change.

## Upload is staged, never immediate

Uploading does **not** create questions. The file is parsed and validated in
the browser, then written to two temporary tables:

- `import_batches` — one row per upload with file metadata, row counts, a
  `staged | discarded | committed | expired` status and a 24-hour `expires_at`.
- `import_staged_rows` — one row per data row with the original values (`raw`),
  the cleaned-up result (`normalized`) and any validation problems (`errors`).

Both tables are admin-only and additionally scoped to the admin who uploaded
the file. Staging an upload is recorded in the audit log as `import.staged`,
and discarding one as `import.discarded`.

Committing staged rows into the question bank is a separate step and is **not**
implemented yet.
## Duplicate detection and originality attestation

### What is compared

After a batch is staged, `scan_import_duplicates(batch_id)` compares every
valid staged row against **the AskMeExam question bank only**. No external
plagiarism-checking service is configured or contacted. Four signals are used:

| Flag | Meaning |
| --- | --- |
| `exact` | The question text matches an existing stem character for character. |
| `normalized` | The texts match after lowercasing, stripping punctuation and collapsing whitespace. |
| `near` | Trigram similarity of the normalized stems is ≥ 0.80. |
| `similar_options` | The scenario text or the order-independent answer-option fingerprint is ≥ 0.85 similar. |

Each flagged row stores up to five matches (`question_id`, truncated stem,
match type, score) in `import_staged_rows.duplicate_matches`, plus the highest
score in `duplicate_score`.

### Flags are advisory

Nothing is deleted, rejected or auto-merged. A flagged row is set to
`review_status = 'pending'` and must be explicitly resolved by an administrator
(`cleared` or `flagged` for editing) before the batch is published. Rows with
no match are `cleared` automatically.

**Automated similarity checking does not prove legal originality.** A low score
only means the text is unlike anything already stored in this instance. AskMeExam
must never be pointed at exam-dump repositories or leaked question banks;
responsibility for rights and originality rests with the importing administrator.

### Attestation

The upload confirmation requires the administrator to tick:

> I confirm that this content is original or that I have the necessary rights to use it.

`attest_import_batch` then records the attesting admin (`attested_by`), the
timestamp (`attested_at`) and the exact wording (`attestation_statement`)
against the import id. The scan and the attestation are both written to the
audit log (`import.duplicate_scan`, `import.attested`).
