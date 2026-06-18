const FS_KEY = 'xp_vfs_v5';
const FS_VER = 5;

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
const old = now - 1000 * 60 * 60 * 24 * 120; // 120 days ago (feels lived-in)

const DEFAULT: FSData = {
  version: FS_VER,
  rootId: 'root',
  nodes: {
    root:        { id: 'root',        name: 'My Computer',        type: 'folder', parentId: null,      childIds: ['c'],                             createdAt: old, modifiedAt: now, protected: true },
    c:           { id: 'c',           name: 'Local Disk (C:)',     type: 'drive',  parentId: 'root',     childIds: ['mydocs','desktop_','progfiles','windows_'],    createdAt: old, modifiedAt: now, protected: true },

    // My Documents tree
    mydocs:      { id: 'mydocs',      name: 'My Documents',       type: 'folder', parentId: 'c',        childIds: ['mypics','mymusic','myvideos','mydownloads','hw_doc','todo_txt','diary_txt','misc_stuff'], createdAt: old, modifiedAt: now, protected: true },

    // "Files" (folders named like files — rewards exploration)
    hw_doc:      { id: 'hw_doc',      name: 'homework due tomorrow FINAL v3.doc',  type: 'folder', parentId: 'mydocs', childIds: [],         createdAt: old, modifiedAt: now },
    todo_txt:    { id: 'todo_txt',    name: 'TODO - important!!.txt',               type: 'folder', parentId: 'mydocs', childIds: [],         createdAt: old, modifiedAt: now },
    diary_txt:   { id: 'diary_txt',   name: 'diary (private DO NOT READ).txt',      type: 'folder', parentId: 'mydocs', childIds: ['diary_locked'], createdAt: old, modifiedAt: now },
    diary_locked:{ id: 'diary_locked',name: '(nothing interesting here)',           type: 'folder', parentId: 'diary_txt', childIds: [],      createdAt: old, modifiedAt: now },
    misc_stuff:  { id: 'misc_stuff',  name: 'Miscellaneous Stuff (important)',      type: 'folder', parentId: 'mydocs', childIds: [],         createdAt: old, modifiedAt: now },

    // My Pictures
    mypics:      { id: 'mypics',      name: 'My Pictures',        type: 'folder', parentId: 'mydocs',   childIds: ['bliss_copy','profile_final','memes','screenshots'], createdAt: old, modifiedAt: now },
    bliss_copy:  { id: 'bliss_copy',  name: 'bliss_BETTER_v2_cropped_hd.bmp',      type: 'folder', parentId: 'mypics', childIds: [],          createdAt: old, modifiedAt: now },
    profile_final:{ id:'profile_final',name:'profile_pic_final_FINAL_use_this_one.jpg', type:'folder',parentId:'mypics',childIds:[],           createdAt: old, modifiedAt: now },
    memes:       { id: 'memes',       name: 'memes (funny)',                        type: 'folder', parentId: 'mypics', childIds: ['trollface','nyan'], createdAt: old, modifiedAt: now },
    trollface:   { id: 'trollface',   name: 'u mad bro.jpg',                       type: 'folder', parentId: 'memes', childIds: [],           createdAt: old, modifiedAt: now },
    nyan:        { id: 'nyan',        name: 'nyan_cat_10_hours.gif',                type: 'folder', parentId: 'memes', childIds: [],           createdAt: old, modifiedAt: now },
    screenshots: { id: 'screenshots', name: 'Screenshots',                          type: 'folder', parentId: 'mypics', childIds: ['ss1','ss2'], createdAt: old, modifiedAt: now },
    ss1:         { id: 'ss1',         name: 'screenshot_000_untitled.png',          type: 'folder', parentId: 'screenshots', childIds: [],      createdAt: old, modifiedAt: now },
    ss2:         { id: 'ss2',         name: 'screenshot_001_omg_look.png',          type: 'folder', parentId: 'screenshots', childIds: [],      createdAt: old, modifiedAt: now },

    // My Music
    mymusic:     { id: 'mymusic',     name: 'My Music',           type: 'folder', parentId: 'mydocs',   childIds: ['song1','song2','song3','song4','song5'], createdAt: old, modifiedAt: now },
    song1:       { id: 'song1',       name: 'Rick Astley - Never Gonna Give You Up.mp3', type: 'folder', parentId: 'mymusic', childIds: [],   createdAt: old, modifiedAt: now },
    song2:       { id: 'song2',       name: 'Smash Mouth - All Star.mp3',           type: 'folder', parentId: 'mymusic', childIds: [],         createdAt: old, modifiedAt: now },
    song3:       { id: 'song3',       name: 'My Chemical Romance - Welcome to the Black Parade.mp3', type: 'folder', parentId: 'mymusic', childIds: [], createdAt: old, modifiedAt: now },
    song4:       { id: 'song4',       name: 'Linkin Park - In The End.mp3',         type: 'folder', parentId: 'mymusic', childIds: [],         createdAt: old, modifiedAt: now },
    song5:       { id: 'song5',       name: 'FREE_MUSIC_NO_VIRUS_CLICK_HERE.exe',   type: 'folder', parentId: 'mymusic', childIds: [],         createdAt: old, modifiedAt: now },

    // My Videos
    myvideos:    { id: 'myvideos',    name: 'My Videos',          type: 'folder', parentId: 'mydocs',   childIds: ['vid1','vid2'], createdAt: old, modifiedAt: now },
    vid1:        { id: 'vid1',        name: 'funny cat compilation 2006.avi',       type: 'folder', parentId: 'myvideos', childIds: [],         createdAt: old, modifiedAt: now },
    vid2:        { id: 'vid2',        name: 'totally_not_homework.mov',             type: 'folder', parentId: 'myvideos', childIds: [],         createdAt: old, modifiedAt: now },

    // My Downloads
    mydownloads: { id: 'mydownloads', name: 'My Downloads',       type: 'folder', parentId: 'mydocs',   childIds: ['dl1','dl2','dl3','dl4'], createdAt: old, modifiedAt: now },
    dl1:         { id: 'dl1',         name: 'FREE_ROBUX_GENERATOR_2006_REAL.exe',   type: 'folder', parentId: 'mydownloads', childIds: [],      createdAt: old, modifiedAt: now },
    dl2:         { id: 'dl2',         name: 'important_do_not_open.zip',            type: 'folder', parentId: 'mydownloads', childIds: [],      createdAt: old, modifiedAt: now },
    dl3:         { id: 'dl3',         name: 'limewire_setup.exe',                   type: 'folder', parentId: 'mydownloads', childIds: [],      createdAt: old, modifiedAt: now },
    dl4:         { id: 'dl4',         name: 'definitely_not_a_virus.exe',           type: 'folder', parentId: 'mydownloads', childIds: [],      createdAt: old, modifiedAt: now },

    // Desktop
    desktop_:    { id: 'desktop_',    name: 'Desktop',            type: 'folder', parentId: 'c',        childIds: ['dt_shortcut','dt_readme'], createdAt: old, modifiedAt: now },
    dt_shortcut: { id: 'dt_shortcut', name: 'Internet Explorer - Shortcut',         type: 'folder', parentId: 'desktop_', childIds: [],         createdAt: old, modifiedAt: now },
    dt_readme:   { id: 'dt_readme',   name: 'readme.txt',                           type: 'folder', parentId: 'desktop_', childIds: [],         createdAt: old, modifiedAt: now },

    // Program Files
    progfiles:   { id: 'progfiles',   name: 'Program Files',      type: 'folder', parentId: 'c',        childIds: ['pf_ie','pf_aim','pf_wmp','pf_notepad'], createdAt: old, modifiedAt: now, protected: true },
    pf_ie:       { id: 'pf_ie',       name: 'Internet Explorer',                    type: 'folder', parentId: 'progfiles', childIds: [],         createdAt: old, modifiedAt: now },
    pf_aim:      { id: 'pf_aim',      name: 'AIM',                                  type: 'folder', parentId: 'progfiles', childIds: [],         createdAt: old, modifiedAt: now },
    pf_wmp:      { id: 'pf_wmp',      name: 'Windows Media Player',                 type: 'folder', parentId: 'progfiles', childIds: [],         createdAt: old, modifiedAt: now },
    pf_notepad:  { id: 'pf_notepad',  name: 'Accessories',                          type: 'folder', parentId: 'progfiles', childIds: ['pf_np_exe'], createdAt: old, modifiedAt: now },
    pf_np_exe:   { id: 'pf_np_exe',   name: 'notepad.exe',                          type: 'folder', parentId: 'pf_notepad', childIds: [],         createdAt: old, modifiedAt: now },

    // Windows
    windows_:    { id: 'windows_',    name: 'Windows',            type: 'folder', parentId: 'c',        childIds: ['win_sys32','win_secret'], createdAt: old, modifiedAt: now, protected: true },
    win_sys32:   { id: 'win_sys32',   name: 'System32',                              type: 'folder', parentId: 'windows_', childIds: ['sys32_warning'], createdAt: old, modifiedAt: now },
    sys32_warning:{ id:'sys32_warning',name:'DO NOT DELETE (very important).dll',    type: 'folder', parentId: 'win_sys32', childIds: [],         createdAt: old, modifiedAt: now },
    win_secret:  { id: 'win_secret',  name: 'secret_do_not_open',                   type: 'folder', parentId: 'windows_', childIds: ['secret_1','secret_2'], createdAt: old, modifiedAt: now },
    secret_1:    { id: 'secret_1',    name: 'passwords.txt',                         type: 'folder', parentId: 'win_secret', childIds: ['secret_1a'], createdAt: old, modifiedAt: now },
    secret_1a:   { id: 'secret_1a',   name: '(nothing here, go away)',               type: 'folder', parentId: 'secret_1', childIds: [],           createdAt: old, modifiedAt: now },
    secret_2:    { id: 'secret_2',    name: 'the_waiting_screen_is_just_a_lobby.txt',type: 'folder', parentId: 'win_secret', childIds: [],          createdAt: old, modifiedAt: now },
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
