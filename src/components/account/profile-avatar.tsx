"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { storeApi } from "@/lib/store-api";

type ProfilePhoto = { avatar_data_url: string | null };

function compressPhoto(file: File) {
  return new Promise<string>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const side = Math.min(image.naturalWidth, image.naturalHeight);
      const sx = (image.naturalWidth - side) / 2;
      const sy = (image.naturalHeight - side) / 2;
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const context = canvas.getContext("2d");
      if (!context) return reject(new Error("Foto belum dapat diproses."));
      context.drawImage(image, sx, sy, side, side, 0, 0, 256, 256);
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error("Foto belum dapat diproses."));
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Foto belum dapat dibaca."));
        reader.onerror = () => reject(new Error("Foto belum dapat dibaca."));
        reader.readAsDataURL(blob);
      }, "image/jpeg", 0.76);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("File foto tidak dapat dibuka."));
    };
    image.src = objectUrl;
  });
}

export function ProfileAvatar({ name, initialAvatar }: { name: string; initialAvatar: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [avatar, setAvatar] = useState(initialAvatar);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 12 * 1024 * 1024) {
      setMessage("Pilih foto JPG, PNG, atau WebP dengan ukuran maksimal 12 MB.");
      return;
    }
    setPending(true);
    setMessage("");
    try {
      const imageDataUrl = await compressPhoto(file);
      const profile = await storeApi<ProfilePhoto>("auth/profile", { method: "PATCH", body: JSON.stringify({ image_data_url: imageDataUrl }) });
      setAvatar(profile.avatar_data_url);
      setMessage("Foto profil tersimpan.");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Foto profil belum dapat disimpan.");
    } finally {
      setPending(false);
    }
  }

  return <div className="profile-avatar-wrap">
    <div className="ds-account-avatar" aria-label={avatar ? `Foto profil ${name}` : `Inisial ${initials}`}>
      {avatar ? <img src={avatar} alt="" /> : initials}
    </div>
    <button className="profile-avatar-edit" type="button" disabled={pending} onClick={() => input.current?.click()} aria-label="Ubah foto profil">{pending ? "…" : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5 5 5M4 20l4.2-.8L19 8.4a2.1 2.1 0 0 0-3-3L5.2 16.2 4 20Z" /></svg>}</button>
    <input ref={input} className="profile-avatar-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void upload(event)} />
    {message && <span className="profile-avatar-status" role="status">{message}</span>}
  </div>;
}
