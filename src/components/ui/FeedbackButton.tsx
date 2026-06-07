const FEEDBACK_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIQLSfO4k7-AAxTrf_mQ9wPcqhJQalkeTeSSW8l59eo13ivGezfzA/viewform";

export default function FeedbackButton() {
  return (
    <a
      href={FEEDBACK_FORM_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs text-[#6A97B4] hover:text-[#7BA8C4] transition-colors px-3 py-2 min-h-[44px] flex items-center"
    >
      Feedback
    </a>
  );
}
