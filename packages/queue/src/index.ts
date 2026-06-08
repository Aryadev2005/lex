export const QUEUES = {
  DOCUMENT_PROCESSING: 'document-processing',
  EMBEDDING: 'embedding',
  ENRICHMENT: 'enrichment',
  HEARING_ALERTS: 'hearing-alerts',
  RESEARCH_CACHE_CLEANUP: 'research-cache-cleanup',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
