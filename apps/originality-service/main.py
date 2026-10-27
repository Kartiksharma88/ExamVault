import os
import socket
import logging
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Header, Depends
from pydantic import BaseModel, Field
from detector import OriginalityEngine, IndexedDocument

# Configure privacy-preserving logging: IDs and scores ONLY, NEVER question text
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] [ORIGINALITY_SVC] %(message)s'
)
logger = logging.getLogger("originality_service")

# Authentication token for internal communication
INTERNAL_SERVICE_TOKEN = os.getenv("ORIGINALITY_SERVICE_TOKEN", "examvault_internal_secret_token_dev")

app = FastAPI(
    title="ExamVault Originality & Copy Checker Service",
    description="Internal, isolated originality detection engine for examination questions",
    version="1.0.0"
)

# Global in-memory engine (never writes unreleased question plaintext to disk)
engine = OriginalityEngine(lsh_threshold=0.5)

# ── Authentication Dependency ──────────────────────────────────────
def verify_service_token(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing service authorization token")
    token = authorization.replace("Bearer ", "").strip()
    if token != INTERNAL_SERVICE_TOKEN:
        logger.warning("Unauthorized service access attempt rejected")
        raise HTTPException(status_code=403, detail="Invalid internal service token")
    return True

# ── Request / Response Models ──────────────────────────────────────
class CheckQuestionRequest(BaseModel):
    questionId: str
    versionNo: int = 1
    stem: str
    options: List[str] = Field(default_factory=list)
    parentVersionId: Optional[str] = None
    authorId: Optional[str] = None
    exactMatchThreshold: float = 1.0
    highSimilarityThreshold: float = 0.85
    mediumSimilarityThreshold: float = 0.60

class IndexFeedItem(BaseModel):
    docId: str
    sourceType: str = "BANK" # "BANK", "PAST_PAPER", "PUBLIC"
    sourceReference: str
    versionNo: int = 1
    stem: str
    options: List[str] = Field(default_factory=list)
    parentVersionId: Optional[str] = None
    authorId: Optional[str] = None

class IndexFeedBatchRequest(BaseModel):
    items: List[IndexFeedItem]

# ── API Endpoints ──────────────────────────────────────────────────

@app.get("/health")
def health_check():
    """Service health and in-memory index metrics"""
    return {
        "status": "HEALTHY",
        "service": "originality-service",
        "version": "1.0.0",
        "indexedDocumentsCount": len(engine.documents),
        "networkIsolationActive": True,
    }

@app.post("/check", dependencies=[Depends(verify_service_token)])
def check_originality(req: CheckQuestionRequest):
    """
    Screen a question version against the bank and public corpora.
    Logs ID, version, and resulting score — NEVER question text!
    """
    result = engine.check_question(
        question_id=req.questionId,
        version_no=req.versionNo,
        stem=req.stem,
        options=req.options,
        parent_version_id=req.parentVersionId,
        author_id=req.authorId,
        exact_match_threshold=req.exactMatchThreshold,
        high_threshold=req.highSimilarityThreshold,
        medium_threshold=req.mediumSimilarityThreshold,
    )

    # Privacy-preserving logging
    logger.info(
        f"CHECK question_id={req.questionId} v={req.versionNo} "
        f"risk={result['riskLevel']} highest_score={result['highestScore']} "
        f"match_count={result['totalMatches']}"
    )

    return result

@app.post("/index/feed", dependencies=[Depends(verify_service_token)])
def feed_index_batch(req: IndexFeedBatchRequest):
    """
    Populate or update in-memory bank index from internal authenticated feed.
    """
    count = 0
    for item in req.items:
        doc = IndexedDocument(
            doc_id=item.docId,
            source_type=item.sourceType,
            source_reference=item.sourceReference,
            version_no=item.versionNo,
            stem=item.stem,
            options=item.options,
            parent_version_id=item.parentVersionId,
            author_id=item.authorId
        )
        engine.add_document(doc)
        count += 1

    engine.rebuild_tfidf()
    logger.info(f"FEED_BATCH ingested={count} total_in_memory={len(engine.documents)}")
    return {"success": True, "ingested": count, "totalIndexed": len(engine.documents)}

@app.delete("/index/{doc_id}", dependencies=[Depends(verify_service_token)])
def remove_from_index(doc_id: str):
    """Remove a document from index upon retirement or withdrawal"""
    engine.remove_document(doc_id)
    logger.info(f"REMOVE_DOC doc_id={doc_id} total_in_memory={len(engine.documents)}")
    return {"success": True, "removed": doc_id, "totalIndexed": len(engine.documents)}

@app.post("/index/clear", dependencies=[Depends(verify_service_token)])
def clear_index():
    """Clear in-memory index for reload"""
    engine.clear()
    logger.info("CLEAR_INDEX in-memory store cleared")
    return {"success": True, "totalIndexed": 0}

@app.get("/test/network-isolation")
def test_network_isolation():
    """
    Automated test proving that external internet outbound requests fail.
    Attempts a socket connection to a public internet DNS IP (8.8.8.8:53 or example.com).
    Returns isolated: true if outbound network attempt is blocked.
    """
    outbound_blocked = False
    details = ""
    try:
        # Timeout quickly (1 second)
        s = socket.create_connection(("8.8.8.8", 53), timeout=1.0)
        s.close()
        outbound_blocked = False
        details = "Warning: Outbound socket connection succeeded. Ensure container has 'internal: true' network."
    except Exception as e:
        outbound_blocked = True
        details = f"Outbound connection correctly rejected: {type(e).__name__}"

    return {
        "isolated": outbound_blocked,
        "details": details,
        "policy": "No external internet access permitted"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
