# EXAMNIA AI Service (FastAPI + RAG + Ollama)

Layanan Python terpisah untuk ekstraksi materi PDF, *overlapping chunking* & *hybrid RAG retrieval*, serta generasi soal pilihan ganda terstruktur menggunakan Ollama lokal untuk `assessment-backend`.

## Prasyarat
1. **Ollama** berjalan di `http://127.0.0.1:11434`:
   ```powershell
   ollama serve
   ollama pull qwen3:4b
   ```
   *(Model dapat diubah lewat variabel `OLLAMA_MODEL` pada `.env`, misalnya model 7B/27B pada server dengan VRAM lebih besar.)*
2. **Environment Python (`uv`)**:
   ```powershell
   uv --directory ai-service sync --python 3.13 --extra dev
   ```

## Menjalankan Service
1. Pastikan `ai-service/.env` dan `assessment-backend/.env` memiliki nilai `AI_SERVICE_API_KEY` yang sama serta `AI_SERVICE_BASE_URL=http://127.0.0.1:8001`.
2. Jalankan server FastAPI:
   ```powershell
   ai-service\.venv\Scripts\uvicorn.exe app.main:app --app-dir ai-service --host 127.0.0.1 --port 8001
   ```
3. Jalankan queue worker Laravel pada `assessment-backend`:
   ```powershell
   php artisan queue:work quiz-generation --queue=quiz-generation --tries=3 --timeout=135
   ```

## Pengujian Unit & Kontrak
```powershell
ai-service\.venv\Scripts\python.exe -m unittest discover -s ai-service\tests -t ai-service -v
```
