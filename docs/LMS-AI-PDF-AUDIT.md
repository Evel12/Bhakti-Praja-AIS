# LMS and AI requirements audit

Source: `E:\Und\Caps\capsnew_Merged.pdf` (119 physical PDF pages).
Scope: LMS and AI only. Existing assessment implementations under `src/`,
`assessment-frontend/`, `assessment-backend/`, `frontend/src/assessment/`, and the
embedded assessment assets are preserved.

## Baseline

The checkout contained standalone Vue LMS pages and API client methods in
`assessment-frontend`, but the main application embedded the root assessment app,
whose router did not expose those LMS pages. The main Laravel backend did not have
LMS course, materials, submission, attendance, or AI-generation tables or routes.
The separate `assessment-backend` contained LMS route references and controller
code, but referenced absent models/controllers/enums including ModuleRead,
AssignmentController, AnnouncementController, NotificationController, and
QuestionSource. Its generator was an HTTP adapter to an unimplemented service.
There was no Python retrieval or generation service in the checkout.

Consequently these were partial source implementations, not a working integrated
LMS/AI feature set. The implementation adds `/api/lms` and `/lms` to the existing
main application without modifying the assessment implementation.

## Requirement mapping

| PDF requirement | Physical pages | Result |
| --- | --- | --- |
| ELIW-15, SRS-08–12: teacher courses, generated joining code, student membership and role-scoped listing | 38–40, 107 | Added course creation/editing, code joining, membership checks, and course navigation |
| ELIW-16/26, SRS-13–15: upload valid PDFs, public/private visibility, member access | 45, 93, 107 | Added private storage, type/header/size validation, protected downloads, and visibility controls |
| ELIW-17/27: course assignments, deadlines, submissions, files, teacher grades and feedback | 38–40, 91, 100–101 | Added draft/publish/close workflow, answer/file submissions, protected file downloads, deadline enforcement, grades, and feedback |
| ELIW-19, SRS-17: choose an uploaded module and question count, run AI asynchronously, persist a draft or show a recoverable failure | 45–46, 61, 107 | Added separate durable AI queue, selected-model tracking, worker, validation, status polling, and retry action |
| SRS-18: teacher reviews question, four options, answer key and explanation before publication | 107–108 | Added editable AI drafts, explicit review, saved review requirement, deadline publication, and quiz closure |
| AI output: Indonesian multiple choice only, generated from PDF text; no essay generation or essay grading | 37, 110 | Implemented strict output schema and Indonesian context-only prompts; invalid output fails generation |
| Text preprocessing, chunking, Sentence Transformers embeddings, ChromaDB persistence, semantic retrieval | 109–110 | Added Python RAG service with source-isolated retrieval and bounded context |
| Qwen/Llama model family and requested model selector | 110; explicit user extension | Teacher chooses a configured model; exact default `qwen3.8:27b`, selected model persisted and forwarded to Ollama |
| RAGAS faithfulness, context precision, context recall, JSON validity and response time | 110–111 | Added generation measurements and a RAGAS evaluator requiring teacher-verified reference answers |
| ELIW-22/32, SRS-42/43: per-meeting attendance and history | 39–40, 100, 109 | Added teacher attendance input, updates, student history, and linked-parent read access |
| ELIW-23, SRS-49: progress dashboard | 39–40, 109 | Added material progress, submitted assignments, attendance counts, assignment/AI-quiz grades and averages |
| ELIW-24: announcements to course students | 39 | Added course-scoped announcements visible only to members and their linked parents |
| ELIW-25: student schedule access | 39 | Reads existing AIS schedules through active class/year/semester membership; teacher schedules use existing teacher linkage |
| Parent views of child tasks, attendance, grades and progress | 39, 109 | Added read-only child selection in LMS, using existing guardian relationships and rechecking access on every request |
| AI quiz access and automatic multiple-choice scoring | 108 | Added delivery/scoring for the new LMS AI drafts; answer keys remain server-side for students and parents |

## Preserved scope

Existing manual quiz/exam creation, question bank, assessment attempts, game/scoring
modes, result release rules, and assessment UI are not changed. The new LMS AI quiz
workflow operates on separate tables; it does not import, rewrite, or recalculate
existing assessment records.

AIS administration, user registration/approval, formal report cards/transcripts,
financial management, and mobile apps are outside this LMS/AI change. The existing
parent portal's placeholder academic screens are also preserved; the new LMS menu
provides the child-scoped LMS views. No video conferencing, chatbot, predictive
analytics, recommendations, OCR, essay AI, offline mode, or external academic
integration has been added.

This audit distinguishes implemented code from operational readiness. The new
migration, matching AI-service secret, Python dependencies, Ollama model and LMS
worker are required to run the feature. Setup and verification commands are in
`ai-service/README.md`. AI latency and semantic-quality targets require measured
results on representative material; implementing an evaluator does not establish
those targets have been met.

## Verification results

- Main Laravel suite: **91 tests passed, 1,026 assertions**, including the existing
  assessment-session, AIS, finance, communication, and parent-portal regressions.
- Python AI service: **5 tests passed**, covering PDF extraction, chunking,
  authentication, model allowlisting/default forwarding, and invalid output.
- Main React frontend production build passed without rebuilding assessment assets.
- Browser checks passed on desktop and at 390px mobile width. The full workflow
  exercised teacher course creation, PDF upload, assignment publication, student
  joining, material read tracking, file submission, teacher grading/attendance,
  and student progress/grade display against an isolated SQLite database.
- Real Sentence Transformers + persistent Chroma retrieval passed on a text PDF.
- RAGAS evaluator imports and dependency consistency checks passed. Semantic
  evaluation scores have not been measured against a teacher-verified corpus.
- Ollama lists the requested `qwen3.8:27b` model, but live generation returned
  HTTP 500 because its runner could not allocate model/compute memory. The LMS
  correctly reports a failed generation; successful live generation and the PDF's
  latency target remain unverified on this machine. No substitute model was used.
- Git diff confirms no changes to the existing assessment source or embedded assets.

Only isolated test database migrations were run during verification. Apply the
additive migration to the actual application database using the setup instructions
when starting the new LMS service.
