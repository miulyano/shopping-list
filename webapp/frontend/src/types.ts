export interface ApiItem {
  id: number;
  name: string;
  qty: string | null;
  done: boolean;
  position: number;
  /** Category key (food | home | care); null on legacy rows before backfill. */
  category: string | null;
  /** Optimistic-only field set in toggle handler; backend never returns it. */
  checked_at?: number | null;
}

export interface ApiList {
  id: number;
  created_at: number;
  archived_at: number | null;
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
}

export interface ApiArchiveList {
  lists: ApiList[];
}

export interface ApiSetDoneResult {
  list_id: number;
  done: boolean;
  archived: boolean;
}

export interface ApiReuseResult {
  list_id: number;
  added: number;
}

export interface ApiArchivePurchasedResult {
  archived_list_id: number;
  moved: number;
}
