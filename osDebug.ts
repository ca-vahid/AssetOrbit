import { transformImportRow } from './packages/shared/src/importSources/transformationRegistry';

const row: Record<string,string> = {
  'Display Name': 'BGC-VAN-SVRM1',
  Role: 'WINDOWS_DESKTOP',
  'Serial Number': '9M0SN23',
  Manufacturer: 'Dell Inc.',
  'System Model': 'Precision 7920 Rack',
  'OS Name': 'Windows 10 Enterprise Edition',
  'OS Architecture': '64-bit',
  'OS Build Number': '19045',
  RAM: '127.62'
};

const res = transformImportRow('ninjaone', row);
console.dir(res, { depth: 5 }); 