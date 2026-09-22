import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SystemConfig from '@/features/adminpages/SystemConfig';
import apiClient from '@/lib/api';

const mockSuccess = jest.fn();
const mockError = jest.fn();

jest.mock('@/lib/api', () => ({
    __esModule: true,
    default: {
        get: jest.fn(),
        put: jest.fn(),
    },
}));

// SystemConfig uses the toast methods directly:
// toast.success(...) and toast.error(...).
jest.mock('@/context/ToastContext', () => ({
    useToast: () => ({
        addToast: jest.fn(),
        success: mockSuccess,
        error: mockError,
        info: jest.fn(),
        warning: jest.fn(),
        removeToast: jest.fn(),
    }),
}));

// Keep the form validation predictable for these component tests.
// The tests focus on SystemConfig behavior rather than the schema itself.
jest.mock('@hookform/resolvers/zod', () => ({
    zodResolver: jest.fn(() => async (values) => ({
        values,
        errors: {},
    })),
}));

const config = {
    freeUserMaxFileSize: 10,
    proUserMaxFileSize: 100,
    maxJobsPerHour: 20,
    maxProcessingTime: 300,
    maxConcurrentJobs: 5,
    cleanupInterval: 24,
    logRetentionDays: 30,
    tempFileRetention: 24,
    enableRateLimit: true,
    maxRequestsPerMinute: 60,
    enableFileTypeValidation: true,
    allowedFileTypes: 'pdf,docx,jpg,png',
    enableEmailNotifications: true,
    enableSlackAlerts: false,
    alertThreshold: 80,
    maxStorageGB: 100,
};

const updatedConfig = {
    ...config,
    freeUserMaxFileSize: 25,
};

const createQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                gcTime: Infinity,
            },
            mutations: {
                retry: false,
            },
        },
    });

const renderSystemConfig = () => {
    const queryClient = createQueryClient();

    return render(
        <QueryClientProvider client={queryClient}>
            <SystemConfig />
        </QueryClientProvider>
    );
};

const mockConfigResponse = () => {
    apiClient.get.mockResolvedValue({
        data: config,
    });
};

/*
 * ConfigInput does not use htmlFor/id associations.
 * It renders the label immediately before the input.
 *
 * Finding the label first and then its parent keeps these tests
 * aligned with the actual ConfigInput implementation.
 */
const getInputByLabel = (labelText) => {
    const label = screen.getByText(labelText, {
        selector: 'label',
    });

    return label.parentElement.querySelector('input');
};

/*
 * ConfigToggle renders:
 *
 * <div>
 *   <div>
 *     <label>...</label>
 *   </div>
 *   <button>...</button>
 * </div>
 *
 * Find the label and walk to the ConfigToggle wrapper, then locate
 * its button.
 */
const getToggleButton = (labelText) => {
    const label = screen.getByText(labelText, {
        selector: 'label',
    });

    return label.parentElement.parentElement.querySelector('button');
};

/* ============================================================
   Loading State
   ============================================================ */

describe('SystemConfig - Loading State', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('shows loading message while configuration is being fetched', () => {
        apiClient.get.mockReturnValue(new Promise(() => { }));

        renderSystemConfig();

        expect(
            screen.getByText('Loading system configuration...')
        ).toBeInTheDocument();
    });
});

/* ============================================================
   Error State
   ============================================================ */

describe('SystemConfig - Error State', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('shows API error message when configuration fetch fails', async () => {
        apiClient.get.mockRejectedValue(
            new Error('Configuration unavailable')
        );

        renderSystemConfig();

        expect(
            await screen.findByText('Error: Configuration unavailable')
        ).toBeInTheDocument();
    });

    test('shows fallback error message when fetch error has no message', async () => {
        apiClient.get.mockRejectedValue({});

        renderSystemConfig();

        expect(
            await screen.findByText('Error: Failed to load configuration.')
        ).toBeInTheDocument();
    });
});

/* ============================================================
   Initial Rendering
   ============================================================ */

