from langgraph.graph import StateGraph, END
from schemas.alert_schema import GraphState
from agents.query_rewriter import QueryRewriterAgent
from agents.retriever import RetrieverAgent
from agents.evaluator import EvaluatorAgent
from agents.soc_agent import SOCReasoningAgent
from agents.reporter import ReporterAgent

class SOCWorkflow:
    def __init__(self):
        self.rewriter = QueryRewriterAgent()
        self.retriever = RetrieverAgent()
        self.evaluator = EvaluatorAgent()
        self.soc_agent = SOCReasoningAgent()
        self.reporter = ReporterAgent()
        
        self.graph = self._build_graph()

    def _build_graph(self):
        workflow = StateGraph(GraphState)

        # Define nodes
        workflow.add_node("query_rewriter", self.node_query_rewriter)
        workflow.add_node("retriever", self.node_retriever)
        workflow.add_node("evaluator", self.node_evaluator)
        workflow.add_node("soc_agent", self.node_soc_agent)
        workflow.add_node("reporter", self.node_reporter)

        # Set entry point
        workflow.set_entry_point("query_rewriter")

        # Define edges
        workflow.add_edge("query_rewriter", "retriever")
        workflow.add_edge("retriever", "evaluator")
        
        # Conditional edge from evaluator
        workflow.add_conditional_edges(
            "evaluator",
            self.evaluator_router,
            {
                "retry": "query_rewriter",
                "proceed": "soc_agent"
            }
        )
        
        workflow.add_edge("soc_agent", "reporter")
        workflow.add_edge("reporter", END)

        # Compile the graph
        return workflow.compile()

    # Node Functions
    def node_query_rewriter(self, state: GraphState):
        alert = state.get("raw_alert")
        missing = state.get("missing_aspects", [])
        iterations = state.get("rewrite_iterations", 0)
        
        # Give full raw alert on first try, otherwise pass previous missing aspects
        optimized = self.rewriter.rewrite(alert, missing_aspects=missing)
        
        return {
            "optimized_query": optimized,
            "rewrite_iterations": iterations + 1
        }

    def node_retriever(self, state: GraphState):
        query = state.get("optimized_query")
        docs = self.retriever.retrieve(query)
        return {"retrieved_docs": docs}

    def node_evaluator(self, state: GraphState):
        alert = state.get("raw_alert")
        docs = state.get("retrieved_docs")
        
        eval_result = self.evaluator.evaluate(alert, docs)
        
        return {
            "is_sufficient": eval_result.is_sufficient,
            "missing_aspects": eval_result.missing_aspects
        }

    def evaluator_router(self, state: GraphState):
        is_sufficient = state.get("is_sufficient")
        iterations = state.get("rewrite_iterations", 0)
        docs = state.get("retrieved_docs", [])
        
        # If no documents are retrieved (DB is empty or query missed),
        # rewriting the query over and over usually just wastes time and API quota.
        if not docs:
            return "proceed"
            
        if not is_sufficient and iterations < 1: # allow max 1 retry
            return "retry"
        return "proceed"

    def node_soc_agent(self, state: GraphState):
        alert = state.get("raw_alert")
        docs = state.get("retrieved_docs")
        
        analysis = self.soc_agent.analyze(alert, docs)
        return {"soc_analysis": analysis}

    def node_reporter(self, state: GraphState):
        alert = state.get("raw_alert")
        analysis = state.get("soc_analysis")
        
        report = self.reporter.generate_report(alert, analysis)
        return {"final_report": report}

    async def run(self, raw_alert: str) -> GraphState:
        initial_state = {
            "raw_alert": raw_alert,
            "optimized_query": "",
            "retrieved_docs": [],
            "rewrite_iterations": 0,
            "is_sufficient": False,
            "missing_aspects": [],
            "soc_analysis": None,
            "final_report": ""
        }
        
        # Run graph
        final_state = await self.graph.ainvoke(initial_state)
        return final_state
