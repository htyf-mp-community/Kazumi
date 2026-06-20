/** 视频嗅探器接口，由 VideoSnifferHost 通过 useImperativeHandle 实现 */
import type { ResolveVideoOptions, VideoSource } from '../models/video-source';

export interface VideoSniffer {
  /**
   * 加载播放页并在 WebView 中嗅探 m3u8/mp4 地址。
   * @param episodeUrl 单集播放页绝对 URL
   * @param options 嗅探选项，见 ResolveVideoOptions
   */
  resolve(episodeUrl: string, options: ResolveVideoOptions): Promise<VideoSource>;
  /** 取消进行中的嗅探，reject 为 VideoSourceCancelledError */
  cancel(): void;
}
