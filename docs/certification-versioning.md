# Certification versioning (Phase 5)

Each certification **version** is its own row in `public.certifications`.
Versions of the same certification share a `family_id`, and `(family_id, version)`
is unique.

## Fields

| Field | Meaning |
| --- | --- |
| `provider` | Certification provider, e.g. Microsoft |
| `exam_code` | Vendor exam code, e.g. SC-300 |
| `version` | Version label, e.g. `2024.1` |
| `effective_at` | Date the version becomes current |
| `retired_at` | Date the version was retired |
| `lifecycle_status` | `draft`, `active` or `retired` |
| `allow_new_attempts` | Explicit override letting a retired version keep accepting attempts |
| `is_active` | Student visibility |
| `family_id` / `supersedes_id` | Version family and the version this one succeeds |

Domains (with weights) and topics hang off a single certification version, so a
new version gets its own taxonomy.

## Admin actions

- **Add certification** — creates version `1.0` as an inactive draft.
- **New version** — `create_certification_version(_source_id, _version, _exam_code,
  _effective_at, _clone_taxonomy)`. Admin-only; optionally clones domains,
  weights and topics from the source version. The new version starts as a draft.
- **Retire** — `retire_certification_version(_certification_id, _retired_at,
  _allow_new_attempts)`. Admin-only.

Both functions write to `audit_logs`
(`certification.version_created`, `certification.version_retired`).

## Attempt safety

`start_attempt` rejects a new attempt when the exam's certification version is
retired and `allow_new_attempts` is false. Nothing is deleted, so existing
attempts, answers and results keep pointing at the version they were taken on.
The exam engine, scoring and attempt state machine are unchanged and shared by
every certification version.
