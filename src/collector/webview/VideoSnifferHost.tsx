/**
 * Headless WebView 视频嗅探宿主。
 *
 * 对应 Kazumi `lib/webview/video` 系列实现：
 * - 现代模式：拦截 XHR/Response + 监听 video 标签 + 导航拦截 m3u8
 * - Legacy 模式：监听 iframe src，RN 侧 decodeVideoSource 解码
 *
 * 默认以 1×1 透明 View 挂载；resolve({ debug: true }) 时全屏显示 WebView 便于调试。
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
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
import { copyToClipboard } from '../utils';

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
  const [debugVisible, setDebugVisible] = useState(false);

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
      setDebugVisible(false);
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
      setDebugVisible(false);
      pending.reject(error);
    },
    [clearPollTimer],
  );

  /** 过滤广告 URL，现代模式保持 Dart 侧 VideoBridgeDebug 的宽松接收策略。 */
  const handleCandidate = useCallback(
    (rawUrl: string, legacy: boolean) => {
      if (!pendingRef.current || !rawUrl) {
        console.log('[VideoSniffer][candidate][ignored:no-pending]', {
          legacy,
          rawUrl,
        });
        return;
      }
      if (isAdUrl(rawUrl)) {
        console.log('[VideoSniffer][candidate][ignored:ad]', {
          legacy,
          rawUrl,
        });
        return;
      }

      if (legacy) {
        const encodedUrl = encodeURI(rawUrl);
        const decoded = decodeVideoSource(encodedUrl);
        console.log('[VideoSniffer][candidate][legacy]', {
          rawUrl,
          encodedUrl,
          decoded,
        });
        if (
          decoded !== encodedUrl ||
          /https?:\/\/.+\.(m3u8|mp4)/i.test(decoded)
        ) {
          console.log('[VideoSniffer][candidate][accepted]', decoded);
          finishPending(decoded);
        } else {
          console.log('[VideoSniffer][candidate][ignored:decode-unchanged]', {
            rawUrl,
            encodedUrl,
            decoded,
          });
        }
        return;
      }

      if (rawUrl.includes('http')) {
        console.log('[VideoSniffer][candidate][accepted]', rawUrl);
        finishPending(rawUrl);
      } else {
        console.log('[VideoSniffer][candidate][ignored:not-http]', rawUrl);
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
      console.log('[VideoSniffer][message][raw]', event.nativeEvent.data);
      const message = parseSnifferMessage(event.nativeEvent.data);
      if (!message) {
        console.warn(
          '[VideoSniffer][message][ignored:malformed]',
          event.nativeEvent.data,
        );
        return;
      }
      if (message.type === 'log') {
        console.log('[VideoSniffer][webview]', message.payload);
      } else if (message.type === 'video') {
        console.log('[VideoSniffer][message][video]', message.payload);
        handleCandidate(message.payload, false);
      } else if (message.type === 'legacy') {
        console.log('[VideoSniffer][message][legacy]', message.payload);
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

  const copyUrl = useCallback(() => {
    if (!currentUrl) {
      return;
    }
    copyToClipboard(currentUrl);
  }, [currentUrl]);

  const closeDebug = useCallback(() => {
    setDebugVisible(false);
  }, []);

  /** 加载播放页并嗅探 m3u8/mp4；新 resolve 会 cancel 前一个进行中的任务 */
  const resolve = useCallback(
    (episodeUrl: string, options: ResolveVideoOptions = {}): Promise<VideoSource> => {
      setMounted(true);

      const useLegacyParser = options.useLegacyParser ?? false;
      const offset = options.offset ?? 0;
      const timeoutMs = options.timeoutMs ?? DEFAULT_RESOLVE_TIMEOUT_MS;

      setUserAgent(options.userAgent);
      setDebugVisible(options.debug ?? false);
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
    <View
      style={debugVisible ? styles.hostDebug : styles.host}
      pointerEvents={debugVisible ? 'auto' : 'none'}
    >
      {debugVisible ? (
        <View style={styles.debugBar}>
          <Text style={styles.debugUrl} numberOfLines={1}>
            {currentUrl}
          </Text>
          <Pressable style={styles.closeBtn} onPress={copyUrl}>
            <Text style={styles.closeBtnText}>复制</Text>
          </Pressable>
          <Pressable style={styles.closeBtn} onPress={closeDebug}>
            <Text style={styles.closeBtnText}>关闭</Text>
          </Pressable>
        </View>
      ) : null}
      <WebView
        ref={webViewRef}
        source={{ uri: currentUrl }}
        userAgent={userAgent}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        injectedJavaScriptBeforeContentLoaded={
          pendingRef.current
            ? pendingRef.current.useLegacyParser
              ? buildLegacyOnLoadStopScript()
              : buildModernOnLoadStartScript()
            : undefined
        }
        injectedJavaScriptBeforeContentLoadedForMainFrameOnly={true}
        injectedJavaScriptForMainFrameOnly={true}
        allowsInlineMediaPlayback
        sharedCookiesEnabled
        originWhitelist={['*']}
        onLoadStart={(event) => {
          console.log(
            '[VideoSniffer][webview][load-start]',
            event.nativeEvent.url,
          );
          const pending = pendingRef.current;
          if (!pending) {
            console.log('[VideoSniffer][webview][load-start][no-pending]');
            return;
          }
          if (!pending.useLegacyParser) {
            injectScripts(false, 'start');
          }
        }}
        onLoadEnd={(event) => {
          console.log(
            '[VideoSniffer][webview][load-end]',
            event.nativeEvent.url,
          );
          const pending = pendingRef.current;
          if (!pending) {
            console.log('[VideoSniffer][webview][load-end][no-pending]');
            return;
          }
          injectScripts(pending.useLegacyParser, 'stop');
        }}
        onError={(event) => {
          console.warn('[VideoSniffer][webview][load-error]', event.nativeEvent);
          rejectPending(new VideoSourceNotFoundError('WebView load error'));
        }}
        onHttpError={(event) => {
          console.warn('[VideoSniffer][webview][http-error]', event.nativeEvent);
          rejectPending(new VideoSourceNotFoundError('WebView HTTP error'));
        }}
        
        style={debugVisible ? styles.webviewDebug : styles.webview}
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
  hostDebug: {
    // ...StyleSheet.absoluteFill,
    bottom: 0,
    height: '50%',
    zIndex: 9999,
    backgroundColor: '#000',
  },
  debugBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#1a1a1a',
  },
  debugUrl: {
    flex: 1,
    color: '#aaa',
    fontSize: 12,
  },
  closeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#333',
  },
  closeBtnText: {
    color: '#fff',
    fontSize: 14,
  },
  webview: {
    width: 360,
    height: 640,
  },
  webviewDebug: {
    flex: 1,
  },
});
