// JSON-RPC protocol
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: any;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: any;
  error?: { code: number; message: string; data?: any };
}

export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

export type JsonRpcMessage = JsonRpcRequest | JsonRpcResponse | JsonRpcNotification;

// ACP domain types
export interface AcpResource {
  uri: string;
  name: string;
  mimeType?: string;
  content: string;
}

export interface AcpToolCall {
  id: string;
  name: string;
  arguments: any;
}

export interface AcpEditFileArgs {
  path: string;
  hunks: AcpHunk[];
}

export interface AcpHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

export interface AcpMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: AcpToolCall[];
  timestamp: number;
}

// DiffEngine state
export type HunkState = 'pending' | 'accepted' | 'rejected' | 'revised';

export interface TrackedHunk {
  index: number;
  state: HunkState;
  original: AcpHunk;
  current?: AcpHunk;
}

export interface FileReview {
  path: string;
  hunks: TrackedHunk[];
  toolCallId: string;
  originalContent: string;
}

// Session persistence
export interface Session {
  id: string;
  title: string;
  createdAt: number;
  lastActiveAt: number;
  messages: AcpMessage[];
  context: SessionContextEntry[];
}

export type SessionContextEntry =
  | { type: 'file'; path: string; text: string }
  | { type: 'selection'; path: string; range: { from: number; to: number }; text: string };

export interface SessionSummary {
  id: string;
  title: string;
  lastActiveAt: number;
}

// Plugin settings
export interface CladeSettings {
  opencodeBinaryPath: string;
  envVars: Record<string, string>;
  maxReconnectAttempts: number;
  reconnectBaseDelayMs: number;
  sessionsDir: string;
}

export const DEFAULT_SETTINGS: CladeSettings = {
  opencodeBinaryPath: 'opencode',
  envVars: {},
  maxReconnectAttempts: 5,
  reconnectBaseDelayMs: 1000,
  sessionsDir: '.clade/sessions',
};

// Lifecycle events
export type LifecycleStatus = 'disconnected' | 'connecting' | 'connected' | 'failed';

export interface LifecycleEvent {
  status: LifecycleStatus;
  attempt?: number;
  error?: string;
}

// ACPClient events
export type AcpClientEvent =
  | { type: 'response:delta'; delta: string }
  | { type: 'response:done'; content: string; toolCalls: AcpToolCall[] }
  | { type: 'tool_call:received'; toolCall: AcpToolCall }
  | { type: 'error'; message: string; code?: number };

export type EventHandler<T> = (event: T) => void;
