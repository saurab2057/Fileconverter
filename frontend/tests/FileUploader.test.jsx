
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FileUploader from '@/components/common/FileUploader';

describe('FileUploader', () => {
  const mockOnFilesSelected = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------

  it('should render with title and subtitle', () => {
    render(
      <FileUploader
        title="Test Title"
        subtitle="Test Subtitle"
        onFilesSelected={mockOnFilesSelected}
      />
    );

    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test Subtitle')).toBeInTheDocument();
  });

  it('should render default title and subtitle when props are omitted', () => {
    render(
      <FileUploader onFilesSelected={mockOnFilesSelected} />
    );

    expect(screen.getByText('Choose Files')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Easily convert files from one format to another, online.'
      )
    ).toBeInTheDocument();
  });

  it('should render the custom className', () => {
    const { container } = render(
      <FileUploader
        className="custom-uploader"
        onFilesSelected={mockOnFilesSelected}
      />
    );

    expect(container.firstChild).toHaveClass('custom-uploader');
  });

  it('should render the file input as hidden', () => {
    render(
      <FileUploader onFilesSelected={mockOnFilesSelected} />
    );

    const fileInput = document.querySelector('input[type="file"]');

    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveClass('hidden');
    expect(fileInput).toHaveAttribute('multiple');
  });

  // ---------------------------------------------------------
  // Accepted formats
  // ---------------------------------------------------------

  it('should generate the correct accept attribute from acceptedFormats', () => {
    render(
      <FileUploader
        acceptedFormats={['pdf', 'docx', 'txt']}
        onFilesSelected={mockOnFilesSelected}
      />
    );

    const fileInput = document.querySelector('input[type="file"]');

    expect(fileInput).toHaveAttribute(
      'accept',
      '.pdf,.docx,.txt'
    );
  });

  it('should accept all file types when acceptedFormats is empty', () => {
    render(
      <FileUploader
        acceptedFormats={[]}
        onFilesSelected={mockOnFilesSelected}
      />
    );

    const fileInput = document.querySelector('input[type="file"]');

    expect(fileInput).toHaveAttribute('accept', '*');
  });

  // ---------------------------------------------------------
  // Dropdown
  // ---------------------------------------------------------

  it('should keep the dropdown closed initially', () => {
    render(
      <FileUploader
        title="Choose Files"
        subtitle="Test Subtitle"
        onFilesSelected={mockOnFilesSelected}
      />
    );

    expect(screen.queryByText('From Device')).not.toBeInTheDocument();
    expect(screen.queryByText('From Dropbox')).not.toBeInTheDocument();
    expect(screen.queryByText('From Google Drive')).not.toBeInTheDocument();
    expect(screen.queryByText('From OneDrive')).not.toBeInTheDocument();
    expect(screen.queryByText('From URL')).not.toBeInTheDocument();
  });

  it('should open dropdown when button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <FileUploader
        title="Choose Files"
        subtitle="Test Subtitle"
        onFilesSelected={mockOnFilesSelected}
      />
    );

    await user.click(screen.getByRole('button', { name: /Choose Files/i }));

    expect(screen.getByText('From Device')).toBeInTheDocument();
    expect(screen.getByText('From Dropbox')).toBeInTheDocument();
    expect(screen.getByText('From Google Drive')).toBeInTheDocument();
    expect(screen.getByText('From OneDrive')).toBeInTheDocument();
    expect(screen.getByText('From URL')).toBeInTheDocument();
  });

  it('should close dropdown when the main button is clicked again', async () => {
    const user = userEvent.setup();

    render(
      <FileUploader
        title="Choose Files"
        onFilesSelected={mockOnFilesSelected}
      />
    );

    const button = screen.getByRole('button', {
      name: /Choose Files/i,
    });

    await user.click(button);

    expect(screen.getByText('From Device')).toBeInTheDocument();

    await user.click(button);

    expect(screen.queryByText('From Device')).not.toBeInTheDocument();
  });

  // ---------------------------------------------------------
  // Device file selection
  // ---------------------------------------------------------

  it('should handle file selection from device', async () => {
    const user = userEvent.setup();

    render(
      <FileUploader
        title="Choose Files"
        subtitle="Test Subtitle"
        onFilesSelected={mockOnFilesSelected}
      />
    );

    await user.click(
      screen.getByRole('button', {
        name: /Choose Files/i,
      })
    );

    await user.click(screen.getByText('From Device'));

    const fileInput = document.querySelector('input[type="file"]');

    expect(fileInput).toBeInTheDocument();

    const file = new File(
      ['test content'],
      'test.txt',
      { type: 'text/plain' }
    );

    fireEvent.change(fileInput, {
      target: {
        files: [file],
      },
    });

    expect(mockOnFilesSelected).toHaveBeenCalledTimes(1);
    expect(mockOnFilesSelected).toHaveBeenCalledWith([file]);
  });

  it('should handle multiple files selected from device', () => {
    render(
      <FileUploader onFilesSelected={mockOnFilesSelected} />
    );

    const fileInput = document.querySelector('input[type="file"]');

    const file1 = new File(
      ['file one'],
      'one.txt',
      { type: 'text/plain' }
    );

    const file2 = new File(
      ['file two'],
      'two.txt',
      { type: 'text/plain' }
    );

    fireEvent.change(fileInput, {
      target: {
        files: [file1, file2],
      },
    });

    expect(mockOnFilesSelected).toHaveBeenCalledTimes(1);
    expect(mockOnFilesSelected).toHaveBeenCalledWith([
      file1,
      file2,
    ]);
  });

  it('should reset the file input after file selection', () => {
    render(
      <FileUploader onFilesSelected={mockOnFilesSelected} />
    );

    const fileInput = document.querySelector('input[type="file"]');

    const file = new File(
      ['test content'],
      'test.txt',
      { type: 'text/plain' }
    );

    fireEvent.change(fileInput, {
      target: {
        files: [file],
      },
    });

    expect(fileInput.value).toBe('');
  });

  it('should not call onFilesSelected when no files are selected', () => {
    render(
      <FileUploader onFilesSelected={mockOnFilesSelected} />
    );

    const fileInput = document.querySelector('input[type="file"]');

    fireEvent.change(fileInput, {
      target: {
        files: [],
      },
    });

    expect(mockOnFilesSelected).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------
  // Drag and drop
  // ---------------------------------------------------------

  it('should handle drag and drop', () => {
    render(
      <FileUploader
        onFilesSelected={mockOnFilesSelected}
      />
    );

    const dropArea = document.querySelector('.min-h-\\[400px\\]');

    const file = new File(
      ['test content'],
      'test.txt',
      { type: 'text/plain' }
    );

    fireEvent.dragEnter(dropArea);
    fireEvent.dragOver(dropArea);

    fireEvent.drop(dropArea, {
      dataTransfer: {
        files: [file],
      },
    });

    expect(mockOnFilesSelected).toHaveBeenCalledTimes(1);
    expect(mockOnFilesSelected).toHaveBeenCalledWith([file]);
  });

  it('should handle multiple files through drag and drop', () => {
    render(
      <FileUploader
        onFilesSelected={mockOnFilesSelected}
      />
    );

    const dropArea = document.querySelector('.min-h-\\[400px\\]');

    const file1 = new File(
      ['file one'],
      'one.pdf',
      { type: 'application/pdf' }
    );

    const file2 = new File(
      ['file two'],
      'two.pdf',
      { type: 'application/pdf' }
    );

    fireEvent.drop(dropArea, {
      dataTransfer: {
        files: [file1, file2],
      },
    });

    expect(mockOnFilesSelected).toHaveBeenCalledWith([
      file1,
      file2,
    ]);
  });

  it('should show drag active state during drag enter', () => {
    render(
      <FileUploader
        onFilesSelected={mockOnFilesSelected}
      />
    );

    const dropArea = document.querySelector('.min-h-\\[400px\\]');

    fireEvent.dragEnter(dropArea);

    expect(dropArea).toHaveClass(
      'border-blue-400',
      'bg-blue-50'
    );
  });

  it('should keep drag active state during drag over', () => {
    render(
      <FileUploader
        onFilesSelected={mockOnFilesSelected}
      />
    );

    const dropArea = document.querySelector('.min-h-\\[400px\\]');

    fireEvent.dragOver(dropArea);

    expect(dropArea).toHaveClass(
      'border-blue-400',
      'bg-blue-50'
    );
  });

  it('should remove drag active state after drag leave', () => {
    render(
      <FileUploader
        onFilesSelected={mockOnFilesSelected}
      />
    );

    const dropArea = document.querySelector('.min-h-\\[400px\\]');

    fireEvent.dragEnter(dropArea);

    expect(dropArea).toHaveClass('border-blue-400');

    fireEvent.dragLeave(dropArea);

    expect(dropArea).not.toHaveClass('border-blue-400');
    expect(dropArea).not.toHaveClass('bg-blue-50');
  });

  // ---------------------------------------------------------
  // Upload source behavior
  // ---------------------------------------------------------

  it('should close the dropdown after selecting From Device', async () => {
    const user = userEvent.setup();

    render(
      <FileUploader
        onFilesSelected={mockOnFilesSelected}
      />
    );

    await user.click(
      screen.getByRole('button', {
        name: /Choose Files/i,
      })
    );

    expect(screen.getByText('From Device')).toBeInTheDocument();

    await user.click(screen.getByText('From Device'));

    expect(screen.queryByText('From Dropbox')).not.toBeInTheDocument();
  });

  it('should close the dropdown when Dropbox is selected', async () => {
    const user = userEvent.setup();

    render(
      <FileUploader
        onFilesSelected={mockOnFilesSelected}
      />
    );

    await user.click(
      screen.getByRole('button', {
        name: /Choose Files/i,
      })
    );

    await user.click(screen.getByText('From Dropbox'));

    expect(screen.queryByText('From Device')).not.toBeInTheDocument();
    expect(mockOnFilesSelected).not.toHaveBeenCalled();
  });

  it('should close the dropdown when Google Drive is selected', async () => {
    const user = userEvent.setup();

    render(
      <FileUploader
        onFilesSelected={mockOnFilesSelected}
      />
    );

    await user.click(
      screen.getByRole('button', {
        name: /Choose Files/i,
      })
    );

    await user.click(screen.getByText('From Google Drive'));

    expect(screen.queryByText('From Device')).not.toBeInTheDocument();
    expect(mockOnFilesSelected).not.toHaveBeenCalled();
  });

  it('should close the dropdown when OneDrive is selected', async () => {
    const user = userEvent.setup();

    render(
      <FileUploader
        onFilesSelected={mockOnFilesSelected}
      />
    );

    await user.click(
      screen.getByRole('button', {
        name: /Choose Files/i,
      })
    );

    await user.click(screen.getByText('From OneDrive'));

    expect(screen.queryByText('From Device')).not.toBeInTheDocument();
    expect(mockOnFilesSelected).not.toHaveBeenCalled();
  });

  it('should close the dropdown when URL is selected', async () => {
    const user = userEvent.setup();

    render(
      <FileUploader
        onFilesSelected={mockOnFilesSelected}
      />
    );

    await user.click(
      screen.getByRole('button', {
        name: /Choose Files/i,
      })
    );

    await user.click(screen.getByText('From URL'));

    expect(screen.queryByText('From Device')).not.toBeInTheDocument();
    expect(mockOnFilesSelected).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------
  // Multiple instances
  // ---------------------------------------------------------

  it('should generate unique file input IDs for multiple instances', () => {
    render(
      <>
        <FileUploader onFilesSelected={mockOnFilesSelected} />
        <FileUploader onFilesSelected={mockOnFilesSelected} />
      </>
    );

    const fileInputs = document.querySelectorAll(
      'input[type="file"]'
    );

    expect(fileInputs).toHaveLength(2);

    expect(fileInputs[0].id).toBeTruthy();
    expect(fileInputs[1].id).toBeTruthy();

    expect(fileInputs[0].id).not.toBe(fileInputs[1].id);
  });
});

