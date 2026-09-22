import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import JobMonitor from '@/features/adminpages/JobMonitor';
import apiClient from '@/lib/api';

jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

// ─────────────────────────────────────────────────────────────
// Test data
// ─────────────────────────────────────────────────────────────

const jobs = [
  {
    _id: 'job-001',
    userId: { email: 'alice@example.com' },
    format: 'PDF',
    filename: 'report.pdf',
    sizeInBytes: 1048576,
    status: 'completed',
    processedAt: '2026-01-15T10:30:00.000Z',
    createdAt: '2026-01-15T10:29:00.000Z',
    processingTimeMs: 1250,
  },
  {
    _id: 'job-002',
    userId: { email: 'bob@example.com' },
    format: 'DOCX',
    filename: 'document.docx',
    sizeInBytes: 2097152,
    status: 'processing',
    processedAt: '2026-01-15T11:00:00.000Z',
    createdAt: '2026-01-15T11:00:00.000Z',
    processingTimeMs: null,
  },
  {
    _id: 'job-003',
    userId: { email: 'charlie@example.com' },
    format: 'PDF',
    filename: 'failed.pdf',
    sizeInBytes: 524288,
    status: 'failed',
    processedAt: '2026-01-15T12:00:00.000Z',
    createdAt: '2026-01-15T12:00:00.000Z',
    processingTimeMs: 500,
  },
  {
    _id: 'job-004',
    userId: { email: 'david@example.com' },
    format: 'PDF',
    filename: 'queued.pdf',
    sizeInBytes: 3145728,
    status: 'queued',
    processedAt: '2026-01-15T13:00:00.000Z',
    createdAt: '2026-01-15T13:00:00.000Z',
    processingTimeMs: null,
  },
];

const pagination = {
  total: 4,
  totalPages: 1,
  hasPrev: false,
  hasNext: false,
};

// ─────────────────────────────────────────────────────────────
// Test helpers
// ─────────────────────────────────────────────────────────────

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
    },
  });

const renderJobMonitor = () => {
  const queryClient = createQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <JobMonitor />
    </QueryClientProvider>
  );
};

const mockSuccessfulResponse = () => {
  apiClient.get.mockResolvedValue({
    data: {
      jobs,
      pagination,
    },
  });
};

// ─────────────────────────────────────────────────────────────
// Loading state
// ─────────────────────────────────────────────────────────────

