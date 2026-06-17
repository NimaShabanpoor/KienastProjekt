// Paginierungs-Hilfsfunktion für API-Responses

import { PAGINATION } from '../config/constants';

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginationResult {
  skip: number;
  take: number;
  page: number;
  limit: number;
}

/**
 * Berechnet Skip und Take-Werte für Prisma-Paginierung
 */
export function getPaginationParams(params: Partial<PaginationParams>): PaginationResult {
  const page = Math.max(1, params.page ?? PAGINATION.DEFAULT_PAGE);
  const limit = Math.min(
    PAGINATION.MAX_LIMIT,
    Math.max(1, params.limit ?? PAGINATION.DEFAULT_LIMIT)
  );

  return {
    skip: (page - 1) * limit,
    take: limit,
    page,
    limit,
  };
}

/**
 * Erstellt die Meta-Informationen für paginierte API-Responses
 */
export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number
) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}