describe('SystemConfig - Initial Rendering', () => {
    beforeEach(() => {
        mockConfigResponse();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('fetches system configuration from the correct endpoint', async () => {
        renderSystemConfig();

        await waitFor(() => {
            expect(apiClient.get).toHaveBeenCalledWith(
                '/api/admin/config'
            );
        });
    });

    test('renders all main configuration sections', async () => {
        renderSystemConfig();

        expect(
            await screen.findByText('File Processing Limits')
        ).toBeInTheDocument();

        expect(
            screen.getByText('System Settings')
        ).toBeInTheDocument();

        expect(
            screen.getByText('Security Settings')
        ).toBeInTheDocument();

        expect(
            screen.getByText('Notifications & Alerts')
        ).toBeInTheDocument();
    });

    test('renders Save Changes and Reset buttons', async () => {
        renderSystemConfig();

        expect(
            await screen.findByRole('button', {
                name: 'Save Changes',
            })
        ).toBeInTheDocument();

        expect(
            screen.getByRole('button', {
                name: 'Reset',
            })
        ).toBeInTheDocument();
    });

    test('renders configuration values returned by the API', async () => {
        renderSystemConfig();

        const freeFileSize = await waitFor(() =>
            getInputByLabel('Free User Max File Size')
        );

        expect(freeFileSize).toHaveValue(10);

        expect(
            getInputByLabel('Pro User Max File Size')
        ).toHaveValue(100);

        expect(
            getInputByLabel('Max Jobs Per Hour')
        ).toHaveValue(20);

        expect(
            getInputByLabel('Max Processing Time')
        ).toHaveValue(300);

        expect(
            getInputByLabel('Max Concurrent Jobs')
        ).toHaveValue(5);

        expect(
            getInputByLabel('Cleanup Interval')
        ).toHaveValue(24);

        expect(
            getInputByLabel('Log Retention')
        ).toHaveValue(30);

        expect(
            getInputByLabel('Temp File Retention')
        ).toHaveValue(24);
    });

    test('renders security and notification configuration values', async () => {
        renderSystemConfig();

        await screen.findByText('Security Settings');

        expect(
            getInputByLabel('Max Requests Per Minute')
        ).toHaveValue(60);

        expect(
            getInputByLabel('Allowed File Types')
        ).toHaveValue('pdf,docx,jpg,png');

        expect(
            getInputByLabel('Alert Threshold')
        ).toHaveValue(80);

        expect(
            getInputByLabel('Max Storage')
        ).toHaveValue(100);
    });

    test('renders the configuration notes', async () => {
        renderSystemConfig();

        const notesHeading = await screen.findByText('Configuration Notes');

        expect(notesHeading).toBeInTheDocument();

        const notesContainer = notesHeading.parentElement;
        const notesList = notesContainer.querySelector('ul');

        expect(notesList).toBeInTheDocument();

        const notes = notesList.querySelectorAll('li');

        expect(notes).toHaveLength(4);

        expect(notes[0]).toHaveTextContent(
            /Changes to file size limits/i
        );

        expect(notes[1]).toHaveTextContent(
            /Rate limiting changes require service restart/i
        );

        expect(notes[2]).toHaveTextContent(
            /Storage and cleanup settings are checked hourly/i
        );

        expect(notes[3]).toHaveTextContent(
            /Alert thresholds are evaluated every 5 minutes/i
        );
    });
});

/* ============================================================
   Dirty State
   ============================================================ */

describe('SystemConfig - Dirty State', () => {
    beforeEach(() => {
        mockConfigResponse();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('Save Changes is disabled when there are no changes', async () => {
        renderSystemConfig();

        const saveButton = await screen.findByRole('button', {
            name: 'Save Changes',
        });

        expect(saveButton).toBeDisabled();
    });

    test('Reset is disabled when there are no changes', async () => {
        renderSystemConfig();

        const resetButton = await screen.findByRole('button', {
            name: 'Reset',
        });

        expect(resetButton).toBeDisabled();
    });

    test('shows unsaved changes banner after editing a field', async () => {
        renderSystemConfig();

        const input = await waitFor(() =>
            getInputByLabel('Free User Max File Size')
        );

        fireEvent.change(input, {
            target: {
                value: '25',
            },
        });

        expect(
            await screen.findByText('You have unsaved changes.')
        ).toBeInTheDocument();
    });

    test('enables Save Changes after editing a field', async () => {
        renderSystemConfig();

        const input = await waitFor(() =>
            getInputByLabel('Free User Max File Size')
        );

        fireEvent.change(input, {
            target: {
                value: '25',
            },
        });

        expect(
            await screen.findByRole('button', {
                name: 'Save Changes',
            })
        ).toBeEnabled();
    });

    test('enables Reset after editing a field', async () => {
        renderSystemConfig();

        const input = await waitFor(() =>
            getInputByLabel('Free User Max File Size')
        );

        fireEvent.change(input, {
            target: {
                value: '25',
            },
        });

        expect(
            await screen.findByRole('button', {
                name: 'Reset',
            })
        ).toBeEnabled();
    });
});

/* ============================================================
   Reset
   ============================================================ */

describe('SystemConfig - Reset', () => {
    beforeEach(() => {
        mockConfigResponse();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('restores original values when Reset is clicked', async () => {
        renderSystemConfig();

        const input = await waitFor(() =>
            getInputByLabel('Free User Max File Size')
        );

        fireEvent.change(input, {
            target: {
                value: '25',
            },
        });

        expect(input).toHaveValue(25);

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Reset',
            })
        );

        await waitFor(() => {
            expect(input).toHaveValue(10);
        });
    });

    test('removes the unsaved changes state after Reset', async () => {
        renderSystemConfig();

        const input = await waitFor(() =>
            getInputByLabel('Free User Max File Size')
        );

        fireEvent.change(input, {
            target: {
                value: '25',
            },
        });

        expect(
            screen.getByText('You have unsaved changes.')
        ).toBeInTheDocument();

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Reset',
            })
        );

        await waitFor(() => {
            expect(
                screen.queryByText('You have unsaved changes.')
            ).not.toBeInTheDocument();
        });
    });
});

