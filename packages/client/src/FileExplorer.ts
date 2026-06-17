import { VirtualFileSystem, FSNode } from './fileSystem';
import * as Icons from './XPIcons';

interface ExplorerCallbacks {
  onNavigate?: (nodeId: string) => void;
}

export class FileExplorer {
  private currentId = '';
  private history: string[] = [];
  private histIdx = -1;

  constructor(
    private fs: VirtualFileSystem,
    private content: HTMLElement,
    private addrInput: HTMLInputElement,
    private statusEl: HTMLElement,
    private backBtn: HTMLButtonElement,
    private fwdBtn: HTMLButtonElement,
    private upBtn: HTMLButtonElement,
    private titleEl: HTMLElement,
    startId: string,
    private _cb?: ExplorerCallbacks
  ) {
    this.backBtn.addEventListener('click', () => this.goBack());
    this.fwdBtn.addEventListener('click', () => this.goForward());
    this.upBtn.addEventListener('click', () => this.goUp());
    this.navigate(startId);
  }

  // ── Navigation ────────────────────────────────────────────────────────────────
  navigate(nodeId: string) {
    this.history = this.history.slice(0, this.histIdx + 1);
    this.history.push(nodeId);
    this.histIdx = this.history.length - 1;
    this.currentId = nodeId;
    this.render();
    this._cb?.onNavigate?.(nodeId);
  }

  goBack() {
    if (this.histIdx <= 0) return;
    this.histIdx--;
    this.currentId = this.history[this.histIdx];
    this.render();
  }

  goForward() {
    if (this.histIdx >= this.history.length - 1) return;
    this.histIdx++;
    this.currentId = this.history[this.histIdx];
    this.render();
  }

  goUp() {
    const node = this.fs.getNode(this.currentId);
    if (node?.parentId) this.navigate(node.parentId);
  }

  newFolder() {
    const created = this.fs.createFolder(this.currentId);
    if (!created) return;
    this.render();
    // Start inline rename after render
    requestAnimationFrame(() => {
      const item = this.content.querySelector(`[data-id="${created.id}"]`) as HTMLElement;
      if (item) this.startRename(item, created.id);
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  private render() {
    const node = this.fs.getNode(this.currentId);
    const children = this.fs.getChildren(this.currentId);

    // Update controls
    const path = this.fs.getPath(this.currentId);
    const pathStr = path.map(n => n.name).join(' › ');
    if (this.addrInput) this.addrInput.value = pathStr;
    if (this.titleEl) this.titleEl.textContent = node?.name ?? 'My Computer';
    if (this.backBtn) this.backBtn.disabled = this.histIdx <= 0;
    if (this.fwdBtn) this.fwdBtn.disabled = this.histIdx >= this.history.length - 1;
    if (this.upBtn) this.upBtn.disabled = !node?.parentId;
    if (this.statusEl) this.statusEl.textContent = `${children.length} object${children.length !== 1 ? 's' : ''}`;

    // Render items
    this.content.innerHTML = '';
    if (children.length === 0) {
      this.content.classList.add('xp-empty');
      const msg = document.createElement('div');
      msg.className = 'xp-empty-msg';
      msg.textContent = 'This folder is empty';
      this.content.appendChild(msg);
      return;
    }
    this.content.classList.remove('xp-empty');

    children.forEach(child => {
      const item = this.makeItem(child);
      this.content.appendChild(item);
    });

    // Content area right-click
    this.content.oncontextmenu = (e) => {
      if ((e.target as HTMLElement).closest('.xp-fitem')) return;
      e.preventDefault();
      this.showContentMenu(e.clientX, e.clientY);
    };
  }

  private makeItem(node: FSNode): HTMLElement {
    const item = document.createElement('div');
    item.className = 'xp-fitem';
    item.dataset.id = node.id;
    item.title = node.name;

    const iconSvg = node.type === 'drive' ? Icons.harddisk : Icons.folder;
    item.innerHTML = `
      <svg viewBox="0 0 48 48">${iconSvg}</svg>
      <span class="xp-flabel">${this.escHtml(node.name)}</span>
    `;

    let lastTap = 0;
    let selected = false;

    // Select / open
    item.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      const now = Date.now();

      // Deselect all others
      this.content.querySelectorAll('.xp-fitem').forEach(el => el.classList.remove('xp-sel'));
      item.classList.add('xp-sel');
      selected = true;

      if (now - lastTap < 400 && now - lastTap > 30) {
        // Double-click / double-tap → open
        this.navigate(node.id);
      }
      lastTap = now;
    });

    // Right-click
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.content.querySelectorAll('.xp-fitem').forEach(el => el.classList.remove('xp-sel'));
      item.classList.add('xp-sel');
      this.showItemMenu(e.clientX, e.clientY, node);
    });

