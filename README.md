# Remix of Entra Path

PROMPT 1 — Project Foundation

Create a new application called AskMeExam.

AskMeExam is an independent Microsoft Entra ID certification practice platform. Phase 1 must focus only on Microsoft Entra ID certification preparation.

Use:

Next.js

TypeScript

Tailwind CSS

Supabase

PostgreSQL

Supabase Authentication

Row Level Security

Use a feature-based architecture:

auth

dashboard

certifications

exams

questions

attempts

results

review

admin

shared

Within each feature, separate:

UI components

services

validation

hooks

types

Do not place all components, hooks and business logic in large global folders.

Create the basic application layout, routing foundation and environment-variable structure.

Branding:

Name: AskMeExam

Tagline: Practice with Confidence.

White background

Dark blue primary colour

Azure-style blue accent

Light grey surfaces

Clear typography

Minimal distractions

Professional certification-platform appearance

Add this footer disclaimer:

“AskMeExam is an independent certification practice platform and is not affiliated with or endorsed by Microsoft.”

Display:

AskMeExam v0.1.0

Create a simple CHANGELOG.md.

Do not build authentication, database tables or exam features yet.

Stop after the project foundation, routing structure, branding shell and design-system foundation are complete.

Report:

Files created

Routes created

Folder structure

Environment variables that will be needed

Any incomplete items

Do not continue automatically.

# PROMPT 2 — Design System

Continue working in the existing AskMeExam project.

Build a reusable design system before creating application pages.

Create reusable components for:

- Primary button
- Secondary button
- Destructive button
- Text input
- Password input
- Select field
- Checkbox
- Radio button
- Form label
- Form error message
- Card
- Badge
- Alert
- Modal/dialog
- Confirmation dialog
- Table
- Pagination controls
- Tabs
- Loading spinner
- Skeleton loader
- Empty state
- Error state
- Toast notification
- Page header
- Sidebar
- Top navigation
- Mobile navigation

Define consistent:

- Typography
- Spacing
- Border radius
- Shadows
- Focus states
- Hover states
- Disabled states
- Success, warning and error states

Meet basic accessibility requirements:

- Keyboard navigation
- Visible focus indicators
- Proper labels
- Semantic HTML
- Sufficient contrast
- Accessible dialog behaviour

Create a private internal design-system preview page for testing components.

Do not build student or admin business features yet.

Stop after the reusable design system is complete and tested.

Do not continue automatically.

PROMPT 3 — Database Schema

Continue working in the existing AskMeExam project.

Connect Supabase and create the normalized Phase 1 database schema.

Create these tables:

profiles

roles

user_roles

certifications

domains

topics

exams

questions

question_options

exam_questions

attempts

attempt_answers

admin_audit_logs

application_settings

Use UUID primary keys where appropriate.

Requirements:

Do not hardcode certifications, domains or topics in frontend code.

All relationships must use database IDs.

Use created_at and updated_at timestamps.

Preserve historical exam data.

Questions must be deactivated instead of permanently deleted.

Exams and questions need active status fields.

Questions need a question_type field.

Questions need point value, difficulty, explanation and scenario text fields.

Question options need display order.

Correct-answer information must be stored securely.

Exam duration and passing scaled score must be configurable.

Use 700 out of 1000 as the default demonstration passing score.

Attempt statuses must be:

not_started

in_progress

submitted

expired

cancelled

Store attempt timestamps for:

creation

start

last activity

submission

expiration

Attempt answers must store:

attempt ID

question ID

selected option IDs

marked-for-review status

saved timestamp

Create database constraints for valid status transitions and important required fields where practical.

Create indexes for common relationships and lookups, but do not prematurely optimize for large-scale traffic.

Generate migration files and document table relationships.

Do not build UI pages in this step.

Stop after the schema and migrations are complete.

Provide:

Table summary

Relationship summary

Migration files

Constraints

Indexes

Any assumptions made

Do not continue automatically.

