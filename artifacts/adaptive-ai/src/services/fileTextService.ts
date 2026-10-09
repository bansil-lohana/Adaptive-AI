import type { DocumentPickerAsset } from 'expo-document-picker';
import { File } from 'expo-file-system';

const supportedExtensions = new Set(['.txt', '.md', '.csv', '.tsv', '.json']);
const supportedMimeTypes = new Set([
  'text/plain',
  'text/markdown',
  'text/csv',
  'text/tab-separated-values',
  'application/json',
]);
const maxFileBytes = 2 * 1024 * 1024;
const maxTextLength = 500_000;

export async function readTextFile(asset: DocumentPickerAsset) {
  const extension = asset.name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0];
  const mimeType = asset.mimeType?.toLowerCase().split(';')[0];
  if (!supportedExtensions.has(extension ?? '') && !supportedMimeTypes.has(mimeType ?? '')) {
    throw new Error('Unsupported file type. Choose a .txt, .md, .csv, .tsv, or .json file.');
  }
  if (asset.size !== undefined && asset.size > maxFileBytes) {
    throw new Error('This file is larger than the 2 MB limit. Choose a smaller text file.');
  }

  const text = asset.file?.text
    ? await asset.file.text()
    : await new File(asset.uri).text();
  if (!text.trim()) {
    throw new Error('This file does not contain readable text.');
  }
  if (text.length > maxTextLength) {
    throw new Error('This text file is too long to process. Choose a file under 500,000 characters.');
  }
  return text.trim();
}

export function getFileErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return fallback;
}
