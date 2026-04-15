from typing import List, Dict, Any
from qdrant_client import QdrantClient
from langchain_qdrant import QdrantVectorStore
from langchain_core.documents import Document
from langchain_google_genai import GoogleGenerativeAIEmbeddings
import os

from config.settings import settings

class SOCVectorStore:
    def __init__(self):
        # We use a lightweight Google Generative AI Embeddings model to avoid Lambda size limits
        # with Vercel serverless functions.
        self.embeddings = GoogleGenerativeAIEmbeddings(model="models/text-embedding-004")
        self.client = QdrantClient(path=settings.qdrant_path)
        self.collection_name = settings.qdrant_collection_name
        
        if not self.client.collection_exists(self.collection_name):
            from qdrant_client.http.models import Distance, VectorParams
            self.client.create_collection(
                collection_name=self.collection_name,
                vectors_config=VectorParams(size=768, distance=Distance.COSINE),
            )
            
        self.vector_store = QdrantVectorStore(
            client=self.client, 
            collection_name=self.collection_name, 
            embedding=self.embeddings
        )
        
    def insert_documents(self, documents: List[Document]):
        """
        Inserts documents into the Qdrant local vector store.
        Assumes metadata contains 'source_id', 'document_type', etc.
        """
        if not documents:
            return
        
        self.vector_store.add_documents(documents)
        print(f"Inserted {len(documents)} documents into {self.collection_name}")
        
    def query_documents(self, query: str, top_k: int = 5, filters: Dict[str, Any] = None) -> List[Document]:
        """
        Queries the vector store for top_k relevant documents.
        Supports optional metadata filtering.
        """
        search_kwargs = {"k": top_k}
        if filters:
            search_kwargs["filter"] = filters
            
        docs = self.vector_store.similarity_search(query, **search_kwargs)
        return docs
