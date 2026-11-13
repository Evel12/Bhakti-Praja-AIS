"""Evaluate a teacher-verified JSONL dataset; references must never be invented."""
import argparse
import json
import os
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("dataset", help="JSONL: user_input, response, retrieved_contexts, reference")
    parser.add_argument("--generations", default="data/generations.jsonl")
    parser.add_argument("--output", default="data/evaluation.json")
    args = parser.parse_args()
    from langchain_ollama import ChatOllama
    from ragas import EvaluationDataset, evaluate
    from ragas.llms import LangchainLLMWrapper
    from ragas.metrics import Faithfulness, LLMContextPrecisionWithReference, LLMContextRecall
    from ragas.run_config import RunConfig
    rows = [json.loads(line) for line in Path(args.dataset).read_text(encoding="utf-8").splitlines() if line.strip()]
    if not rows or any(not row.get("reference") for row in rows):
        raise ValueError("Dataset must contain teacher-verified reference answers.")
    llm = LangchainLLMWrapper(ChatOllama(model=os.getenv("LMS_AI_MODEL", "qwen3.8:27b"),
                                       base_url=os.getenv("OLLAMA_URL", "http://127.0.0.1:11434"), temperature=0))
    result = evaluate(EvaluationDataset.from_list(rows), metrics=[Faithfulness(), LLMContextPrecisionWithReference(), LLMContextRecall()],
                      llm=llm, raise_exceptions=True, run_config=RunConfig(timeout=180, max_retries=1, max_workers=1))
    generations = [json.loads(line) for line in Path(args.generations).read_text(encoding="utf-8").splitlines() if line.strip()]
    summary = {"ragas": result.scores, "samples": len(rows),
               "json_validity_rate": sum(g["json_valid"] for g in generations) / len(generations) if generations else None,
               "mean_response_seconds": sum(g["response_seconds"] for g in generations) / len(generations) if generations else None}
    output = Path(args.output); output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(summary, ensure_ascii=False, indent=2, allow_nan=False), encoding="utf-8")


if __name__ == "__main__":
    main()
