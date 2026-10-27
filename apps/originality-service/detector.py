import hashlib
from typing import Dict, List, Optional, Tuple, Any
from datasketch import MinHash, MinHashLSH
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
from normalizer import Normalizer

class IndexedDocument:
    def __init__(
        self,
        doc_id: str,
        source_type: str, # 'BANK', 'PAST_PAPER', 'PUBLIC'
        source_reference: str, # e.g. Human ID or file title
        version_no: int,
        stem: str,
        options: List[str],
        parent_version_id: Optional[str] = None,
        author_id: Optional[str] = None
    ):
        self.doc_id = doc_id
        self.source_type = source_type
        self.source_reference = source_reference
        self.version_no = version_no
        self.parent_version_id = parent_version_id
        self.author_id = author_id

        # Plaintexts (only stored in-memory, NEVER written to disk)
        self.raw_stem = stem
        self.raw_options = options

        # Normalization
        self.norm_stem = Normalizer.normalize_text(stem)
        self.norm_options = [Normalizer.normalize_text(opt) for opt in options]
        self.norm_combined = self.norm_stem + " " + " ".join(self.norm_options)
        
        # Number-masked normalization
        self.masked_stem = Normalizer.normalize_text(stem, mask_numbers=True)
        self.masked_combined = Normalizer.normalize_text(self.norm_combined, mask_numbers=True)

        # Exact hash
        self.exact_hash = hashlib.sha256(self.norm_combined.encode('utf-8')).hexdigest()
        self.stem_hash = hashlib.sha256(self.norm_stem.encode('utf-8')).hexdigest()
        self.masked_hash = hashlib.sha256(self.masked_combined.encode('utf-8')).hexdigest()

        # MinHash for near-duplicate
        self.minhash = self._compute_minhash(self.norm_combined)
        self.stem_minhash = self._compute_minhash(self.norm_stem)

    @staticmethod
    def _compute_minhash(text: str, num_perm: int = 128) -> MinHash:
        m = MinHash(num_perm=num_perm)
        # Combine word shingles and character shingles
        word_shingles = Normalizer.get_shingles(text, k=3)
        char_shingles = Normalizer.get_char_shingles(text, k=5)
        for s in word_shingles + char_shingles:
            m.update(s.encode('utf-8'))
        return m


