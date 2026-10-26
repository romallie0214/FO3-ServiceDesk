import toast from 'react-hot-toast';

/** Consistent non-blocking error feedback; repeated messages share one toast. */
export function showErrorToast(message: unknown) {
  const text = typeof message === 'string' && message.trim() ? message : 'Something went wrong. Please try again.';
  return toast.error(text, { id: `error:${text}`, duration: 5000 });
}
