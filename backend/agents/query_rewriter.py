from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate
from schemas.alert_schema import RewriterOutput
from config.settings import settings
import os

class QueryRewriterAgent:
    def __init__(self):
        # We assume GOOGLE_API_KEY is in environment or passed directly
        self.llm = ChatGoogleGenerativeAI(
            model=settings.llm_model,
            temperature=0,
            google_api_key=settings.google_api_key or os.environ.get("GOOGLE_API_KEY")
        )
        self.structured_llm = self.llm.with_structured_output(RewriterOutput)
        
        self.prompt = PromptTemplate(
            template="""You are a SOC Query Optimization Agent.
Your job is to rewrite raw SOC alerts, queries, or previous insufficient queries to maximize vector retrieval quality.

Guidelines:
1. Extract and prioritize technical terms (CVEs, MITRE ATT&CK techniques, log types, IP addresses, error codes).
2. Remove conversational ambiguity or unnecessary words.
3. Keep the query under 20 words.
4. If missing aspects are provided, ensure they are explicitly included in the new query to refine the search.

Input Alert/Query: {alert}
Missing Aspects (if previous retrieval failed): {missing_aspects}

Optimize the query:
""",
            input_variables=["alert", "missing_aspects"]
        )

    def rewrite(self, alert: str, missing_aspects: list[str] = None) -> str:
        missing_str = ", ".join(missing_aspects) if missing_aspects else "None"
        chain = self.prompt | self.structured_llm
        result = chain.invoke({"alert": alert, "missing_aspects": missing_str})
        return result.optimized_query
