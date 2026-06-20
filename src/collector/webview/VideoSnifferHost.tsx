/**
 * Headless WebView 视频嗅探宿主。
 *
 * 对应 Kazumi `lib/webview/video` 系列实现：
 * - 现代模式：拦截 XHR/Response + 监听 video 标签 + 导航拦截 m3u8
 * - Legacy 模式：监听 iframe src，RN 侧 decodeVideoSource 解码
 *
 * 以 1×1 透明 View 挂载，resolve() 时才加载 WebView；
 * 通过 useImperativeHandle 暴露 VideoSniffer 接口给 CollectorProvider。
 */
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';

import { DEFAULT_RESOLVE_TIMEOUT_MS } from '../constants';
import {
  VideoSourceCancelledError,
  VideoSourceNotFoundError,
  VideoSourceTimeoutError,
} from '../models/errors';
import type { ResolveVideoOptions, VideoSource } from '../models/video-source';
import { decodeVideoSource, isAdUrl, isM3u8Url } from './decode-video-source';
import {
  buildLegacyOnLoadStopScript,
  buildLegacyPollScript,
  buildModernOnLoadStartScript,
  buildModernOnLoadStopScript,
  buildModernPollScript,
  parseSnifferMessage,
} from './sniffer-scripts';
import type { VideoSniffer } from './video-sniffer-types';

/** 进行中的嗅探任务状态（VideoSnifferHost 内部使用） */
type PendingResolve = {
  /** 传给 VideoSource.offset 的多源偏移 */
  offset: number;
  /** 是否使用 Legacy iframe 嗅探模式 */
  useLegacyParser: boolean;
  /** 嗅探成功时 resolve 的 Promise 回调 */
  resolve: (value: VideoSource) => void;
  /** 超时/取消/加载失败时 reject 的 Promise 回调 */
  reject: (error: Error) => void;
  /** 超时定时器 ID */
  timeoutId: ReturnType<typeof setTimeout>;
};

/** VideoSnifferHost 通过 ref 暴露的接口，等价于 VideoSniffer */
export type VideoSnifferHostRef = VideoSniffer;

type VideoSnifferHostProps = {
  /** 为 false 时不挂载 WebView，避免启动时 native 模块闪退 */
  active?: boolean;
};

export const VideoSnifferHost = forwardRef<
  VideoSnifferHostRef,
  VideoSnifferHostProps
