import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import TorrentFilesScreen from '@/app/(tabs)/(torrents)/torrent/files';
import { torrentsApi } from '@/services/api/torrents';
import { TorrentFile } from '@/types/api';
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ hash: 'test-hash' }),
  useRouter: () => ({ back: jest.fn() }),
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: require('../components/theme-mock').mockColors, isDark: false }),
}));
jest.mock('@/context/ServerContext', () => ({ useServer: () => ({ isConnected: true }) }));
jest.mock('@/context/ToastContext', () => ({ useToast: () => ({ showToast: jest.fn() }) }));
jest.mock('@/components/FocusAwareStatusBar', () => ({ FocusAwareStatusBar: () => null }));
jest.mock('@/services/api/torrents', () => ({
  torrentsApi: { getTorrentContents: jest.fn(), setFilePriority: jest.fn() },
}));
const makeFile = (
  index: number,
  name: string,
  priority: TorrentFile['priority'] = 1,
): TorrentFile => ({
  index,
  name,
  priority,
  progress: 0,
  size: 10,
  is_seed: false,
  piece_range: [0, 1],
});
const browse = (key: string) => `screens.files.browse.${key}`;
beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(torrentsApi.getTorrentContents)
    .mockResolvedValue([
      makeFile(7, 'root/a.mp4'),
      makeFile(2, 'root/b.txt'),
      makeFile(19, 'root/c.mp4', 0),
    ]);
  jest.mocked(torrentsApi.setFilePriority).mockResolvedValue(undefined);
});
it('expands search matches and scopes bulk and folder writes to matching API indices', async () => {
  await render(<TorrentFilesScreen />);
  await screen.findByLabelText(browse('search'));
  expect(screen.queryByText('a.mp4')).toBeNull();
  await fireEvent.changeText(screen.getByLabelText(browse('search')), '.mp4');
  expect(await screen.findByText('a.mp4')).toBeTruthy();
  expect(screen.queryByText('b.txt')).toBeNull();
  expect(screen.getByLabelText('root').props.accessibilityState).toEqual({ disabled: true });
  await fireEvent.press(screen.getByText(browse('skipMatching')));
  await waitFor(() =>
    expect(torrentsApi.setFilePriority).toHaveBeenCalledWith('test-hash', [7, 19], 0),
  );
  await waitFor(() => expect(torrentsApi.getTorrentContents).toHaveBeenCalledTimes(2));
  await fireEvent.press(screen.getByLabelText('screens.files.selectFolder'));
  await waitFor(() =>
    expect(torrentsApi.setFilePriority).toHaveBeenLastCalledWith('test-hash', [7, 19], 1),
  );
  await fireEvent.press(screen.getByText(browse('includeMatching')));
  await waitFor(() =>
    expect(torrentsApi.setFilePriority).toHaveBeenLastCalledWith('test-hash', [7, 19], 1),
  );
  await fireEvent.press(screen.getByText(browse('priorityMatching')));
  await fireEvent.press(await screen.findByText('screens.files.highPriority'));
  await waitFor(() =>
    expect(torrentsApi.setFilePriority).toHaveBeenLastCalledWith('test-hash', [7], 6),
  );
  await fireEvent.press(screen.getByLabelText('common.clearSearch'));
  expect(screen.queryByText('a.mp4')).toBeNull();
});
it('shows a no-match state and clears back to the original tree', async () => {
  await render(<TorrentFilesScreen />);
  await screen.findByLabelText(browse('search'));
  await fireEvent.changeText(screen.getByLabelText(browse('search')), 'missing');
  expect(await screen.findByText(browse('noMatches'))).toBeTruthy();
  expect(screen.getByLabelText(browse('includeMatching')).props.accessibilityState).toEqual({
    disabled: true,
  });
  expect(screen.getByLabelText(browse('skipMatching')).props.accessibilityState).toEqual({
    disabled: true,
  });
  await fireEvent.press(screen.getByText(browse('includeMatching')));
  expect(torrentsApi.setFilePriority).not.toHaveBeenCalled();
  await fireEvent.press(screen.getAllByText(browse('clearAll'))[0]);
  expect(screen.queryByText(browse('noMatches'))).toBeNull();
  expect(screen.getByText('root')).toBeTruthy();
});