# PROMPT 4 — Authentication, Roles and RLS

Continue working in the existing AskMeExam project.

Implement Phase 1 authentication using Supabase.

Build:

- Email/password registration
- Email/password login
- Logout
- Forgot password
- Password reset
- Protected student routes
- Protected admin routes
- Session handling
- Safe redirects

Use only these initial roles:

- student
- admin

Requirements:

- New users receive the student role by default.
- Users must not be able to assign themselves the admin role.
- Admin roles must be assigned through a secure server-side or database-controlled process.
- Do not expose service-role credentials to the browser.
- Do not add Google or Microsoft OAuth.

Implement Row Level Security for every table.

Students must:

- Read only their own profile.
- Read only their own attempts.
- Read and update only their own active attempt answers.
- Never access another student's attempt or answer data.
- Never create or modify exams or questions.
- Never retrieve correct-answer information during an active exam.

Admins may:

- Manage certification content.
- Manage domains and topics.
- Manage exams.
- Manage questions.
- View operational data needed for administration.

Do not create overly broad policies for all authenticated users.

Create a written RLS policy matrix by table and role.

Test:

1. Anonymous access to protected student route
2. Anonymous access to admin route
3. Student access to admin route
4. Student access to another student's attempt
5. Student attempt to assign admin role

Stop after authentication and RLS work correctly.

Do not build exam pages yet.

Do not continue automatically.

PROMPT 5 — Seed Admin, Audit Log and Health Check

Continue working in the existing AskMeExam project.

Add the minimum operational foundation.

Build:

A secure documented method to assign the first admin account.

Admin audit logging.

Application health-check endpoint.

Basic application settings.

Admin audit logs must record:

Admin user ID

Action

Entity type

Entity ID

Timestamp

Safe summary of the change

Do not log passwords, authentication tokens, private keys or sensitive answer payloads.

Create a health-check endpoint that verifies:

Application is running

Database connection is available

Do not expose internal secrets or detailed database information through the health check.

Create a basic admin settings page containing:

Application name

Support email placeholder

Footer disclaimer

Current application version

Default passing scaled score

Default exam duration

Do not add payments, notifications or advanced system settings.

Document:

How to create the first admin

How to verify the health endpoint

What actions are currently audited

Stop after these operational features work.

Do not continue automatically.

# PROMPT 6 — Certification, Domain and Topic Management

Continue working in the existing AskMeExam project.

Build the admin content-taxonomy pages.

Admins must be able to:

- View certifications
- Add a certification
- Edit a certification
- Activate or deactivate a certification
- View domains
- Add a domain
- Edit a domain
- Activate or deactivate a domain
- View topics
- Add a topic
- Edit a topic
- Activate or deactivate a topic

Phase 1 must include only one active certification:

Microsoft Entra ID certification practice

SC-300 may appear as descriptive exam metadata but must not be used as AskMeExam's brand identity.

Requirements:

- Domains belong to a certification.
- Topics belong to a domain.
- Do not permanently delete records.
- Prevent deactivation from corrupting historical attempts.
- Use reusable forms and validation.
- Record admin actions in the audit log.
- Provide search and basic active/inactive filtering.

Do not build CSV import, bulk actions or version history yet.

Stop after taxonomy management is working.

Test create, edit and deactivate flows.

Do not continue automatically.

PROMPT 7 — Exam Administration

Continue working in the existing AskMeExam project.

Build basic admin exam management.

Admins must be able to:

View exams

Create an exam

Edit an exam

Activate or deactivate an exam

Assign a certification

Set exam title and description

Set timed mock availability

Set untimed practice availability

Set duration in minutes

Set passing scaled score

Set question count

Set instructions

View questions assigned to an exam

Do not permanently delete exams.

An exam must not become available to students unless:

It is active.

It contains at least one active question.

Its required configuration is valid.

Record all admin changes in the audit log.

Add form validation for:

Duration

Passing score

Question count

Mode availability

Required text fields

