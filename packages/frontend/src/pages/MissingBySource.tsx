import React from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

interface MissingItem {
	linkId: string;
	asset: { id: string; assetTag: string; status: string; serialNumber?: string; assetType?: string };
	missingSince: string;
}

function useQueryParam(name: string) {
	const { search } = useLocation();
	return React.useMemo(() => new URLSearchParams(search).get(name), [search, name]);
}

const MissingBySource: React.FC = () => {
	const source = useQueryParam('source') || '';
	const { data, isLoading, error, refetch, isFetching } = useQuery<{ source: string; count: number; items: MissingItem[] }>({
		queryKey: ['missing-by-source', source],
		queryFn: async () => {
			const res = await api.get('/import/missing', { params: { source } });
			return res.data;
		},
		enabled: !!source,
		staleTime: 30_000,
	});

	return (
		<div className="space-y-4">
			<div className="flex items-end justify-between">
				<div>
					<h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Missing from Source</h1>
					<p className="text-sm text-slate-600 dark:text-slate-400">Assets not present in the latest snapshot for {source || '—'}</p>
				</div>
				<div className="flex items-center gap-2">
					<button onClick={() => refetch()} disabled={isFetching} className="px-3 py-1 bg-brand-600 text-white rounded text-sm disabled:opacity-50">Refresh</button>
				</div>
			</div>

			<div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
				<table className="min-w-full text-sm">
					<thead className="bg-slate-50 dark:bg-slate-700/30 text-slate-700 dark:text-slate-200">
						<tr>
							<th className="text-left px-4 py-2">Asset Tag</th>
							<th className="text-left px-4 py-2">Status</th>
							<th className="text-left px-4 py-2">Serial</th>
							<th className="text-left px-4 py-2">Type</th>
							<th className="text-left px-4 py-2">Missing Since</th>
							<th className="text-left px-4 py-2">Actions</th>
						</tr>
					</thead>
					<tbody>
						{!source ? (
							<tr><td className="px-4 py-6" colSpan={6}>Select a source via URL param, e.g., /reports/missing?source=NINJAONE</td></tr>
						) : isLoading ? (
							<tr><td className="px-4 py-6" colSpan={6}>Loading…</td></tr>
						) : error ? (
							<tr><td className="px-4 py-6 text-red-600" colSpan={6}>Failed to load missing items</td></tr>
						) : (data?.items || []).map((item) => (
							<tr key={item.linkId} className="border-t border-slate-100 dark:border-slate-700/50">
								<td className="px-4 py-2">
									<a className="text-brand-600 hover:underline" href={`/assets?search=${encodeURIComponent(item.asset.assetTag)}`}>{item.asset.assetTag}</a>
								</td>
								<td className="px-4 py-2">{item.asset.status}</td>
								<td className="px-4 py-2">{item.asset.serialNumber || '-'}</td>
								<td className="px-4 py-2">{item.asset.assetType || '-'}</td>
								<td className="px-4 py-2">{new Date(item.missingSince).toLocaleString()}</td>
								<td className="px-4 py-2 text-slate-600">—</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
};

export default MissingBySource;

