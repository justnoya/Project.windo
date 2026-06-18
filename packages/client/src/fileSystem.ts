const FS_KEY = 'xp_vfs_v6';
const FS_VER = 6;

export type NodeType = 'folder' | 'drive';

export interface FSNode {
  id: string;
  name: string;
  type: NodeType;
  parentId: string | null;
  childIds: string[];
  createdAt: number;
  modifiedAt: number;
  protected?: boolean;
}

interface FSData {
  version: number;
  rootId: string;
  nodes: Record<string, FSNode>;
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const now = Date.now();
const old = now - 1000 * 60 * 60 * 24 * 120;

const DEFAULT: FSData = {
  version: FS_VER,
  rootId: 'root',
  nodes: {
    root:      { id: 'root',      name: 'My Computer',      type: 'folder', parentId: null,   childIds: ['c'],                                        createdAt: old, modifiedAt: now, protected: true },
    c:         { id: 'c',         name: 'Local Disk (C:)',   type: 'drive',  parentId: 'root',  childIds: ['mydocs', 'progfiles', 'windows_'],           createdAt: old, modifiedAt: now, protected: true },

    mydocs:    { id: 'mydocs',    name: 'My Documents',     type: 'folder', parentId: 'c',     childIds: ['mypics', 'mymusic', 'myvideos', 'mydownloads'], createdAt: old, modifiedAt: now, protected: true },
    mypics:    { id: 'mypics',    name: 'My Pictures',      type: 'folder', parentId: 'mydocs', childIds: [],                                           createdAt: old, modifiedAt: now },
    mymusic:   { id: 'mymusic',   name: 'My Music',         type: 'folder', parentId: 'mydocs', childIds: [],                                           createdAt: old, modifiedAt: now },
    myvideos:  { id: 'myvideos',  name: 'My Videos',        type: 'folder', parentId: 'mydocs', childIds: [],                                           createdAt: old, modifiedAt: now },
    mydownloads:{ id:'mydownloads',name:'My Downloads',     type: 'folder', parentId: 'mydocs', childIds: [],                                           createdAt: old, modifiedAt: now },

    progfiles: { id: 'progfiles', name: 'Program Files',    type: 'folder', parentId: 'c',     childIds: [],                                           createdAt: old, modifiedAt: now, protected: true },

    windows_:  { id: 'windows_',  name: 'Windows',          type: 'folder', parentId: 'c',     childIds: ['win_sys32'],                                 createdAt: old, modifiedAt: now, protected: true },
    win_sys32: { id: 'win_sys32', name: 'System32',          type: 'folder', parentId: 'windows_', childIds: [],                                        createdAt: old, modifiedAt: now, protected: true },
  }
};

export class VirtualFileSystem {
  private data: FSData;

  constructor() {
    this.data = this.load();
  }

  private load(): FSData {
    try {
      const raw = localStorage.getItem(FS_KEY);
      if (raw) {
        const d = JSON.parse(raw) as FSData;
        if (d.version === FS_VER) return d;
      }
    } catch { /* ignore */ }
    return JSON.parse(JSON.stringify(DEFAULT));
  }

  private save() {
    try { localStorage.setItem(FS_KEY, JSON.stringify(this.data)); } catch { /* ignore */ }
  }

  get rootId(): string { return this.data.rootId; }

  getNode(id: string): FSNode | null {
    return this.data.nodes[id] ?? null;
  }

  getChildren(parentId: string): FSNode[] {
    return (this.getNode(parentId)?.childIds ?? [])
      .map(id => this.data.nodes[id])
      .filter(Boolean)
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'drive' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }

  getPath(id: string): FSNode[] {
    const path: FSNode[] = [];
    let cur = this.getNode(id);
    while (cur) {
      path.unshift(cur);
      cur = cur.parentId ? this.getNode(cur.parentId) : null;
    }
    return path;
  }

  createFolder(parentId: string, baseName = 'New Folder'): FSNode | null {
    const parent = this.getNode(parentId);
    if (!parent) return null;
    const siblings = this.getChildren(parentId).map(n => n.name.toLowerCase());
    let name = baseName;
    let i = 2;
    while (siblings.includes(name.toLowerCase())) name = `${baseName} (${i++})`;
    const id = uid();
    const t = Date.now();
    const node: FSNode = { id, name, type: 'folder', parentId, childIds: [], createdAt: t, modifiedAt: t };
    this.data.nodes[id] = node;
    parent.childIds.push(id);
    parent.modifiedAt = t;
    this.save();
    return node;
  }

  rename(id: string, newName: string): boolean {
    const node = this.getNode(id);
    const trimmed = newName.trim();
    if (!node || node.protected || !trimmed) return false;
    node.name = trimmed;
    node.modifiedAt = Date.now();
    this.save();
    return true;
  }

  delete(id: string): boolean {
    const node = this.getNode(id);
    if (!node || node.protected) return false;
    if (node.parentId) {
      const parent = this.getNode(node.parentId);
      if (parent) {
        parent.childIds = parent.childIds.filter(c => c !== id);
        parent.modifiedAt = Date.now();
      }
    }
    this.deleteTree(id);
    this.save();
    return true;
  }

  private deleteTree(id: string) {
    const node = this.data.nodes[id];
    if (!node) return;
    node.childIds.forEach(c => this.deleteTree(c));
    delete this.data.nodes[id];
  }

  countDescendants(id: string): number {
    const node = this.getNode(id);
    if (!node) return 0;
    return node.childIds.reduce((sum, c) => sum + 1 + this.countDescendants(c), 0);
  }
}