Do not build payment access, scheduling, coupons or publishing workflows.

Stop after exam creation and editing work.

Do not continue automatically.

# PROMPT 8 — Question Administration

Continue working in the existing AskMeExam project.

Build the Phase 1 question-management interface.

Support only:

- Single-choice
- Multiple-choice
- Scenario-based single-choice
- Scenario-based multiple-choice

Question form fields:

- Certification
- Domain
- Topic
- Question type
- Scenario text
- Question text
- Answer options
- Correct answer or correct answers
- Explanation
- Difficulty
- Point value
- Active status

Validation rules:

- Single-choice questions must have exactly one correct option.
- Multiple-choice questions must have at least two correct options.
- Every question must have at least two answer options.
- Answer-option text cannot be empty.
- Explanation is required.
- Certification, domain and topic relationships must be valid.
- Scenario text is required only for scenario-based types.
- Point value must be positive.

Admins may:

- View questions
- Search questions
- Filter by certification, domain, topic, type, difficulty and status
- Add questions
- Edit questions
- Activate questions
- Deactivate questions
- Assign existing questions to an exam
- Remove a question from future exam assignments

Do not implement permanent deletion.

Deactivated questions must remain available in historical submitted-attempt review data.

Prevent correct-answer fields from being returned through student-facing active-exam requests.

Record admin changes in the audit log.

Stop after question management works.

Do not build bulk import yet.

Do not continue automatically.

PROMPT 9 — Student Dashboard and Attempt Creation

Continue working in the existing AskMeExam project.

Build the student dashboard and secure attempt-creation flow.

The dashboard must show:

Welcome message

Available Microsoft Entra ID practice exams

Exam mode

Duration

Number of questions

Passing scaled score

Previous attempts

Most recent score

Start Exam button

Continue Exam button for an existing in-progress attempt

Do not add:

Charts

Leaderboards

Certificates

AI recommendations

Payments

Advanced analytics

Attempt creation requirements:

Create attempts through a secure server-side action.

The authenticated user must become the attempt owner.

The user ID must not come from a trusted client field.

Save a fixed question assignment for the attempt.

Prevent students from adding arbitrary questions to an attempt.

Define whether one active attempt per exam and mode is allowed; use one active attempt per student, exam and mode in Phase 1.

Start time must use server time.

Initial status must transition from not_started to in_progress through controlled logic.

Save the server-authoritative deadline for timed attempts.

Do not expose correct answers or explanations while creating the attempt.

Stop after the dashboard and attempt-start flow work.

Do not build the full exam interface yet.

Do not continue automatically.

# PROMPT 10 — Exam Interface and Navigation

Continue working in the existing AskMeExam project.

Build the main student exam interface.

Include:

- Exam title
- Current question number
- Total question count
- Countdown display for timed mode
- Question text
- Scenario text when applicable
- Single-choice options
- Multiple-choice options
- Previous button
- Next button
- Mark for Review
- Clear Answer
- Submit Exam button
- Question-navigation palette

Question palette indicators:

- Current
- Answered
- Unanswered
- Marked for review
- Answered and marked for review

Requirements:

- Students can jump to any assigned question.
- Keyboard navigation must work where appropriate.
- The interface must be responsive.
- The desktop experience is the priority.
- Do not imitate Microsoft or Pearson VUE branding or protected visual design.
- Do not show correct answers, explanations or correctness during the active session.
- Do not fetch sensitive answer-key data and merely hide it in the UI.

Timed and practice modes must use the same exam engine.

Practice mode has no countdown timer, but answers and explanations must still remain hidden until final submission.

Do not implement drag-and-drop, matching, hotspot, image-based or ordering questions.

Stop after navigation and question answering work in the browser.

Do not continue automatically.

PROMPT 11 — Autosave, Resume and Authoritative Timer

Continue working in the existing AskMeExam project.

Implement reliable autosave and attempt resume.

Autosave requirements:

Save whenever an answer is selected, changed or cleared.

