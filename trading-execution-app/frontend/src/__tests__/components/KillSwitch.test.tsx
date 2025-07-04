import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { KillSwitch } from '../../components/KillSwitch';
import { api } from '../../lib/api';

jest.mock('../../lib/api');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false }
  }
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
);

describe('KillSwitch Component', () => {
  it('should render kill switch button', () => {
    render(<KillSwitch />, { wrapper });
    
    const button = screen.getByText('KILL SWITCH');
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('bg-red-600');
  });

  it('should show confirmation dialog on click', () => {
    render(<KillSwitch />, { wrapper });
    
    const button = screen.getByText('KILL SWITCH');
    fireEvent.click(button);
    
    expect(screen.getByText('Emergency Close All Positions')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter emergency auth code')).toBeInTheDocument();
  });

  it('should call API with auth code', async () => {
    (api.post as jest.Mock).mockResolvedValue({ message: 'Success' });
    
    render(<KillSwitch />, { wrapper });
    
    // Open dialog
    fireEvent.click(screen.getByText('KILL SWITCH'));
    
    // Enter auth code
    const input = screen.getByPlaceholderText('Enter emergency auth code');
    fireEvent.change(input, { target: { value: 'TEST-CODE' } });
    
    // Confirm
    const confirmButton = screen.getByText('Close All Positions');
    fireEvent.click(confirmButton);
    
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/trading/emergency/close-all', {
        reason: 'Manual emergency close',
        auth_code: 'TEST-CODE'
      });
    });
  });
}); 