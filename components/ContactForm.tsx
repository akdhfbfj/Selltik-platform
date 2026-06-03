"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { Contact, ContactInput } from "@/lib/types";
import { STATUS_OPTIONS } from "@/lib/types";
import DuplicateWarning from "@/components/DuplicateWarning";
import { ClipboardPaste, ImagePlus, Loader2 } from "lucide-react";

interface DuplicateItem {
  contact: Contact;
  reasons: string[];
}

interface Props {
  contact: Contact | null;
  prefill?: Partial<ContactInput>;
  recommendationId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const emptyForm: ContactInput = {
  companyName: "",
  contactPerson: "",
  phone: "",
  email: "",
  website: "",
  notes: "",
  status: "new",
  tags: "",
};

export default function ContactForm({
  contact,
  prefill,
  recommendationId,
  onSuccess,
  onCancel,
}: Props) {
  const [form, setForm] = useState<ContactInput>(
    contact
      ? {
          companyName: contact.companyName,
          contactPerson: contact.contactPerson,
          phone: contact.phone,
          email: contact.email,
          website: contact.website,
          notes: contact.notes,
          status: contact.status,
          tags: contact.tags,
          recommendationId: contact.recommendationId,
        }
      : { ...emptyForm, ...prefill, recommendationId: recommendationId ?? prefill?.recommendationId }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [duplicates, setDuplicates] = useState<DuplicateItem[]>([]);
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const update = (field: keyof ContactInput, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const checkDuplicates = useCallback(async () => {
    const name = form.companyName.trim();
    const phone = form.phone?.trim() ?? "";
    if (name.length < 2 && phone.replace(/\D/g, "").length < 9) {
      setDuplicates([]);
      return;
    }

    const params = new URLSearchParams({
      companyName: name,
      phone,
    });
    if (contact?.id) params.set("excludeId", contact.id);

    const res = await fetch(`/api/contacts/check-duplicate?${params}`);
    if (res.ok) {
      const data = await res.json();
      setDuplicates(data.duplicates);
    }
  }, [form.companyName, form.phone, contact?.id]);

  useEffect(() => {
    const timer = setTimeout(checkDuplicates, 400);
    return () => clearTimeout(timer);
  }, [checkDuplicates]);

  const addFiles = (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((f) =>
      f.type.startsWith("image/")
    );
    if (imageFiles.length === 0) return;
    setPendingImages((prev) => [...prev, ...imageFiles]);
    imageFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviews((prev) => [...prev, e.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      addFiles(files);
    }
  };

  const removePendingImage = (index: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadImages = async (contactId: string) => {
    for (const file of pendingImages) {
      const formData = new FormData();
      formData.append("file", file);
      await fetch(`/api/contacts/${contactId}/images`, {
        method: "POST",
        body: formData,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName.trim()) {
      setError("업체명을 입력해주세요.");
      return;
    }

    if (duplicates.length > 0) {
      const names = duplicates.map((d) => d.contact.companyName).join(", ");
      const ok = confirm(
        `비슷한 업체가 이미 있습니다 (${names}).\n그래도 저장할까요?`
      );
      if (!ok) return;
    }

    setSaving(true);
    setError("");

    try {
      let contactId = contact?.id;
      if (contact) {
        const res = await fetch(`/api/contacts/${contact.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error("수정 실패");
      } else {
        const res = await fetch("/api/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error("등록 실패");
        const created = await res.json();
        contactId = created.id;
      }

      if (contactId && pendingImages.length > 0) {
        await uploadImages(contactId);
      }
      onSuccess();
    } catch {
      setError("저장에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100";

  return (
    <form onSubmit={handleSubmit} onPaste={handlePaste} className="space-y-4 p-6">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          업체명 <span className="text-red-500">*</span>
        </label>
        <input
          className={inputClass}
          value={form.companyName}
          onChange={(e) => update("companyName", e.target.value)}
          placeholder={prefill ? "업체 조사 후 입력" : "예: (주)OO상사"}
          autoFocus
        />
      </div>

      <DuplicateWarning duplicates={duplicates} />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">담당자</label>
          <input
            className={inputClass}
            value={form.contactPerson}
            onChange={(e) => update("contactPerson", e.target.value)}
            placeholder="홍길동"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">전화번호</label>
          <input
            className={inputClass}
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            placeholder="010-0000-0000"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">이메일</label>
          <input
            className={inputClass}
            type="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            placeholder="contact@company.com"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">웹사이트</label>
          <input
            className={inputClass}
            value={form.website}
            onChange={(e) => update("website", e.target.value)}
            placeholder="https://..."
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">메모</label>
        <textarea
          className={`${inputClass} min-h-[80px] resize-y`}
          value={form.notes}
          onChange={(e) => update("notes", e.target.value)}
          placeholder="컨택 시 참고사항, 추천 상품 정보 등"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">상태</label>
          <select
            className={inputClass}
            value={form.status}
            onChange={(e) => update("status", e.target.value)}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">태그</label>
          <input
            className={inputClass}
            value={form.tags}
            onChange={(e) => update("tags", e.target.value)}
            placeholder="식품, 뷰티 (쉼표 구분)"
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">
          캡처 이미지
        </label>
        <div
          className="cursor-pointer rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center transition hover:border-brand-300 hover:bg-brand-50/50"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            addFiles(e.dataTransfer.files);
          }}
        >
          <ImagePlus className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-2 text-sm font-medium text-slate-600">
            클릭하거나 이미지를 드래그하세요
          </p>
          <p className="mt-1 flex items-center justify-center gap-1 text-xs text-slate-400">
            <ClipboardPaste className="h-3 w-3" />
            Ctrl+V로 캡처 붙여넣기 가능
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
        </div>
        {previews.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {previews.map((src, i) => (
              <div key={i} className="group relative">
                <img
                  src={src}
                  alt={`미리보기 ${i + 1}`}
                  className="h-20 w-20 rounded-lg border border-slate-200 object-cover"
                />
                <button
                  type="button"
                  onClick={() => removePendingImage(i)}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white opacity-0 transition group-hover:opacity-100"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {contact ? "수정하기" : "등록하기"}
        </button>
      </div>
    </form>
  );
}
