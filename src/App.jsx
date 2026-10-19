import { useState, useEffect } from 'react'
import { db } from './firebase'
import { doc, getDoc, setDoc, onSnapshot, collection, addDoc, query, orderBy, limit } from 'firebase/firestore'

async function hashPassword(password) {
  const msgBuffer = new TextEncoder().encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

function App() {
  const [userName, setUserName] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [selectedTime, setSelectedTime] = useState('09:00 - 10:00')
  const [filterType, setFilterType] = useState('all')
  const [activeTab, setActiveTab] = useState('book')
  
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('office_theme') === 'dark'
  })
  
  const [authMode, setAuthMode] = useState('login')
  const [regName, setRegName] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [loginName, setLoginName] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [forgotName, setForgotName] = useState('')
  const [forgotNewPassword, setForgotNewPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authSuccess, setAuthSuccess] = useState('')

  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [showRegPassword, setShowRegPassword] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)

  const [editingResourceId, setEditingResourceId] = useState(null)
  const [editingResourceName, setEditingResourceName] = useState('')
  const [newTimeSlot, setNewTimeSlot] = useState('')
  const [adminLogs, setAdminLogs] = useState([])
  const [timeSlots, setTimeSlots] = useState(['09:00 - 10:00', '10:00 - 11:00', '11:00 - 12:00', '13:00 - 14:00', '14:00 - 15:00', '15:00 - 16:00'])
  const [resources, setResources] = useState([
    { id: 1, name: 'Переговорная Альфа', type: 'room', bookings: {} },
    { id: 2, name: 'Переговорная Бета', type: 'room', bookings: {} },
    { id: 3, name: 'Рабочее место №1', type: 'desk', bookings: {} },
    { id: 4, name: 'Рабочее место №2', type: 'desk', bookings: {} },
    { id: 5, name: 'Рабочее место №3', type: 'desk', bookings: {} },
  ])

  useEffect(() => {
    const unsubBookings = onSnapshot(doc(db, "office", "bookings"), (docSnap) => {
      if (docSnap.exists()) setResources(docSnap.data().data)
      else setDoc(doc(db, "office", "bookings"), { data: resources })
    })
    const unsubSlots = onSnapshot(doc(db, "office", "slots"), (docSnap) => {
      if (docSnap.exists()) setTimeSlots(docSnap.data().data)
      else setDoc(doc(db, "office", "slots"), { data: timeSlots })
    })
    
    const q = query(collection(db, "logs"), orderBy("timestamp", "desc"), limit(10))
    const unsubLogs = onSnapshot(q, (querySnapshot) => {
      const logsArr = []
      querySnapshot.forEach((documentItem) => {
        logsArr.push({ id: documentItem.id, ...documentItem.data() })
      })
      setAdminLogs(logsArr)
    })

    return () => { unsubBookings(); unsubSlots(); unsubLogs(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    localStorage.setItem('office_theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  useEffect(() => {
    const styleSheet = document.createElement("style")
    styleSheet.innerText = `
      html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow-x: hidden; }
      @keyframes gradientBg {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      .dynamic-bg-container {
        background: linear-gradient(-45deg, #0f172a, #1e1b4b, #1d4ed8, #2563eb, #4338ca, #0f172a);
        background-size: 400% 400%;
        animation: gradientBg 12s ease infinite;
        min-height: 100vh; width: 100%; display: flex; align-items: center; justifyContent: center; padding: 20px; box-sizing: border-box;
      }
      .volume-btn:active, .time-chip:active, .tab-btn:active, .theme-toggle-btn:active { transform: translateY(2px) !important; box-shadow: 0 2px 4px rgba(0,0,0,0.2) !important; }
      .logout-btn:active { transform: translateY(2px) !important; box-shadow: 0 1px 0 #991b1b, 0 3px 6px rgba(0,0,0,0.2) !important; }
      .neon-input:focus { border-color: #3b82f6 !important; box-shadow: 0 0 10px rgba(59,130,246,0.5) !important; }
      .map-element { transition: all 0.3s ease; cursor: pointer; }
      .map-element:hover { filter: brightness(1.2); transform: scale(1.02); }
    `
    document.head.appendChild(styleSheet)
    return () => document.head.removeChild(styleSheet)
  }, [])
  const createAdminIfNeeded = async () => {
    const adminRef = doc(db, "users", "Администратор")
    const adminSnap = await getDoc(adminRef)
    if (!adminSnap.exists()) {
      const hashedAdminPassword = await hashPassword("admin123")
      await setDoc(adminRef, { password: hashedAdminPassword })
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setAuthError(''); setAuthSuccess('')
    const nameTrimmed = regName.trim()
    if (nameTrimmed === 'Администратор') { setAuthError('Имя зарезервировано'); return }
    const nameParts = nameTrimmed.split(/\s+/)
    if (nameParts.length !== 2) { setAuthError('Введите Имя и Отчество через пробел'); return }
    if (/\d/.test(nameTrimmed) || /[^А-Яа-яЁёA-Za-z\s]/.test(nameTrimmed)) { setAuthError('Допустимы только буквы'); return }
    if (regPassword.length < 6) { setAuthError('Пароль от 6 символов'); return }

    const userDocRef = doc(db, "users", nameTrimmed)
    const userSnap = await getDoc(userDocRef)
    if (userSnap.exists()) { setAuthError('Пользователь уже существует'); return }

    const hashedPassword = await hashPassword(regPassword)
    await setDoc(userDocRef, { password: hashedPassword })
    
    await addDoc(collection(db, "logs"), { text: `Зарегистрирован новый сотрудник: ${nameTrimmed}`, timestamp: new Date().getTime() })
    
    setAuthSuccess('Успешно!'); setAuthMode('login'); setLoginName(''); setLoginPassword(''); setRegName(''); setRegPassword('')
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setAuthError(''); setAuthSuccess('')
    const nameTrimmed = loginName.trim()
    await createAdminIfNeeded()
    const hashedInputPassword = await hashPassword(loginPassword)

    if (nameTrimmed === 'Администратор' && loginPassword === 'admin123') {
      setUserName(nameTrimmed); setIsAdmin(true); setIsLoggedIn(true); setLoginPassword(''); setLoginName(''); setActiveTab('book'); return
    }

    const userDocRef = doc(db, "users", nameTrimmed)
    const userSnap = await getDoc(userDocRef)
    if (!userSnap.exists() || userSnap.data().password !== hashedInputPassword) { setAuthError('Неверные данные'); return }
    setUserName(nameTrimmed); setIsAdmin(false); setIsLoggedIn(true); setLoginPassword(''); setLoginName(''); setActiveTab('book')
  }
  const handleResetPassword = async (e) => {
    e.preventDefault()
    setAuthError(''); setAuthSuccess('')
    const nameTrimmed = forgotName.trim()
    if (nameTrimmed === 'Администратор') { setAuthError('Нельзя сбросить админа'); return }
    if (forgotNewPassword.length < 6) { setAuthError('Пароль от 6 символов'); return }

    const userDocRef = doc(db, "users", nameTrimmed)
    const userSnap = await getDoc(userDocRef)
    if (!userSnap.exists()) { setAuthError('Не найден'); return }

    const hashedNewPassword = await hashPassword(forgotNewPassword)
    await setDoc(userDocRef, { password: hashedNewPassword })
    
    await addDoc(collection(db, "logs"), { text: `Пользователь ${nameTrimmed} обновил пароль`, timestamp: new Date().getTime() })
    
    setAuthSuccess('Пароль изменен!'); setAuthMode('login'); setLoginName(''); setLoginPassword(''); setForgotName(''); setForgotNewPassword('')
  }

  const toggleBookResource = async (id, specificTime = selectedTime) => {
    let logMessage = ""

    const updated = resources.map(item => {
      if (item.id === id) {
        const currentBooking = item.bookings[specificTime]
        const updatedBookings = { ...item.bookings }
        if (!currentBooking) {
          updatedBookings[specificTime] = userName
          logMessage = `${userName} забронировал место "${item.name}" на время ${specificTime}`
        } else if (currentBooking === userName || isAdmin) {
          delete updatedBookings[specificTime]
          logMessage = isAdmin && currentBooking !== userName 
            ? `Администратор принудительно освободил "${item.name}" (было занято: ${currentBooking}) на ${specificTime}`
            : `${userName} отменил бронь места "${item.name}" на время ${specificTime}`
        }
        return { ...item, bookings: updatedBookings }
      }
      return item
    })
    setResources(updated)
    await setDoc(doc(db, "office", "bookings"), { data: updated })
    if (logMessage) {
      await addDoc(collection(db, "logs"), { text: logMessage, timestamp: new Date().getTime() })
    }
  }

  const saveResourceName = async (id) => {
    if (editingResourceName.trim() === '') return
    const target = resources.find(r => r.id === id)
    const targetName = target ? target.name : `Ресурс №${id}`
    const updated = resources.map(item => item.id === id ? { ...item, name: editingResourceName.trim() } : item)
    setResources(updated); setEditingResourceId(null)
    await setDoc(doc(db, "office", "bookings"), { data: updated })
    await addDoc(collection(db, "logs"), { text: `Админ переименовал зону "${targetName}" в "${editingResourceName.trim()}"`, timestamp: new Date().getTime() })
  }

  const addTimeSlot = async (e) => {
    e.preventDefault()
    if (newTimeSlot.trim() === '' || timeSlots.includes(newTimeSlot.trim())) return
    const updated = [...timeSlots, newTimeSlot.trim()]
    setTimeSlots(updated); setNewTimeSlot('')
    await setDoc(doc(db, "office", "slots"), { data: updated })
    await addDoc(collection(db, "logs"), { text: `Админ добавил новый временной слот: ${newTimeSlot.trim()}`, timestamp: new Date().getTime() })
  }

  const switchMode = (mode) => { setAuthError(''); setAuthSuccess(''); setAuthMode(mode) }

  const renderEyeIcon = (visible, onClickAction) => (
    <div onClick={onClickAction} style={{ ...styles.eyeWrapper, backgroundColor: darkMode ? '#1e293b' : '#ffffff', borderColor: darkMode ? '#334155' : '#e2e8f0' }}>
      <svg style={styles.eyeSvg} viewBox="0 0 24 24" fill="none" stroke={visible ? '#2563eb' : '#a0a0a0'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3" fill={visible ? 'rgba(37,99,235,0.15)' : 'none'}/>
        {!visible && <line x1="1" y1="1" x2="23" y2="23" />}
      </svg>
    </div>
  )

  const myBookings = []
  resources.forEach(res => {
    Object.keys(res.bookings).forEach(time => {
      if (res.bookings[time] === userName) myBookings.push({ resourceId: res.id, name: res.name, type: res.type, time })
    })
  })

  const filteredResources = resources.filter(res => filterType === 'all' || res.type === filterType)
  const themeContainerStyle = { ...styles.mobileContainer, backgroundColor: darkMode ? 'rgba(15, 23, 42, 0.88)' : 'rgba(255, 255, 255, 0.82)', border: darkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.25)', boxShadow: darkMode ? '0 30px 60px rgba(0,0,0,0.6)' : '0 30px 60px rgba(0,0,0,0.25)' }
  const themeTitleStyle = { ...styles.title, color: darkMode ? '#f8fafc' : '#0f172a' }
  const themeInputStyle = { ...styles.input, backgroundColor: darkMode ? 'rgba(30, 41, 59, 0.5)' : 'rgba(255,255,255,0.6)', color: darkMode ? '#f8fafc' : '#0f172a', borderColor: darkMode ? '#334155' : 'rgba(15,23,42,0.15)' }
  const renderOfficeMap = () => {
    return (
      <div style={styles.mapContainer}>
        <p style={{ ...styles.label, textAlign: 'center', marginBottom: '14px', color: darkMode ? '#94a3b8' : '#334155', fontWeight: '800' }}>🗺️ ИНТЕРАКТИВНЫЙ ПЛАН ЭТАЖА</p>
        <div style={{ ...styles.mapWrapper, backgroundColor: darkMode ? '#020617' : '#1e293b', boxShadow: darkMode ? 'inset 0 4px 20px rgba(0,0,0,0.6), 0 0 15px rgba(59,130,246,0.15)' : 'inset 0 4px 20px rgba(0,0,0,0.2)' }}>
          <svg width="100%" viewBox="0 0 440 220" style={{ display: 'block' }}>
            <defs>
              <linearGradient id="freeGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" /><stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.05" /></linearGradient>
              <linearGradient id="myGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#10b981" stopOpacity="0.4" /><stop offset="100%" stopColor="#059669" stopOpacity="0.1" /></linearGradient>
              <linearGradient id="otherGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#ef4444" stopOpacity="0.35" /><stop offset="100%" stopColor="#991b1b" stopOpacity="0.05" /></linearGradient>
            </defs>
            <rect x="15" y="15" width="410" height="190" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            {resources.map(res => {
              const bookedUser = res.bookings[selectedTime] || null
              const isBookedByMe = bookedUser === userName
              const isBookedByOther = bookedUser !== null && !isBookedByMe
              let fillStyle = "url(#freeGrad)", strokeStyle = "#3b82f6", glowFilter = "drop-shadow(0 2px 8px rgba(59,130,246,0.3))"
              if (isBookedByMe) { fillStyle = "url(#myGrad)"; strokeStyle = "#10b981"; glowFilter = "drop-shadow(0 4px 12px rgba(16,185,129,0.5))" }
              else if (isBookedByOther) { fillStyle = "url(#otherGrad)"; strokeStyle = "#ef4444"; glowFilter = "drop-shadow(0 2px 6px rgba(239,68,68,0.2))" }

              if (res.id === 1 || res.id === 2) {
                const yPos = res.id === 1 ? 25 : 120
                return (
                  <g key={res.id} className="map-element" style={{ filter: glowFilter }} onClick={() => { if (!isBookedByOther || isAdmin) toggleBookResource(res.id) }}>
                    <rect x="25" y={yPos} width="110" height="75" rx="14" fill={fillStyle} stroke={strokeStyle} strokeWidth="2.5" />
                    <text x="80" y={yPos + 37} fill="#ffffff" fontSize="12" fontWeight="800" textAnchor="middle">{res.id === 1 ? 'Альфа 🚪' : 'Бета 🚪'}</text>
                    {bookedUser && <text x="80" y={yPos + 55} fill="rgba(255,255,255,0.6)" fontSize="8" textAnchor="middle">{isBookedByMe ? 'Вы' : 'Занято'}</text>}
                  </g>
                )
              }
              if (res.id === 3 || res.id === 4 || res.id === 5) {
                const xPos = res.id === 3 ? 185 : (res.id === 4 ? 270 : 355)
                return (
                  <g key={res.id} className="map-element" style={{ filter: glowFilter }} onClick={() => { if (!isBookedByOther || isAdmin) toggleBookResource(res.id) }}>
                    <rect x={xPos} y="80" width="60" height="60" rx="16" fill={fillStyle} stroke={strokeStyle} strokeWidth="2.5" />
                    <text x={xPos + 30} y="110" fill="#ffffff" fontSize="11" fontWeight="800" textAnchor="middle">№{res.id - 2} 💻</text>
                    {bookedUser && <text x={xPos + 30} y="126" fill="rgba(255,255,255,0.6)" fontSize="8" textAnchor="middle">{isBookedByMe ? 'Вы' : 'Занято'}</text>}
                  </g>
                )
              }
              return null
            })}
          </svg>
        </div>
      </div>
    )
  }
  if (isLoggedIn) {
    return (
      <div className="dynamic-bg-container">
        <div style={themeContainerStyle}>
          <div style={{ ...styles.header, borderBottom: darkMode ? '1px solid #334155' : '1px solid #e2e8f0' }}>
            <div style={{ ...styles.userBadge, backgroundColor: isAdmin ? '#fef3c7' : (darkMode ? 'rgba(30,41,59,0.8)' : 'rgba(255,255,255,0.6)'), borderColor: isAdmin ? '#f59e0b' : (darkMode ? '#334155' : 'rgba(0,0,0,0.05)') }}>
              <span style={styles.userIcon}>{isAdmin ? '👑' : '👤'}</span>
              <span style={{ ...styles.userNameText, color: isAdmin ? '#b45309' : (darkMode ? '#f8fafc' : '#0f172a') }}>{userName}</span>
            </div>
            <button className="theme-toggle-btn" onClick={() => setDarkMode(!darkMode)} style={{ ...styles.themeToggleBtn, backgroundColor: darkMode ? '#334155' : '#f1f5f9', color: darkMode ? '#f8fafc' : '#1e293b', boxShadow: darkMode ? '0 3px 0 #1e293b' : '0 3px 0 #cbd5e1' }}>{darkMode ? '☀️ Светлая' : '🌙 Тёмная'}</button>
            <button className="logout-btn" style={styles.logoutButton} onClick={() => setIsLoggedIn(false)}>Выйти</button>
          </div>

          <div style={{ ...styles.tabContainer, borderBottom: darkMode ? '1px solid #334155' : '1px solid #e2e8f0' }}>
            <button className="tab-btn" onClick={() => setActiveTab('book')} style={{ ...styles.tabButton, backgroundColor: activeTab === 'book' ? '#2563eb' : 'transparent', color: activeTab === 'book' ? '#fff' : (darkMode ? '#94a3b8' : '#475569'), boxShadow: activeTab === 'book' ? '0 4px 0 #1d4ed8, 0 4px 8px rgba(37,99,235,0.2)' : 'none' }}>🛡️ Бронирование</button>
            <button className="tab-btn" onClick={() => setActiveTab('profile')} style={{ ...styles.tabButton, backgroundColor: activeTab === 'profile' ? '#2563eb' : 'transparent', color: activeTab === 'profile' ? '#fff' : (darkMode ? '#94a3b8' : '#475569'), boxShadow: activeTab === 'profile' ? '0 4px 0 #1d4ed8, 0 4px 8px rgba(37,99,235,0.2)' : 'none' }}>{isAdmin ? '📋 Логи системы' : `💼 Мои брони (${myBookings.length})`}</button>
          </div>

          {activeTab === 'book' ? (
            <>
              <h2 style={{ ...styles.sectionTitle, color: darkMode ? '#f8fafc' : '#0f172a' }}>{isAdmin ? 'Панель Управления' : 'Доступные места'}</h2>
              {isAdmin && (
                <form onSubmit={addTimeSlot} style={{ ...styles.form, marginBottom: '24px', padding: '16px', backgroundColor: darkMode ? '#1e293b' : '#f8fafc', borderRadius: '16px', border: darkMode ? '1px solid #334155' : '1px solid #e2e8f0' }}>
                  <label style={{ ...styles.label, color: darkMode ? '#94a3b8' : '#475569' }}>Добавить интервал:</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input type="text" placeholder="17:00 - 18:00" value={newTimeSlot} onChange={(e) => setNewTimeSlot(e.target.value)} style={themeInputStyle} />
                    <button type="submit" className="volume-btn" style={{ ...styles.button, width: 'auto', padding: '10px 20px' }}>+</button>
                  </div>
                </form>
              )}

              <div style={styles.filterContainer}>
                <button className="time-chip" onClick={() => setFilterType('all')} style={{ ...styles.filterChip, backgroundColor: filterType === 'all' ? '#2563eb' : (darkMode ? '#1e293b' : '#f1f5f9'), color: filterType === 'all' ? '#ffffff' : (darkMode ? '#94a3b8' : '#1e293b') }}>🔍 Все</button>
                <button className="time-chip" onClick={() => setFilterType('room')} style={{ ...styles.filterChip, backgroundColor: filterType === 'room' ? '#2563eb' : (darkMode ? '#1e293b' : '#f1f5f9'), color: filterType === 'room' ? '#ffffff' : (darkMode ? '#94a3b8' : '#1e293b') }}>🚪 Переговорные</button>
                <button className="time-chip" onClick={() => setFilterType('desk')} style={{ ...styles.filterChip, backgroundColor: filterType === 'desk' ? '#2563eb' : (darkMode ? '#1e293b' : '#f1f5f9'), color: filterType === 'desk' ? '#ffffff' : (darkMode ? '#94a3b8' : '#1e293b') }}>💻 Столы</button>
              </div>

              <div style={styles.timeSelectorContainer}>
                <label style={{ ...styles.label, color: darkMode ? '#94a3b8' : '#334155' }}>Выберите время:</label>
                <div style={styles.chipsWrapper}>
                  {timeSlots.map(slot => {
                    const isSelected = selectedTime === slot
                    return <div key={slot} className="time-chip" onClick={() => setSelectedTime(slot)} style={{ ...styles.timeChip, backgroundColor: isSelected ? '#2563eb' : (darkMode ? 'rgba(30,41,59,0.5)' : 'rgba(255,255,255,0.7)'), color: isSelected ? '#ffffff' : (darkMode ? '#94a3b8' : '#1e293b'), borderColor: isSelected ? '#1d4ed8' : (darkMode ? '#334155' : '#cbd5e1'), boxShadow: isSelected ? '0 4px 0 #1d4ed8, 0 6px 10px rgba(37,99,235,0.3)' : (darkMode ? '0 3px 0 #334155' : '0 3px 0 #cbd5e1, 0 4px 6px rgba(0,0,0,0.05)') }}>{slot}</div>
                  })}
                </div>
              </div>

              {renderOfficeMap()}
              <div style={styles.resourceList}>
                {filteredResources.map(item => {
                  const bookedUser = item.bookings[selectedTime] || null
                  const isBookedByMe = bookedUser === userName
                  const isBookedByOther = bookedUser !== null && !isBookedByMe
                  const isEditing = editingResourceId === item.id
                  return (
                    <div key={item.id} style={{ ...styles.resourceCard, borderColor: isBookedByOther ? '#ffebee' : (isBookedByMe ? '#e8f5e9' : (darkMode ? '#334155' : 'rgba(255,255,255,0.4)')), backgroundColor: isBookedByOther ? (darkMode ? '#1e293b' : '#fafafa') : (darkMode ? 'rgba(30,41,59,0.4)' : 'rgba(255,255,255,0.85)') }}>
                      <div style={{ flex: 1, marginRight: '10px' }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><input type="text" value={editingResourceName} onChange={(e) => setEditingResourceName(e.target.value)} style={themeInputStyle} /><button className="volume-btn" onClick={() => saveResourceName(item.id)} style={{ ...styles.button, width: 'auto', padding: '6px 12px', backgroundColor: '#10b981', boxShadow: '0 3px 0 #047857' }}>✓</button></div>
                        ) : (
                          <div style={{ ...styles.resourceName, color: darkMode ? '#f8fafc' : '#0f172a' }} onClick={() => { if (isAdmin) { setEditingResourceId(item.id); setEditingResourceName(item.name); } }}>{item.type === 'room' ? '🚪' : '💻'} {item.name} {isAdmin && <span style={{ fontSize: '12px', color: '#3b82f6', marginLeft: '6px' }}>✏️</span>}</div>
                        )}
                        <div style={{ ...styles.statusText, color: isBookedByOther ? '#ef4444' : isBookedByMe ? '#10b981' : (darkMode ? '#94a3b8' : '#475569') }}>{isBookedByOther ? `Занято: ${bookedUser}` : isBookedByMe ? 'Забронировано вами' : 'Свободно'}</div>
                      </div>
                      {!isEditing && <button className="volume-btn" disabled={isBookedByOther && !isAdmin} onClick={() => toggleBookResource(item.id)} style={{ ...styles.bookButton, backgroundColor: isBookedByOther ? (isAdmin ? '#ef4444' : '#cbd5e1') : isBookedByMe ? '#ef4444' : '#10b981', boxShadow: (isBookedByOther && !isAdmin) ? 'none' : isBookedByMe || (isBookedByOther && isAdmin) ? '0 5px 0 #b91c1c, 0 8px 15px rgba(239,68,68,0.3)' : '0 5px 0 #047857, 0 8px 15px rgba(16,185,129,0.3)', cursor: (isBookedByOther && !isAdmin) ? 'not-allowed' : 'pointer', color: (isBookedByOther && !isAdmin) ? '#94a3b8' : '#ffffff' }}>{isBookedByMe ? 'Отмена' : isBookedByOther && isAdmin ? 'Сброс' : 'Занять'}</button>}
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <>
              <h2 style={{ ...styles.sectionTitle, color: darkMode ? '#f8fafc' : '#0f172a' }}>{isAdmin ? '📋 Логи активности (Firebase)' : 'Мой Личный Кабинет'}</h2>
              {isAdmin ? (
                <div style={{ ...styles.resourceList, maxHeight: '350px', overflowY: 'auto', padding: '10px', backgroundColor: darkMode ? '#020617' : '#f8fafc', borderRadius: '16px' }}>
                  {adminLogs.map((log) => (
                    <div key={log.id} style={{ padding: '10px 14px', borderRadius: '10px', backgroundColor: darkMode ? '#1e293b' : '#ffffff', border: darkMode ? '1px solid #334155' : '1px solid #e2e8f0', color: darkMode ? '#e2e8f0' : '#1e293b', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>
                      ⚡ {log.text}
                    </div>
                  ))}
                </div>
              ) : (
                myBookings.length === 0 ? <div style={{ textAlign: 'center', color: '#64748b', padding: '40px 0' }}>Нет активных броней 🗓️</div> : (
                  <div style={styles.resourceList}>{myBookings.map((booking, idx) => (
                    <div key={idx} style={{ ...styles.resourceCard, borderColor: darkMode ? '#334155' : '#e2e8f0', backgroundColor: darkMode ? '#1e293b' : '#f8fafc' }}>
                      <div><div style={{ ...styles.resourceName, color: darkMode ? '#f8fafc' : '#0f172a' }}>{booking.type === 'room' ? '🚪' : '💻'} {booking.name}</div><div style={{ ...styles.statusText, color: '#3b82f6', fontWeight: '700' }}>⏰ {booking.time}</div></div>
                      <button className="volume-btn" onClick={() => toggleBookResource(booking.resourceId, booking.time)} style={{ ...styles.bookButton, backgroundColor: '#ef4444', boxShadow: '0 4px 0 #b91c1c' }}>Отмена</button>
                    </div>
                  ))}</div>
                )
              )}
            </>
          )}
        </div>
      </div>
    )
  }
  return (
    <div className="dynamic-bg-container">
      <div style={themeContainerStyle}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
          <button className="theme-toggle-btn" onClick={() => setDarkMode(!darkMode)} style={{ ...styles.themeToggleBtn, backgroundColor: darkMode ? '#334155' : '#f1f5f9', color: darkMode ? '#f8fafc' : '#0f172a', boxShadow: darkMode ? '0 3px 0 #1e293b' : '0 3px 0 #cbd5e1' }}>{darkMode ? '☀️ Светлая' : '🌙 Тёмная'}</button>
        </div>
        {authError && <div style={styles.errorBanner}>{authError}</div>}
        {authSuccess && <div style={styles.successBanner}>{authSuccess}</div>}

        {authMode === 'login' && (
          <>
            <h2 style={themeTitleStyle}>Вход в систему</h2>
            <form onSubmit={handleLogin} style={styles.form} autoComplete="off">
              <input type="text" className="neon-input" placeholder="Имя Отчество" value={loginName} onChange={(e) => setLoginName(e.target.value)} style={themeInputStyle} required autoComplete="none"/>
              <div style={styles.passwordWrapper}>
                <input type={showLoginPassword ? 'text' : 'password'} className="neon-input" placeholder="Пароль" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} style={{ ...themeInputStyle, paddingRight: '54px' }} required autoComplete="new-password"/>
                {renderEyeIcon(showLoginPassword, () => setShowLoginPassword(!showLoginPassword))}
              </div>
              <button type="submit" className="volume-btn" style={styles.button}>Войти</button>
            </form>
            <div style={styles.linksContainer}><span style={styles.link} onClick={() => switchMode('register')}>Регистрация</span><span style={styles.link} onClick={() => switchMode('forgot')}>Забыли пароль?</span></div>
          </>
        )}

        {authMode === 'register' && (
          <>
            <h2 style={themeTitleStyle}>Регистрация</h2>
            <form onSubmit={handleRegister} style={styles.form} autoComplete="off">
              <input type="text" className="neon-input" placeholder="Имя Отчество" value={regName} onChange={(e) => setRegName(e.target.value)} style={themeInputStyle} required autoComplete="none"/>
              <div style={styles.passwordWrapper}>
                <input type={showRegPassword ? 'text' : 'password'} className="neon-input" placeholder="Пароль (минимум 6 символов)" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} style={{ ...themeInputStyle, paddingRight: '54px' }} required autoComplete="new-password"/>
                {renderEyeIcon(showRegPassword, () => setShowRegPassword(!showRegPassword))}
              </div>
              <button type="submit" className="volume-btn" style={styles.button}>Создать аккаунт</button>
            </form>
            <div style={styles.linksContainer}><span style={styles.link} onClick={() => switchMode('login')}>Уже есть аккаунт? Войти</span></div>
          </>
        )}

        {authMode === 'forgot' && (
          <>
            <h2 style={themeTitleStyle}>Сброс пароля</h2>
            <form onSubmit={handleResetPassword} style={styles.form} autoComplete="off">
              <input type="text" className="neon-input" placeholder="Введите ваше Имя Отчество" value={forgotName} onChange={(e) => setForgotName(e.target.value)} style={themeInputStyle} required autoComplete="none"/>
              <div style={styles.passwordWrapper}>
                <input type={showForgotPassword ? 'text' : 'password'} className="neon-input" placeholder="Новый пароль" value={forgotNewPassword} onChange={(e) => setForgotNewPassword(e.target.value)} style={{ ...themeInputStyle, paddingRight: '54px' }} required autoComplete="new-password"/>
                {renderEyeIcon(showForgotPassword, () => setShowForgotPassword(!showForgotPassword))}
              </div>
              <button type="submit" className="volume-btn" style={styles.button}>Обновить пароль</button>
            </form>
            <div style={styles.linksContainer}><span style={styles.link} onClick={() => switchMode('login')}>Вернуться ко входу</span></div>
          </>
        )}
      </div>
    </div>
  )
}

const styles = {
  mobileContainer: { width: '100%', maxWidth: '580px', margin: '0 auto', padding: '32px', borderRadius: '24px', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', boxSizing: 'border-box', backdropFilter: 'blur(20px)' },
  title: { fontSize: '28px', marginBottom: '24px', textAlign: 'center', fontWeight: '800', textShadow: '0 2px 4px rgba(255,255,255,0.1)' },
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  input: { padding: '14px 18px', borderRadius: '12px', border: '1px solid', fontSize: '16px', outline: 'none', width: '100%', boxSizing: 'border-box', transition: 'all 0.2s ease' },
  passwordWrapper: { position: 'relative', display: 'flex', alignItems: 'center', width: '100%', boxSizing: 'border-box' },
  eyeWrapper: { position: 'absolute', right: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '50%', border: '1px solid', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05), 0 3px 6px rgba(0,0,0,0.1)' },
  eyeSvg: { width: '18px', height: '18px' },
  button: { padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: '#2563eb', color: '#ffffff', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', width: '100%', boxShadow: '0 5px 0 #1d4ed8, 0 8px 15px rgba(37,99,235,0.4)', transition: 'transform 0.1s ease, box-shadow 0.1s ease' },
  linksContainer: { display: 'flex', justifyContent: 'space-between', marginTop: '20px', fontSize: '14px' },
  link: { color: '#2563eb', cursor: 'pointer', textDecoration: 'none', fontWeight: '700' },
  errorBanner: { backgroundColor: 'rgba(254,242,242,0.9)', color: '#991b1b', padding: '14px', borderRadius: '12px', fontSize: '14px', marginBottom: '16px', textAlign: 'center', fontWeight: '600', border: '1px solid #fee2e2' },
  successBanner: { backgroundColor: 'rgba(240,253,244,0.9)', color: '#166534', padding: '14px', borderRadius: '12px', fontSize: '14px', marginBottom: '16px', textAlign: 'center', fontWeight: '600', border: '1px solid #bbf7d0' },
  header: { display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'space-between', marginBottom: '24px', paddingBottom: '16px' },
  userBadge: { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 16px', borderRadius: '12px', border: '1px solid' },
  userIcon: { fontSize: '16px' },
  userNameText: { fontSize: '15px', fontWeight: '700' },
  themeToggleBtn: { padding: '8px 14px', borderRadius: '10px', border: 'none', fontSize: '13px', cursor: 'pointer', fontWeight: '700', transition: 'all 0.1s ease' },
  logoutButton: { padding: '8px 16px', borderRadius: '10px', border: 'none', backgroundColor: '#dc2626', color: '#ffffff', fontSize: '13px', cursor: 'pointer', fontWeight: '700', boxShadow: '0 3px 0 #b91c1c, 0 4px 8px rgba(220,38,38,0.25)', transition: 'all 0.1s ease' },
  sectionTitle: { fontSize: '22px', marginBottom: '20px', textAlign: 'center', fontWeight: '800' },
  tabContainer: { display: 'flex', gap: '10px', marginBottom: '24px', width: '100%', paddingBottom: '10px' },
  tabButton: { flex: 1, padding: '10px', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: '700', transition: 'all 0.1s ease' },
  filterContainer: { display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' },
  filterChip: { padding: '8px 14px', borderRadius: '10px', border: 'none', fontSize: '13px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.1s ease' },
  timeSelectorContainer: { display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' },
  label: { fontSize: '14px', fontWeight: '700' },
  chipsWrapper: { display: 'flex', flexWrap: 'wrap', gap: '10px' },
  timeChip: { padding: '10px 16px', borderRadius: '12px', border: '1px solid', fontSize: '14px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.1s ease', userSelect: 'none' },
  mapContainer: { width: '100%', marginBottom: '24px', boxSizing: 'border-box' },
  mapWrapper: { width: '100%', padding: '16px', borderRadius: '20px', boxSizing: 'border-box', border: '1px solid rgba(255,255,255,0.08)' },
  resourceList: { display: 'flex', flexDirection: 'column', gap: '14px' },
  resourceCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px', border: '1px solid', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', backdropFilter: 'blur(5px)', transition: 'all 0.2s ease' },
  resourceName: { fontSize: '17px', fontWeight: '700', marginBottom: '4px' },
  statusText: { fontSize: '13px', fontWeight: '600' },
  bookButton: { padding: '10px 20px', borderRadius: '12px', border: 'none', color: '#ffffff', fontSize: '14px', fontWeight: '700', minWidth: '90px', transition: 'all 0.1s ease' }
}

export default App
