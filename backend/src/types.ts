// API Types
export interface BindStartRequest {
  deviceName: string;
  vaultName: string;
}

export interface BindStartResponse {
  code: string;
  expiresAt: string;
}

export interface BindStatusResponse {
  status: 'pending' | 'confirmed' | 'expired';
  token?: string;
  userId?: string;
}

export interface Article {
  id: string;
  title: string;
  sourceUrl: string;
  account?: string;
  author?: string;
  publishedAt?: string;
  savedAt: string;
  markdown: string;
  contentKind?: 'article' | 'file';
  parseStatus?: string;
  parseError?: string;
}

export interface SyncArticlesResponse {
  articles: Article[];
}

export interface AckRequest {
  writtenPath: string;
}

// Storage Types
export interface User {
  id: string;
  token: string;
  createdAt: number;
}

export interface Binding {
  code: string;
  deviceName: string;
  vaultName: string;
  expiresAt: number;
  status: 'pending' | 'confirmed';
  userId?: string;
  token?: string;
}

export interface SyncedArticle {
  id: string;
  userId: string;
  title: string;
  sourceUrl: string;
  account?: string;
  author?: string;
  publishedAt?: string;
  savedAt: string;
  markdown: string;
  contentKind?: 'article' | 'file';
  acknowledged: boolean;
  acknowledgedPath?: string;
  createdAt: number;
}
