import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import LogsManager from '@/features/adminpages/logs/index';

jest.mock('@/features/adminpages/logs/AuditLogs', () => ({
  __esModule: true,
  default: () => <div>Mock Audit Logs Content</div>,
}));

jest.mock('@/features/adminpages/logs/ActivityLogs', () => ({
  __esModule: true,
  default: () => <div>Mock Activity Logs Content</div>,
}));

jest.mock('@/features/adminpages/logs/ChainAuditing', () => ({
  __esModule: true,
  default: () => <div>Mock Chain Auditing Content</div>,
}));

jest.mock('@/features/adminpages/logs/WafStatus', () => ({
  __esModule: true,
  default: () => <div>Mock WAF Status Content</div>,
}));

describe('LogsManager', () => {
  test('renders the Logs & Security heading and all tabs', () => {
    render(<LogsManager />);

    expect(screen.getByText('Logs & Security')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /Audit Logs/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Activity Logs/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Chain Auditing/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /WAF Status/ })).toBeInTheDocument();
  });

  test('shows Audit Logs by default', () => {
    render(<LogsManager />);

    expect(screen.getByText('Mock Audit Logs Content')).toBeInTheDocument();

    expect(
      screen.queryByText('Mock Activity Logs Content')
    ).not.toBeInTheDocument();

    expect(
      screen.queryByText('Mock Chain Auditing Content')
    ).not.toBeInTheDocument();

    expect(
      screen.queryByText('Mock WAF Status Content')
    ).not.toBeInTheDocument();
  });

  test('switches to Activity Logs tab', async () => {
    const user = userEvent.setup();

    render(<LogsManager />);

    await user.click(
      screen.getByRole('button', { name: /Activity Logs/ })
    );

    expect(screen.getByText('Mock Activity Logs Content')).toBeInTheDocument();

    expect(
      screen.queryByText('Mock Audit Logs Content')
    ).not.toBeInTheDocument();
  });

  test('switches to Chain Auditing tab', async () => {
    const user = userEvent.setup();

    render(<LogsManager />);

    await user.click(
      screen.getByRole('button', { name: /Chain Auditing/ })
    );

    expect(
      screen.getByText('Mock Chain Auditing Content')
    ).toBeInTheDocument();

    expect(
      screen.queryByText('Mock Audit Logs Content')
    ).not.toBeInTheDocument();
  });

  test('switches to WAF Status tab', async () => {
    const user = userEvent.setup();

    render(<LogsManager />);

    await user.click(
      screen.getByRole('button', { name: /WAF Status/ })
    );

    expect(
      screen.getByText('Mock WAF Status Content')
    ).toBeInTheDocument();

    expect(
      screen.queryByText('Mock Audit Logs Content')
    ).not.toBeInTheDocument();
  });
});