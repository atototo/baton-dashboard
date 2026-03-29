import { useEffect, useState } from "react";
import { api, type IssueComment } from "../lib/api";

interface CommentThreadProps {
  issueId: string;
}

export function CommentThread({ issueId }: CommentThreadProps) {
  const [comments, setComments] = useState<IssueComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    api.getIssueComments(issueId)
      .then(setComments)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [issueId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const comment = await api.createIssueComment(issueId, newComment);
      setComments([...comments, comment]);
      setNewComment("");
    } catch (err) {
      alert("Failed to post comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return (
    <div className="py-20 text-center">
      <div className="inline-block w-6 h-6 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mb-4" />
      <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Loading Conversation</div>
    </div>
  );

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="space-y-6">
        {comments.map((comment) => (
          <div key={comment.id} className="group">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-xl shadow-sm ring-1 ring-gray-100 shrink-0">
                {comment.authorAgentIcon || (comment.authorUserId ? "👤" : "❓")}
              </div>
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-gray-900 tracking-tight">
                      {comment.authorAgentName || comment.authorUserId || "Unknown"}
                    </span>
                    {comment.authorAgentId && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-black uppercase tracking-tighter">Agent</span>
                    )}
                    {!comment.authorAgentId && comment.authorUserId && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-black uppercase tracking-tighter">User</span>
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-gray-300 uppercase tracking-tight">
                    {new Date(comment.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-medium group-hover:border-gray-200 transition-colors">
                  {comment.body}
                </div>
              </div>
            </div>
          </div>
        ))}
        {comments.length === 0 && (
          <div className="py-20 text-center bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-100">
            <div className="text-4xl mb-4">💬</div>
            <div className="text-sm font-black text-gray-400 uppercase tracking-widest">No comments yet.</div>
            <p className="text-xs text-gray-300 mt-2 font-medium">Start the conversation below.</p>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="relative pt-6 border-t border-gray-100">
        <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
          <span className="w-4 h-px bg-gray-200" />
          Post a new comment
        </div>
        <div className="relative group">
          <textarea
            className="w-full h-40 p-5 bg-white border border-gray-200 rounded-2xl shadow-sm focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 focus:outline-none text-sm font-medium resize-none transition-all placeholder:text-gray-300"
            placeholder="Write your message here..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
          />
          <div className="absolute bottom-4 right-4 flex items-center gap-4">
            <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">{newComment.length} chars</span>
            <button
              type="submit"
              disabled={!newComment.trim() || isSubmitting}
              className="px-6 py-2.5 bg-gray-900 text-white text-[11px] font-black rounded-xl shadow-lg hover:bg-black disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed transition-all uppercase tracking-widest transform active:scale-95"
            >
              {isSubmitting ? "Sending..." : "Post Comment"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
