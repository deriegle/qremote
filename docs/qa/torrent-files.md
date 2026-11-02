# Torrent Files: search, filters and recursive sorting QA

## Setup

Use an iOS device/simulator with a configured qBittorrent server. Use a disposable
multi-file torrent: checkboxes and bulk actions immediately change download
priorities on the server. Repeat core cases on qBittorrent 4.x and 5.x if available.

Prepare nested folders such as `videos/January`, `videos/July`, `photos/January`,
and `music/September`, plus files directly at the torrent root. Include different
sizes, incomplete/complete files, skipped files, and Normal/High/Maximum priorities.
Include `clip2.mp4` and `clip10.mp4`, duplicate basenames in different folders,
and, if available, zero-byte files. Pause the torrent when checking exact ordering.

## Search and folder state

- [ ] Open Files: default is Name A–Z, folders before files at each level, folders collapsed.
- [ ] Expand only some branches. Search for a filename while typing: matching files
      appear immediately, with all ancestor folders expanded and unrelated branches hidden.
- [ ] Search uppercase/lowercase, surrounding spaces, a folder name and `.mp4`:
      matching is case-insensitive against the full path; surrounding spaces are ignored.
- [ ] Clear via the search X: original expanded/collapsed branches return.
- [ ] Search for a nonexistent name: show a distinct “No matching files” state,
      zero matching count, disabled bulk actions, and a working clear action.
- [ ] A torrent with no files retains the original no-files state.

## Filters

- [ ] Open the funnel panel. Choose Included/Skipped and Complete/Incomplete.
      Nothing changes before Apply. Close by tapping the funnel, then reopen:
      unapplied changes are discarded.
- [ ] Apply each filter alone, then together with a search. Conditions combine
      with AND. Complete means 100%; Included means priority above Skip.
- [ ] Active filters color the funnel. Count shows matching files out of total,
      independently of the number of visible folder rows.
- [ ] Clear filters, then Apply, removes both dropdown filters but keeps search.
      “Clear search and filters” resets both immediately without resetting sorting.
- [ ] Clearing the last active condition restores the saved folder collapse state.

## Recursive sorting

- [ ] Open the sort dropdown: Name, Completion, Size, Priority are available.
      Tap the selected option again to reverse direction. Switching options starts
      Name ascending and numeric options descending.
- [ ] Name: check both directions at every depth, with natural `clip2` / `clip10`
      ordering. Folders precede files even in descending order.
- [ ] Completion: compare top-level folders, their child folders, then their files.
      Each sibling group sorts independently; branches remain contiguous.
- [ ] Confirm folder completion uses ALL descendant bytes (downloaded bytes / total
      size), rather than an unweighted average. Zero-total-size folders use 0%.
- [ ] Size: folders use total descendant size; files use their own size.
- [ ] Priority: files follow numeric priority; folders stay Name A–Z in both
      directions. Equal numeric values fall back to Name A–Z.
- [ ] Repeat sorting during search/filtering. Only matching branches appear, while
      folder size/completion aggregates still describe the whole folder.

## Actions and regressions

- [ ] Without filters, existing Select All / Deselect All and priority controls work.
- [ ] With filters, labels explicitly refer to matching files. Include matching /
      Skip matching change only matches, including matches inside collapsed folders.
      Verify unrelated files retain their priorities on the server.
- [ ] Folder checkboxes likewise affect only matching descendants while filtering.
      Individual checkboxes, rename and priority menus target the correct API index,
      especially after sorting and with duplicate basenames.
- [ ] Bulk priority affects included matching files only (preserving the existing
      meaning of “selected”). Skipped matches stay skipped until included.
- [ ] Changing a priority can remove a file from the current filter; counts and
      folder checkbox state update after reload. No empty folder remnants remain.
- [ ] Rename a matching file/folder: search results, paths and ordering refresh.
- [ ] Disconnect/reconnect: existing connection/loading/toast behavior remains usable.

## Presentation and accessibility

- [ ] Check light/dark/custom themes, a small phone, large text and keyboard open:
      controls remain reachable; action labels wrap rather than clip; panels scroll.
- [ ] Check VoiceOver labels for search, clear, sorting and filters, selected filter
      chips and sort options. Verify the sort direction arrow is announced.
- [ ] Spot-check all eight locales for translated labels and readable wrapping.

## Automated validation

Run TypeScript, the full Jest suite, ESLint and Prettier before committing.
Pure utility tests cover nested/interleaved paths, weighted/zero-byte aggregates,
filter intersections, non-mutating collapse restoration, API index preservation,
matching-only folder actions and sorting in both directions. Component tests cover
live search, staged filters, clearing, and sort interaction.

Manual device checks are intentionally left for the reviewer; this environment
cannot run the iOS application or connect to the reviewer's qBittorrent server.
