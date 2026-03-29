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

  if (loading) return <div className="py-10 text-center text-gray-500">Loading timeline...</div>;

  return (
    <div className="space-y-2 relative">
      <div className="absolute left-3.5 top-0 bottom-0 w-px bg-gray-100 -z-10" />
      {events.map((event) => (
        <TimelineEvent key={event.id} event={event} />
      ))}
      {events.length === 0 && (
        <div className="py-20 text-center text-gray-400">No events found for this issue.</div>
      )}
    </div>
  );
}
