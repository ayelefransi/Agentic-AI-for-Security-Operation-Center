from rag.vector_store import SOCVectorStore
from langchain_core.documents import Document
from typing import List, Dict, Any

class RetrieverAgent:
    def __init__(self):
        self.vector_store = SOCVectorStore()

    def retrieve(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """
        Retrieves top_k relevant documents for the query.
        Returns a list of dictionaries with content and metadata.
        """
        docs: List[Document] = self.vector_store.query_documents(query, top_k=top_k)
        
        results = []
        for doc in docs:
            results.append({
                "content": doc.page_content,
                "metadata": doc.metadata
            })
            
        print(f"Retriever fetched {len(results)} docs for query: '{query}'")
        return results
