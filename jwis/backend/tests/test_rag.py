import unittest

from app.rag import build_rag_index, retrieve_jwis_context


class RagTests(unittest.TestCase):
    def test_rag_index_builds_with_recentering_and_whitening(self):
        index = build_rag_index()

        self.assertGreater(len(index.chunks), 5)
        self.assertEqual(index.vectors.shape[0], len(index.chunks))
        self.assertEqual(index.mean.shape[0], 1)
        self.assertEqual(index.components.shape[0], index.scale.shape[0])

    def test_rag_retrieves_forecast_context(self):
        results = retrieve_jwis_context("Can JWIS predict waste tonnage for the next 7 days?", top_k=3)
        joined = " ".join(item["text"].lower() for item in results)

        self.assertIn("7 days", joined)
        self.assertIn("predicted_tons", joined)
        self.assertTrue(any("forecast" in item["title"].lower() for item in results))

    def test_rag_index_contains_decision_logic_knowledge_docs(self):
        index = build_rag_index()
        sources = {chunk.source for chunk in index.chunks}
        self.assertTrue(any(s.startswith("docs/knowledge/01_") for s in sources), "decision logic doc not indexed")

    def test_rag_retrieves_tpa_threshold_from_knowledge_doc(self):
        results = retrieve_jwis_context("ambang antrian TPA yellow 45 90 red", top_k=3)
        sources = [item["source"] for item in results]
        self.assertTrue(any(s.startswith("docs/knowledge/01_") for s in sources), "decision logic doc not in top-3")
        joined = " ".join(item["text"].lower() for item in results)
        self.assertIn("45", joined)
        self.assertIn("90", joined)


if __name__ == "__main__":
    unittest.main()
