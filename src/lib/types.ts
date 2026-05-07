// 一条日程
export interface Entry {
  id: string; // ULID
  start: string; // "HH:MM"
  end: string; // "HH:MM"，必须 >= start，禁止跨午夜
  text: string; // 原始文本（Plan 1 不渲染 Markdown）
  tagId: string | null; // Plan 1 固定为 null
  createdAt: string; // ISO 8601 UTC
  updatedAt: string; // ISO 8601 UTC
}

// 一天的数据
export interface DayData {
  entries: Entry[];
}

// 月文件 data/YYYY-MM.json 的全部内容
export interface MonthData {
  version: 1;
  month: string; // "YYYY-MM"
  days: Record<string, DayData>; // key: "YYYY-MM-DD"
}

// 月文件附带的 sha（GitHub blob sha）
export interface MonthDoc {
  data: MonthData;
  sha: string | null; // null = 仓库里还没这个文件
}

// 登录态
export type AuthState =
  | { kind: "anonymous" }
  | { kind: "logged-in"; token: string; user: { login: string } };

// 仓库就绪态
export type RepoState =
  | { kind: "unknown" } // 还没检测
  | { kind: "missing" } // dairybook-data 仓库不存在或 App 未安装
  | { kind: "ready"; owner: string; repo: string };

// 同步状态指示
export type SyncStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: number } // unix ms
  | { kind: "error"; message: string; retryable: boolean };

// === Plan 2: Tags ===
export interface Tag {
  id: string;                 // 短英文 slug，不可改
  name: string;
  color: string;              // CSS hex "#RRGGBB"
  updatedAt: string;          // ISO 8601 UTC
  deletedAt: string | null;   // 软删除
}
export interface TagsData {
  version: 1;
  tags: Tag[];
}
export interface TagsDoc { data: TagsData; sha: string | null; }
