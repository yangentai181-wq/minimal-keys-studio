import { Check } from "lucide-react";

interface ActionFeedbackLabelProps {
  idleLabel: string;
  pendingLabel: string;
  successLabel: string;
  pending: boolean;
  success: boolean;
}

export function ActionFeedbackLabel({ idleLabel, pendingLabel, successLabel, pending, success }: ActionFeedbackLabelProps) {
  const label = pending ? pendingLabel : success ? successLabel : idleLabel;
  return (
    <span className="grid grid-cols-1 items-center">
      {[idleLabel, pendingLabel, successLabel].map((value) => (
        <span key={value} className="col-start-1 row-start-1 whitespace-nowrap" style={{ visibility: value === label ? "visible" : "hidden" }}>
          {value === successLabel && success && !pending && <Check data-testid="action-success-icon" aria-hidden="true" className="mr-1 inline-block size-4" />}
          {value}
        </span>
      ))}
    </span>
  );
}
