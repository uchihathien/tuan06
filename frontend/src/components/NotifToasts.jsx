export default function NotifToasts({ notifications, onDismiss }) {
  if (!notifications.length) return null;

  return (
    <div className="notif-panel">
      {notifications.slice(0, 5).map((n, i) => (
        <div key={n.id ?? i} className={`notif-toast ${n.type}`}>
          <button className="notif-toast-close" onClick={() => onDismiss(n.id)}>✕</button>
          <p className="notif-msg">{n.message}</p>
          <p className="notif-time">
            {new Date(n.timestamp).toLocaleTimeString('vi-VN')}
          </p>
        </div>
      ))}
    </div>
  );
}
