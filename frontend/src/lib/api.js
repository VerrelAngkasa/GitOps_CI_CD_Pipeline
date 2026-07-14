import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

export default api;

export const currency = (n) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(
    Number(n || 0)
  );

export const monthLabel = (year, month) =>
  new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

export const percent = (n) => `${Number(n || 0).toFixed(1)}%`;

export const ASSET_TYPES = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank account' },
  { value: 'savings', label: 'Savings' },
  { value: 'investment', label: 'Investment' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'liability', label: 'Liability (loan, debt)' },
  { value: 'other', label: 'Other' },
];

export const EXPENSE_CATEGORIES = [
  'FnBs',
  'Health',
  'Sports',
  'Groceries',
  'Transport',
  'Shopping',
  'Entertainment',
  'Bills & Utilities',
  'Travel',
  'Other',
];