class OriginalityEngine:
    def __init__(self, lsh_threshold: float = 0.5):
        self.lsh_threshold = lsh_threshold
        self.documents: Dict[str, IndexedDocument] = {}
        # MinHash LSH Index (in-memory)
        self.lsh = MinHashLSH(threshold=lsh_threshold, num_perm=128)
        
        # TF-IDF state
        self.tfidf_vectorizer: Optional[TfidfVectorizer] = None
        self.tfidf_matrix: Optional[Any] = None
        self.doc_id_list: List[str] = []
        self._dirty_tfidf = False

    def add_document(self, doc: IndexedDocument):
        """Add or update an in-memory indexed document"""
        if doc.doc_id in self.documents:
            self.remove_document(doc.doc_id)
        
        self.documents[doc.doc_id] = doc
        try:
            self.lsh.insert(doc.doc_id, doc.minhash)
        except ValueError:
            pass
        self._dirty_tfidf = True

    def remove_document(self, doc_id: str):
        if doc_id in self.documents:
            try:
                self.lsh.remove(doc_id)
            except (KeyError, ValueError):
                pass
            del self.documents[doc_id]
            self._dirty_tfidf = True

    def clear(self):
        self.documents.clear()
        self.lsh = MinHashLSH(threshold=self.lsh_threshold, num_perm=128)
        self.tfidf_vectorizer = None
        self.tfidf_matrix = None
        self.doc_id_list = []
        self._dirty_tfidf = False

    def rebuild_tfidf(self):
        """Recompute TF-IDF matrix over current in-memory corpus"""
        if not self._dirty_tfidf and self.tfidf_matrix is not None:
            return

        self.doc_id_list = list(self.documents.keys())
        if not self.doc_id_list:
            self.tfidf_vectorizer = None
            self.tfidf_matrix = None
            self._dirty_tfidf = False
            return

        corpus = [self.documents[did].norm_combined for did in self.doc_id_list]
        self.tfidf_vectorizer = TfidfVectorizer(
            ngram_range=(1, 2),
            sublinear_tf=True,
            min_df=1
        )
        self.tfidf_matrix = self.tfidf_vectorizer.fit_transform(corpus)
        self._dirty_tfidf = False

    def check_question(
        self,
        question_id: str,
        version_no: int,
        stem: str,
        options: List[str],
        parent_version_id: Optional[str] = None,
        author_id: Optional[str] = None,
        exact_match_threshold: float = 1.0,
        high_threshold: float = 0.85,
        medium_threshold: float = 0.60,
    ) -> Dict[str, Any]:
        """
        Check a submitted question version against the entire in-memory index
        Returns originality_report structure with riskLevel, highestScore, and matches.
        """
        self.rebuild_tfidf()

        # Build query document representations
        norm_stem = Normalizer.normalize_text(stem)
        norm_options = [Normalizer.normalize_text(opt) for opt in options]
        norm_combined = norm_stem + " " + " ".join(norm_options)
        masked_stem = Normalizer.normalize_text(stem, mask_numbers=True)
        masked_combined = Normalizer.normalize_text(norm_combined, mask_numbers=True)

        query_exact_hash = hashlib.sha256(norm_combined.encode('utf-8')).hexdigest()
        query_stem_hash = hashlib.sha256(norm_stem.encode('utf-8')).hexdigest()
        query_masked_hash = hashlib.sha256(masked_combined.encode('utf-8')).hexdigest()

        query_minhash = IndexedDocument._compute_minhash(norm_combined)
        query_stem_minhash = IndexedDocument._compute_minhash(norm_stem)

        # Compute TF-IDF query vector if matrix exists
        query_tfidf_sims: Dict[str, float] = {}
        if self.tfidf_vectorizer and self.tfidf_matrix is not None and len(self.doc_id_list) > 0:
            query_vec = self.tfidf_vectorizer.transform([norm_combined])
            sims = cosine_similarity(query_vec, self.tfidf_matrix)[0]
            for idx, did in enumerate(self.doc_id_list):
                query_tfidf_sims[did] = float(sims[idx])

        matches = []
        highest_score = 0.0

        for doc_id, doc in self.documents.items():
            # Exclude self-comparison
            if doc.doc_id == question_id or doc.doc_id == f"{question_id}:{version_no}":
                continue

            # Exclude parent versions of the same question!
            # (A minor revision must not flag as duplicate of its own parent)
            if parent_version_id and (doc.doc_id == parent_version_id or doc.doc_id.startswith(parent_version_id)):
                continue

            # 1. Exact match test
            exact_combined_match = (query_exact_hash == doc.exact_hash)
            exact_stem_match = (query_stem_hash == doc.stem_hash)
            exact_masked_match = (query_masked_hash == doc.masked_hash)

            # 2. MinHash Jaccard similarity
            minhash_score = query_minhash.jaccard(doc.minhash)
            stem_minhash_score = query_stem_minhash.jaccard(doc.stem_minhash)

            # 3. TF-IDF cosine similarity
            tfidf_score = query_tfidf_sims.get(doc_id, 0.0)

            # 4. Separate stem score
            stem_score = max(
                1.0 if exact_stem_match else 0.0,
                stem_minhash_score
            )

            # 5. Options set comparison (order-invariant matching)
            options_score, options_reordered = self._compare_options(norm_options, doc.norm_options)

            # Compute composite overall score
            if exact_combined_match:
                overall_score = 1.0
            elif exact_masked_match:
                # Number-masked exact match
                overall_score = max(0.92, tfidf_score, minhash_score)
            else:
                # Weighted combination of TF-IDF, MinHash, stem, and options
                overall_score = float(
                    0.45 * tfidf_score +
                    0.35 * minhash_score +
                    0.10 * stem_score +
                    0.10 * options_score
                )
                if options_reordered and stem_score > 0.7:
                    overall_score = max(overall_score, 0.88)

            overall_score = round(min(1.0, max(0.0, overall_score)), 4)

            # Only include if score >= medium_threshold or exact match
            if overall_score >= medium_threshold or exact_combined_match or exact_masked_match:
                highest_score = max(highest_score, overall_score)

                # Determine matched spans
                matched_spans = self._extract_matching_spans(stem, doc.raw_stem)

                # Determine snippet visibility:
                # PAST_PAPER and PUBLIC can reveal snippet text.
                # BANK questions reveal snippet text ONLY if doc is public or will be masked at API layer.
                source_snippet = None
                if doc.source_type in ('PAST_PAPER', 'PUBLIC'):
                    source_snippet = doc.raw_stem[:300] + ('...' if len(doc.raw_stem) > 300 else '')

                matches.append({
                    "sourceType": doc.source_type,
                    "sourceReference": doc.source_reference,
                    "matchedQuestionVersionId": doc.doc_id if doc.source_type == 'BANK' else None,
                    "matchedDocumentId": doc.doc_id if doc.source_type != 'BANK' else None,
                    "overallScore": overall_score,
                    "exactHashMatch": exact_combined_match or exact_masked_match,
                    "minhashScore": round(minhash_score, 4),
                    "tfidfScore": round(tfidf_score, 4),
                    "semanticScore": None,
                    "stemScore": round(stem_score, 4),
                    "optionsScore": round(options_score, 4),
                    "optionsReorderedMatch": options_reordered,
                    "matchedSpans": matched_spans,
                    "sourceTextSnippet": source_snippet,
                })

        # Sort matches descending by overallScore
        matches.sort(key=lambda m: m["overallScore"], reverse=True)

        # Determine overall risk level
        if highest_score >= exact_match_threshold:
            risk_level = "EXACT"
        elif highest_score >= high_threshold:
            risk_level = "HIGH"
        elif highest_score >= medium_threshold:
            risk_level = "MEDIUM"
        elif highest_score > 0.25:
            risk_level = "LOW"
        else:
            risk_level = "NONE"

        return {
            "riskLevel": risk_level,
            "highestScore": round(highest_score, 4),
            "matches": matches,
            "totalMatches": len(matches),
        }

    @staticmethod
    def _compare_options(q_opts: List[str], doc_opts: List[str]) -> Tuple[float, bool]:
        """
        Compare answer-option sets. Detects if the same options are present in scrambled order.
        """
        if not q_opts or not doc_opts:
            return 0.0, False

        # Multiset / sorted comparison
        q_sorted = sorted(q_opts)
        doc_sorted = sorted(doc_opts)

        if q_sorted == doc_sorted:
            # Exact multiset match
            is_reordered = (q_opts != doc_opts)
            return 1.0, is_reordered

        # Jaccard over normalized options
        set_q = set(q_opts)
        set_d = set(doc_opts)
        overlap = len(set_q.intersection(set_d))
        union = len(set_q.union(set_d))
        jaccard = overlap / union if union > 0 else 0.0

        return jaccard, False

    @staticmethod
    def _extract_matching_spans(query: str, target: str) -> List[Dict[str, Any]]:
        """Find common overlapping word n-grams (3+ words)"""
        q_words = query.split()
        t_words = set(Normalizer.get_shingles(target.lower(), k=3))
        spans = []

        for i in range(len(q_words) - 2):
            trigram = f"{q_words[i].lower()} {q_words[i+1].lower()} {q_words[i+2].lower()}"
            if trigram in t_words:
                text = f"{q_words[i]} {q_words[i+1]} {q_words[i+2]}"
                spans.append({"start": i, "end": i + 3, "text": text})

        return spans[:10] # Top 10 spans
