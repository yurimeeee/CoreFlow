"use client";

import * as React from "react";
import Image from "next/image";
import { ImageUp, Trash2, FileSignature } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";

interface FileDropzoneProps {
  id: string;
  label: string;
  hint?: string;
  file: File | null;
  onChange: (file: File | null) => void;
  variant?: "avatar" | "signature";
  accept?: string;
  maxSizeMB?: number;
}

export function FileDropzone({
  id,
  label,
  hint,
  file,
  onChange,
  variant = "avatar",
  accept = "image/png,image/jpeg,image/webp",
  maxSizeMB = 5,
}: FileDropzoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const preview = React.useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file],
  );

  React.useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  const accept_list = accept.split(",").map((s) => s.trim());

  const validate = (f: File): string | null => {
    if (accept_list.length && !accept_list.includes(f.type)) {
      return "PNG · JPG · WEBP 이미지만 업로드할 수 있습니다.";
    }
    if (f.size > maxSizeMB * 1024 * 1024) {
      return `파일 용량은 ${maxSizeMB}MB 이하여야 합니다.`;
    }
    return null;
  };

  const handleFiles = (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    const err = validate(f);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    onChange(f);
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-semibold text-secondary-foreground">
        {label}
      </span>

      <div
        role="button"
        tabIndex={0}
        aria-label={`${label} 업로드`}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "group relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-border bg-secondary/60 p-6 text-center transition-colors",
          "hover:border-ring hover:bg-accent/50",
          dragging && "border-ring bg-accent ring-2 ring-ring/30",
          variant === "signature" ? "min-h-[132px]" : "min-h-[168px]",
        )}
      >
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />

        {preview ? (
          <>
            {variant === "avatar" ? (
              <span className="relative size-24 overflow-hidden rounded-full ring-4 ring-card shadow-[var(--shadow-card)]">
                <Image
                  src={preview}
                  alt="프로필 미리보기"
                  fill
                  sizes="96px"
                  className="object-cover"
                  unoptimized
                />
              </span>
            ) : (
              <span className="relative h-20 w-full max-w-[220px] overflow-hidden rounded-md border border-border bg-card">
                <Image
                  src={preview}
                  alt="서명 미리보기"
                  fill
                  sizes="220px"
                  className="object-contain p-2"
                  unoptimized
                />
              </span>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="max-w-[160px] truncate font-medium text-secondary-foreground">
                {file?.name}
              </span>
              <span>·</span>
              <span>{file ? formatBytes(file.size) : ""}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null);
                  setError(null);
                }}
                className="ml-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="size-3.5" />
                삭제
              </button>
            </div>
          </>
        ) : (
          <>
            <span className="flex size-11 items-center justify-center rounded-full bg-accent text-primary">
              {variant === "signature" ? (
                <FileSignature className="size-5" />
              ) : (
                <ImageUp className="size-5" />
              )}
            </span>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-secondary-foreground">
                파일을 끌어다 놓거나 클릭해 선택
              </p>
              <p className="text-xs text-muted-foreground">
                {hint ?? `PNG · JPG · WEBP / 최대 ${maxSizeMB}MB`}
              </p>
            </div>
          </>
        )}
      </div>

      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}
