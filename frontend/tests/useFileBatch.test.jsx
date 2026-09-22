
import { renderHook, act } from '@testing-library/react';
import { useFileBatch } from '@/hooks/useFileBatch';

describe('useFileBatch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------
  // Initial state
  // ---------------------------------------------------------

  it('should initialize with empty files and default state', () => {
    const { result } = renderHook(() =>
      useFileBatch({ quality: 'high' })
    );

    expect(result.current.files).toEqual([]);
    expect(result.current.uploadLimitExceeded).toBe(false);

    expect(result.current.readyFiles).toEqual([]);
    expect(result.current.processingFiles).toEqual([]);
    expect(result.current.completedFiles).toEqual([]);
    expect(result.current.errorFiles).toEqual([]);

    expect(result.current.hasFiles).toBe(false);
    expect(result.current.canProcess).toBe(false);
    expect(result.current.isProcessing).toBe(false);
    expect(result.current.allDone).toBe(false);

    expect(result.current.maxAllowedFiles).toBe(5);
  });

  // ---------------------------------------------------------
  // Adding files
  // ---------------------------------------------------------

  it('should add files to the batch', () => {
    const { result } = renderHook(() =>
      useFileBatch({ quality: 'high' })
    );

    const file1 = new File(
      ['test'],
      'test1.txt',
      { type: 'text/plain' }
    );

    const file2 = new File(
      ['test2'],
      'test2.txt',
      { type: 'text/plain' }
    );

    act(() => {
      result.current.addFiles([file1, file2]);
    });

    expect(result.current.files).toHaveLength(2);
    expect(result.current.hasFiles).toBe(true);
    expect(result.current.canProcess).toBe(true);

    expect(result.current.readyFiles).toHaveLength(2);

    expect(result.current.files[0].name).toBe('test1.txt');
    expect(result.current.files[1].name).toBe('test2.txt');

    expect(result.current.files[0].file).toBe(file1);
    expect(result.current.files[1].file).toBe(file2);

    expect(result.current.files[0].size).toBe(file1.size);
    expect(result.current.files[1].size).toBe(file2.size);

    expect(result.current.files[0].status).toBe('ready');
    expect(result.current.files[1].status).toBe('ready');

    expect(result.current.files[0].settings).toEqual({
      quality: 'high',
    });

    expect(result.current.files[1].settings).toEqual({
      quality: 'high',
    });

    expect(result.current.files[0].id).toBeTruthy();
    expect(result.current.files[1].id).toBeTruthy();
    expect(result.current.files[0].id).not.toBe(
      result.current.files[1].id
    );
  });

  it('should use empty settings when no default settings are provided', () => {
    const { result } = renderHook(() => useFileBatch());

    const file = new File(
      ['test'],
      'test.txt',
      { type: 'text/plain' }
    );

    act(() => {
      result.current.addFiles([file]);
    });

    expect(result.current.files[0].settings).toEqual({});
  });

  it('should copy default settings into each new file', () => {
    const defaultSettings = {
      quality: 'high',
      format: 'pdf',
    };

    const { result } = renderHook(() =>
      useFileBatch(defaultSettings)
    );

    const file1 = new File(['one'], 'one.txt');
    const file2 = new File(['two'], 'two.txt');

    act(() => {
      result.current.addFiles([file1, file2]);
    });

    expect(result.current.files[0].settings).toEqual(
      defaultSettings
    );

    expect(result.current.files[1].settings).toEqual(
      defaultSettings
    );
  });

  // ---------------------------------------------------------
  // Maximum file limit
  // ---------------------------------------------------------

  it('should enforce the maximum file limit of 5', () => {
    const { result } = renderHook(() => useFileBatch());

    const files = Array.from(
      { length: 6 },
      (_, i) =>
        new File(
          [`test${i}`],
          `test${i}.txt`,
          { type: 'text/plain' }
        )
    );

    act(() => {
      result.current.addFiles(files);
    });

    expect(result.current.files).toHaveLength(5);
    expect(result.current.readyFiles).toHaveLength(5);
    expect(result.current.uploadLimitExceeded).toBe(true);
  });

  it('should add files up to the remaining available slots', () => {
    const { result } = renderHook(() => useFileBatch());

    const firstFiles = Array.from(
      { length: 3 },
      (_, i) =>
        new File(
          [`first${i}`],
          `first${i}.txt`
        )
    );

    const secondFiles = Array.from(
      { length: 3 },
      (_, i) =>
        new File(
          [`second${i}`],
          `second${i}.txt`
        )
    );

    act(() => {
      result.current.addFiles(firstFiles);
    });

    expect(result.current.files).toHaveLength(3);

    act(() => {
      result.current.addFiles(secondFiles);
    });

    expect(result.current.files).toHaveLength(5);
    expect(result.current.uploadLimitExceeded).toBe(true);

    expect(
      result.current.files.map(file => file.name)
    ).toEqual([
      'first0.txt',
      'first1.txt',
      'first2.txt',
      'second0.txt',
      'second1.txt',
    ]);
  });

  it('should allow exactly 5 files without setting the limit flag', () => {
    const { result } = renderHook(() => useFileBatch());

    const files = Array.from(
      { length: 5 },
      (_, i) =>
        new File(
          [`test${i}`],
          `test${i}.txt`
        )
    );

    act(() => {
      result.current.addFiles(files);
    });

    expect(result.current.files).toHaveLength(5);
    expect(result.current.uploadLimitExceeded).toBe(false);
  });

  it('should not add more files when the batch already contains 5 files', () => {
    const { result } = renderHook(() => useFileBatch());

    const initialFiles = Array.from(
      { length: 5 },
      (_, i) =>
        new File(
          [`test${i}`],
          `test${i}.txt`
        )
    );

    act(() => {
      result.current.addFiles(initialFiles);
    });

    const extraFile = new File(
      ['extra'],
      'extra.txt'
    );

    act(() => {
      result.current.addFiles([extraFile]);
    });

    expect(result.current.files).toHaveLength(5);
    expect(result.current.uploadLimitExceeded).toBe(true);

    expect(
      result.current.files.some(
        file => file.name === 'extra.txt'
      )
    ).toBe(false);
  });

  // ---------------------------------------------------------
  // Removing files
  // ---------------------------------------------------------

  it('should remove a file by ID', () => {
    const { result } = renderHook(() => useFileBatch());

    const file = new File(
      ['test'],
      'test.txt',
      { type: 'text/plain' }
    );

    act(() => {
      result.current.addFiles([file]);
    });

    const fileId = result.current.files[0].id;

    act(() => {
      result.current.removeFile(fileId);
    });

    expect(result.current.files).toHaveLength(0);
    expect(result.current.hasFiles).toBe(false);
    expect(result.current.readyFiles).toHaveLength(0);
    expect(result.current.uploadLimitExceeded).toBe(false);
  });

  it('should remove only the file matching the supplied ID', () => {
    const { result } = renderHook(() => useFileBatch());

    const files = [
      new File(['one'], 'one.txt'),
      new File(['two'], 'two.txt'),
      new File(['three'], 'three.txt'),
    ];

    act(() => {
      result.current.addFiles(files);
    });

    const middleFileId = result.current.files[1].id;

    act(() => {
      result.current.removeFile(middleFileId);
    });

    expect(
      result.current.files.map(file => file.name)
    ).toEqual([
      'one.txt',
      'three.txt',
    ]);
  });

  it('should safely do nothing when removing an unknown file ID', () => {
    const { result } = renderHook(() => useFileBatch());

    const file = new File(
      ['test'],
      'test.txt'
    );

    act(() => {
      result.current.addFiles([file]);
    });

    const originalFiles = result.current.files;

    act(() => {
      result.current.removeFile('non-existent-id');
    });

    expect(result.current.files).toEqual(originalFiles);
  });

  // ---------------------------------------------------------
  // File settings
  // ---------------------------------------------------------

  it('should update settings for a specific file', () => {
    const { result } = renderHook(() =>
      useFileBatch({ quality: 'high' })
    );

    const file = new File(
      ['test'],
      'test.txt'
    );

    act(() => {
      result.current.addFiles([file]);
    });

    const fileId = result.current.files[0].id;

    act(() => {
      result.current.updateFileSettings(
        fileId,
        {
          quality: 'low',
          size: 800,
        }
      );
    });

    expect(result.current.files[0].settings).toEqual({
      quality: 'low',
      size: 800,
    });
  });

  it('should update settings only for the matching file', () => {
    const { result } = renderHook(() => useFileBatch());

    const files = [
      new File(['one'], 'one.txt'),
      new File(['two'], 'two.txt'),
    ];

    act(() => {
      result.current.addFiles(files);
    });

    const firstId = result.current.files[0].id;

    act(() => {
      result.current.updateFileSettings(
        firstId,
        { quality: 'low' }
      );
    });

    expect(result.current.files[0].settings).toEqual({
      quality: 'low',
    });

    expect(result.current.files[1].settings).toEqual({});
  });

  // ---------------------------------------------------------
  // File status
  // ---------------------------------------------------------

  it('should update a file status', () => {
    const { result } = renderHook(() => useFileBatch());

    const file = new File(
      ['test'],
      'test.txt'
    );

    act(() => {
      result.current.addFiles([file]);
    });

    const fileId = result.current.files[0].id;

    act(() => {
      result.current.updateFileStatus(
        fileId,
        'converting'
      );
    });

    expect(result.current.files[0].status).toBe(
      'converting'
    );

    expect(result.current.processingFiles).toHaveLength(1);
    expect(result.current.isProcessing).toBe(true);
    expect(result.current.canProcess).toBe(false);
  });

  it('should update additional properties when changing file status', () => {
    const { result } = renderHook(() => useFileBatch());

    const file = new File(
      ['test'],
      'test.txt'
    );

    act(() => {
      result.current.addFiles([file]);
    });

    const fileId = result.current.files[0].id;

    act(() => {
      result.current.updateFileStatus(
        fileId,
        'completed',
        {
          outputUrl: 'https://example.com/output.pdf',
          message: 'Conversion complete',
        }
      );
    });

    expect(result.current.files[0]).toEqual(
      expect.objectContaining({
        status: 'completed',
        outputUrl: 'https://example.com/output.pdf',
        message: 'Conversion complete',
      })
    );
  });

  it('should update only the requested file status', () => {
    const { result } = renderHook(() => useFileBatch());

    const files = [
      new File(['one'], 'one.txt'),
      new File(['two'], 'two.txt'),
    ];

    act(() => {
      result.current.addFiles(files);
    });

    const firstId = result.current.files[0].id;

    act(() => {
      result.current.updateFileStatus(
        firstId,
        'converting'
      );
    });

    expect(result.current.files[0].status).toBe(
      'converting'
    );

    expect(result.current.files[1].status).toBe('ready');
  });

  // ---------------------------------------------------------
  // Bulk status updates
  // ---------------------------------------------------------

  it('should update all files matching the source status', () => {
    const { result } = renderHook(() => useFileBatch());

    const files = [
      new File(['one'], 'one.txt'),
      new File(['two'], 'two.txt'),
      new File(['three'], 'three.txt'),
    ];

    act(() => {
      result.current.addFiles(files);
    });

    const secondId = result.current.files[1].id;

    act(() => {
      result.current.updateFileStatus(
        secondId,
        'completed'
      );
    });

    act(() => {
      result.current.updateAllStatus(
        'ready',
        'converting'
      );
    });

    expect(
      result.current.files.map(file => file.status)
    ).toEqual([
      'converting',
      'completed',
      'converting',
    ]);
  });

  it('should not change files whose status does not match', () => {
    const { result } = renderHook(() => useFileBatch());

    const files = [
      new File(['one'], 'one.txt'),
      new File(['two'], 'two.txt'),
    ];

    act(() => {
      result.current.addFiles(files);
    });

    const firstId = result.current.files[0].id;

    act(() => {
      result.current.updateFileStatus(
        firstId,
        'error'
      );
    });

    act(() => {
      result.current.updateAllStatus(
        'ready',
        'converting'
      );
    });

    expect(result.current.files[0].status).toBe('error');
    expect(result.current.files[1].status).toBe('converting');
  });

  // ---------------------------------------------------------
  // Derived status collections
  // ---------------------------------------------------------

  it('should expose completed files', () => {
    const { result } = renderHook(() => useFileBatch());

    const file = new File(
      ['test'],
      'test.txt'
    );

    act(() => {
      result.current.addFiles([file]);
    });

    const fileId = result.current.files[0].id;

    act(() => {
      result.current.updateFileStatus(
        fileId,
        'completed'
      );
    });

    expect(result.current.completedFiles).toHaveLength(1);
    expect(result.current.completedFiles[0].id).toBe(
      fileId
    );
  });

  it('should expose error files', () => {
    const { result } = renderHook(() => useFileBatch());

    const file = new File(
      ['test'],
      'test.txt'
    );

    act(() => {
      result.current.addFiles([file]);
    });

    const fileId = result.current.files[0].id;

    act(() => {
      result.current.updateFileStatus(
        fileId,
        'error'
      );
    });

    expect(result.current.errorFiles).toHaveLength(1);
    expect(result.current.errorFiles[0].id).toBe(
      fileId
    );
  });

  it('should report processing state correctly', () => {
    const { result } = renderHook(() => useFileBatch());

    const file = new File(
      ['test'],
      'test.txt'
    );

    act(() => {
      result.current.addFiles([file]);
    });

    const fileId = result.current.files[0].id;

    expect(result.current.isProcessing).toBe(false);

    act(() => {
      result.current.updateFileStatus(
        fileId,
        'converting'
      );
    });

    expect(result.current.isProcessing).toBe(true);

    act(() => {
      result.current.updateFileStatus(
        fileId,
        'completed'
      );
    });

    expect(result.current.isProcessing).toBe(false);
  });

  // ---------------------------------------------------------
  // allDone
  // ---------------------------------------------------------

  it('should report allDone as false while files are ready', () => {
    const { result } = renderHook(() => useFileBatch());

    const file = new File(
      ['test'],
      'test.txt'
    );

    act(() => {
      result.current.addFiles([file]);
    });

    expect(result.current.allDone).toBe(false);
  });

  it('should report allDone as false while files are processing', () => {
    const { result } = renderHook(() => useFileBatch());

    const file = new File(
      ['test'],
      'test.txt'
    );

    act(() => {
      result.current.addFiles([file]);
    });

    const fileId = result.current.files[0].id;

    act(() => {
      result.current.updateFileStatus(
        fileId,
        'converting'
      );
    });

    expect(result.current.allDone).toBe(false);
  });

  it('should report allDone as true when all files are completed', () => {
    const { result } = renderHook(() => useFileBatch());

    const files = [
      new File(['one'], 'one.txt'),
      new File(['two'], 'two.txt'),
    ];

    act(() => {
      result.current.addFiles(files);
    });

    const ids = result.current.files.map(file => file.id);

    act(() => {
      result.current.updateFileStatus(
        ids[0],
        'completed'
      );

      result.current.updateFileStatus(
        ids[1],
        'completed'
      );
    });

    expect(result.current.completedFiles).toHaveLength(2);
    expect(result.current.errorFiles).toHaveLength(0);
    expect(result.current.allDone).toBe(true);
  });

  it('should report allDone as true when files contain only completed and error statuses', () => {
    const { result } = renderHook(() => useFileBatch());

    const files = [
      new File(['one'], 'one.txt'),
      new File(['two'], 'two.txt'),
    ];

    act(() => {
      result.current.addFiles(files);
    });

    const ids = result.current.files.map(file => file.id);

    act(() => {
      result.current.updateFileStatus(
        ids[0],
        'completed'
      );

      result.current.updateFileStatus(
        ids[1],
        'error'
      );
    });

    expect(result.current.completedFiles).toHaveLength(1);
    expect(result.current.errorFiles).toHaveLength(1);
    expect(result.current.allDone).toBe(true);
  });

  it('should report allDone as false for an empty batch', () => {
    const { result } = renderHook(() => useFileBatch());

    expect(result.current.files).toHaveLength(0);
    expect(result.current.allDone).toBe(false);
  });

  // ---------------------------------------------------------
  // Reset
  // ---------------------------------------------------------

  it('should reset the entire batch', () => {
    const { result } = renderHook(() => useFileBatch());

    const files = [
      new File(['one'], 'one.txt'),
      new File(['two'], 'two.txt'),
    ];

    act(() => {
      result.current.addFiles(files);
    });

    expect(result.current.hasFiles).toBe(true);

    act(() => {
      result.current.resetBatch();
    });

    expect(result.current.files).toHaveLength(0);
    expect(result.current.hasFiles).toBe(false);
    expect(result.current.readyFiles).toHaveLength(0);
    expect(result.current.processingFiles).toHaveLength(0);
    expect(result.current.completedFiles).toHaveLength(0);
    expect(result.current.errorFiles).toHaveLength(0);
    expect(result.current.isProcessing).toBe(false);
    expect(result.current.allDone).toBe(false);
    expect(result.current.uploadLimitExceeded).toBe(false);
  });

  // ---------------------------------------------------------
  // File size formatting
  // ---------------------------------------------------------

  it('should format file size correctly', () => {
    const { result } = renderHook(() =>
      useFileBatch()
    );

    expect(result.current.formatFileSize(0)).toBe(
      '0 Bytes'
    );

    expect(result.current.formatFileSize(1024)).toBe(
      '1 KB'
    );

    expect(
      result.current.formatFileSize(1024 * 1024)
    ).toBe('1 MB');

    expect(
      result.current.formatFileSize(1024 * 1024 * 1024)
    ).toBe('1 GB');
  });

  it('should format fractional file sizes to two decimal places', () => {
    const { result } = renderHook(() =>
      useFileBatch()
    );

    expect(result.current.formatFileSize(1536)).toBe(
      '1.5 KB'
    );

    expect(
      result.current.formatFileSize(1.5 * 1024 * 1024)
    ).toBe('1.5 MB');
  });
});
