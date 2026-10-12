import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { LoaderCircle, X } from 'lucide-react';
import type { CloudUser } from '../sync-types';
import '../cloud.css';

export function AccountDialog({ user, busy, error, syncSummary, onSignIn, onSignOut, onRetry, onClose }: {
  user: CloudUser | null;
  busy: boolean;
  error: string;
  syncSummary: string;
  onSignIn: () => void;
  onSignOut: () => void;
  onRetry: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    opener.current ??= document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current?.showModal();
    return () => {
      queueMicrotask(() => {
        const openDialog = [...document.querySelectorAll('dialog[open]')].at(-1);
        if (opener.current?.isConnected && (!openDialog || openDialog.contains(opener.current))) opener.current.focus({ preventScroll: true });
      });
    };
  }, []);

  return createPortal(<dialog ref={dialog} className="cloud-dialog account-dialog" aria-labelledby="account-dialog-title" aria-describedby="account-dialog-description"
    onCancel={event => { event.preventDefault(); onClose(); }} onClose={onClose}
    onClick={event => {
      if (event.target !== dialog.current) return;
      const rect = dialog.current.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
    }}>
    <div className="cloud-dialog-heading"><h2 id="account-dialog-title">계정</h2><button className="icon-button" onClick={onClose} aria-label="계정 창 닫기"><X size={20} /></button></div>
    <p id="account-dialog-description" className="cloud-dialog-description">Google 계정으로 로그인하면 국내·해외 티어와 선택한 곡을 다른 기기에서도 이어서 볼 수 있습니다.</p>
    {user && <div className="cloud-user"><p>{user.name || user.email || 'Google 계정'}</p>{user.email && user.name !== user.email && <p className="cloud-caption">{user.email}</p>}</div>}
    {!!syncSummary && <p className="cloud-sync-summary" role="status" aria-live="polite">{busy && <LoaderCircle size={16} className="spin" aria-hidden="true" />}<span>{syncSummary}</span></p>}
    {!!error && <div className="cloud-dialog-error" role="alert"><p>{error}</p><button className="cloud-text-button" onClick={onRetry} disabled={busy}>다시 시도</button></div>}
    <div className="cloud-dialog-actions">
      {user ? <button className="cloud-secondary-button" onClick={onSignOut} disabled={busy}>로그아웃</button>
        : <button className="cloud-primary-button" onClick={onSignIn} disabled={busy}>{busy ? '로그인 중' : 'Google로 로그인'}</button>}
    </div>
    <p className="cloud-caption">{user ? '계정에 저장된 티어는 로그아웃 후에도 유지됩니다.' : '로그인 전의 티어는 이 브라우저에 저장됩니다.'}</p>
  </dialog>, document.body);
}
