import { useState, useCallback } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

interface ParsedCSV {
  headers: string[];
  rows: Record<string, string>[];
}

export function useFileParser() {
  const [parsed, setParsed] = useState<ParsedCSV | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  const parseXLSX = useCallback((file: File): Promise<ParsedCSV> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          if (jsonData.length === 0) throw new Error('Empty file');
          const headers = jsonData[0] as string[];
          const rows = (jsonData.slice(1) as unknown[]).map(row => {
            const arr = Array.isArray(row) ? row : [];
            const obj: Record<string, string> = {};
            headers.forEach((h, idx) => {
              obj[h] = arr[idx] ? String(arr[idx]) : '';
            });
            return obj;
          }).filter(r => Object.values(r).some(v => v.trim() !== ''));
          resolve({ headers, rows });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsBinaryString(file);
    });
  }, []);

  const parseFile = useCallback(async (file: File) => {
    setIsParsing(true);
    setError(null);
    try {
      const isCSV = file.type === 'text/csv' || file.name.endsWith('.csv');
      const isXLSX = file.type.includes('spreadsheet') || file.name.endsWith('.xlsx');

      let result: ParsedCSV;
      if (isCSV) {
        result = await new Promise((resolve, reject) => {
          Papa.parse<Record<string, string>>(file, {
            header: true,
            skipEmptyLines: true,
            complete: res => {
              if (res.data && res.data.length) {
                resolve({ headers: Object.keys(res.data[0]), rows: res.data as any });
              } else reject(new Error('Empty CSV'));
            },
            error: err => reject(err)
          });
        });
      } else if (isXLSX) {
        result = await parseXLSX(file);
      } else {
        throw new Error('Unsupported file type');
      }
      setParsed(result);
      return result;
    } catch (err: any) {
      setError(err.message || 'Failed to parse file');
      throw err;
    } finally {
      setIsParsing(false);
    }
  }, [parseXLSX]);

  return { parsed, error, isParsing, parseFile };
} 