    return item;
  }

  // ── Inline rename ─────────────────────────────────────────────────────────────
  private startRename(item: HTMLElement, nodeId: string) {
    const node = this.fs.getNode(nodeId);
    if (!node || node.protected) return;

    const labelEl = item.querySelector('.xp-flabel') as HTMLElement;
    if (!labelEl) return;

    item.classList.remove('xp-sel');
    const input = document.createElement('input');
    input.className = 'xp-frename';
    input.value = node.name;
    labelEl.replaceWith(input);
    input.select();
    input.focus();

    const commit = () => {
      const newName = input.value.trim();
      if (newName && newName !== node.name) this.fs.rename(nodeId, newName);
      this.render();
    };

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { this.render(); }
    });
  }

  // ── Context menus ─────────────────────────────────────────────────────────────
  private showItemMenu(x: number, y: number, node: FSNode) {
    this.closeCtx();
    const menu = document.createElement('div');
    menu.className = 'xp-ctx';

    const openRow = this.ctxRow(`<svg viewBox="0 0 48 48">${Icons.folderOpen}</svg> Open`);
    openRow.style.fontWeight = 'bold';
    openRow.addEventListener('click', () => { this.closeCtx(); this.navigate(node.id); });
    menu.appendChild(openRow);

    menu.appendChild(this.ctxSep());

    if (!node.protected) {
      const renameRow = this.ctxRow('Rename');
      renameRow.addEventListener('click', () => {
        this.closeCtx();
        const item = this.content.querySelector(`[data-id="${node.id}"]`) as HTMLElement;
        if (item) this.startRename(item, node.id);
      });
      menu.appendChild(renameRow);

      const deleteRow = this.ctxRow('Delete');
      deleteRow.addEventListener('click', () => {
        this.closeCtx();
        this.confirmDelete(node);
      });
      menu.appendChild(deleteRow);

      menu.appendChild(this.ctxSep());
    }

    const propsRow = this.ctxRow('Properties');
    propsRow.addEventListener('click', () => {
      this.closeCtx();
      this.showProps(node);
    });
    menu.appendChild(propsRow);

    this.positionCtx(menu, x, y);
    document.body.appendChild(menu);

    const closeOnOut = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) { this.closeCtx(); document.removeEventListener('pointerdown', closeOnOut, true); }
    };
    setTimeout(() => document.addEventListener('pointerdown', closeOnOut, true), 0);
  }

  private showContentMenu(x: number, y: number) {
    this.closeCtx();
    const menu = document.createElement('div');
    menu.className = 'xp-ctx';

    const newFolderRow = this.ctxRow(`<svg viewBox="0 0 48 48">${Icons.folder}</svg> New Folder`);
    newFolderRow.addEventListener('click', () => { this.closeCtx(); this.newFolder(); });
    menu.appendChild(newFolderRow);

    this.positionCtx(menu, x, y);
    document.body.appendChild(menu);

    const closeOnOut = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) { this.closeCtx(); document.removeEventListener('pointerdown', closeOnOut, true); }
    };
    setTimeout(() => document.addEventListener('pointerdown', closeOnOut, true), 0);
  }

  private ctxRow(html: string): HTMLElement {
    const row = document.createElement('div');
    row.className = 'xp-ctx-item';
    row.innerHTML = html;
    return row;
  }

  private ctxSep(): HTMLElement {
    const sep = document.createElement('div');
    sep.className = 'xp-ctx-sep';
    return sep;
  }

  private positionCtx(menu: HTMLElement, x: number, y: number) {
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    requestAnimationFrame(() => {
      const r = menu.getBoundingClientRect();
      if (r.right > window.innerWidth) menu.style.left = (x - r.width) + 'px';
      if (r.bottom > window.innerHeight) menu.style.top = (y - r.height) + 'px';
    });
  }

  private closeCtx() {
    document.querySelectorAll('.xp-ctx').forEach(m => m.remove());
  }

  // ── Dialogs ───────────────────────────────────────────────────────────────────
  private confirmDelete(node: FSNode) {
    const count = this.fs.countDescendants(node.id);
    const extra = count > 0 ? `<br><small>This contains ${count} item${count !== 1 ? 's' : ''}.</small>` : '';
    const overlay = this.makeDialogOverlay();
    const dialog = this.makeDialog('Confirm Folder Delete',
      `<div class="xp-dlg-msg">
        <svg viewBox="0 0 48 48">${Icons.warnIcon}</svg>
        <span>Are you sure you want to remove the folder <b>${this.escHtml(node.name)}</b>?${extra}</span>
      </div>`,
      [
        { label: 'Yes', primary: true, onClick: () => { this.fs.delete(node.id); this.render(); } },
        { label: 'No' }
      ]
    );
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
  }

  private showProps(node: FSNode) {
    const created = new Date(node.createdAt).toLocaleString();
    const modified = new Date(node.modifiedAt).toLocaleString();
    const count = this.fs.countDescendants(node.id);
    const overlay = this.makeDialogOverlay();
    const dialog = this.makeDialog(`${node.name} Properties`,
      `<div class="xp-dlg-msg">
        <svg viewBox="0 0 48 48">${node.type === 'drive' ? Icons.harddisk : Icons.folder}</svg>
        <div>
          <b>${this.escHtml(node.name)}</b><br>
          Type: ${node.type === 'drive' ? 'Local Disk' : 'File Folder'}<br>
          Contains: ${count} folder${count !== 1 ? 's' : ''}<br>
          Created: ${created}<br>
          Modified: ${modified}
        </div>
      </div>`,
      [{ label: 'OK', primary: true }]
    );
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
  }

  private makeDialogOverlay(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'xp-dialog-overlay';
    return el;
  }

  private makeDialog(title: string, bodyHtml: string, buttons: { label: string; primary?: boolean; onClick?: () => void }[]): HTMLElement {
    const d = document.createElement('div');
    d.className = 'xp-dialog';
    const btnsHtml = buttons.map((b, i) =>
      `<button class="xp-dlg-btn" data-idx="${i}">${b.label}</button>`
    ).join('');
    d.innerHTML = `
      <div class="xp-dlg-title">
        <svg viewBox="0 0 48 48" width="16" height="16">${Icons.mycomputer}</svg>
        ${this.escHtml(title)}
      </div>
      <div class="xp-dlg-body">
        ${bodyHtml}
        <div class="xp-dlg-btns">${btnsHtml}</div>
      </div>
    `;
    d.querySelectorAll('.xp-dlg-btn').forEach((btn, i) => {
      btn.addEventListener('click', () => {
        d.closest('.xp-dialog-overlay')?.remove();
        buttons[i]?.onClick?.();
      });
    });
    return d;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────
  private escHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
