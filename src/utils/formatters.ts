const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatBRL(value: number, showSign = false): string {
  const safe = Math.abs(value) < 0.005 ? 0 : value;
  const formatted = brlFormatter.format(safe);
  if (showSign && safe > 0) {
    return `+${formatted}`;
  }
  return formatted;
}

export function formatNumber(value: number, maxDecimals = 2): string {
  const safe = Math.abs(value) < 1e-9 ? 0 : value;
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: Number.isInteger(safe) ? 0 : 1,
    maximumFractionDigits: maxDecimals,
  }).format(safe);
}

export function formatSignedNumber(value: number, maxDecimals = 2): string {
  const safe = Math.abs(value) < 1e-9 ? 0 : value;
  const formatted = formatNumber(safe, maxDecimals);
  if (safe > 0) {
    return `+${formatted}`;
  }
  return formatted;
}

export function formatPercent(value: number, decimals = 1): string {
  const safe = Math.abs(value) < 1e-9 ? 0 : value;
  return `${new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(safe)}%`;
}

export function formatDateTimeBR(isoOrDate: string | Date): string {
  const date = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const datePart = date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timePart = date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${datePart} às ${timePart}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1).replace('.', ',')} KB`;
  }
  const mb = kb / 1024;
  return `${mb.toFixed(2).replace('.', ',')} MB`;
}

export function generateReportCode(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const suffix = Math.floor(1000 + Math.random() * 9000).toString(16).toUpperCase().padStart(4, '0');
  return `SG-${y}${m}${d}-${suffix}`;
}
