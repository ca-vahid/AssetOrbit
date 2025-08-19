import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

interface ImportRun {
	id: string;
	sourceSystem: string;
	isFullSnapshot: boolean;
	startedAt: string;
	finishedAt?: string;
	stats?: any;
}

const ImportRuns: React.FC = () => {
	const [source, setSource] = React.useState<string>('');
	const { data, isLoading, error, refetch, isFetching } = useQuery<{ runs: ImportRun[] }>({
		queryKey: ['import-runs', source],
		queryFn: async () => {
			const res = await api.get('/import/runs', { params: source ? { source } : {} });
			return res.data;
		},
		staleTime: 30_000,
	});

	return (
		<div className="space-y-4">
			<div className="flex items-end justify-between">
				<div>
					<h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Import Runs</h1>
					<p className="text-sm text-slate-600 dark:text-slate-400">Recent import executions and their outcomes</p>
				</div>
				<div className="flex items-center gap-2">
					<select
						value={source}
						onChange={(e) => setSource(e.target.value)}
						className="px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-sm"
					>
						<option value="">All sources</option>
						<option value="NINJAONE">NINJAONE</option>
						<option value="NINJAONE_SERVERS">NINJAONE_SERVERS</option>
						<option value="TELUS">TELUS</option>
						<option value="ROGERS">ROGERS</option>
					</select>
					<button
						onClick={() => refetch()}
						disabled={isFetching}
						className="px-3 py-1 bg-brand-600 text-white rounded text-sm disabled:opacity-50"
					>
						Refresh
					</button>
				</div>
			</div>

			<div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
				<table className="min-w-full text-sm">
					<thead className="bg-slate-50 dark:bg-slate-700/30 text-slate-700 dark:text-slate-200">
						<tr>
							<th className="text-left px-4 py-2">Source</th>
							<th className="text-left px-4 py-2">Snapshot</th>
							<th className="text-left px-4 py-2">Started</th>
							<th className="text-left px-4 py-2">Finished</th>
							<th className="text-left px-4 py-2">Created</th>
							<th className="text-left px-4 py-2">Updated</th>
							<th className="text-left px-4 py-2">Retired</th>
							<th className="text-left px-4 py-2">Reactivated</th>
							<th className="text-left px-4 py-2">Missing Report</th>
						</tr>
					</thead>
					<tbody>
						{isLoading ? (
							<tr><td className="px-4 py-6" colSpan={9}>Loading…</td></tr>
						) : error ? (
							<tr><td className="px-4 py-6 text-red-600" colSpan={9}>Failed to load import runs</td></tr>
						) : (data?.runs || []).map((run) => {
							const stats = run.stats || {};
							return (
								<tr key={run.id} className="border-t border-slate-100 dark:border-slate-700/50">
									<td className="px-4 py-2">{run.sourceSystem}</td>
									<td className="px-4 py-2">{run.isFullSnapshot ? 'Full' : 'Partial'}</td>
									<td className="px-4 py-2">{new Date(run.startedAt).toLocaleString()}</td>
									<td className="px-4 py-2">{run.finishedAt ? new Date(run.finishedAt).toLocaleString() : '-'}</td>
									<td className="px-4 py-2">{stats.created ?? '-'}</td>
									<td className="px-4 py-2">{stats.updated ?? '-'}</td>
									<td className="px-4 py-2">{stats.retired ?? '-'}</td>
									<td className="px-4 py-2">{stats.reactivated ?? '-'}</td>
									<td className="px-4 py-2">
										<a className="text-brand-600 hover:underline" href={`/reports/missing?source=${encodeURIComponent(run.sourceSystem)}`}>View</a>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</div>
	);
};

export default ImportRuns;

