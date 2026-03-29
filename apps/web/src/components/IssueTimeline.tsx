import { useEffect, useState } from "react";
import { api, type TimelineEvent as TimelineEventData } from "../lib/api";
import { TimelineEvent } from "./TimelineEvent";

interface IssueTimelineProps {
  issueId: string;
}

export function IssueTimeline({ issueId }: IssueTimelineProps) {
  const [events, setEvents] = useState<TimelineEventData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getIssueTimeline(issueId)
      .then(setEvents)
      .finally(() => setLoading(false));
  }, [issueId]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-gray-50 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="py-20 text-center text-gray-400">
        <div className="text-4xl mb-4">📋</div>
        <div className="text-sm font-bold">타임라인 이벤트가 없습니다</div>
      </div>
    );
  }

  const runCount = events.filter((e) => e.type === "run").length;
  const commentCount = events.filter((e) => e.type === "comment").length;
  const approvalCount = events.filter((e) => e.type === "approval").length;
  const activityCount = events.length - runCount - commentCount - approvalCount;

  return (
    <div className="space-y-0">
      {/* Summary row */}
      <div className="flex items-center gap-6 pb-6 mb-2 border-b border-gray-100">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-blue-400" />
          <span className="text-xs font-black text-gray-500">{runCount} 실행</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-gray-400" />
          <span className="text-xs font-black text-gray-500">{commentCount} 코멘트</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="text-xs font-black text-gray-500">{approvalCount} 승인</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-gray-200" />
          <span className="text-xs font-black text-gray-500">{activityCount} 활동</span>
        </div>
      </div>

      <div className="relative">
        {/* Vertical line behind dots */}
        <div className="absolute left-3 top-4 bottom-4 w-px bg-gray-100" />
        <div className="space-y-0">
          {events.map((event, idx) => (
            <TimelineEvent key={event.id} event={event} isLast={idx === events.length - 1} />
          ))}
        </div>
      </div>
    </div>
  );
}
