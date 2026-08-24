import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FileUploader from '@/components/common/FileUploader';

describe('FileUploader', () => {
  const mockOnFilesSelected = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

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

  it('should open dropdown when button clicked', async () => {
    const user = userEvent.setup();
    render(
      <FileUploader
        title="Choose Files"
        subtitle="Test Subtitle"
        onFilesSelected={mockOnFilesSelected}
      />
    );

    const button = screen.getByText('Choose Files');
    await user.click(button);

    expect(screen.getByText('From Device')).toBeInTheDocument();
    expect(screen.getByText('From Dropbox')).toBeInTheDocument();
    expect(screen.getByText('From Google Drive')).toBeInTheDocument();
    expect(screen.getByText('From OneDrive')).toBeInTheDocument();
    expect(screen.getByText('From URL')).toBeInTheDocument();
  });

  it('should handle file selection from device', async () => {
    const user = userEvent.setup();
    render(
      <FileUploader
        title="Choose Files"
        subtitle="Test Subtitle"
        onFilesSelected={mockOnFilesSelected}
      />
    );

    const button = screen.getByText('Choose Files');
    await user.click(button);
    
    const deviceOption = screen.getByText('From Device');
    await user.click(deviceOption);

    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();

    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    
    // 🔥 FIX: Use fireEvent.change instead of user.upload
    fireEvent.change(fileInput, { target: { files: [file] } });
    
    expect(mockOnFilesSelected).toHaveBeenCalledWith([file]);
  });

  it('should handle drag and drop', () => {
    render(
      <FileUploader
        title="Choose Files"
        subtitle="Test Subtitle"
        onFilesSelected={mockOnFilesSelected}
      />
    );

    const dropArea = document.querySelector('.min-h-\\[400px\\]');
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });

    fireEvent.dragEnter(dropArea);
    fireEvent.dragOver(dropArea);
    fireEvent.drop(dropArea, {
      dataTransfer: {
        files: [file],
      },
    });

    expect(mockOnFilesSelected).toHaveBeenCalledWith([file]);
  });

  it('should show drag active state', () => {
    render(
      <FileUploader
        title="Choose Files"
        subtitle="Test Subtitle"
        onFilesSelected={mockOnFilesSelected}
      />
    );

    const dropArea = document.querySelector('.min-h-\\[400px\\]');
    fireEvent.dragEnter(dropArea);
    expect(dropArea).toHaveClass('border-blue-400', 'bg-blue-50');

    fireEvent.dragLeave(dropArea);
    expect(dropArea).not.toHaveClass('border-blue-400', 'bg-blue-50');
  });
});