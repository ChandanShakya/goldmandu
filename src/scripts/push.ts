/** Web Push subscribe UI — requires PUBLIC_VAPID_KEY at build time. */

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function getVapidKey(): string | null {
  const key = import.meta.env.PUBLIC_VAPID_KEY as string | undefined;
  return key && key.length > 10 ? key : null;
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  return navigator.serviceWorker.ready;
}

async function isSubscribed(): Promise<boolean> {
  const reg = await getRegistration();
  if (!reg) return false;
  const sub = await reg.pushManager.getSubscription();
  return !!sub;
}

async function subscribe(): Promise<void> {
  const vapid = getVapidKey();
  if (!vapid) {
    throw new Error('PUBLIC_VAPID_KEY not set at build time');
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission denied');
  }
  const reg = await getRegistration();
  if (!reg) throw new Error('Service worker not ready');

  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ||
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid) as BufferSource,
    }));

  const res = await fetch('/api/subscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(sub.toJSON()),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Subscribe failed (${res.status})`);
  }
}

export function initPushUi(): void {
  const btn = document.getElementById('btn-push');
  const status = document.getElementById('push-status');
  if (!btn || !status) return;

  const setStatus = (text: string) => {
    status.textContent = text;
  };

  const refresh = async () => {
    if (!('Notification' in window) || !getVapidKey()) {
      btn.hidden = true;
      setStatus('Push not available (missing key or browser support).');
      return;
    }
    if (Notification.permission === 'denied') {
      btn.hidden = true;
      setStatus('Notifications blocked in browser settings.');
      return;
    }
    const on = await isSubscribed();
    btn.textContent = on ? 'Disable alerts' : 'Enable daily alerts';
    setStatus(
      on
        ? 'Daily rate alerts are on.'
        : 'Get today’s gold & silver rate as a notification.',
    );
  };

  btn.addEventListener('click', async () => {
    btn.setAttribute('disabled', 'true');
    try {
      const on = await isSubscribed();
      if (on) {
        const reg = await getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        if (sub) {
          await fetch('/api/subscribe', {
            method: 'DELETE',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
          await sub.unsubscribe();
        }
        setStatus('Daily alerts disabled.');
      } else {
        await subscribe();
        setStatus('Daily rate alerts are on.');
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Could not enable alerts.');
    } finally {
      btn.removeAttribute('disabled');
      await refresh();
    }
  });

  void refresh();
}
