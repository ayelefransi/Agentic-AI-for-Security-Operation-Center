from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate
from schemas.alert_schema import EvaluatorOutput
from config.settings import settings
import os

class EvaluatorAgent:
    def __init__(self):
        self.llm = ChatGoogleGenerativeAI(
            model=settings.llm_model,
            temperature=0,
            google_api_key=settings.google_api_key or os.environ.get("GOOGLE_API_KEY")
        )
        self.structured_llm = self.llm.with_structured_output(EvaluatorOutput)
        
        self.prompt = PromptTemplate(
            template="""You are a Self-RAG Evaluator Agent in a SOC environment.
Your task is to judge whether the retrieved context is relevant and sufficient to classify the SOC alert.

Alert/Issue: {alert}
Retrieved Context: {context}

Task Details:
1. Assign a relevance_score (0.0 to 1.0) comparing the context against the alert.
2. If the relevance_score is less than 0.7 or the context is missing critical technical details to classify the alert, set is_sufficient to false.
3. If is_sufficient is false, list exactly what missing_aspects need to be retrieved (e.g. "Missing policy for login attempts", "Missing firewall log").

Evaluate the retrieval:
""",
            input_variables=["alert", "context"]
        )

    def evaluate(self, alert: str, retrieved_docs: list[dict]) -> EvaluatorOutput:
        context_str = "\n\n".join(
            [f"Source: {d['metadata'].get('source_id', 'Unknown')}\n{d['content']}" for d in retrieved_docs]
        )
        if not context_str.strip():
             context_str = "No documents were retrieved."
             
        chain = self.prompt | self.structured_llm
        result = chain.invoke({"alert": alert, "context": context_str})
        return result
