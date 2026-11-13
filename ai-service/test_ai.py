import json
import os
import tempfile
import unittest
from unittest.mock import patch

os.environ["LMS_AI_KEY"] = "test-key"
from core import chunks, validate_output

OUTPUT = {"title": "Kuis", "questions": [{"question": "Apa fungsi primary key?", "options": ["Identitas unik", "Warna", "Ukuran", "Alamat"], "correct_index": 0, "explanation": "Mengidentifikasi baris secara unik."}]}


class CoreTests(unittest.TestCase):
    def test_preprocessing_chunk_overlap_and_empty_pdf(self):
        parts = chunks("a" * 2200)
        self.assertEqual(parts[0][-200:], parts[1][:200])
        with self.assertRaises(ValueError): chunks(" ")

    def test_count_keys_and_duplicate_options(self):
        self.assertEqual(validate_output(json.dumps(OUTPUT), 1).questions[0].correct_index, 0)
        with self.assertRaises(ValueError): validate_output(json.dumps(OUTPUT), 2)
        with self.assertRaises(ValueError): validate_output("not json", 1)
        invalid = json.loads(json.dumps(OUTPUT)); invalid['questions'][0]['options'][1] = 'Identitas unik'
        with self.assertRaises(ValueError): validate_output(json.dumps(invalid), 1)
        invalid = json.loads(json.dumps(OUTPUT)); invalid['questions'][0]['correct_index'] = True
        with self.assertRaises(ValueError): validate_output(json.dumps(invalid), 1)


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from fastapi.testclient import TestClient
        import app
        cls.module = app
        cls.client = TestClient(app.app)
        cls.temp = tempfile.TemporaryDirectory()
        app.DATA = __import__('pathlib').Path(cls.temp.name)

    @classmethod
    def tearDownClass(cls): cls.temp.cleanup()

    def post(self, **kwargs):
        return self.client.post('/generate-quiz', headers={'Authorization': 'Bearer test-key'}, files={'file': ('m.pdf', b'%PDF-1.4\ncontent', 'application/pdf')}, data={'question_count': 1, **kwargs})

    def test_auth_and_model_allowlist(self):
        self.assertIn(self.client.post('/generate-quiz').status_code, [401, 403])
        self.assertEqual(self.post(model='unapproved').status_code, 422)

    def test_pdf_extraction_rejects_scans_and_handles_real_text(self):
        import pymupdf
        class Encoder:
            def encode(self, values, **_):
                class Vectors:
                    def tolist(self): return [[1., 0.]] * len(values)
                return Vectors()
        class Collection:
            def get(self, **_): return {'ids': []}
            def upsert(self, **kwargs): self.documents = kwargs['documents']
            def query(self, **kwargs): return {'documents': [self.documents]}
        with pymupdf.open() as doc:
            page = doc.new_page(); page.insert_text((30, 50), 'Primary key adalah identitas unik setiap baris pada tabel basis data. ' * 3)
            pdf = doc.tobytes()
        with patch.object(self.module, 'resources', return_value=(Encoder(), Collection())):
            self.assertIn('Primary key', self.module.retrieve(pdf, 1)[0])
        with pymupdf.open() as doc:
            doc.new_page(); blank = doc.tobytes()
        with self.assertRaises(ValueError): self.module.retrieve(blank, 1)

    def test_default_model_wire_format_and_malformed_response(self):
        import httpx
        response = httpx.Response(200, json={'message': {'content': json.dumps(OUTPUT)}}, request=httpx.Request('POST', 'http://ollama/api/chat'))
        with patch.object(self.module, 'retrieve', return_value=['Primary key adalah identitas unik.']), patch.object(self.module.httpx, 'post', return_value=response) as post:
            result = self.post(); self.assertEqual(result.status_code, 200)
            self.assertEqual(post.call_args.kwargs['json']['model'], 'qwen3.8:27b')
            self.assertEqual(result.json()['questions'][0]['correct_index'], 0)
        bad = httpx.Response(200, json={'message': {'content': '{}'}}, request=httpx.Request('POST', 'http://ollama/api/chat'))
        with patch.object(self.module, 'retrieve', return_value=['Materi']), patch.object(self.module.httpx, 'post', return_value=bad):
            self.assertEqual(self.post().status_code, 422)


if __name__ == '__main__': unittest.main()