/* ============================================================
   Configuration Toggles
   ============================================================ */

describe('SystemConfig - Configuration Toggles', () => {
    beforeEach(() => {
        mockConfigResponse();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('renders rate limiting toggle in enabled state', async () => {
        renderSystemConfig();

        await screen.findByText('Enable Rate Limiting');

        const toggle = getToggleButton('Enable Rate Limiting');

        expect(toggle).toHaveClass('bg-blue-600');
    });

    test('toggles rate limiting when clicked', async () => {
        renderSystemConfig();

        await screen.findByText('Enable Rate Limiting');

        const toggle = getToggleButton('Enable Rate Limiting');

        expect(toggle).toHaveClass('bg-blue-600');

        fireEvent.click(toggle);

        await waitFor(() => {
            expect(toggle).toHaveClass('bg-gray-200');
        });

        expect(
            screen.getByText('You have unsaved changes.')
        ).toBeInTheDocument();
    });

    test('renders file type validation toggle in enabled state', async () => {
        renderSystemConfig();

        await screen.findByText('File Type Validation');

        const toggle = getToggleButton('File Type Validation');

        expect(toggle).toHaveClass('bg-blue-600');
    });

    test('renders email notifications toggle in enabled state', async () => {
        renderSystemConfig();

        await screen.findByText('Email Notifications');

        const toggle = getToggleButton('Email Notifications');

        expect(toggle).toHaveClass('bg-blue-600');
    });

    test('renders Slack alerts toggle in disabled state', async () => {
        renderSystemConfig();

        await screen.findByText('Slack Alerts');

        const toggle = getToggleButton('Slack Alerts');

        expect(toggle).toHaveClass('bg-gray-200');
    });

    test('toggles file type validation when clicked', async () => {
        renderSystemConfig();

        await screen.findByText('File Type Validation');

        const toggle = getToggleButton('File Type Validation');

        expect(toggle).toHaveClass('bg-blue-600');

        fireEvent.click(toggle);

        await waitFor(() => {
            expect(toggle).toHaveClass('bg-gray-200');
        });

        expect(
            screen.getByText('You have unsaved changes.')
        ).toBeInTheDocument();
    });

    test('toggles email notifications when clicked', async () => {
        renderSystemConfig();

        await screen.findByText('Email Notifications');

        const toggle = getToggleButton('Email Notifications');

        expect(toggle).toHaveClass('bg-blue-600');

        fireEvent.click(toggle);

        await waitFor(() => {
            expect(toggle).toHaveClass('bg-gray-200');
        });

        expect(
            screen.getByText('You have unsaved changes.')
        ).toBeInTheDocument();
    });

    test('toggles Slack alerts when clicked', async () => {
        renderSystemConfig();

        await screen.findByText('Slack Alerts');

        const toggle = getToggleButton('Slack Alerts');

        expect(toggle).toHaveClass('bg-gray-200');

        fireEvent.click(toggle);

        await waitFor(() => {
            expect(toggle).toHaveClass('bg-blue-600');
        });

        expect(
            screen.getByText('You have unsaved changes.')
        ).toBeInTheDocument();
    });
});

/* ============================================================
   Save
   ============================================================ */

describe('SystemConfig - Save', () => {
    beforeEach(() => {
        mockConfigResponse();
        mockSuccess.mockClear();
        mockError.mockClear();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('sends updated configuration to the API', async () => {
        apiClient.put.mockResolvedValue({
            data: updatedConfig,
        });

        renderSystemConfig();

        const input = await waitFor(() =>
            getInputByLabel('Free User Max File Size')
        );

        fireEvent.change(input, {
            target: {
                value: '25',
            },
        });

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Save Changes',
            })
        );

        await waitFor(() => {
            expect(apiClient.put).toHaveBeenCalledWith(
                '/api/admin/config',
                expect.objectContaining({
                    freeUserMaxFileSize: 25,
                })
            );
        });
    });

    test('shows success toast after configuration is saved', async () => {
        apiClient.put.mockResolvedValue({
            data: updatedConfig,
        });

        renderSystemConfig();

        const input = await waitFor(() =>
            getInputByLabel('Free User Max File Size')
        );

        fireEvent.change(input, {
            target: {
                value: '25',
            },
        });

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Save Changes',
            })
        );

        await waitFor(() => {
            expect(mockSuccess).toHaveBeenCalledWith(
                'Configuration saved successfully!'
            );
        });
    });

    test('shows API error message when saving fails', async () => {
        apiClient.put.mockRejectedValue({
            response: {
                data: {
                    message: 'Configuration update failed',
                },
            },
        });

        renderSystemConfig();

        const input = await waitFor(() =>
            getInputByLabel('Free User Max File Size')
        );

        fireEvent.change(input, {
            target: {
                value: '25',
            },
        });

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Save Changes',
            })
        );

        await waitFor(() => {
            expect(mockError).toHaveBeenCalledWith(
                'Configuration update failed'
            );
        });
    });

    test('uses fallback error message when API error has no message', async () => {
        apiClient.put.mockRejectedValue({});

        renderSystemConfig();

        const input = await waitFor(() =>
            getInputByLabel('Free User Max File Size')
        );

        fireEvent.change(input, {
            target: {
                value: '25',
            },
        });

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Save Changes',
            })
        );

        await waitFor(() => {
            expect(mockError).toHaveBeenCalledWith(
                'Failed to save configuration.'
            );
        });
    });
});

/* ============================================================
   Field Updates
   ============================================================ */

describe('SystemConfig - Field Updates', () => {
    beforeEach(() => {
        mockConfigResponse();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('updates numeric configuration values', async () => {
        renderSystemConfig();

        const input = await waitFor(() =>
            getInputByLabel('Max Jobs Per Hour')
        );

        expect(input).toHaveValue(20);

        fireEvent.change(input, {
            target: {
                value: '50',
            },
        });

        expect(input).toHaveValue(50);
    });

    test('updates allowed file types', async () => {
        renderSystemConfig();

        const input = await waitFor(() =>
            getInputByLabel('Allowed File Types')
        );

        expect(input).toHaveValue('pdf,docx,jpg,png');

        fireEvent.change(input, {
            target: {
                value: 'pdf,docx,xlsx',
            },
        });

        expect(input).toHaveValue('pdf,docx,xlsx');
    });
});