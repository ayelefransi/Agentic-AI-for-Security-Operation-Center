import os
import json
from pathlib import Path
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from rag.vector_store import SOCVectorStore

class DataIngestionPipeline:
    def __init__(self):
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=750,
            chunk_overlap=50
        )
        self.vector_store = SOCVectorStore()

    def load_pdf(self, file_path: str) -> list[Document]:
        loader = PyPDFLoader(file_path)
        docs = loader.load()
        for doc in docs:
            doc.metadata["document_type"] = "policy"
            doc.metadata["source_id"] = Path(file_path).name
        return docs

    def load_json_log(self, file_path: str) -> list[Document]:
        with open(file_path, "r") as f:
            data = json.load(f)
        
        docs = []
        for index, item in enumerate(data):
            # Treat each list item as a separate document if it's an array of logs
            content = json.dumps(item, indent=2)
            doc = Document(
                page_content=content,
                metadata={
                    "document_type": "log",
                    "source_id": f"{Path(file_path).name}_{index}",
                    "timestamp": item.get("timestamp", "unknown")
                }
            )
            docs.append(doc)
        return docs
        
    def process_and_store(self, file_path: str):
        path = Path(file_path)
        docs = []
        if path.suffix.lower() == ".pdf":
            docs = self.load_pdf(file_path)
        elif path.suffix.lower() == ".json":
            docs = self.load_json_log(file_path)
        elif path.suffix.lower() == ".txt":
            loader = TextLoader(file_path)
            docs = loader.load()
            for doc in docs:
                doc.metadata["document_type"] = "intel"
                doc.metadata["source_id"] = path.name
                
        if not docs:
            print(f"Skipping unsupported or empty file: {file_path}")
            return

        chunks = self.text_splitter.split_documents(docs)
        self.vector_store.insert_documents(chunks)
        print(f"Ingested and chunked {path.name} into {len(chunks)} fragments.")

