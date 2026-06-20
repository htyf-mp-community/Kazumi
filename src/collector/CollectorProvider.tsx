/**
 * React Context 层：将 Headless WebView 嗅探器注入 RuleEngine。
 *
 * VideoSnifferHost 以 1×1 透明 View 挂载在 Provider 底部，
 * 仅在 resolve 视频时才真正加载 WebView，避免启动时 native 模块开销。
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type PropsWithChildren,
} from 'react';

import { createRuleEngine, type RuleEngine } from './engine/rule-engine';
import { VideoSnifferHost, type VideoSnifferHostRef } from './webview';
import type { VideoSniffer } from './webview/video-sniffer-types';

export type CollectorContextValue = {
  /** 由 VideoSnifferHost 在 mount 时调用，注册嗅探器实例；传 null 表示卸载 */
  bindSniffer: (sniffer: VideoSniffer | null) => void;
  /** 基于当前已绑定的嗅探器创建 RuleEngine；未绑定时 resolveVideo 不可用 */
  getRuleEngine: () => RuleEngine;
};

const CollectorContext = createContext<CollectorContextValue | null>(null);

export function CollectorProvider({ children }: PropsWithChildren) {
  const snifferRef = useRef<VideoSniffer | null>(null);

  const bindSniffer = useCallback((sniffer: VideoSniffer | null) => {
    snifferRef.current = sniffer;
  }, []);

  const getRuleEngine = useCallback(
    () => createRuleEngine(snifferRef.current ?? undefined),
    [],
  );

  const value = useMemo<CollectorContextValue>(
    () => ({ bindSniffer, getRuleEngine }),
    [bindSniffer, getRuleEngine],
  );

  return (
    <CollectorContext.Provider value={value}>
      {children}
      <VideoSnifferHost ref={bindSniffer as React.Ref<VideoSnifferHostRef>} />
    </CollectorContext.Provider>
  );
}

/** 必须在 CollectorProvider 子树内使用 */
export function useCollector(): CollectorContextValue {
  const context = useContext(CollectorContext);
  if (!context) {
    throw new Error('useCollector must be used within CollectorProvider');
  }
  return context;
}
