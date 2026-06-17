// Standard-API-Response-Typen für SchulAdmin
// Konsistentes Format für alle Endpunkte

// Erfolgs-Response
export interface ApiResponse<T> {
  data: T;
  meta?: PaginationMeta;
}

// Fehler-Response
export interface ApiError {
  error: string;
  code: string;
  details?: Record<string, unknown>;
}

// Paginierungs-Metadaten
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Paginierte Response (Kombination)
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

// Generische Upsert-Response
export interface UpsertResponse<T> {
  data: T;
  created: boolean; // true = neu erstellt, false = aktualisiert
}
