# LMS AI service

This service implements the PDF specification's text extraction, preprocessing,
overlapping chunks, multilingual Sentence Transformers embeddings, persistent
ChromaDB storage, semantic retrieval, and Indonesian multiple-choice generation.
Ollama receives the selected model name unchanged. The default is `qwen3.8:27b`.
There is no generated sample-question fallback.

Use Python 3.11 or 3.12. From the repository root:

```powershell
py -3.11 -m venv ai-service/.venv
ai-service/.venv/Scripts/python.exe -m pip install -r ai-service/requirements.txt
```

Set these entries in `backend/.env`:

```dotenv
LMS_AI_URL=http://127.0.0.1:8001
LMS_AI_KEY=replace-with-a-long-random-secret
LMS_AI_MODEL=qwen3.8:27b
LMS_AI_MODELS=qwen3.8:27b,llama3.1:8b
```

Use the same key and model list in the AI terminal:

```powershell
$env:LMS_AI_KEY='the-same-secret-as-backend'
$env:LMS_AI_MODEL='qwen3.8:27b'
$env:LMS_AI_MODELS='qwen3.8:27b,llama3.1:8b'
$env:OLLAMA_URL='http://127.0.0.1:11434'
cd ai-service
.venv/Scripts/python.exe -m uvicorn app:app --host 127.0.0.1 --port 8001
```

The requested Ollama model must exist locally. The service never silently substitutes
another model. Add other installed Qwen or Llama tags to both model lists to make
them selectable. The first embedding run downloads
`sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`; warm the service before
measuring generation latency.

Run the additive LMS migration and a separate worker in backend terminals:

```powershell
cd backend
php artisan migrate
php artisan config:clear
php artisan queue:work lms --queue=lms-ai --tries=1 --timeout=150
```

The worker uses a separate durable database queue with a 180-second reservation.
Generation calls have a 120-second HTTP timeout and produce a visible failed status
if the model, service, source PDF, or generated JSON cannot be processed. Teachers
can retry from the course. Scanned PDFs without extractable text are rejected; OCR
is outside the specification. Material uploads are limited to 10 MB and 300 pages
for AI processing. Only the authorized Laravel backend should access this service.

In the main frontend, choose **LMS pembelajaran** at login, then open **Course &
Pembelajaran**. Existing assessment routes and assets are independent and unchanged.
For validating only this frontend without rebuilding the embedded assessment:

```powershell
cd frontend
npx vite build
```

## Evaluation

Generation records under `data/generations.jsonl` contain retrieved context, model,
validated output, JSON validity, and measured response time. This is private teaching
content and stays outside source control.

Install the evaluation dependencies:

```powershell
ai-service/.venv/Scripts/python.exe -m pip install -r ai-service/requirements-eval.txt
```

Create a teacher-verified JSONL evaluation dataset, one item per question:

```json
{"user_input":"Apa fungsi primary key?","response":"Primary key mengidentifikasi setiap baris secara unik.","retrieved_contexts":["Primary key mengidentifikasi setiap baris secara unik."],"reference":"Primary key adalah pengenal unik untuk setiap baris dalam tabel."}
```

From `ai-service`, run:

```powershell
.venv/Scripts/python.exe evaluate.py verified-dataset.jsonl
```

RAGAS computes faithfulness, context precision, and context recall with an Ollama
judge. The report also aggregates JSON validity rate and mean response time. Recall
requires independently verified reference answers; the evaluator never invents
ground truth or claims unmeasured quality scores.

## Checks

```powershell
ai-service/.venv/Scripts/python.exe -m unittest discover -s ai-service -p test_ai.py -v
cd backend
php artisan test
```

API implementations follow the official [Ollama chat API](https://docs.ollama.com/api/chat),
[Chroma collection API](https://docs.trychroma.com/docs/collections/add-data), and
[RAGAS evaluation API](https://docs.ragas.io/en/v0.2.15/references/evaluate/).
