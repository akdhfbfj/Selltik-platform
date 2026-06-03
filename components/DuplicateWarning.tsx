"use client";

import type { Contact } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/types";
import { AlertTriangle } from "lucide-react";

interface DuplicateItem {
  contact: Contact;
  reasons: string[];
}

interface Props {
  duplicates: DuplicateItem[];
}

export default function DuplicateWarning({ duplicates }: Props) {
  if (duplicates.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-900">
            비슷한 업체가 이미 있습니다
          </p>
          <ul className="mt-2 space-y-1.5">
            {duplicates.map(({ contact, reasons }) => (
              <li
                key={contact.id}
                className="rounded-md bg-white/70 px-2.5 py-1.5 text-xs text-amber-900"
              >
                <span className="font-medium">{contact.companyName}</span>
                {contact.phone && (
                  <span className="text-amber-700"> · {contact.phone}</span>
                )}
                <span className="ml-1 text-amber-600">
                  ({reasons.join(", ")} 일치)
                </span>
                <span className="ml-1 text-slate-500">
                  · {STATUS_LABELS[contact.status]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
