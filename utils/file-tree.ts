/** Pure torrent-file filtering and recursive sibling sorting. API indices are never reassigned. */
import { TorrentFile } from '@/types/api';

export type FileSort = 'name' | 'progress' | 'size' | 'priority';
export type InclusionFilter = 'all' | 'included' | 'skipped';
export type CompletionFilter = 'all' | 'complete' | 'incomplete';
export interface FileTreeOptions {
  query: string;
  inclusion: InclusionFilter;
  completion: CompletionFilter;
  sort: FileSort;
  direction: 'asc' | 'desc';
}
export const DEFAULT_FILE_TREE_OPTIONS: FileTreeOptions = {
  query: '',
  inclusion: 'all',
  completion: 'all',
  sort: 'name',
  direction: 'asc',
};
export interface FileTreeItem {
  id: string;
  type: 'file' | 'folder';
  name: string;
  path: string;
  depth: number;
  file?: TorrentFile;
  fileIndices?: number[];
  fileCount?: number;
  size: number;
  progress: number;
  allSelected?: boolean;
  someSelected?: boolean;
}
interface Folder {
  name: string;
  path: string;
  folders: Map<string, Folder>;
  files: TorrentFile[];
  descendants: TorrentFile[];
}
export function hasFileFilters(options: FileTreeOptions): boolean {
  return !!options.query.trim() || options.inclusion !== 'all' || options.completion !== 'all';
}
export function filterTorrentFiles(files: TorrentFile[], options: FileTreeOptions): TorrentFile[] {
  const query = options.query.trim().toLowerCase();
  return files.filter(
    (file) =>
      (!query || file.name.toLowerCase().includes(query)) &&
      (options.inclusion === 'all' || file.priority > 0 === (options.inclusion === 'included')) &&
      (options.completion === 'all' || file.progress >= 1 === (options.completion === 'complete')),
  );
}
export function buildFileTree(
  files: TorrentFile[],
  options: FileTreeOptions,
  collapsed: Set<string>,
): FileTreeItem[] {
  const root: Folder = { name: '', path: '', folders: new Map(), files: [], descendants: [] };
  for (const file of files) {
    const parts = file.name.split('/');
    let folder = root;
    folder.descendants.push(file);
    for (let i = 0; i < parts.length - 1; i++) {
      const name = parts[i];
      const path = parts.slice(0, i + 1).join('/');
      if (!folder.folders.has(name))
        folder.folders.set(name, { name, path, folders: new Map(), files: [], descendants: [] });
      folder = folder.folders.get(name)!;
      folder.descendants.push(file);
    }
    folder.files.push(file);
  }
  const matches = new Set(filterTorrentFiles(files, options).map((file) => file.index));
  const active = hasFileFilters(options);
  const items: FileTreeItem[] = [];
  const sign = options.direction === 'asc' ? 1 : -1;
  const compare = (a: FileTreeItem, b: FileTreeItem) => {
    const names =
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }) ||
      a.path.localeCompare(b.path);
    if (options.sort === 'priority' && a.type === 'folder') return names;
    if (options.sort === 'name') return sign * names;
    const value =
      options.sort === 'priority'
        ? a.file!.priority - b.file!.priority
        : a[options.sort] - b[options.sort];
    return sign * value || names;
  };
  function visit(folder: Folder, depth: number) {
    const folders = [...folder.folders.values()].filter((child) =>
      child.descendants.some((file) => matches.has(file.index)),
    );
    const rows = folders.map((child) => {
      // Folder aggregates describe the whole folder, even when only some descendants match.
      const size = child.descendants.reduce((sum, file) => sum + file.size, 0);
      const matching = child.descendants.filter((file) => matches.has(file.index));
      const item: FileTreeItem = {
        id: `folder-${child.path}`,
        type: 'folder',
        name: child.name,
        path: child.path,
        depth,
        size,
        progress: size
          ? child.descendants.reduce((sum, file) => sum + file.size * file.progress, 0) / size
          : 0,
        fileIndices: matching.map((file) => file.index),
        fileCount: child.descendants.length,
        allSelected: matching.every((file) => file.priority > 0),
        someSelected: matching.some((file) => file.priority > 0),
      };
      return { child, item };
    });
    rows.sort((a, b) => compare(a.item, b.item));
    for (const { child, item } of rows) {
      items.push(item);
      if (active || !collapsed.has(child.path)) visit(child, depth + 1);
    }
    const fileRows: FileTreeItem[] = folder.files
      .filter((file) => matches.has(file.index))
      .map((file) => ({
        id: `file-${file.index}`,
        type: 'file',
        name: file.name.split('/').pop()!,
        path: file.name,
        depth,
        file,
        size: file.size,
        progress: file.progress,
      }));
    items.push(...fileRows.sort(compare));
  }
  visit(root, 0);
  return items;
}
