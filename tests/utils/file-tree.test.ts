import {
  buildFileTree,
  buildFileTreeFromIndex,
  createFileTreeIndex,
  DEFAULT_FILE_TREE_OPTIONS as defaults,
  filterTorrentFiles,
  FileTreeOptions,
} from '@/utils/file-tree';
import { TorrentFile } from '@/types/api';
const file = (
  index: number,
  name: string,
  progress = 0,
  size = 100,
  priority: TorrentFile['priority'] = 1,
): TorrentFile => ({ index, name, progress, size, priority, is_seed: false, piece_range: [0, 1] });
const tree = (
  files: TorrentFile[],
  options: Partial<FileTreeOptions> = {},
  collapsed = new Set<string>(),
) => buildFileTree(files, { ...defaults, ...options }, collapsed);
const paths = (items: ReturnType<typeof tree>) => items.map((item) => item.path);

describe('torrent file tree', () => {
  const files = [
    file(9, 'root/videos/July/clip10.mp4', 0.2),
    file(4, 'root/photos/January/image.jpg', 1),
    file(2, 'root/videos/January/clip2.mp4', 1),
    file(20, 'root/videos/July/clip2.mp4', 0.8),
    file(0, 'readme.txt', 0, 10, 0),
  ];
  it('builds contiguous nested branches from interleaved API order, folders first with natural names', () => {
    expect(paths(tree(files))).toEqual([
      'root',
      'root/photos',
      'root/photos/January',
      'root/photos/January/image.jpg',
      'root/videos',
      'root/videos/January',
      'root/videos/January/clip2.mp4',
      'root/videos/July',
      'root/videos/July/clip2.mp4',
      'root/videos/July/clip10.mp4',
      'readme.txt',
    ]);
    expect(
      tree(files)
        .filter((item) => item.file)
        .map((item) => item.file!.index),
    ).toEqual([4, 2, 20, 9, 0]);
  });
  it('sorts siblings recursively by completion in both directions', () => {
    const desc = paths(tree(files, { sort: 'progress', direction: 'desc' }));
    expect(desc.indexOf('root/photos')).toBeLessThan(desc.indexOf('root/videos'));
    expect(desc.indexOf('root/videos/January')).toBeLessThan(desc.indexOf('root/videos/July'));
    expect(desc.indexOf('root/videos/July/clip2.mp4')).toBeLessThan(
      desc.indexOf('root/videos/July/clip10.mp4'),
    );
    const asc = paths(tree(files, { sort: 'progress', direction: 'asc' }));
    expect(asc.indexOf('root/videos')).toBeLessThan(asc.indexOf('root/photos'));
  });
  it('weights folder completion by bytes and handles zero-byte folders', () => {
    const result = tree(
      [
        file(0, 'a/small', 1, 1),
        file(1, 'a/large', 0, 999),
        file(2, 'b/file', 0.5),
        file(3, 'empty/file', 1, 0),
      ],
      { sort: 'progress', direction: 'desc' },
    );
    expect(result.filter((item) => item.type === 'folder').map((item) => item.name)).toEqual([
      'b',
      'a',
      'empty',
    ]);
    expect(result.find((item) => item.path === 'a')!.progress).toBe(0.001);
    expect(result.find((item) => item.path === 'empty')!.progress).toBe(0);
  });
  it('sorts aggregate sizes while retaining folders before files', () => {
    expect(
      paths(
        tree([file(1, 'a/x', 0, 10), file(2, 'b/x', 0, 20), file(3, 'z', 0, 100)], {
          sort: 'size',
          direction: 'desc',
        }),
      ),
    ).toEqual(['b', 'b/x', 'a', 'a/x', 'z']);
  });
  it('keeps folders alphabetical for either priority direction, sorts files by priority and ties by name', () => {
    const input = [
      file(3, 'b/x', 0, 1, 7),
      file(1, 'a/z', 0, 1, 1),
      file(2, 'a/b', 0, 1, 7),
      file(4, 'a/a', 0, 1, 7),
    ];
    expect(paths(tree(input, { sort: 'priority', direction: 'desc' }))).toEqual([
      'a',
      'a/a',
      'a/b',
      'a/z',
      'b',
      'b/x',
    ]);
    expect(paths(tree(input, { sort: 'priority', direction: 'asc' }))).toEqual([
      'a',
      'a/z',
      'a/a',
      'a/b',
      'b',
      'b/x',
    ]);
  });
  it('collapses whole branches; filtering expands matches without mutating collapse state', () => {
    const collapsed = new Set(['root', 'root/videos']);
    expect(paths(tree(files, {}, collapsed))).toEqual(['root', 'readme.txt']);
    const filtered = tree(files, { query: ' CLIP2.MP4 ' }, collapsed);
    expect(filtered.filter((item) => item.file).map((item) => item.file!.index)).toEqual([2, 20]);
    expect(filtered.some((item) => item.path === 'root/photos')).toBe(false);
    expect([...collapsed]).toEqual(['root', 'root/videos']);
    expect(paths(tree(files, {}, collapsed))).toEqual(['root', 'readme.txt']);
  });
  it('searches full folder paths and extensions and combines both filters with AND', () => {
    expect(
      filterTorrentFiles(files, { ...defaults, query: 'july' }).map((item) => item.index),
    ).toEqual([9, 20]);
    expect(
      filterTorrentFiles(files, {
        ...defaults,
        query: '.mp4',
        completion: 'complete',
        inclusion: 'included',
      }).map((item) => item.index),
    ).toEqual([2]);
    expect(
      filterTorrentFiles(files, {
        ...defaults,
        inclusion: 'skipped',
        completion: 'incomplete',
      }).map((item) => item.index),
    ).toEqual([0]);
    expect(tree(files, { query: 'missing' })).toEqual([]);
    expect(tree([])).toEqual([]);
  });
  it('limits folder actions to matching indices but keeps full-folder aggregates stable', () => {
    const result = tree(files, { query: 'clip2' });
    const root = result.find((item) => item.path === 'root')!;
    expect(root.fileIndices).toEqual([2, 20]);
    expect(root.fileCount).toBe(4);
    expect(root.size).toBe(400);
    expect(root.allSelected).toBe(true);
  });
  it('does not mutate API order and reverses name sorting at every level', () => {
    const before = files.map((item) => item.index);
    const result = paths(tree(files, { direction: 'desc' }));
    expect(result.indexOf('root/videos')).toBeLessThan(result.indexOf('root/photos'));
    expect(result.indexOf('root/videos/July')).toBeLessThan(result.indexOf('root/videos/January'));
    expect(files.map((item) => item.index)).toEqual(before);
  });
  it('reuses file rows across sorts so large virtualized lists can avoid rerendering them', () => {
    const index = createFileTreeIndex(files);
    const byName = buildFileTreeFromIndex(index, defaults, new Set());
    const bySize = buildFileTreeFromIndex(
      index,
      { ...defaults, sort: 'size', direction: 'desc' },
      new Set(),
    );
    expect(bySize.find((item) => item.path === 'root/videos/July/clip2.mp4')).toBe(
      byName.find((item) => item.path === 'root/videos/July/clip2.mp4'),
    );
  });
});
