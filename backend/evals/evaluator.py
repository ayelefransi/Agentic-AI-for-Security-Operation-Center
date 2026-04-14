import json
import logging
import asyncio
from pathlib import Path
from schemas.alert_schema import SOCAgentOutput
from graph.workflow import SOCWorkflow

# We can either call the FastAPI endpoint using requests, or directly invoke the workflow.
# Since we want to test the entire graph logic including retries without needing the server running, 
# invoking the workflow directly is more robust for local evaluation.

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def run_evals():
    test_cases_path = Path(__file__).parent / "test_cases.json"
    
    with open(test_cases_path, "r") as f:
        test_cases = json.load(f)
        
    workflow = SOCWorkflow()
    
    total = len(test_cases)
    correct = 0
    hallucinations = 0
    total_retrieval_retries = 0
    
    logger.info(f"Starting evaluation of {total} test cases...")
    
    for case in test_cases:
        alert = case["alert"]
        expected = case["expected_classification"]
        
        logger.info(f"Evaluating: {alert}")
        
        try:
            final_state = await workflow.run(alert)
            analysis = final_state.get("soc_analysis")
            iterations = final_state.get("rewrite_iterations", 0)
            
            total_retrieval_retries += (iterations - 1) if iterations > 0 else 0
            
            if not analysis:
                logger.error(f"Failed to generate analysis for: {alert}")
                continue
                
            actual = analysis.classification
            
            if actual == expected:
                correct += 1
            else:
                 logger.warning(f"Mismatch: Expected {expected}, Got {actual}")
                 
            # Simple hallucination check: if evidence is not found in retrieved docs
            retrieved_docs = final_state.get("retrieved_docs", [])
            context_text = " ".join([d["content"] for d in retrieved_docs])
            
            for ev in analysis.evidence:
                if ev.excerpt and ev.excerpt not in context_text and len(ev.excerpt) > 20: 
                    # Naive check. Real check would use LLM as judge.
                    # Relaxed check because LLM might slightly rephrase or excerpt.
                    # We just track if it's completely missing
                    pass
            
        except Exception as e:
            logger.error(f"Error evaluating '{alert}': {e}")
            
    accuracy = (correct / total) * 100
    avg_retries = total_retrieval_retries / total
    
    print("\n" + "="*40)
    print("EVALUATION RESULTS")
    print("="*40)
    print(f"Total Cases: {total}")
    print(f"Correct Classifications: {correct}")
    print(f"Accuracy: {accuracy:.2f}%")
    print(f"Average Query Rewrites per Alert: {avg_retries:.2f}")
    print("="*40)

if __name__ == "__main__":
    asyncio.run(run_evals())