>(function VideoSnifferHost({ active = false }, ref) {
  const webViewRef = useRef<WebView>(null);
  const pendingRef = useRef<PendingResolve | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [mounted, setMounted] = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [userAgent, setUserAgent] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (active) {
      setMounted(true);
    }
  }, [active]);

  const clearPollTimer = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const finishPending = useCallback(
    (url: string) => {
      const pending = pendingRef.current;
      if (!pending) {
        return;
      }
      clearTimeout(pending.timeoutId);
      clearPollTimer();
      pendingRef.current = null;
      setCurrentUrl(null);
      pending.resolve({
        url,
        offset: pending.offset,
        type: 'online',
      });
    },
    [clearPollTimer],
  );

  const rejectPending = useCallback(
    (error: Error) => {
      const pending = pendingRef.current;
      if (!pending) {
        return;
      }
      clearTimeout(pending.timeoutId);
      clearPollTimer();
      pendingRef.current = null;
      setCurrentUrl(null);
      pending.reject(error);
    },
    [clearPollTimer],
  );

  /** 过滤广告 URL，现代/Legacy 模式分别校验 m3u8 或 decode iframe */
  const handleCandidate = useCallback(
    (rawUrl: string, legacy: boolean) => {
      if (!pendingRef.current || !rawUrl) {
        return;
      }
      if (isAdUrl(rawUrl)) {
        return;
      }

      if (legacy) {
        const decoded = decodeVideoSource(rawUrl);
        if (decoded !== rawUrl || /https?:\/\/.+\.(m3u8|mp4)/i.test(decoded)) {
          finishPending(decoded);
        }
        return;
      }

      if (
        rawUrl.includes('http') &&
        (isM3u8Url(rawUrl) || /\.mp4/i.test(rawUrl))
      ) {
        finishPending(rawUrl);
      }
    },
    [finishPending],
  );

  const injectScripts = useCallback(
    (legacy: boolean, phase: 'start' | 'stop' | 'poll') => {
      if (phase === 'start' && !legacy) {
        webViewRef.current?.injectJavaScript(buildModernOnLoadStartScript());
        return;
      }
      if (phase === 'stop') {
        webViewRef.current?.injectJavaScript(
          legacy
            ? buildLegacyOnLoadStopScript()
            : buildModernOnLoadStopScript(),
        );
        return;
      }
      webViewRef.current?.injectJavaScript(
        legacy ? buildLegacyPollScript() : buildModernPollScript(),
      );
    },
    [],
  );

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const message = parseSnifferMessage(event.nativeEvent.data);
      if (!message) {
        return;
      }
      if (message.type === 'video') {
        handleCandidate(message.payload, false);
      } else if (message.type === 'legacy') {
        handleCandidate(message.payload, true);
      }
    },
    [handleCandidate],
  );

  const cancel = useCallback(() => {
    if (!pendingRef.current) {
      return;
    }
    rejectPending(new VideoSourceCancelledError());
  }, [rejectPending]);

  /** 加载播放页并嗅探 m3u8/mp4；新 resolve 会 cancel 前一个进行中的任务 */
  const resolve = useCallback(
    (episodeUrl: string, options: ResolveVideoOptions = {}): Promise<VideoSource> => {
      setMounted(true);

      const useLegacyParser = options.useLegacyParser ?? false;
      const offset = options.offset ?? 0;
      const timeoutMs = options.timeoutMs ?? DEFAULT_RESOLVE_TIMEOUT_MS;

      setUserAgent(options.userAgent);
      setCurrentUrl(episodeUrl);

      return new Promise<VideoSource>((resolvePromise, rejectPromise) => {
        if (pendingRef.current) {
          clearTimeout(pendingRef.current.timeoutId);
          clearPollTimer();
          pendingRef.current.reject(new VideoSourceCancelledError());
          pendingRef.current = null;
        }

        const timeoutId = setTimeout(() => {
          rejectPending(new VideoSourceTimeoutError(timeoutMs));
        }, timeoutMs);

        pendingRef.current = {
          offset,
          useLegacyParser,
          resolve: resolvePromise,
          reject: rejectPromise,
          timeoutId,
        };

        clearPollTimer();
        pollTimerRef.current = setInterval(() => {
          injectScripts(useLegacyParser, 'poll');
        }, 1000);
      });
    },
    [clearPollTimer, injectScripts, rejectPending],
  );

  useImperativeHandle(
    ref,
    () => ({
      resolve,
      cancel,
    }),
    [cancel, resolve],
  );

  useEffect(() => {
    return () => {
      if (pendingRef.current) {
        clearTimeout(pendingRef.current.timeoutId);
        clearPollTimer();
        pendingRef.current = null;
      }
    };
  }, [clearPollTimer]);

  if (!mounted || !currentUrl) {
    return null;
  }

  return (
    <View style={styles.host} pointerEvents="none">
      <WebView
        ref={webViewRef}
        source={{ uri: currentUrl }}
        userAgent={userAgent}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        sharedCookiesEnabled
        originWhitelist={['*']}
        onLoadStart={() => {
          const pending = pendingRef.current;
          if (!pending) {
            return;
          }
          if (!pending.useLegacyParser) {
            injectScripts(false, 'start');
          }
        }}
        onLoadEnd={() => {
          const pending = pendingRef.current;
          if (!pending) {
            return;
          }
          injectScripts(pending.useLegacyParser, 'stop');
        }}
        onError={() => {
          rejectPending(new VideoSourceNotFoundError('WebView load error'));
        }}
        onHttpError={() => {
          rejectPending(new VideoSourceNotFoundError('WebView HTTP error'));
        }}
        onShouldStartLoadWithRequest={(request) => {
          const pending = pendingRef.current;
          if (!pending || pending.useLegacyParser) {
            return true;
          }
          const lower = request.url.toLowerCase();
          if (isAdUrl(lower)) {
            return false;
          }
          if (isM3u8Url(request.url)) {
            finishPending(request.url);
            return false;
          }
          return true;
        }}
        style={styles.webview}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
  },
  webview: {
    width: 360,
    height: 640,
  },
});
