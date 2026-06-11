---
# LEX Hallucination Prevention — Audit Log
Generated: 2026-06-11T11:06:27.923Z
System: LEX Legal AI Platform
Threshold: 0.50 cosine similarity (verified from live pipeline data)

## What This Document Shows

LEX refuses to generate an answer whenever retrieved source chunks fail to clear a
verified similarity threshold. This prevents hallucinated legal citations — the primary
trust failure mode in legal AI products. The following 0 queries were declined by
the system because no sufficiently grounded sources were found. In every case, the
system returned an explicit "insufficient sources" response instead of generating text.

No language model was invoked for any of the queries below.

> **Note:** The system is newly deployed — no declined queries have been logged yet. This is expected for a fresh instance. As real queries are processed, declined queries (those below the 0.50 threshold) will appear in this table.

---

## Declined Queries

| # | Query | Jurisdiction | Top Similarity | Chunks Found | Declined At |
|---|-------|-------------|---------------|-------------|-------------|


---

## Interpretation

Queries where Top Similarity < 0.50 indicate the question falls outside LEX's current
knowledge base coverage. These are typically:
- Very recent judgments not yet ingested
- Highly specialised tribunal orders not in the current corpus
- Queries phrased in a way that does not match any indexed document

This is the correct behaviour. A system that answers these queries would be hallucinating.

---
*This log is auto-generated from production agent_sessions data. It cannot be manually edited.*
