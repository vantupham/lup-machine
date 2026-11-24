import { useCallback, useState } from 'react';
import { safeStorage } from '@/ui/safe-storage';

const key = (projectId: string) => `lup.blurFaces.${projectId}`;

/** Mặc định BẬT (người dùng là học sinh): chỉ tắt khi giá trị đã lưu là "off". */
export function readFaceBlur(projectId: string): boolean {
  return safeStorage.get(key(projectId)) !== 'off';
}

/** Công tắc "làm mờ khuôn mặt trước khi lưu ảnh", nhớ riêng cho từng dự án trên máy này. */
export function useFaceBlurSetting(projectId: string): [boolean, (on: boolean) => void] {
  const [isOn, setIsOn] = useState(() => readFaceBlur(projectId));
  const set = useCallback(
    (on: boolean) => {
      safeStorage.set(key(projectId), on ? 'on' : 'off');
      setIsOn(on);
    },
    [projectId],
  );
  return [isOn, set];
}
