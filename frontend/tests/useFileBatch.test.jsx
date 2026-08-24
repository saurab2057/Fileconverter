import { renderHook, act } from '@testing-library/react';
import { useFileBatch } from '@/hooks/useFileBatch';

describe('useFileBatch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with empty files', () => {
    const { result } = renderHook(() => useFileBatch({ quality: 'high' }));

    expect(result.current.files).toEqual([]);
    expect(result.current.hasFiles).toBe(false);
    expect(result.current.canProcess).toBe(false);
    expect(result.current.maxAllowedFiles).toBe(5);
  });

  it('should add files to batch', () => {
    const { result } = renderHook(() => useFileBatch({ quality: 'high' }));

    const file1 = new File(['test'], 'test1.txt', { type: 'text/plain' });
    const file2 = new File(['test2'], 'test2.txt', { type: 'text/plain' });

    act(() => {
      result.current.addFiles([file1, file2]);
    });

    expect(result.current.files).toHaveLength(2);
    expect(result.current.hasFiles).toBe(true);
    expect(result.current.readyFiles).toHaveLength(2);
    expect(result.current.files[0].name).toBe('test1.txt');
    expect(result.current.files[1].name).toBe('test2.txt');
    expect(result.current.files[0].settings).toEqual({ quality: 'high' });
  });

  it('should enforce max file limit (5)', () => {
    const { result } = renderHook(() => useFileBatch());

    const files = Array.from({ length: 6 }, (_, i) => 
      new File([`test${i}`], `test${i}.txt`, { type: 'text/plain' })
    );

    act(() => {
      result.current.addFiles(files);
    });

    expect(result.current.files).toHaveLength(5);
    expect(result.current.uploadLimitExceeded).toBe(true);
  });

  it('should remove a file by id', () => {
    const { result } = renderHook(() => useFileBatch());

    const file = new File(['test'], 'test.txt', { type: 'text/plain' });

    act(() => {
      result.current.addFiles([file]);
    });

    const fileId = result.current.files[0].id;

    act(() => {
      result.current.removeFile(fileId);
    });

    expect(result.current.files).toHaveLength(0);
    expect(result.current.hasFiles).toBe(false);
  });

  it('should update file settings', () => {
    const { result } = renderHook(() => useFileBatch({ quality: 'high' }));

    const file = new File(['test'], 'test.txt', { type: 'text/plain' });

    act(() => {
      result.current.addFiles([file]);
    });

    const fileId = result.current.files[0].id;

    act(() => {
      result.current.updateFileSettings(fileId, { quality: 'low', size: 800 });
    });

    expect(result.current.files[0].settings).toEqual({ quality: 'low', size: 800 });
  });

  it('should update file status', () => {
    const { result } = renderHook(() => useFileBatch());

    const file = new File(['test'], 'test.txt', { type: 'text/plain' });

    act(() => {
      result.current.addFiles([file]);
    });

    const fileId = result.current.files[0].id;

    act(() => {
      result.current.updateFileStatus(fileId, 'converting');
    });

    expect(result.current.files[0].status).toBe('converting');
    expect(result.current.processingFiles).toHaveLength(1);
  });

  it('should update all files status', () => {
    const { result } = renderHook(() => useFileBatch());

    const files = [
      new File(['test1'], 'test1.txt', { type: 'text/plain' }),
      new File(['test2'], 'test2.txt', { type: 'text/plain' }),
    ];

    act(() => {
      result.current.addFiles(files);
    });

    act(() => {
      result.current.updateAllStatus('ready', 'converting');
    });

    expect(result.current.files.every(f => f.status === 'converting')).toBe(true);
    expect(result.current.processingFiles).toHaveLength(2);
  });

  it('should reset batch', () => {
    const { result } = renderHook(() => useFileBatch());

    const file = new File(['test'], 'test.txt', { type: 'text/plain' });

    act(() => {
      result.current.addFiles([file]);
    });

    expect(result.current.hasFiles).toBe(true);

    act(() => {
      result.current.resetBatch();
    });

    expect(result.current.files).toHaveLength(0);
    expect(result.current.hasFiles).toBe(false);
    expect(result.current.uploadLimitExceeded).toBe(false);
  });

  it('should format file size correctly', () => {
    const { result } = renderHook(() => useFileBatch());

    expect(result.current.formatFileSize(0)).toBe('0 Bytes');
    expect(result.current.formatFileSize(1024)).toBe('1 KB');
    expect(result.current.formatFileSize(1024 * 1024)).toBe('1 MB');
    expect(result.current.formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
  });
});