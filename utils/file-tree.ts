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
  size: number;
  completedBytes: number;
}
export interface FileTreeIndex {
  root: Folder;
  fileItems: Map<number, FileTreeItem>;
}

const naturalNameCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});
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
  return buildFileTreeFromIndex(createFileTreeIndex(files), options, collapsed);
}

export function createFileTreeIndex(files: TorrentFile[]): FileTreeIndex {
  const root: Folder = {
    name: '',
    path: '',
    folders: new Map(),
    files: [],
    descendants: [],
    size: 0,
    completedBytes: 0,
  };
  const fileItems = new Map<number, FileTreeItem>();
  for (const file of files) {
    const parts = file.name.split('/');
    let folder = root;
    folder.descendants.push(file);
    folder.size += file.size;
    folder.completedBytes += file.size * file.progress;
    for (let i = 0; i < parts.length - 1; i++) {
      const name = parts[i];
      const path = parts.slice(0, i + 1).join('/');
      if (!folder.folders.has(name))
        folder.folders.set(name, {
          name,
          path,
          folders: new Map(),
          files: [],
          descendants: [],
          size: 0,
          completedBytes: 0,
        });
      folder = folder.folders.get(name)!;
      folder.descendants.push(file);
      folder.size += file.size;
      folder.completedBytes += file.size * file.progress;
    }
    folder.files.push(file);
    fileItems.set(file.index, {
      id: `file-${file.index}`,
      type: 'file',
      name: parts[parts.length - 1],
      path: file.name,
      depth: parts.length - 1,
      file,
      size: file.size,
      progress: file.progress,
    });
  }
  return { root, fileItems };
}

export function buildFileTreeFromIndex(
  index: FileTreeIndex,
  options: FileTreeOptions,
  collapsed: Set<string>,
  matchingFiles = filterTorrentFiles(index.root.descendants, options),
): FileTreeItem[] {
  const matches = new Set(matchingFiles.map((file) => file.index));
  const active = hasFileFilters(options);
  const items: FileTreeItem[] = [];
  const sign = options.direction === 'asc' ? 1 : -1;
  const compare = (a: FileTreeItem, b: FileTreeItem) => {
    const names = naturalNameCollator.compare(a.name, b.name) || a.path.localeCompare(b.path);
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
      const matching = child.descendants.filter((file) => matches.has(file.index));
      const item: FileTreeItem = {
        id: `folder-${child.path}`,
        type: 'folder',
        name: child.name,
        path: child.path,
        depth,
        size: child.size,
        progress: child.size ? child.completedBytes / child.size : 0,
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
    const fileRows = folder.files
      .filter((file) => matches.has(file.index))
      .map((file) => index.fileItems.get(file.index)!);
    items.push(...fileRows.sort(compare));
  }
  visit(index.root, 0);
  return items;
}
