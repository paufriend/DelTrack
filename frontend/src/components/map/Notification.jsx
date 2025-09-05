import React from 'react';

const notificationContainerStyle = {
  position: 'fixed',
  top: '80px',
  right: '20px',
  zIndex: 1001,
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
};

const notificationStyle = {
  background: '#ffc107', // Amarillo de alerta
  color: '#333',
  padding: '12px 18px',
  borderRadius: '5px',
  boxShadow: '0 3px 10px rgba(0,0,0,0.2)',
  opacity: 0.95,
  transition: 'opacity 0.5s ease-in-out',
  minWidth: '250px',
};

const Notification = ({ notifications }) => {
  if (!notifications || notifications.length === 0) {
    return null;
  }

  return (
    <div style={notificationContainerStyle}>
      {notifications.map(notif => (
        <div key={notif.id} style={notificationStyle}>
          {notif.message}
        </div>
      ))}
    </div>
  );
};

export default Notification;