Save marked-for-review status.

Save current question number.

Save last activity time.

Debounce rapid duplicate updates.

Do not display “Saved” until the server confirms the write.

Display saving, saved and failed states.

Retry temporary failures safely.

Prevent duplicate requests from corrupting data.

Security rules:

Students may update only their own in-progress attempts.

Students may answer only questions assigned to the attempt.

Students cannot update submitted, expired or cancelled attempts.

Students cannot change attempt ownership, exam ID or assigned questions.

Resume requirements:

Refreshing the page restores confirmed answers.

Re-login restores the active attempt.

Continue Exam opens at the last saved question.

Marked-for-review state is restored.

Timer requirements:

Browser timer is display-only.

Server start time and configured duration determine the deadline.

Remaining time must be calculated from server-authoritative values.

Changing browser time or local storage must not extend the exam.

Refresh must restore the correct remaining time.

Late answer writes must be rejected.

At zero, the exam must enter the secure submission flow.

Full offline operation is not required.

Stop after autosave, resume and timer behaviour pass testing.

Do not continue automatically.

# PROMPT 12 — Submission, Scoring and Results

Continue working in the existing AskMeExam project.

Implement secure exam submission and scoring.

Before manual submission, display:

- Answered count
- Unanswered count
- Marked-for-review count
- Confirmation dialog

Submission requirements:

- Run through protected server-side logic.
- Confirm attempt ownership.
- Confirm the attempt is in progress.
- Prevent duplicate scoring.
- Lock the attempt after submission.
- Store submission time.
- Store time taken.
- Make submission and scoring atomic where practical.
- Timer reaching zero must trigger the same secure submission process.
- The client must never submit its own score or correctness values.

Scoring:

- Single-choice requires an exact correct option.
- Multiple-choice requires the exact complete correct set.
- No partial marks in Phase 1.
- Respect question point values.
- Calculate raw score.
- Calculate percentage score.
- Calculate scaled score from 0 to 1000.
- Compare scaled score with the exam's configured passing score.
- Use 700/1000 for the demonstration exam.
- Do not imply that this duplicates Microsoft's official scoring method.

Build the result page showing:

- Exam name
- Attempt date
- Raw score
- Percentage
- Scaled score
- Pass or fail
- Time taken
- Total questions
- Correct count
- Incorrect count
- Unanswered count
- Domain-wise totals, correct answers and percentage

Cancelled attempts must not appear as completed results.

Stop after submission, scoring and results work.

Do not continue automatically.

PROMPT 13 — Review Screen, Seed Data and Phase 1 Checkpoint

Continue working in the existing AskMeExam project.

Build the submitted-attempt review screen.

For each question show:

Question text

Scenario text

Student-selected answer

Correct answer

Correct or incorrect status

Explanation

Domain

Topic

Security requirements:

Review is available only after submitted status.

A student may review only their own attempt.

Deactivated questions must still display correctly in historical reviews.

Correct answers and explanations must not be available through active-attempt requests.

Create original seed data:

One Microsoft Entra ID practice certification

Multiple representative domains

Multiple topics

One demonstration exam

Approximately 10 original practice questions

Single-choice questions

Multiple-choice questions

Scenario-based questions

Explanations for every question

Do not use leaked, copied or proprietary certification exam questions.

Run the Phase 1 checkpoint.

Verify:

Student registration and login

Admin access

Admin creates and edits questions

Admin creates an exam

Student starts an exam

Answer autosave

Refresh and resume

Mark for review

Server-authoritative timer

Manual submission

Automatic submission

Scoring

Results

Review

Correct-answer protection

Student isolation through RLS

Provide:

Features completed

Features incomplete

Bugs found

Test results

Routes created

Database tables

RLS policies

Exact student test steps

Exact admin test steps

Do not start bulk content management or any later phase automatically.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://azure-exam-master.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/5e36a655-de8f-4b89-a4dd-e46d659d45e9).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
