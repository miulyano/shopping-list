/** A named list (bucket): «Общее»/«Тата»/«Максим». */
export interface NamedList {
  id: number;
  key: string;
  name: string;
  color: string | null;
  position: number;
  is_default: boolean;
}

export interface ApiItem {
  id: number;
  name: string;
  qty: string | null;
  done: boolean;
  position: number;
  /** Category key (food | home | care); null on legacy rows before backfill. */
  category: string | null;
  /** Named list this item belongs to; null on legacy rows before backfill. */
  named_list_id: number | null;
  /** Optimistic-only field set in toggle handler; backend never returns it. */
  checked_at?: number | null;
}

export interface ApiList {
  id: number;
  created_at: number;
  archived_at: number | null;
  /** Named list this archived snapshot was bought from. */
  named_list_id: number | null;
  items: ApiItem[];
}

export type IngestStage = 'pending' | 'transcribing' | 'analyzing' | 'parsing' | 'success' | 'error' | string;
export type IngestKind = 'text' | 'voice' | 'photo' | string;

export interface ApiIngest {
  id: number;
  kind: IngestKind;
  stage: IngestStage;
  title: string;
  sub: string | null;
  added: number | null;
  updated_at: number;
}

export interface ApiState {
  active_list: ApiList | null;
  archive_count: number;
  ingest: ApiIngest | null;
  lists: NamedList[];
}

export interface ApiArchiveList {
  lists: ApiList[];
}

export interface ApiSetDoneResult {
  list_id: number;
  done: boolean;
  archived: boolean;
  archived_named_list_id: number | null;
}

export interface ApiMoveResult {
  id: number;
  list_id: number;
  named_list_id: number;
  archived: boolean;
  /** Buckets archived by this move — target and/or source, zero to two. */
  archived_named_list_ids: number[];
}

export interface ApiDeleteResult {
  id: number;
  list_id: number;
  deleted: boolean;
  archived: boolean;
  archived_named_list_id: number | null;
}

export interface ApiReuseResult {
  list_id: number;
  added: number;
}

export interface ApiArchivePurchasedResult {
  archived_list_id: number;
  moved: number;
}
