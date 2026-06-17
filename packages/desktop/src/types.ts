export type NodeType = 'folder' | 'file' | 'drive';

export interface FSNode {
  id: string;
  name: string;
  type: NodeType;
  parentId: string | null;
  childIds: string[];
  createdAt: number;
  modifiedAt: number;
  protected?: boolean;
  driveLabel?: string;
}

export interface FSData {
  nodes: Record<string, FSNode>;
  rootId: string;
  version: number;
}

export interface WindowState {
  id: string;
  title: string;
  el: HTMLElement;
  x: number;
  y: number;
  w: number;
  h: number;
  minimized: boolean;
  maximized: boolean;
  prevRect?: { x: number; y: number; w: number; h: number };
}
