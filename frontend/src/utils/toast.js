export const toastListeners = new Set();

/**
 * Global toast dispatcher
 * Usage:
 *   toast.success('Campaign saved successfully')
 *   toast.error('Failed to connect WhatsApp')
 *   toast.warning('Please check phone number')
 *   toast.info('Session refreshed')
 */
export const toast = {
  show: (message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    toastListeners.forEach((listener) => listener({ id, message, type, duration }));
    return id;
  },
  success: (message, duration = 4000) => toast.show(message, 'success', duration),
  error: (message, duration = 4000) => toast.show(message, 'error', duration),
  warning: (message, duration = 4000) => toast.show(message, 'warning', duration),
  info: (message, duration = 4000) => toast.show(message, 'info', duration),
};

export default toast;