describe('JobMonitor - Loading State', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('shows loading message while jobs are being fetched', () => {
    apiClient.get.mockReturnValue(new Promise(() => {}));

    renderJobMonitor();

    expect(screen.getByText('Loading jobs...')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
// Error state
// ─────────────────────────────────────────────────────────────

describe('JobMonitor - Error State', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('shows API error message when fetching jobs fails', async () => {
    apiClient.get.mockRejectedValue(new Error('Network error'));

    renderJobMonitor();

    expect(
      await screen.findByText('Error: Network error')
    ).toBeInTheDocument();
  });

  test('shows fallback error message when error has no message', async () => {
    apiClient.get.mockRejectedValue({});

    renderJobMonitor();

    expect(
      await screen.findByText('Error: Failed to load jobs.')
    ).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
// Initial job rendering
// ─────────────────────────────────────────────────────────────

describe('JobMonitor - Job Rendering', () => {
  beforeEach(() => {
    mockSuccessfulResponse();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders Job Monitor heading and description', async () => {
    renderJobMonitor();

    expect(
      await screen.findByRole('heading', { name: 'Job Monitor' })
    ).toBeInTheDocument();

    expect(
      screen.getByText('Track all file processing jobs and their status')
    ).toBeInTheDocument();
  });

  test('fetches jobs with the correct initial pagination parameters', async () => {
    renderJobMonitor();

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/api/admin/jobs', {
        params: {
          page: 1,
          limit: 20,
        },
      });
    });
  });

  test('renders formatted job information', async () => {
    renderJobMonitor();

    const jobId = await screen.findByText('job-001');
    const row = jobId.closest('tr');

    expect(row).toBeInTheDocument();
    expect(row).toHaveTextContent('alice@example.com');
    expect(row).toHaveTextContent('Converted to PDF');
    expect(row).toHaveTextContent('report.pdf');
    expect(row).toHaveTextContent('1.00 MB');
    expect(row).toHaveTextContent('1250ms');

    const expectedTimestamp = new Date(
      '2026-01-15T10:30:00.000Z'
    ).toLocaleString();

    expect(row).toHaveTextContent(expectedTimestamp);
  });

  test('renders all supported job status badges', async () => {
    renderJobMonitor();

    await screen.findByText('job-001');

    const statusBadges = screen
      .getAllByText(/^(Completed|Processing|Failed|Queued)$/)
      .filter((element) => element.tagName.toLowerCase() === 'span');

    expect(statusBadges).toHaveLength(4);

    expect(statusBadges.map((badge) => badge.textContent)).toEqual(
      expect.arrayContaining([
        'Completed',
        'Processing',
        'Failed',
        'Queued',
      ])
    );
  });

  test('renders Export Logs and Refresh buttons', async () => {
    renderJobMonitor();

    await screen.findByText('job-001');

    expect(
      screen.getByRole('button', { name: 'Refresh' })
    ).toBeInTheDocument();

    expect(
      screen.getByRole('button', { name: 'Export Logs' })
    ).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
// Search filtering
// ─────────────────────────────────────────────────────────────

describe('JobMonitor - Search Filtering', () => {
  beforeEach(() => {
    mockSuccessfulResponse();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('filters jobs by user email', async () => {
    renderJobMonitor();

    await screen.findByText('job-001');

    const searchInput = screen.getByPlaceholderText(
      'Search by user, filename, or job ID...'
    );

    fireEvent.change(searchInput, {
      target: { value: 'alice@example.com' },
    });

    expect(screen.getByText('job-001')).toBeInTheDocument();
    expect(screen.queryByText('job-002')).not.toBeInTheDocument();
    expect(screen.queryByText('job-003')).not.toBeInTheDocument();
  });

  test('filters jobs by filename', async () => {
    renderJobMonitor();

    await screen.findByText('job-001');

    const searchInput = screen.getByPlaceholderText(
      'Search by user, filename, or job ID...'
    );

    fireEvent.change(searchInput, {
      target: { value: 'failed.pdf' },
    });

    expect(screen.getByText('job-003')).toBeInTheDocument();
    expect(screen.queryByText('job-001')).not.toBeInTheDocument();
    expect(screen.queryByText('job-002')).not.toBeInTheDocument();
  });

  test('filters jobs by job ID', async () => {
    renderJobMonitor();

    await screen.findByText('job-001');

    const searchInput = screen.getByPlaceholderText(
      'Search by user, filename, or job ID...'
    );

    fireEvent.change(searchInput, {
      target: { value: 'job-002' },
    });

    expect(screen.getByText('job-002')).toBeInTheDocument();
    expect(screen.queryByText('job-001')).not.toBeInTheDocument();
  });

  test('search is case-insensitive', async () => {
    renderJobMonitor();

    await screen.findByText('job-001');

    const searchInput = screen.getByPlaceholderText(
      'Search by user, filename, or job ID...'
    );

    fireEvent.change(searchInput, {
      target: { value: 'ALICE@EXAMPLE.COM' },
    });

    expect(screen.getByText('job-001')).toBeInTheDocument();
    expect(screen.queryByText('job-002')).not.toBeInTheDocument();
  });

  test('shows no-results message when search matches nothing', async () => {
    renderJobMonitor();

    await screen.findByText('job-001');

    const searchInput = screen.getByPlaceholderText(
      'Search by user, filename, or job ID...'
    );

    fireEvent.change(searchInput, {
      target: { value: 'does-not-exist' },
    });

    expect(
      screen.getByText('No jobs found matching your criteria.')
    ).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
// Status filtering
// ─────────────────────────────────────────────────────────────

describe('JobMonitor - Status Filtering', () => {
  beforeEach(() => {
    mockSuccessfulResponse();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('filters jobs by completed status', async () => {
    renderJobMonitor();

    await screen.findByText('job-001');

    const selects = screen.getAllByRole('combobox');
    const statusSelect = selects[0];

    fireEvent.change(statusSelect, {
      target: { value: 'completed' },
    });

    expect(screen.getByText('job-001')).toBeInTheDocument();
    expect(screen.queryByText('job-002')).not.toBeInTheDocument();
    expect(screen.queryByText('job-003')).not.toBeInTheDocument();
    expect(screen.queryByText('job-004')).not.toBeInTheDocument();
  });

  test('filters jobs by failed status', async () => {
    renderJobMonitor();

    await screen.findByText('job-001');

    const selects = screen.getAllByRole('combobox');
    const statusSelect = selects[0];

    fireEvent.change(statusSelect, {
      target: { value: 'failed' },
    });

    expect(screen.getByText('job-003')).toBeInTheDocument();
    expect(screen.queryByText('job-001')).not.toBeInTheDocument();
    expect(screen.queryByText('job-002')).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
// Tool filtering
// ─────────────────────────────────────────────────────────────

describe('JobMonitor - Tool Filtering', () => {
  beforeEach(() => {
    mockSuccessfulResponse();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('filters jobs by tool', async () => {
    renderJobMonitor();

    await screen.findByText('job-001');

    const selects = screen.getAllByRole('combobox');
    const toolSelect = selects[1];

    fireEvent.change(toolSelect, {
      target: { value: 'Converted to PDF' },
    });

    expect(screen.getByText('job-001')).toBeInTheDocument();
    expect(screen.getByText('job-003')).toBeInTheDocument();
    expect(screen.getByText('job-004')).toBeInTheDocument();
    expect(screen.queryByText('job-002')).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
// Refresh functionality
// ─────────────────────────────────────────────────────────────

describe('JobMonitor - Refresh', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('refetches jobs when Refresh is clicked', async () => {
    apiClient.get
      .mockResolvedValueOnce({
        data: {
          jobs,
          pagination,
        },
      })
      .mockResolvedValueOnce({
        data: {
          jobs,
          pagination,
        },
      });

    renderJobMonitor();

    await screen.findByText('job-001');

    expect(apiClient.get).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledTimes(2);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Pagination
// ─────────────────────────────────────────────────────────────

describe('JobMonitor - Pagination', () => {
  const firstPageJobs = jobs.slice(0, 2);

  const secondPageJobs = [
    {
      _id: 'job-021',
      userId: { email: 'eve@example.com' },
      format: 'PDF',
      filename: 'page-two.pdf',
      sizeInBytes: 1048576,
      status: 'completed',
      processedAt: '2026-01-16T10:00:00.000Z',
      createdAt: '2026-01-16T10:00:00.000Z',
      processingTimeMs: 800,
    },
  ];

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('loads the next page when Next is clicked', async () => {
    apiClient.get.mockImplementation((url, { params }) => {
      if (params.page === 1) {
        return Promise.resolve({
          data: {
            jobs: firstPageJobs,
            pagination: {
              total: 21,
              totalPages: 2,
              hasPrev: false,
              hasNext: true,
            },
          },
        });
      }

      return Promise.resolve({
        data: {
          jobs: secondPageJobs,
          pagination: {
            total: 21,
            totalPages: 2,
            hasPrev: true,
            hasNext: false,
          },
        },
      });
    });

    renderJobMonitor();

    expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument();

    const nextButton = screen.getByRole('button', { name: 'Next' });

    expect(nextButton).toBeEnabled();

    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    });

    expect(screen.getByText('job-021')).toBeInTheDocument();

    expect(apiClient.get).toHaveBeenCalledWith('/api/admin/jobs', {
      params: {
        page: 2,
        limit: 20,
      },
    });
  });

  test('previous button is disabled on the first page', async () => {
    apiClient.get.mockResolvedValue({
      data: {
        jobs,
        pagination: {
          total: 21,
          totalPages: 2,
          hasPrev: false,
          hasNext: true,
        },
      },
    });

    renderJobMonitor();

    await screen.findByText('Page 1 of 2');

    expect(
      screen.getByRole('button', { name: 'Previous' })
    ).toBeDisabled();
  });
});

// ─────────────────────────────────────────────────────────────
// Empty results
// ─────────────────────────────────────────────────────────────

describe('JobMonitor - Empty Results', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('shows no-results message when API returns no jobs', async () => {
    apiClient.get.mockResolvedValue({
      data: {
        jobs: [],
        pagination: {
          total: 0,
          totalPages: 1,
          hasPrev: false,
          hasNext: false,
        },
      },
    });

    renderJobMonitor();

    expect(
      await screen.findByText('No jobs found matching your criteria.')
    ).toBeInTheDocument();
  });

  test('handles missing jobs array by using an empty array', async () => {
    apiClient.get.mockResolvedValue({
      data: {
        pagination: {
          total: 0,
          totalPages: 1,
          hasPrev: false,
          hasNext: false,
        },
      },
    });

    renderJobMonitor();

    expect(
      await screen.findByText('No jobs found matching your criteria.')
    ).toBeInTheDocument();
  });
});