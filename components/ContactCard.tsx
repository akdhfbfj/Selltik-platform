"use client";

import { useState } from "react";
import type { Contact, ContactStatus } from "@/lib/types";
import { STATUS_COLORS, STATUS_LABELS, STATUS_OPTIONS } from "@/lib/types";
import {
  Building2,
  ChevronDown,
  Mail,
  Pencil,
  Phone,
  Trash2,
  User,
  Globe,
  ImagePlus,
  X,
} from "lucide-react";
import ActivityLog from "@/components/ActivityLog";
import ContactProposals from "@/components/ContactProposals";

interface Props {
  contact: Contact;
  onEdit: (contact: Contact) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: ContactStatus) => void;
  onRefresh: () => void;
  variant?: "grid" | "list";
}

export default function ContactCard({
  contact,
  onEdit,
  onDelete,
  onStatusChange,
  onRefresh,
  variant = "grid",
}: Props) {
  const [showImages, setShowImages] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const isList = variant === "list";

  const tags = contact.tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    await fetch(`/api/contacts/${contact.id}/images`, {
      method: "POST",
      body: formData,
    });
    setUploading(false);
    onRefresh();
  };

  const handleImageDelete = async (imagePath: string) => {
    if (!confirm("이 이미지를 삭제할까요?")) return;
    await fetch(`/api/contacts/${contact.id}/images`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imagePath }),
    });
    onRefresh();
  };

  return (
    <div
      className={`group rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md ${
        isList ? "flex gap-4 p-4" : "flex flex-col"
      }`}
    >
      {/* 이미지 */}
      {contact.images.length > 0 && (
        <div
          className={`relative shrink-0 cursor-pointer overflow-hidden bg-slate-100 ${
            isList
              ? "h-24 w-24 rounded-lg"
              : "h-36 w-full rounded-t-2xl"
          }`}
          onClick={() => setShowImages(true)}
        >
          <img
            src={contact.images[0]}
            alt={contact.companyName}
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
          {contact.images.length > 1 && (
            <span className="absolute bottom-1 right-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
              +{contact.images.length - 1}
            </span>
          )}
        </div>
      )}

      {!isList && contact.images.length === 0 && null}

      <div className={`flex min-w-0 flex-1 flex-col ${isList ? "" : "p-4"}`}>
        {/* 헤더: 업체명 + 상태 */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {isList && contact.images.length === 0 && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <Building2 className="h-4 w-4" />
                </div>
              )}
              <h3 className="truncate text-base font-bold text-slate-900">
                {contact.companyName}
              </h3>
            </div>
            {contact.notes && !expanded && (
              <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                {contact.notes}
              </p>
            )}
          </div>
          <select
            value={contact.status}
            onChange={(e) =>
              onStatusChange(contact.id, e.target.value as ContactStatus)
            }
            className={`shrink-0 cursor-pointer rounded-full border-0 py-1 pl-2.5 pr-7 text-xs font-medium ${STATUS_COLORS[contact.status]}`}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* 연락처 정보 */}
        <div
          className={`mt-3 space-y-1.5 text-sm text-slate-600 ${
            isList ? "grid gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-4" : ""
          }`}
        >
          {contact.contactPerson && (
            <InfoRow icon={<User className="h-3.5 w-3.5" />} text={contact.contactPerson} />
          )}
          {contact.phone && (
            <InfoRow
              icon={<Phone className="h-3.5 w-3.5" />}
              text={contact.phone}
              href={`tel:${contact.phone}`}
            />
          )}
          {contact.email && (
            <InfoRow
              icon={<Mail className="h-3.5 w-3.5" />}
              text={contact.email}
              href={`mailto:${contact.email}`}
            />
          )}
          {contact.website && (
            <InfoRow
              icon={<Globe className="h-3.5 w-3.5" />}
              text={contact.website.replace(/^https?:\/\//, "")}
              href={
                contact.website.startsWith("http")
                  ? contact.website
                  : `https://${contact.website}`
              }
            />
          )}
        </div>

        {expanded && contact.notes && (
          <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs whitespace-pre-line text-slate-500">
            {contact.notes}
          </p>
        )}

        {contact.notes && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700"
          >
            {expanded ? "접기" : "더보기"}
            <ChevronDown
              className={`h-3 w-3 transition ${expanded ? "rotate-180" : ""}`}
            />
          </button>
        )}

        {tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <ContactProposals contactId={contact.id} />

        <ActivityLog contactId={contact.id} />

        {/* 하단: 날짜 + 액션 */}
        <div
          className={`mt-3 flex items-center justify-between border-t border-slate-100 pt-3 ${
            isList ? "mt-auto" : ""
          }`}
        >
          <span className="text-xs text-slate-400">
            {new Date(contact.createdAt).toLocaleDateString("ko-KR")}
          </span>
          <div className="flex items-center gap-1">
            <label className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600">
              <ImagePlus className={`h-4 w-4 ${uploading ? "animate-pulse" : ""}`} />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
                disabled={uploading}
              />
            </label>
            <button
              onClick={() => onEdit(contact)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600"
              title="수정"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => onDelete(contact.id)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
              title="삭제"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {showImages && (
        <ImageModal
          images={contact.images}
          companyName={contact.companyName}
          onClose={() => setShowImages(false)}
          onDelete={handleImageDelete}
        />
      )}
    </div>
  );
}

function InfoRow({
  icon,
  text,
  href,
}: {
  icon: React.ReactNode;
  text: string;
  href?: string;
}) {
  const content = (
    <span className="flex items-center gap-2 truncate">
      <span className="shrink-0 text-slate-400">{icon}</span>
      <span className="truncate">{text}</span>
    </span>
  );
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="block hover:text-brand-600"
      >
        {content}
      </a>
    );
  }
  return content;
}

function ImageModal({
  images,
  companyName,
  onClose,
  onDelete,
}: {
  images: string[];
  companyName: string;
  onClose: () => void;
  onDelete: (path: string) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] max-w-3xl overflow-y-auto rounded-2xl bg-white p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">{companyName} - 캡처</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3">
          {images.map((src) => (
            <div key={src} className="group relative">
              <img src={src} alt="캡처" className="w-full rounded-lg" />
              <button
                onClick={() => onDelete(src)}
                className="absolute right-2 top-2 rounded-lg bg-red-500 px-2 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100"
              >
                삭제
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
