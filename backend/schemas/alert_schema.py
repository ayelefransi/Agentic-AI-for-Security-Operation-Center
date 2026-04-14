from typing import List, Optional, Any
from pydantic import BaseModel, Field
from typing_extensions import TypedDict

# Agent Response Schemas

class Evidence(BaseModel):
    source_id: str = Field(description="The source_id of the document where evidence was found")
    excerpt: str = Field(description="A direct or slightly summarized excerpt from the source supporting the reasoning")

class SOCAgentOutput(BaseModel):
    classification: str = Field(
        description="Must be exactly one of: 'True Positive', 'False Positive', or 'Needs Investigation'."
    )
    reasoning: str = Field(description="Detailed step-by-step reasoning cross-referencing alert details and retrieved policies/logs.")
    evidence: List[Evidence] = Field(description="List of evidence supporting the classification")
    confidence_score: float = Field(description="A float between 0.0 and 1.0 indicating confidence in the classification")
    recommended_action: str = Field(description="Actionable recommendation for the SOC analyst")

class EvaluatorOutput(BaseModel):
    relevance_score: float = Field(description="Score between 0.0 and 1.0 representing relevance of documents to query")
    is_sufficient: bool = Field(description="True if context is sufficient to analyze the alert, False otherwise")
    missing_aspects: List[str] = Field(description="List of aspects that are missing from the context. Empty if sufficient.")

class RewriterOutput(BaseModel):
    optimized_query: str = Field(description="The optimized query incorporating technical terms or expanding missing aspects, max 20 words")

# Graph State Schema

class GraphState(TypedDict):
    raw_alert: str
    optimized_query: str
    retrieved_docs: List[Any]
    rewrite_iterations: int
    is_sufficient: bool
    soc_analysis: Optional[SOCAgentOutput]
    final_report: Optional[str]
