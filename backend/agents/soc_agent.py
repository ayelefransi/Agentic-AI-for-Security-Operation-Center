from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate
from schemas.alert_schema import SOCAgentOutput
from config.settings import settings
import os

class SOCReasoningAgent:
    def __init__(self):
        self.llm = ChatGoogleGenerativeAI(
            model=settings.llm_model,
            temperature=0.1,  # Slight temperature for reasoning, but mostly deterministic
            google_api_key=settings.google_api_key or os.environ.get("GOOGLE_API_KEY")
        )
        self.structured_llm = self.llm.with_structured_output(SOCAgentOutput)
        
        self.prompt = PromptTemplate(
            template="""You are an expert Security Operations Center (SOC) Analyst Agent.
Your task is to analyze a security alert using the provided evidence/context, reason through the findings, and classify the alert.

Alert/Issue: {alert}
Valid Evidence Context: {context}

Instructions:
1. Reason step-by-step about what the alert means and what the evidence actually shows.
2. Cross-reference the logs and policies. Do not hallucinate. If evidence is lacking, classify as 'Needs Investigation'.
3. Extract direct excerpts for your evidence list, linked to the source_id.
4. Classify the alert strictly as 'True Positive', 'False Positive', or 'Needs Investigation'.
5. Provide a confidence score and a recommended action for the human analyst.

Analyze and output JSON:
""",
            input_variables=["alert", "context"]
        )

    def analyze(self, alert: str, retrieved_docs: list[dict]) -> SOCAgentOutput:
        context_str = "\n\n".join(
            [f"Source: {d['metadata'].get('source_id', 'Unknown')}\n{d['content']}" for d in retrieved_docs]
        )
        if not context_str.strip():
             context_str = "No valid evidence provided."
             
        chain = self.prompt | self.structured_llm
        result = chain.invoke({"alert": alert, "context": context_str})
        return result
