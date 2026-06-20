import Clipboard from '@react-native-clipboard/clipboard';
import { Platform } from 'react-native';

/** 将文本写入系统剪贴板，web 与 native 均可用 */
export async function copyToClipboard(text: string): Promise<boolean> {
  const value = text.trim();
  if (!value) {
    return false;
  }

  try {
    if (Platform.OS === 'web') {
      await navigator.clipboard.writeText(value);
      return true;
    }
    Clipboard.setString(value);
    return true;
  } catch {
    return false;
  }
}
