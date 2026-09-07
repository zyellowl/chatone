import type { TSubmission } from 'librechat-data-provider';

const cancelledSubmissions = new WeakSet<TSubmission>();

export function cancelSubmission(submission: TSubmission | null) {
  if (submission) {
    cancelledSubmissions.add(submission);
  }
}

export function isSubmissionCancelled(submission: TSubmission) {
  return cancelledSubmissions.has(submission);
}
