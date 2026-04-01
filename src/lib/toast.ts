import { toast } from "sonner";

export function showSuccess(message: string) {
  toast.success(message, {
    duration: 3000,
    style: {
      background: "#1f2937",
      border: "1px solid rgba(16, 185, 129, 0.2)",
      color: "#d1fae5",
    },
  });
}

export function showError(message: string, options?: { retry?: () => void }) {
  toast.error(message, {
    duration: 5000,
    action: options?.retry
      ? { label: "Retry", onClick: options.retry }
      : undefined,
    style: {
      background: "#1f2937",
      border: "1px solid rgba(239, 68, 68, 0.2)",
      color: "#fecaca",
    },
  });
}

export function showWarning(message: string) {
  toast.warning(message, {
    duration: 4000,
    style: {
      background: "#1f2937",
      border: "1px solid rgba(245, 158, 11, 0.2)",
      color: "#fde68a",
    },
  });
}

export function showLoading(message: string): string | number {
  return toast.loading(message, {
    style: {
      background: "#1f2937",
      border: "1px solid #374151",
      color: "#f3f4f6",
    },
  });
}

export function dismissToast(id: string | number) {
  toast.dismiss(id);
}
