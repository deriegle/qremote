import React, { useState } from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { FileListControls } from '@/components/FileListControls';
import { DEFAULT_FILE_TREE_OPTIONS, FileTreeOptions } from '@/utils/file-tree';
jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: require('./theme-mock').mockColors }),
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const key = (value: string) => `screens.files.browse.${value}`;
function Harness({
  onChange,
  initial = {},
}: {
  onChange: jest.Mock;
  initial?: Partial<FileTreeOptions>;
}) {
  const [options, setOptions] = useState({ ...DEFAULT_FILE_TREE_OPTIONS, ...initial });
  return (
    <FileListControls
      options={options}
      matching={2}
      total={4}
      onChange={(value) => {
        onChange(value);
        setOptions(value);
      }}
    />
  );
}
it('searches instantly and clears text without clearing applied filters', async () => {
  const onChange = jest.fn();
  await render(<Harness onChange={onChange} initial={{ inclusion: 'skipped' }} />);
  await fireEvent.changeText(screen.getByLabelText(key('search')), '.mp4');
  await waitFor(() =>
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ query: '.mp4', inclusion: 'skipped' }),
    ),
  );
  await fireEvent.press(screen.getByLabelText('common.clearSearch'));
  expect(onChange).toHaveBeenLastCalledWith(
    expect.objectContaining({ query: '', inclusion: 'skipped' }),
  );
});
it('stages filters until Apply and discards unapplied changes when reopened', async () => {
  const onChange = jest.fn();
  await render(<Harness onChange={onChange} />);
  await fireEvent.press(screen.getByLabelText(key('filters')));
  await fireEvent.press(screen.getByText(key('skipped')));
  expect(onChange).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByLabelText(key('filters')));
  await fireEvent.press(screen.getByLabelText(key('filters')));
  await fireEvent.press(screen.getByText(key('apply')));
  expect(onChange).toHaveBeenLastCalledWith(DEFAULT_FILE_TREE_OPTIONS);
  await fireEvent.press(screen.getByLabelText(key('filters')));
  await fireEvent.press(screen.getByText(key('included')));
  await fireEvent.press(screen.getByText(key('incomplete')));
  await fireEvent.press(screen.getByText(key('apply')));
  expect(onChange).toHaveBeenLastCalledWith(
    expect.objectContaining({ inclusion: 'included', completion: 'incomplete' }),
  );
});
it('toggles sort direction and defaults numeric sorts descending', async () => {
  const onChange = jest.fn();
  await render(<Harness onChange={onChange} />);
  await fireEvent.press(screen.getByLabelText(key('sort')));
  await fireEvent.press(screen.getByText(key('name')));
  expect(onChange).toHaveBeenLastCalledWith(
    expect.objectContaining({ sort: 'name', direction: 'desc' }),
  );
  await fireEvent.press(screen.getByLabelText(key('sort')));
  await fireEvent.press(screen.getByText(key('progress')));
  expect(onChange).toHaveBeenLastCalledWith(
    expect.objectContaining({ sort: 'progress', direction: 'desc' }),
  );
});
it('clears search and filters while retaining the chosen sort', async () => {
  const onChange = jest.fn();
  await render(
    <Harness
      onChange={onChange}
      initial={{
        query: 'x',
        inclusion: 'skipped',
        completion: 'complete',
        sort: 'size',
        direction: 'desc',
      }}
    />,
  );
  await fireEvent.press(screen.getByText(key('clearAll')));
  expect(onChange).toHaveBeenLastCalledWith({
    ...DEFAULT_FILE_TREE_OPTIONS,
    sort: 'size',
    direction: 'desc',
  });
});
