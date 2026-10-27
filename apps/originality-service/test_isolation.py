import sys
import io
import logging
import urllib.request
import urllib.error

from normalizer import Normalizer
from detector import OriginalityEngine, IndexedDocument

def test_outbound_internet_isolation_fails():
    """Verify outbound internet access fails or is blocked."""
    try:
        urllib.request.urlopen("http://198.51.100.1:80", timeout=1.0)
        raise AssertionError("Outbound request should not succeed in isolated network")
    except (urllib.error.URLError, TimeoutError, OSError):
        # Expected failure: isolated network cannot reach external IP
        pass


if __name__ == "__main__":
    print("Running originality service confidentiality & isolation tests...")
    
    # Run test 1 with string stream handler
    log_capture = io.StringIO()
    handler = logging.StreamHandler(log_capture)
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    logger.addHandler(handler)
    
    engine = OriginalityEngine()
    doc = IndexedDocument(
        doc_id="bank-test-secret-01",
        source_type="BANK",
        source_reference="EV-TEST-001",
        version_no=1,
        stem="Confidential quantum entanglement test question with secret solution formula",
        options=["Option A alpha", "Option B beta", "Option C gamma", "Option D delta"],
    )
    engine.add_document(doc)
    
    matches = engine.check_question(
        question_id="bank-test-query",
        version_no=1,
        stem="Confidential quantum entanglement test question with secret solution formula",
        options=["Option A alpha", "Option B beta", "Option C gamma", "Option D delta"],
    )
    
    log_output = log_capture.getvalue()
    assert "Confidential quantum entanglement" not in log_output, "Question stem leaked to logs!"
    assert "secret solution formula" not in log_output, "Solution formula leaked to logs!"
    assert "Option A alpha" not in log_output, "Options leaked to logs!"
    print("PASS: Log confidentiality verified. Plaintext is scrubbed.")

    test_outbound_internet_isolation_fails()
    print("PASS: Network isolation verified. Outbound internet connection rejected.")
    print("\nALL ORIGINALITY SERVICE CONFIDENTIALITY & ISOLATION TESTS PASSED.")
