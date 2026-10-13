"use client";
import { Suspense } from "react";
import ProtectedWorkspace from "@/components/common/ProtectedWorkspace";
import InterviewReport from "@/components/interview/InterviewReport";
import { useSearchParams } from "next/navigation";

function ReportPageContent() {
	const searchParams = useSearchParams();
	const interviewId = searchParams.get("id");

	return (
		<ProtectedWorkspace eyebrow="Interview report">
			<div className="space-y-6">
				<div>
					<p className="text-xs uppercase tracking-[0.24em] text-fuchsia-300">Interview record</p>
					<h1 className="mt-2 text-3xl font-bold">Interview Report</h1>
					<p className="mt-2 text-slate-400">
						{interviewId ? `Report for interview ${interviewId}` : 'Latest generated interview report'}
					</p>
				</div>
				<InterviewReport />
			</div>
		</ProtectedWorkspace>
	);
}

export default function ReportPage() {
	return (
		<Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
			<ReportPageContent />
		</Suspense>
	);
}